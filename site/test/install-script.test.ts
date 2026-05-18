import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { describe, expect, test } from "vitest";

const scriptPath = join(import.meta.dirname, "..", "public", "install.sh");
const scriptChecksumPath = join(import.meta.dirname, "..", "public", "install.sh.sha256");
const readmePath = join(import.meta.dirname, "..", "..", "README.md");
const version = JSON.parse(await readFile(join(import.meta.dirname, "..", "..", "nipmod", "package.json"), "utf8")).version;
const releaseName = `nipmod-${version}.tgz`;
const releasePath = join(import.meta.dirname, "..", "public", "releases", releaseName);
const releaseChecksumPath = `${releasePath}.sha256`;
const releaseSignaturePath = `${releasePath}.sig`;
const doctorSuccess = {
  ok: true,
  data: {
    ready: true,
    checks: [
      { id: "node", label: "Node.js", status: "ok", message: "Node v22.0.0" },
      { id: "git", label: "Git", status: "ok", message: "git found" },
      { id: "gitlawb-helper", label: "Gitlawb helper", status: "warn", message: "publish helper missing" },
      { id: "gitlawb-node", label: "Gitlawb node", status: "warn", message: "skipped" }
    ]
  }
};

describe("install script", () => {
  test("publishes a checksum for the installer script", async () => {
    const script = await readFile(scriptPath);
    const checksum = await readFile(scriptChecksumPath, "utf8");
    const digest = createHash("sha256").update(script).digest("hex");

    expect(checksum).toBe(`${digest}  install.sh\n`);
  });

  test("keeps README installer hash pinned to the published script", async () => {
    const script = await readFile(scriptPath);
    const checksum = await readFile(scriptChecksumPath, "utf8");
    const readme = await readFile(readmePath, "utf8");
    const digest = createHash("sha256").update(script).digest("hex");

    expect(checksum).toBe(`${digest}  install.sh\n`);
    expect(readme).toContain("curl -fLO https://nipmod.com/install.sh.sha256");
    expect(readme).toContain("shasum -a 256 -c install.sh.sha256");
  });

  test("installs the committed signed release artifact", async () => {
    const temp = await mkdtemp(join(tmpdir(), "nipmod-install-script-real-release-"));
    const result = await runScript({
      NIPMOD_PACKAGE_URL: `file://${releasePath}`,
      NIPMOD_CHECKSUM_URL: `file://${releaseChecksumPath}`,
      NIPMOD_SIGNATURE_URL: `file://${releaseSignaturePath}`,
      NIPMOD_HOME: join(temp, "home"),
      NIPMOD_BIN_DIR: join(temp, "bin"),
      NIPMOD_SKIP_GITLAWB: "1"
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Installed nipmod");
    expect(result.stdout).toContain(`Installing nipmod ${version}`);
  }, 15_000);

  test("fails when the installed binary cannot pass the post install check", async () => {
    const fakeBin = await makeFakeBin({
      checksumFails: true,
      doctorScript: "exit 42",
      signatureFails: true
    });
    const temp = await mkdtemp(join(tmpdir(), "nipmod-install-script-postcheck-"));
    const result = await runScript({
      NIPMOD_ALLOW_UNVERIFIED: "1",
      NIPMOD_PACKAGE_URL: "file:///tmp/nipmod.tgz",
      NIPMOD_CHECKSUM_URL: "file:///tmp/nipmod.tgz.sha256",
      NIPMOD_SIGNATURE_URL: "file:///tmp/nipmod.tgz.sig",
      NIPMOD_HOME: join(temp, "home"),
      NIPMOD_BIN_DIR: join(temp, "bin"),
      NIPMOD_SKIP_GITLAWB: "1",
      PATH: `${fakeBin}:${process.env.PATH ?? ""}`
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("installed nipmod binary failed its offline doctor check");
    expect(result.stdout).not.toContain("Installed nipmod");
  });

  test("fails when installed binary reports blocking doctor failures", async () => {
    const fakeBin = await makeFakeBin({
      checksumFails: true,
      doctorPayload: {
        ok: true,
        data: {
          checks: [{ id: "node", label: "Node.js", status: "fail", message: "Node v20 is too old" }]
        }
      },
      fakeNode: false,
      signatureFails: true
    });
    const temp = await mkdtemp(join(tmpdir(), "nipmod-install-script-doctor-fail-"));
    const result = await runScript({
      NIPMOD_ALLOW_UNVERIFIED: "1",
      NIPMOD_PACKAGE_URL: "file:///tmp/nipmod.tgz",
      NIPMOD_CHECKSUM_URL: "file:///tmp/nipmod.tgz.sha256",
      NIPMOD_SIGNATURE_URL: "file:///tmp/nipmod.tgz.sig",
      NIPMOD_HOME: join(temp, "home"),
      NIPMOD_BIN_DIR: join(temp, "bin"),
      NIPMOD_SKIP_GITLAWB: "1",
      PATH: `${fakeBin}:${process.env.PATH ?? ""}`
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Node.js: Node v20 is too old");
    expect(result.stdout).not.toContain("Installed nipmod");
  });

  test("supports a dry run without network or filesystem writes", async () => {
    const temp = await mkdtemp(join(tmpdir(), "nipmod-install-script-"));
    const result = await runScript({
      NIPMOD_DRY_RUN: "1",
      NIPMOD_HOME: join(temp, "home"),
      NIPMOD_BIN_DIR: join(temp, "bin"),
      NIPMOD_BASE_URL: "https://example.test"
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain(`Installing nipmod ${version}`);
    expect(result.stdout).toContain(`dry run: curl -fsSL https://example.test/releases/${releaseName}`);
    expect(result.stdout).toContain("dry run: npm install --ignore-scripts --omit=dev");
    expect(result.stdout).not.toContain("gitlawb.com/install.sh");
    expect(result.stdout).toContain("nipmod doctor");
  });

  test("prints a persistent PATH hint when the install bin directory is not already on PATH", async () => {
    const temp = await mkdtemp(join(tmpdir(), "nipmod-install-script-path-"));
    const binDir = join(temp, "bin");
    const result = await runScript({
      NIPMOD_DRY_RUN: "1",
      NIPMOD_HOME: join(temp, "home"),
      NIPMOD_BIN_DIR: binDir,
      NIPMOD_SKIP_GITLAWB: "1",
      PATH: process.env.PATH ?? ""
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Add nipmod to PATH:");
    expect(result.stdout).toContain(`export PATH="${binDir}:$PATH"`);
  });

  test("keeps installer configurable for local verification", async () => {
    const result = await runScript({
      NIPMOD_DRY_RUN: "1",
      NIPMOD_VERSION: "1.2.3",
      NIPMOD_PACKAGE_URL: "file:///tmp/nipmod.tgz",
      NIPMOD_CHECKSUM_URL: "file:///tmp/nipmod.tgz.sha256",
      NIPMOD_SKIP_GITLAWB: "1"
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Installing nipmod 1.2.3");
    expect(result.stdout).toContain("file:///tmp/nipmod.tgz");
    expect(result.stdout).not.toContain("gitlawb.com/install.sh | sh");
  });

  test("fails closed when the checksum cannot be fetched", async () => {
    const fakeBin = await makeFakeBin({ checksumFails: true });
    const temp = await mkdtemp(join(tmpdir(), "nipmod-install-script-"));
    const result = await runScript({
      NIPMOD_BASE_URL: "https://example.test",
      NIPMOD_HOME: join(temp, "home"),
      NIPMOD_BIN_DIR: join(temp, "bin"),
      NIPMOD_SKIP_GITLAWB: "1",
      PATH: `${fakeBin}:${process.env.PATH ?? ""}`
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("checksum file is required");
  });

  test("does not let unverified recovery bypass HTTPS checksum verification", async () => {
    const fakeBin = await makeFakeBin({ checksumFails: true });
    const temp = await mkdtemp(join(tmpdir(), "nipmod-install-script-"));
    const result = await runScript({
      NIPMOD_ALLOW_UNVERIFIED: "1",
      NIPMOD_BASE_URL: "https://example.test",
      NIPMOD_HOME: join(temp, "home"),
      NIPMOD_BIN_DIR: join(temp, "bin"),
      NIPMOD_SKIP_GITLAWB: "1",
      PATH: `${fakeBin}:${process.env.PATH ?? ""}`
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("checksum file is required");
  });

  test("allows explicit unverified installs for local file recovery only", async () => {
    const fakeBin = await makeFakeBin({ checksumFails: true, signatureFails: true });
    const temp = await mkdtemp(join(tmpdir(), "nipmod-install-script-"));
    const result = await runScript({
      NIPMOD_ALLOW_UNVERIFIED: "1",
      NIPMOD_PACKAGE_URL: "file:///tmp/nipmod.tgz",
      NIPMOD_CHECKSUM_URL: "file:///tmp/nipmod.tgz.sha256",
      NIPMOD_SIGNATURE_URL: "file:///tmp/nipmod.tgz.sig",
      NIPMOD_HOME: join(temp, "home"),
      NIPMOD_BIN_DIR: join(temp, "bin"),
      NIPMOD_SKIP_GITLAWB: "1",
      PATH: `${fakeBin}:${process.env.PATH ?? ""}`
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Installed nipmod");
    expect(result.stderr).toContain("warning: installing without checksum verification");
    expect(result.stderr).toContain("warning: installing without signature verification");
  });

  test("fails closed when the release signature cannot be fetched", async () => {
    const fakeBin = await makeFakeBin({ checksumFails: false, signatureFails: true });
    const temp = await mkdtemp(join(tmpdir(), "nipmod-install-script-"));
    const result = await runScript({
      NIPMOD_BASE_URL: "https://example.test",
      NIPMOD_HOME: join(temp, "home"),
      NIPMOD_BIN_DIR: join(temp, "bin"),
      NIPMOD_SKIP_GITLAWB: "1",
      PATH: `${fakeBin}:${process.env.PATH ?? ""}`
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("signature file is required");
  });

  test("rejects a detached signature that does not match the downloaded archive", async () => {
    const fakeBin = await makeFakeBin({
      checksumFails: false,
      fakeNode: false,
      signatureContent: JSON.stringify({
        algorithm: "Ed25519",
        artifact: releaseName,
        publicKeySpkiSha256: "49de8ed6bb670abcefc579534811a1f48c0e478f8427479e0ea05f839f96964e",
        signatureBase64: Buffer.alloc(64).toString("base64"),
        type: "dev.nipmod.release.signature.v1"
      })
    });
    const temp = await mkdtemp(join(tmpdir(), "nipmod-install-script-"));
    const result = await runScript({
      NIPMOD_BASE_URL: "https://example.test",
      NIPMOD_HOME: join(temp, "home"),
      NIPMOD_BIN_DIR: join(temp, "bin"),
      NIPMOD_SKIP_GITLAWB: "1",
      PATH: `${fakeBin}:${process.env.PATH ?? ""}`
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("release artifact signature verification failed");
  });

  test("rejects release packages with lifecycle scripts", async () => {
    const fakeBin = await makeFakeBin({
      checksumFails: true,
      fakeNode: false,
      packageScripts: { postinstall: "node postinstall.js" },
      signatureFails: true
    });
    const temp = await mkdtemp(join(tmpdir(), "nipmod-install-script-"));
    const result = await runScript({
      NIPMOD_ALLOW_UNVERIFIED: "1",
      NIPMOD_PACKAGE_URL: "file:///tmp/nipmod.tgz",
      NIPMOD_CHECKSUM_URL: "file:///tmp/nipmod.tgz.sha256",
      NIPMOD_SIGNATURE_URL: "file:///tmp/nipmod.tgz.sig",
      NIPMOD_HOME: join(temp, "home"),
      NIPMOD_BIN_DIR: join(temp, "bin"),
      NIPMOD_SKIP_GITLAWB: "1",
      PATH: `${fakeBin}:${process.env.PATH ?? ""}`
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("release package contains postinstall script");
  });

  test("uses nipmod setup for Gitlawb helper instead of executing a remote shell installer", async () => {
    const fakeBin = await makeFakeBin({ checksumFails: false });
    const temp = await mkdtemp(join(tmpdir(), "nipmod-install-script-"));
    const result = await runScript({
      NIPMOD_ALLOW_UNVERIFIED: "1",
      NIPMOD_BASE_URL: "https://example.test",
      NIPMOD_BIN_DIR: join(temp, "bin"),
      NIPMOD_HOME: join(temp, "home"),
      NIPMOD_INSTALL_GITLAWB: "1",
      HOME: join(temp, "user-home"),
      PATH: `${fakeBin}:/bin:/usr/bin`
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Setting up Gitlawb publish helper");
    expect(result.stdout).not.toContain("curl -fsSL");
    expect(result.stdout).not.toContain("| sh");
    expect(result.stdout).not.toContain("gitlawb-install.sh");
    expect(result.stderr).not.toContain("GITLAWB_INSTALL_SHA256");
  });

  test("still normalizes Gitlawb publish setup when a PATH helper already exists", async () => {
    const fakeBin = await makeFakeBin({
      checksumFails: true,
      signatureFails: true
    });
    await writeExecutable(join(fakeBin, "git-remote-gitlawb"), "#!/usr/bin/env bash\nexit 0\n");
    const temp = await mkdtemp(join(tmpdir(), "nipmod-install-script-"));
    const result = await runScript({
      NIPMOD_ALLOW_UNVERIFIED: "1",
      NIPMOD_PACKAGE_URL: "file:///tmp/nipmod.tgz",
      NIPMOD_CHECKSUM_URL: "file:///tmp/nipmod.tgz.sha256",
      NIPMOD_SIGNATURE_URL: "file:///tmp/nipmod.tgz.sig",
      NIPMOD_BIN_DIR: join(temp, "bin"),
      NIPMOD_HOME: join(temp, "home"),
      NIPMOD_INSTALL_GITLAWB: "1",
      HOME: join(temp, "user-home"),
      PATH: `${fakeBin}:/bin:/usr/bin`
    });

    expect(result.code).toBe(0);
    expect(result.stderr).not.toContain("GITLAWB_INSTALL_SHA256 is required");
    expect(result.stdout).toContain("Setting up Gitlawb publish helper");
    expect(result.stdout).toContain("Installed nipmod");
  });
});

async function runScript(env: Record<string, string>): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const child = spawn("bash", [scriptPath], {
    env: { ...process.env, ...env, FORCE_COLOR: "0" },
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
  const code = await new Promise<number | null>((resolve) => {
    child.on("close", resolve);
  });

  return { code, stdout, stderr };
}

async function makeFakeBin(options: {
  checksumFails: boolean;
  doctorPayload?: unknown;
  doctorScript?: string;
  fakeNode?: boolean;
  packageScripts?: Record<string, string>;
  signatureContent?: string;
  signatureFails?: boolean;
}): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "nipmod-fake-bin-"));
  const artifactPath = join(dir, releaseName);
  await mkdir(join(dir, "package", "dist"), { recursive: true });
  await writeFile(
    join(dir, "package", "package.json"),
    `${JSON.stringify(
      {
        name: "nipmod",
        version,
        description: "Verifiable packages for agents on Gitlawb.",
        type: "module",
        bin: {
          nipmod: "./dist/cli.js"
        },
        license: "MIT",
        ...(options.packageScripts ? { scripts: options.packageScripts } : {})
      },
      null,
      2
    )}\n`
  );
  await writeFile(join(dir, "package", "dist", "cli.js"), "#!/usr/bin/env node\n");
  await runCommand("tar", ["-czf", artifactPath, "-C", dir, "package"]);
  const fakeDigest = createHash("sha256").update(await readFile(artifactPath)).digest("hex");
  const signatureContent =
    options.signatureContent ??
    JSON.stringify({
      algorithm: "Ed25519",
      artifact: releaseName,
      publicKeySpkiSha256: "49de8ed6bb670abcefc579534811a1f48c0e478f8427479e0ea05f839f96964e",
      signatureBase64: "fake",
      type: "dev.nipmod.release.signature.v1"
    });
  await writeExecutable(
    join(dir, "curl"),
    `#!/usr/bin/env bash
set -euo pipefail
out=""
url=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o)
      out="$2"
      shift 2
      ;;
    -*)
      shift
      ;;
    *)
      url="$1"
      shift
      ;;
  esac
done
if [[ "$url" == *.sha256 ]] && [ "${options.checksumFails ? "1" : "0"}" = "1" ]; then
  exit 22
fi
if [[ "$url" == *.sig ]] && [ "${options.signatureFails ? "1" : "0"}" = "1" ]; then
  exit 22
fi
if [[ "$url" == *.sha256 ]]; then
  printf '%s  nipmod.tgz\\n' "${fakeDigest}" > "$out"
elif [[ "$url" == *.sig ]]; then
  cat > "$out" <<'SIG'
${signatureContent}
SIG
else
  cp "${artifactPath}" "$out"
fi
`
  );
  await writeExecutable(join(dir, "git"), "#!/usr/bin/env bash\nexit 0\n");
  if (options.fakeNode !== false) {
    await writeExecutable(join(dir, "node"), "#!/usr/bin/env bash\nexit 0\n");
  }
  await writeExecutable(
    join(dir, "npm"),
    `#!/usr/bin/env bash
set -euo pipefail
prefix=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --prefix)
      prefix="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done
mkdir -p "$prefix/node_modules/.bin"
cat > "$prefix/node_modules/.bin/nipmod" <<'NIPMOD'
#!/usr/bin/env bash
if [ "$1" = "doctor" ]; then
${options.doctorScript ?? `cat <<'JSON'\n${JSON.stringify(options.doctorPayload ?? doctorSuccess)}\nJSON`}
  exit 0
fi
exit 0
NIPMOD
chmod +x "$prefix/node_modules/.bin/nipmod"
exit 0
`
  );

  return dir;
}

async function runCommand(command: string, args: string[]): Promise<void> {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  const code = await new Promise<number | null>((resolve) => {
    child.on("close", resolve);
  });
  if (code !== 0) {
    throw new Error(stderr || `${command} failed`);
  }
}

async function writeExecutable(path: string, content: string): Promise<void> {
  await writeFile(path, content);
  await chmod(path, 0o755);
}
