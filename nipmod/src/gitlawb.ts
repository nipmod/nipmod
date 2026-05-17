import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BUNDLE_MEDIA_TYPE, packProject } from "./bundle.js";
import { readResponseBytes, readResponseText } from "./http.js";
import { type Identity, signBytes } from "./identity.js";
import { type ReleaseEvent } from "./protocol.js";
import { signReleaseEvent } from "./release.js";
import { canonicalJson } from "./verifier.js";

export const DEFAULT_GITLAWB_NODE = "https://node.nipmod.com";

export interface RemoteSpecifier {
  canonical: string;
  ownerDid: string;
  ownerSegment: string;
  repoName: string;
  version: string;
}

export interface SignedGitlawbRequest {
  headers: Record<string, string>;
  signatureBase: string;
}

export interface SignGitlawbRequestOptions {
  identity: Identity;
  method: string;
  path: string;
  body: Uint8Array;
  createdAt?: number;
}

export interface CreateGitlawbRepoOptions {
  nodeUrl: string;
  identity: Identity;
  repoName: string;
  description?: string;
  fetchImpl?: typeof fetch;
}

export interface CreateGitlawbRepoResult {
  created: boolean;
}

export interface CommandOptions {
  cwd: string;
  env: Record<string, string>;
}

export type CommandRunner = (
  command: string,
  args: readonly string[],
  options: CommandOptions
) => Promise<string | void>;

export interface RegistryCandidate {
  type: "dev.nipmod.registry-candidate.v1";
  package: string;
  version: string;
  digest: string;
  manifestDigest: string;
  publisher: string;
  repoName: string;
  resolved: string;
  sourceRepo: string;
  sourceTag: string;
  sourceCommit: string | null;
  artifactPath: string;
  releasePath: string;
}

export interface PublishGitlawbPackageOptions {
  projectDir: string;
  nodeUrl?: string;
  helperPath?: string;
  identityPath?: string;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  runCommand?: CommandRunner;
}

export interface PublishGitlawbPackageResult {
  package: string;
  version: string;
  digest: string;
  resolved: string;
  repoName: string;
  sourceCommit: string;
  registryCandidate: RegistryCandidate;
}

export type PublishVersionCheckStatus = "available" | "same-artifact" | "blocked-existing-version" | "unknown";

export interface PublishDryRunPlan {
  ready: boolean;
  package: string;
  version: string;
  digest: string;
  manifestDigest: string;
  resolved: string;
  repoName: string;
  nodeUrl: string;
  sourceRepo: string;
  sourceTag: string;
  registryCandidate: RegistryCandidate;
  helper: GitlawbHelperStatus;
  git: { ok: boolean; path?: string };
  versionCheck: {
    status: PublishVersionCheckStatus;
    checkedUrl: string;
    existingDigest?: string;
    message: string;
  };
  releaseEvent: ReturnType<typeof signReleaseEvent>;
}

export interface PublishDryRunOptions extends PublishGitlawbPackageOptions {}

export interface FetchGitlawbBundleOptions {
  nodeUrl?: string;
  spec: RemoteSpecifier;
  fetchImpl?: typeof fetch;
}

export interface FetchGitlawbBundleResult {
  bytes: Buffer;
  resolved: string;
}

export interface ResolveGitlawbHelperOptions {
  explicitPath?: string;
  env?: Record<string, string | undefined>;
  cwd?: string;
  accessImpl?: (path: string) => Promise<void>;
}

export interface GitlawbHelperStatus {
  ok: boolean;
  path?: string;
  source?: string;
  checked: string[];
  installCommand: string;
  message: string;
}

export type DoctorCheckStatus = "ok" | "warn" | "fail";

export interface DoctorCheck {
  id: "node" | "git" | "gitlawb-helper" | "gitlawb-node";
  label: string;
  status: DoctorCheckStatus;
  message: string;
  detail?: string;
}

