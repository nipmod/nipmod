import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, chmod, copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DEFAULT_GITLAWB_NODE } from "./gitlawb.js";
import { readResponseBytes, readResponseText } from "./http.js";

const DEFAULT_RELEASE_BASE_URL = "https://github.com/gitlawb/releases/releases/download";
const DEFAULT_LATEST_API_URL = "https://api.github.com/repos/gitlawb/releases/releases/latest";
const PINNED_GITLAWB_RELEASE_VERSION = "v0.3.8";
const PINNED_GITLAWB_RELEASE_DIGESTS: Record<string, Record<string, string>> = {
  "v0.3.8": {
    "aarch64-apple-darwin": "e0a6f216a87e43a3f8a606e73c6e3e340ac62eb5a9dc5058bdabb6a0ae0de30a",
    "aarch64-unknown-linux-musl": "b501533183bc1805475de5af33edfdc5a9e82f0409541ddfad6bc0149a87870a",
    "x86_64-apple-darwin": "760bcb2aa9bfa44457d689843111706aed8b6563387acbdb3bd1b59bd2bbb97a",
    "x86_64-unknown-linux-musl": "196e23797c7ea91eda2f91d17fcaed7fe5b69adb43b8715727bd10e362675cff"
  }
};
const HELPER_NAME = "git-remote-gitlawb";
const HELPER_REAL_NAME = "git-remote-gitlawb.real";
const MAX_RELEASE_ARCHIVE_BYTES = 100 * 1024 * 1024;
const MAX_RELEASE_METADATA_BYTES = 16 * 1024;
const RELEASE_FETCH_TIMEOUT_MS = 30_000;

export interface SetupGitlawbHelperOptions {
  allowUnpinned?: boolean;
  binDir?: string;
  dryRun?: boolean;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  force?: boolean;
  latestApiUrl?: string;
  nodeUrl?: string;
  releaseBaseUrl?: string;
  version?: string;
}

export interface SetupGitlawbHelperResult {
  archiveName: string;
  archiveUrl: string;
  binDir: string;
  checksumUrl: string;
  glPath: string;
  helperPath: string;
  helperRealPath: string;
  installed: boolean;
  message: string;
  nodeUrl: string;
  ready: boolean;
  target: string;
  version: string;
}

export async function setupGitlawbHelper(options: SetupGitlawbHelperOptions = {}): Promise<SetupGitlawbHelperResult> {
  const env = options.env ?? process.env;
  const binDir = resolve(options.binDir ?? env.NIPMOD_BIN_DIR ?? join(homedir(), ".local", "bin"));
  const nodeUrl = normalizeNodeUrl(options.nodeUrl ?? env.GITLAWB_NODE ?? DEFAULT_GITLAWB_NODE);
  const target = gitlawbReleaseTarget();
  const version = await gitlawbReleaseVersion(options);
  const archiveName = `gitlawb-${version}-${target}.tar.gz`;
  const archiveUrl = `${trimTrailingSlash(options.releaseBaseUrl ?? DEFAULT_RELEASE_BASE_URL)}/${version}/${archiveName}`;
  const checksumUrl = `${archiveUrl}.sha256`;
  const pinnedDigest = pinnedReleaseDigest(version, target);
  const glPath = join(binDir, "gl");
  const helperPath = join(binDir, HELPER_NAME);
  const helperRealPath = join(binDir, HELPER_REAL_NAME);

  if (options.dryRun === true) {
    return {
      archiveName,
      archiveUrl,
      binDir,
      checksumUrl,
      glPath,
      helperPath,
      helperRealPath,
      installed: false,
      message: [
        `dry run: install verified Gitlawb release ${version}`,
        `archive: ${archiveUrl}`,
        `checksum: ${pinnedDigest ? "pinned by Nipmod" : checksumUrl}`,
        `binary: ${glPath}`,
        `helper: ${helperPath}`,
        `default node: ${nodeUrl}`
      ].join("\n"),
      nodeUrl,
      ready: true,
      target,
      version
    };
  }

  if (options.force !== true) {
    const existing = await installedWrapperStatus(helperPath, helperRealPath, nodeUrl);
    if (existing.ready) {
      return {
        archiveName,
        archiveUrl,
        binDir,
        checksumUrl,
        glPath,
        helperPath,
        helperRealPath,
        installed: false,
        message: `git-remote-gitlawb already installed at ${helperPath}`,
        nodeUrl,
        ready: true,
        target,
        version
      };
    }
  }

  const stage = await mkdtemp(join(tmpdir(), "nipmod-gitlawb-setup-"));
  try {
    const archivePath = join(stage, archiveName);
    const extractDir = join(stage, "extract");
    await mkdir(extractDir, { recursive: true });
    if (!pinnedDigest && options.allowUnpinned !== true) {
      throw new Error(`Gitlawb release ${version} for ${target} is not pinned by Nipmod`);
    }
    const archiveBytes = await fetchBytes(archiveUrl, options.fetchImpl);
    const expectedDigest = pinnedDigest ?? parseSha256(await fetchText(checksumUrl, options.fetchImpl), checksumUrl);
    const actualDigest = createHash("sha256").update(archiveBytes).digest("hex");
    if (expectedDigest !== actualDigest) {
      throw new Error(`Gitlawb release checksum mismatch: expected ${expectedDigest}, got ${actualDigest}`);
    }
    await writeFile(archivePath, archiveBytes);
    await run("tar", ["-xzf", archivePath, "-C", extractDir, "gl", HELPER_NAME]);

    const glSource = join(extractDir, "gl");
    const helperSource = join(extractDir, HELPER_NAME);
    await assertExecutablePayload(glSource, "gl");
    await assertExecutablePayload(helperSource, HELPER_NAME);
    await mkdir(binDir, { recursive: true });
    await installExecutable(glSource, glPath);
    await installExecutable(helperSource, helperRealPath);
    await installWrapper(helperPath, nodeUrl);

    return {
      archiveName,
      archiveUrl,
      binDir,
      checksumUrl,
      glPath,
      helperPath,
      helperRealPath,
      installed: true,
      message: [
        `installed Gitlawb ${version}`,
        `gl: ${glPath}`,
        `git helper: ${helperPath}`,
        `default node: ${nodeUrl}`,
        "next: nipmod doctor --online"
      ].join("\n"),
      nodeUrl,
      ready: true,
      target,
      version
    };
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

function gitlawbReleaseTarget(): string {
  if (process.platform === "linux" && process.arch === "x64") return "x86_64-unknown-linux-musl";
  if (process.platform === "linux" && process.arch === "arm64") return "aarch64-unknown-linux-musl";
  if (process.platform === "darwin" && process.arch === "x64") return "x86_64-apple-darwin";
  if (process.platform === "darwin" && process.arch === "arm64") return "aarch64-apple-darwin";
  throw new Error(`Gitlawb release is not available for ${process.platform}/${process.arch}`);
}

async function resolveLatestVersion(options: SetupGitlawbHelperOptions): Promise<string> {
  const latestApiUrl = options.latestApiUrl ?? DEFAULT_LATEST_API_URL;
  const payload = JSON.parse(await fetchText(latestApiUrl, options.fetchImpl)) as { tag_name?: unknown };
  if (typeof payload.tag_name !== "string" || payload.tag_name.length === 0) {
    throw new Error(`Gitlawb latest release response is missing tag_name: ${latestApiUrl}`);
  }
  return normalizeReleaseVersion(payload.tag_name);
}

async function gitlawbReleaseVersion(options: SetupGitlawbHelperOptions): Promise<string> {
  if (!options.version) {
    return PINNED_GITLAWB_RELEASE_VERSION;
  }
  if (options.version !== "latest") {
    return normalizeReleaseVersion(options.version);
  }
  if (options.dryRun === true) {
    return "latest";
  }
  return resolveLatestVersion(options);
}

function pinnedReleaseDigest(version: string, target: string): string | undefined {
  return PINNED_GITLAWB_RELEASE_DIGESTS[version]?.[target];
}

async function fetchBytes(url: string, fetchImpl: typeof fetch = fetch): Promise<Buffer> {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(RELEASE_FETCH_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`Gitlawb release download failed (${response.status}): ${url}`);
  }
  return readResponseBytes(response, { label: "Gitlawb release archive", maxBytes: MAX_RELEASE_ARCHIVE_BYTES });
}

async function fetchText(url: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(RELEASE_FETCH_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`Gitlawb release metadata fetch failed (${response.status}): ${url}`);
  }
  return readResponseText(response, { label: "Gitlawb release metadata", maxBytes: MAX_RELEASE_METADATA_BYTES });
}