export interface DoctorGitlawbOptions {
  nodeUrl?: string;
  offline?: boolean;
  env?: Record<string, string | undefined>;
  cwd?: string;
  fetchImpl?: typeof fetch;
  nodeVersion?: string;
}

export interface DoctorGitlawbResult {
  ready: boolean;
  nodeUrl: string;
  checks: DoctorCheck[];
  installCommand: string;
}

const REMOTE_SPECIFIER_PATTERN =
  /^(pkg:(did:key:z[A-Za-z0-9]+)\/([a-z0-9][a-z0-9._-]*))@((0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*))$/;
const GITLAWB_REPO_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const BUNDLE_FILENAME = "bundle.nipmod";
const REMOTE_BUNDLE_LIMIT = 50 * 1024 * 1024;
const ERROR_BODY_LIMIT = 8 * 1024;
const GITLAWB_INSTALL_COMMAND =
  "Install git-remote-gitlawb from Gitlawb with a verified checksum.";
const HELPER_NAME = "git-remote-gitlawb";

export function parseRemoteSpecifier(spec: string): RemoteSpecifier {
  const match = REMOTE_SPECIFIER_PATTERN.exec(spec);
  if (!match) {
    throw new Error("remote package spec must be pkg:did:key:<owner>/<name>@<version>");
  }

  const canonical = requireMatch(match[1], "canonical");
  const ownerDid = requireMatch(match[2], "owner");
  const repoName = requireMatch(match[3], "repo");
  const version = requireMatch(match[4], "version");
  assertGitlawbRepoName(repoName);

  return {
    canonical,
    ownerDid,
    ownerSegment: ownerSegmentFromDid(ownerDid),
    repoName,
    version
  };
}

export function gitlawbBlobUrl(nodeUrl: string, spec: RemoteSpecifier): string {
  const path = [
    "api",
    "v1",
    "repos",
    spec.ownerSegment,
    spec.repoName,
    "blob",
    ...bundlePathForVersion(spec.version).split("/")
  ]
    .map(encodeURIComponent)
    .join("/");

  return new URL(`/${path}`, `${normalizeNodeUrl(nodeUrl)}/`).toString();
}

export function signGitlawbRequest(options: SignGitlawbRequestOptions): SignedGitlawbRequest {
  const method = options.method.toUpperCase();
  const created = Math.floor(options.createdAt ?? Date.now() / 1000);
  const contentDigest = `sha-256=:${createHash("sha256").update(options.body).digest("base64")}:`;
  const signatureParams = `("@method" "@path" "content-digest");keyid="${options.identity.did}";alg="ed25519";created=${created}`;
  const signatureBase = [
    `"@method": ${method}`,
    `"@path": ${options.path}`,
    `"content-digest": ${contentDigest}`,
    `"@signature-params": ${signatureParams}`
  ].join("\n");
  const signature = signBytes(options.identity.privateKeyPem, Buffer.from(signatureBase, "utf8")).toString("base64");

  return {
    headers: {
      "Content-Digest": contentDigest,
      "Signature-Input": `sig1=${signatureParams}`,
      Signature: `sig1=:${signature}:`
    },
    signatureBase
  };
}

export async function createGitlawbRepo(options: CreateGitlawbRepoOptions): Promise<CreateGitlawbRepoResult> {
  assertGitlawbRepoName(options.repoName);

  const fetchImpl = options.fetchImpl ?? fetch;
  const path = "/api/v1/repos";
  const body = canonicalJson({
    default_branch: "main",
    description: options.description ?? "",
    is_public: true,
    name: options.repoName
  });
  const signed = signGitlawbRequest({
    identity: options.identity,
    method: "POST",
    path,
    body: Buffer.from(body, "utf8")
  });

  const response = await fetchImpl(new URL(path, `${normalizeNodeUrl(options.nodeUrl)}/`).toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...signed.headers
    },
    body
  });

  if (response.status === 409) {
    return { created: false };
  }

  if (!response.ok) {
    throw new Error(
      `Gitlawb repo create failed (${response.status}): ${await readResponseText(response, {
        label: "Gitlawb error",
        maxBytes: ERROR_BODY_LIMIT
      })}`
    );
  }

  return { created: true };
}