function parseSha256(text: string, source: string): string {
  const digest = text.trim().split(/\s+/)[0] ?? "";
  if (!/^[a-f0-9]{64}$/i.test(digest)) {
    throw new Error(`Gitlawb release checksum is invalid: ${source}`);
  }
  return digest.toLowerCase();
}

async function assertExecutablePayload(path: string, label: string): Promise<void> {
  try {
    await access(path, fsConstants.R_OK);
  } catch {
    throw new Error(`Gitlawb release archive is missing ${label}`);
  }
}

async function installedWrapperStatus(
  helperPath: string,
  helperRealPath: string,
  nodeUrl: string
): Promise<{ ready: boolean }> {
  if (!(await canExecute(helperPath)) || !(await canExecute(helperRealPath))) {
    return { ready: false };
  }
  const wrapper = await readFile(helperPath, "utf8");
  return {
    ready: wrapper.includes(HELPER_REAL_NAME) && wrapper.includes(nodeUrl)
  };
}

async function canExecute(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function installExecutable(source: string, destination: string): Promise<void> {
  const staging = `${destination}.new`;
  await copyFile(source, staging);
  await chmod(staging, 0o755);
  await rename(staging, destination);
}

async function installWrapper(destination: string, nodeUrl: string): Promise<void> {
  const staging = `${destination}.new`;
  const script = [
    "#!/bin/sh",
    "set -eu",
    "",
    'if [ -z "${GITLAWB_NODE:-}" ]; then',
    `  GITLAWB_NODE=${shellQuote(nodeUrl)}`,
    "fi",
    "export GITLAWB_NODE",
    "",
    `exec "$(dirname "$0")/${HELPER_REAL_NAME}" "$@"`,
    ""
  ].join("\n");
  await writeFile(staging, script);
  await chmod(staging, 0o755);
  await rename(staging, destination);
}

async function run(command: string, args: readonly string[]): Promise<void> {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  const code = await new Promise<number | null>((resolveCode, reject) => {
    child.on("error", reject);
    child.on("close", resolveCode);
  });
  if (code !== 0) {
    throw new Error(`command failed (${code}): ${command} ${args.join(" ")}\n${stderr}`);
  }
}

function normalizeReleaseVersion(version: string): string {
  if (!/^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error("Gitlawb release version must look like v1.2.3");
  }
  return version;
}

function normalizeNodeUrl(value: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    throw new Error("Gitlawb node URL must use https:// unless it is loopback");
  }
  parsed.hash = "";
  parsed.search = "";
  parsed.username = "";
  parsed.password = "";
  return parsed.toString().replace(/\/$/, "");
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