export async function publishGitlawbPackage(
  options: PublishGitlawbPackageOptions
): Promise<PublishGitlawbPackageResult> {
  const nodeUrl = normalizeNodeUrl(options.nodeUrl ?? DEFAULT_GITLAWB_NODE);
  const identity = await readLocalIdentity(options.projectDir, options.identityPath);
  const packed = await packProject(options.projectDir, {
    signingPrivateKeyPem: identity.privateKeyPem
  });
  const spec = parseRemoteSpecifier(`${packed.manifest.canonical}@${packed.manifest.version}`);
  const stagingDir = await mkdtemp(join(tmpdir(), "nipmod-publish-"));
  const repoDir = join(stagingDir, "repo");
  const keyPath = join(stagingDir, "identity.pem");

  if (spec.ownerDid !== identity.did) {
    throw new Error("local identity must match package canonical owner");
  }

  const helperOptions: ResolveGitlawbHelperOptions = {
    cwd: options.projectDir
  };
  if (options.helperPath) {
    helperOptions.explicitPath = options.helperPath;
  }
  if (options.env) {
    helperOptions.env = options.env;
  }
  const helper = await resolveGitlawbHelper(helperOptions);
  if (!helper.ok || !helper.path) {
    throw new Error(helper.message);
  }
  const preflightEnv = gitEnvironment(nodeUrl, keyPath, helper.path, options.env);
  const git = await resolveCommand("git", { env: preflightEnv, cwd: options.projectDir });
  if (!git.ok) {
    throw new Error("git is required for publish. Install git, then run: nipmod doctor");
  }

  const createRepoOptions: CreateGitlawbRepoOptions = {
    nodeUrl,
    identity,
    repoName: spec.repoName
  };
  if (packed.manifest.description) {
    createRepoOptions.description = packed.manifest.description;
  }
  if (options.fetchImpl) {
    createRepoOptions.fetchImpl = options.fetchImpl;
  }

  const repo = await createGitlawbRepo(createRepoOptions);

  try {
    await mkdir(repoDir, { recursive: true });
    await writeFile(keyPath, identity.privateKeyPem, { mode: 0o600 });
    const env = preflightEnv;
    const runCommand = options.runCommand ?? defaultRunCommand;
    if (repo.created) {
      await runCommand("git", ["init"], { cwd: repoDir, env });
    } else {
      await runCommand("git", ["clone", `gitlawb://${identity.did}/${spec.repoName}`, repoDir], { cwd: stagingDir, env });
    }

    await runCommand("git", ["checkout", "-B", "main"], { cwd: repoDir, env });
    await mkdir(join(repoDir, dirname(bundlePathForVersion(spec.version))), { recursive: true });
    await assertVersionIsPublishable(repoDir, packed);
    await writeFile(join(repoDir, bundlePathForVersion(spec.version)), packed.bytes);

    await runCommand("git", ["config", "user.email", "bot@nipmod.local"], { cwd: repoDir, env });
    await runCommand("git", ["config", "user.name", "nipmod"], { cwd: repoDir, env });
    await runCommand("git", ["add", bundlePathForVersion(spec.version)], { cwd: repoDir, env });
    await runCommand("git", ["commit", "-m", `Add ${spec.repoName} ${spec.version} artifact`], { cwd: repoDir, env });
    const sourceCommit = normalizeGitCommit(await runCommand("git", ["rev-parse", "HEAD"], { cwd: repoDir, env }));
    await writeFile(
      join(repoDir, releasePathForVersion(spec.version)),
      `${canonicalJson(signReleaseEvent(releaseEventForPackedBundle(packed, sourceCommit), identity))}\n`
    );
    await writeFile(join(repoDir, "index.json"), `${canonicalJson(indexForPackedBundle(packed, sourceCommit))}\n`);
    await runCommand("git", ["add", releasePathForVersion(spec.version), "index.json"], { cwd: repoDir, env });
    await runCommand("git", ["commit", "-m", `Publish ${spec.repoName} ${spec.version} metadata`], { cwd: repoDir, env });
    await runCommand("git", ["tag", "-f", `v${spec.version}`], { cwd: repoDir, env });
    await runCommand("git", ["push", `gitlawb://${identity.did}/${spec.repoName}`, "HEAD:main", `refs/tags/v${spec.version}`], {
      cwd: repoDir,
      env
    });

    return {
      package: packed.manifest.canonical,
      version: packed.manifest.version,
      digest: packed.digest,
      resolved: gitlawbBlobUrl(nodeUrl, spec),
      repoName: spec.repoName,
      sourceCommit,
      registryCandidate: registryCandidateForPackedBundle({
        nodeUrl,
        packed,
        sourceCommit
      })
    };
  } finally {
    await rm(stagingDir, { recursive: true, force: true });
  }
}

export async function createPublishDryRunPlan(options: PublishDryRunOptions): Promise<PublishDryRunPlan> {
  const nodeUrl = normalizeNodeUrl(options.nodeUrl ?? DEFAULT_GITLAWB_NODE);
  const identity = await readLocalIdentity(options.projectDir, options.identityPath);
  const packed = await packProject(options.projectDir, {
    signingPrivateKeyPem: identity.privateKeyPem
  });
  const spec = parseRemoteSpecifier(`${packed.manifest.canonical}@${packed.manifest.version}`);

  if (spec.ownerDid !== identity.did) {
    throw new Error("local identity must match package canonical owner");
  }

  const helperOptions: ResolveGitlawbHelperOptions = {
    cwd: options.projectDir
  };
  if (options.helperPath) {
    helperOptions.explicitPath = options.helperPath;
  }
  if (options.env) {
    helperOptions.env = options.env;
  }
  const helper = await resolveGitlawbHelper(helperOptions);
  const preflightEnv = helper.ok && helper.path ? gitEnvironment(nodeUrl, "/dev/null", helper.path, options.env) : options.env;
  const gitOptions: { cwd: string; env?: Record<string, string | undefined> } = { cwd: options.projectDir };
  if (preflightEnv) {
    gitOptions.env = preflightEnv;
  }
  const git = await resolveCommand("git", gitOptions);
  const resolved = gitlawbBlobUrl(nodeUrl, spec);
  const versionCheckOptions: {
    digest: string;
    fetchImpl?: typeof fetch;
    url: string;
  } = {
    digest: packed.digest,
    url: resolved
  };
  if (options.fetchImpl) {
    versionCheckOptions.fetchImpl = options.fetchImpl;
  }
  const versionCheck = await checkPublishedVersion(versionCheckOptions);
  const releaseEvent = signReleaseEvent(releaseEventForPackedBundle(packed), identity);
  const registryCandidate = registryCandidateForPackedBundle({
    nodeUrl,
    packed,
    sourceCommit: null
  });

  return {
    ready: helper.ok && git.ok && (versionCheck.status === "available" || versionCheck.status === "same-artifact"),
    package: packed.manifest.canonical,
    version: packed.manifest.version,
    digest: packed.digest,
    manifestDigest: packed.manifestDigest,
    resolved,
    repoName: spec.repoName,
    nodeUrl,
    sourceRepo: `gitlawb://${identity.did}/${spec.repoName}`,
    sourceTag: `v${packed.manifest.version}`,
    registryCandidate,
    helper,
    git,
    versionCheck,
    releaseEvent
  };
}

export async function fetchGitlawbBundle(options: FetchGitlawbBundleOptions): Promise<FetchGitlawbBundleResult> {
  const nodeUrl = normalizeNodeUrl(options.nodeUrl ?? DEFAULT_GITLAWB_NODE);
  const fetchImpl = options.fetchImpl ?? fetch;
  const resolved = gitlawbBlobUrl(nodeUrl, options.spec);
  const response = await fetchImpl(resolved, {
    redirect: "error",
    signal: AbortSignal.timeout(30_000)
  });

  if (!response.ok) {
    throw new Error(
      `Gitlawb bundle fetch failed (${response.status}): ${await readResponseText(response, {
        label: "Gitlawb error",
        maxBytes: ERROR_BODY_LIMIT
      })}`
    );
  }

  return {
    bytes: await readResponseBytes(response, { label: "Gitlawb bundle", maxBytes: REMOTE_BUNDLE_LIMIT }),
    resolved
  };
}

async function checkPublishedVersion(options: {
  digest: string;
  fetchImpl?: typeof fetch;
  url: string;
}): Promise<PublishDryRunPlan["versionCheck"]> {
  try {
    const response = await (options.fetchImpl ?? fetch)(options.url, {
      method: "GET",
      signal: AbortSignal.timeout(5_000)
    });
    if (response.status === 404) {
      return {
        status: "available",
        checkedUrl: options.url,
        message: "version is not present on the configured node"
      };
    }
    if (!response.ok) {
      return {
        status: "unknown",
        checkedUrl: options.url,
        message: `version check returned ${response.status}`
      };
    }

    const existingDigest = createHash("sha256")
      .update(await readResponseBytes(response, { label: "Gitlawb bundle", maxBytes: REMOTE_BUNDLE_LIMIT }))
      .digest("hex");
    if (existingDigest === options.digest) {
      return {
        status: "same-artifact",
        checkedUrl: options.url,
        existingDigest,
        message: "same artifact already exists"
      };
    }

    return {
      status: "blocked-existing-version",
      checkedUrl: options.url,
      existingDigest,
      message: "version already exists with different artifact bytes"
    };
  } catch (error) {
    return {
      status: "unknown",
      checkedUrl: options.url,
      message: error instanceof Error ? error.message : "version check failed"
    };
  }
}

export async function resolveGitlawbHelper(
  options: ResolveGitlawbHelperOptions = {}
): Promise<GitlawbHelperStatus> {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const checked: string[] = [];
  const accessImpl =
    options.accessImpl ??
    (async (path: string): Promise<void> => {
      await access(path, fsConstants.X_OK);
    });

  const explicitPath = options.explicitPath ?? env.NIPMOD_GITLAWB_HELPER;
  if (explicitPath) {
    const candidate = resolveCandidate(cwd, explicitPath);
    checked.push(candidate);
    if (await canExecute(candidate, accessImpl)) {
      return helperFound(candidate, "explicit", checked);
    }

    return helperMissing(checked, `git-remote-gitlawb was not executable at ${candidate}.`);
  }

  for (const candidate of packagedHelperCandidates(cwd)) {
    checked.push(candidate);
    if (await canExecute(candidate, accessImpl)) {
      return helperFound(candidate, "package", checked);
    }
  }

  for (const candidate of pathCommandCandidates(HELPER_NAME, env.PATH ?? "")) {
    checked.push(candidate);
    if (await canExecute(candidate, accessImpl)) {
      return helperFound(candidate, "PATH", checked);
    }
  }

  return helperMissing(
    checked,
    `git-remote-gitlawb is required for publish. ${GITLAWB_INSTALL_COMMAND}`
  );
}

export async function doctorGitlawb(options: DoctorGitlawbOptions = {}): Promise<DoctorGitlawbResult> {
  const env = options.env ?? process.env;
  const nodeUrl = normalizeNodeUrl(options.nodeUrl ?? DEFAULT_GITLAWB_NODE);
  const installCommand = GITLAWB_INSTALL_COMMAND;
  const nodeVersion = options.nodeVersion ?? process.version;
  const checks: DoctorCheck[] = [
    {
      id: "node",
      label: "Node.js",
      status: nodeVersionMatches(nodeVersion) ? "ok" : "fail",
      message: nodeVersionMatches(nodeVersion) ? `Node ${nodeVersion}` : `Node ${nodeVersion} is too old`,
      detail: "requires Node 22 or newer"
    }
  ];

  const commandOptions: { env?: Record<string, string | undefined>; cwd?: string } = { env };
  if (options.cwd) {
    commandOptions.cwd = options.cwd;
  }
  const git = await resolveCommand("git", commandOptions);
  const gitCheck: DoctorCheck = {
    id: "git",
    label: "Git",
    status: git.ok ? "ok" : "fail",
    message: git.ok ? `git found at ${git.path}` : "git not found in PATH"
  };
  if (!git.ok) {
    gitCheck.detail = "publish needs git";
  }
  checks.push(gitCheck);

  const helperOptions: ResolveGitlawbHelperOptions = { env };
  if (options.cwd) {
    helperOptions.cwd = options.cwd;
  }
  const helper = await resolveGitlawbHelper(helperOptions);
  const helperCheck: DoctorCheck = {
    id: "gitlawb-helper",
    label: "Gitlawb helper",
    status: helper.ok ? "ok" : "warn",
    message: helper.ok && helper.path ? `git-remote-gitlawb found at ${helper.path}` : "publish needs git-remote-gitlawb; install and add still work"
  };
  if (helper.ok) {
    if (helper.source) {
      helperCheck.detail = helper.source;
    }
  } else {
    helperCheck.detail = installCommand;
  }
  checks.push(helperCheck);

  const nodeCheckOptions: { nodeUrl: string; offline: boolean; fetchImpl?: typeof fetch } = {
    nodeUrl,
    offline: options.offline === true
  };
  if (options.fetchImpl) {
    nodeCheckOptions.fetchImpl = options.fetchImpl;
  }
  checks.push(await gitlawbNodeCheck(nodeCheckOptions));

  return {
    ready: checks.every((check) => check.status !== "fail"),
    nodeUrl,
    checks,
    installCommand
  };
}

function releaseEventForPackedBundle(packed: Awaited<ReturnType<typeof packProject>>, sourceCommit?: string | null): ReleaseEvent {
  const spec = parseRemoteSpecifier(`${packed.manifest.canonical}@${packed.manifest.version}`);
  const source: ReleaseEvent["source"] = {
    type: "gitlawb",
    repo: `gitlawb://${packed.manifest.publish.signingKey}/${spec.repoName}`,
    tag: `v${packed.manifest.version}`
  };
  if (sourceCommit) {
    source.commit = sourceCommit;
  }

  return {
    type: "dev.nipmod.release.v1",
    formatVersion: 1,
    package: packed.manifest.canonical,
    version: packed.manifest.version,
    publisher: packed.manifest.publish.signingKey,
    source,
    artifact: {
      mediaType: BUNDLE_MEDIA_TYPE,
      path: bundlePathForVersion(packed.manifest.version),
      manifestDigest: packed.manifestDigest,
      sha256: packed.digest
    }
  };
}

function indexForPackedBundle(packed: Awaited<ReturnType<typeof packProject>>, sourceCommit?: string | null): unknown {
  const spec = parseRemoteSpecifier(`${packed.manifest.canonical}@${packed.manifest.version}`);
  return {
    formatVersion: 1,
    package: packed.manifest.canonical,
    latest: packed.manifest.version,
    releases: {
      [packed.manifest.version]: {
        artifact: {
          mediaType: BUNDLE_MEDIA_TYPE,
          path: bundlePathForVersion(packed.manifest.version),
          manifestDigest: packed.manifestDigest,
          sha256: packed.digest
        },
        publisher: packed.manifest.publish.signingKey,
        source: {
          type: "gitlawb",
          repo: `gitlawb://${packed.manifest.publish.signingKey}/${spec.repoName}`,
          tag: `v${packed.manifest.version}`,
          ...(sourceCommit ? { commit: sourceCommit } : {})
        }
      }
    }
  };
}

function registryCandidateForPackedBundle(options: {
  nodeUrl: string;
  packed: Awaited<ReturnType<typeof packProject>>;
  sourceCommit: string | null;
}): RegistryCandidate {
  const spec = parseRemoteSpecifier(`${options.packed.manifest.canonical}@${options.packed.manifest.version}`);
  return {
    type: "dev.nipmod.registry-candidate.v1",
    package: options.packed.manifest.canonical,
    version: options.packed.manifest.version,
    digest: options.packed.digest,
    manifestDigest: options.packed.manifestDigest,
    publisher: options.packed.manifest.publish.signingKey,
    repoName: spec.repoName,
    resolved: gitlawbBlobUrl(options.nodeUrl, spec),
    sourceRepo: `gitlawb://${options.packed.manifest.publish.signingKey}/${spec.repoName}`,
    sourceTag: `v${options.packed.manifest.version}`,
    sourceCommit: options.sourceCommit,
    artifactPath: bundlePathForVersion(options.packed.manifest.version),
    releasePath: releasePathForVersion(options.packed.manifest.version)
  };
}

function normalizeGitCommit(value: string | void): string {
  const commit = String(value ?? "").trim();
  if (!/^[a-f0-9]{40}$/.test(commit)) {
    throw new Error("git rev-parse HEAD did not return a commit hash");
  }
  return commit;
}

async function assertVersionIsPublishable(
  repoDir: string,
  packed: Awaited<ReturnType<typeof packProject>>
): Promise<void> {
  const bundlePath = join(repoDir, bundlePathForVersion(packed.manifest.version));
  const releasePath = join(repoDir, releasePathForVersion(packed.manifest.version));
  const existingBundle = await readOptionalBytes(bundlePath);
  const existingRelease = await fileExists(releasePath);
  if (!existingBundle && !existingRelease) {
    return;
  }

  if (existingBundle && createHash("sha256").update(existingBundle).digest("hex") === packed.digest) {
    return;
  }

  throw new Error(
    `version ${packed.manifest.version} already exists for ${packed.manifest.canonical}; bump the version before publishing`
  );
}

function bundlePathForVersion(version: string): string {
  return `releases/${version}/${BUNDLE_FILENAME}`;
}

function releasePathForVersion(version: string): string {
  return `releases/${version}/release.json`;
}

function assertGitlawbRepoName(repoName: string): void {
  if (!GITLAWB_REPO_NAME_PATTERN.test(repoName)) {
    throw new Error("Gitlawb repo names currently allow only lowercase letters, numbers, hyphens, and underscores");
  }
}

function ownerSegmentFromDid(ownerDid: string): string {
  return ownerDid.slice(ownerDid.lastIndexOf(":") + 1);
}

function normalizeNodeUrl(nodeUrl: string): string {
  const trimmed = nodeUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//.test(trimmed)) {
    throw new Error("Gitlawb node URL must start with http:// or https://");
  }

  return trimmed;
}

function requireMatch(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`remote package spec is missing ${label}`);
  }

  return value;
}

async function readLocalIdentity(projectDir: string, path?: string): Promise<Identity> {
  const identityPath = path ?? join(projectDir, ".nipmod", "identity.json");
  const identity = JSON.parse(await readFile(identityPath, "utf8")) as Partial<Identity>;
  if (!identity.did || !identity.privateKeyPem || !identity.publicKeyPem) {
    throw new Error("local identity is incomplete");
  }

  return {
    did: identity.did,
    privateKeyPem: identity.privateKeyPem,
    publicKeyPem: identity.publicKeyPem
  };
}

async function readOptionalBytes(path: string): Promise<Buffer | null> {
  try {
    return await readFile(path);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

function gitEnvironment(
  nodeUrl: string,
  keyPath: string,
  helperPath: string,
  baseEnv: Record<string, string | undefined> | undefined
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(baseEnv ?? process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }

  env.GITLAWB_NODE = nodeUrl;
  env.GITLAWB_KEY = keyPath;
  env.PATH = prependPath(dirname(helperPath), env.PATH ?? "");

  return env;
}

async function gitlawbNodeCheck(options: {
  nodeUrl: string;
  offline: boolean;
  fetchImpl?: typeof fetch;
}): Promise<DoctorCheck> {
  if (options.offline) {
    return {
      id: "gitlawb-node",
      label: "Gitlawb node",
      status: "warn",
      message: `skipped network check for ${options.nodeUrl}`,
      detail: "run without --offline before publishing"
    };
  }

  try {
    const response = await (options.fetchImpl ?? fetch)(new URL("/health", `${options.nodeUrl}/`).toString());
    if (!response.ok) {
      return {
        id: "gitlawb-node",
        label: "Gitlawb node",
        status: "fail",
        message: `node health failed with ${response.status}`,
        detail: options.nodeUrl
      };
    }

    return {
      id: "gitlawb-node",
      label: "Gitlawb node",
      status: "ok",
      message: `node is reachable at ${options.nodeUrl}`
    };
  } catch (error) {
    return {
      id: "gitlawb-node",
      label: "Gitlawb node",
      status: "fail",
      message: error instanceof Error ? error.message : "node health failed",
      detail: options.nodeUrl
    };
  }
}

async function resolveCommand(
  command: string,
  options: { env?: Record<string, string | undefined>; cwd?: string }
): Promise<{ ok: boolean; path?: string }> {
  for (const candidate of pathCommandCandidates(command, options.env?.PATH ?? process.env.PATH ?? "")) {
    if (await canExecute(candidate, async (path) => access(path, fsConstants.X_OK))) {
      return { ok: true, path: candidate };
    }
  }

  return { ok: false };
}

function nodeVersionMatches(version: string): boolean {
  const match = /^v?(\d+)\./.exec(version);
  return Number(match?.[1] ?? 0) >= 22;
}

function helperFound(path: string, source: string, checked: string[]): GitlawbHelperStatus {
  return {
    ok: true,
    path,
    source,
    checked,
    installCommand: GITLAWB_INSTALL_COMMAND,
    message: `git-remote-gitlawb found at ${path}`
  };
}

function helperMissing(checked: string[], message: string): GitlawbHelperStatus {
  return {
    ok: false,
    checked,
    installCommand: GITLAWB_INSTALL_COMMAND,
    message: `${message}\nThen run: nipmod doctor`
  };
}

function resolveCandidate(cwd: string, path: string): string {
  return isAbsolute(path) ? path : resolve(cwd, path);
}

function packagedHelperCandidates(cwd: string): string[] {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  return [
    join(moduleDir, "..", "bin", HELPER_NAME),
    join(moduleDir, "bin", HELPER_NAME)
  ];
}

function pathCommandCandidates(command: string, pathValue: string): string[] {
  const names = process.platform === "win32" ? [`${command}.exe`, `${command}.cmd`, command] : [command];
  const dirs = pathValue.split(delimiter).filter(Boolean);
  const candidates: string[] = [];
  for (const dir of dirs) {
    for (const name of names) {
      candidates.push(join(dir, name));
    }
  }

  return candidates;
}

async function canExecute(path: string, accessImpl: (path: string) => Promise<void>): Promise<boolean> {
  try {
    await accessImpl(path);
    return true;
  } catch {
    return false;
  }
}

function prependPath(dir: string, pathValue: string): string {
  const dirs = pathValue.split(delimiter).filter(Boolean);
  if (dirs.includes(dir)) {
    return dirs.join(delimiter);
  }

  return [dir, ...dirs].join(delimiter);
}

async function defaultRunCommand(command: string, args: readonly string[], options: CommandOptions): Promise<string> {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  const code = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  if (code !== 0) {
    const output = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
    throw new Error(`command failed (${code}): ${command} ${args.join(" ")}${output ? `\n${output}` : ""}`);
  }
  return stdout;
}
