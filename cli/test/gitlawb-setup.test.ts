import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { afterEach, describe, expect, test } from "vitest";
import { setupGitlawbHelper } from "../src/gitlawb-setup.js";

const servers: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((close) => close()));
});

describe("Gitlawb helper setup", () => {
  test("installs a checksum verified Gitlawb release with a Nipmod node wrapper", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-gitlawb-setup-"));
    const version = "v9.9.9";
    const target = currentTestTarget();
    const archiveName = `gitlawb-${version}-${target}.tar.gz`;
    const release = await createGitlawbReleaseArchive(workspace, archiveName);
    const server = await serveGitlawbRelease(version, archiveName, release.bytes, release.digest);
    const binDir = join(workspace, "bin");

    const result = await setupGitlawbHelper({
      allowUnpinned: true,
      binDir,
      force: true,
      releaseBaseUrl: `${server.origin}/releases`,
      version
    });

    expect(result).toMatchObject({
      installed: true,
      ready: true,
      binDir,
      helperPath: join(binDir, "git-remote-gitlawb"),
      helperRealPath: join(binDir, "git-remote-gitlawb.real"),
      glPath: join(binDir, "gl"),
      nodeUrl: "https://node.nipmod.com",
      version
    });
    await expect(stat(result.glPath)).resolves.toMatchObject({ mode: expect.any(Number) });
    await expect(stat(result.helperRealPath)).resolves.toMatchObject({ mode: expect.any(Number) });
    const wrapper = await readFile(result.helperPath, "utf8");
    expect(wrapper).toContain("https://node.nipmod.com");
    expect(wrapper).toContain("git-remote-gitlawb.real");
  });

  test("installs the Nipmod wrapper even when a raw PATH helper already exists", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-gitlawb-setup-path-helper-"));
    const externalBin = join(workspace, "external-bin");
    await mkdir(externalBin, { recursive: true });
    await writeExecutable(join(externalBin, "git-remote-gitlawb"), "#!/bin/sh\nprintf 'external\\n'\n");

    const version = "v9.9.9";
    const target = currentTestTarget();
    const archiveName = `gitlawb-${version}-${target}.tar.gz`;
    const release = await createGitlawbReleaseArchive(workspace, archiveName);
    const server = await serveGitlawbRelease(version, archiveName, release.bytes, release.digest);
    const binDir = join(workspace, "bin");

    const result = await setupGitlawbHelper({
      allowUnpinned: true,
      binDir,
      env: { PATH: externalBin },
      releaseBaseUrl: `${server.origin}/releases`,
      version
    });

    expect(result).toMatchObject({
      installed: true,
      helperPath: join(binDir, "git-remote-gitlawb"),
      helperRealPath: join(binDir, "git-remote-gitlawb.real")
    });
    const wrapper = await readFile(result.helperPath, "utf8");
    expect(wrapper).toContain("https://node.nipmod.com");
    expect(wrapper).toContain("git-remote-gitlawb.real");
  });

  test("refuses a Gitlawb release when the checksum does not match", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-gitlawb-setup-bad-sha-"));
    const version = "v9.9.9";
    const target = currentTestTarget();
    const archiveName = `gitlawb-${version}-${target}.tar.gz`;
    const release = await createGitlawbReleaseArchive(workspace, archiveName);
    const server = await serveGitlawbRelease(version, archiveName, release.bytes, "0".repeat(64));

    await expect(
      setupGitlawbHelper({
        binDir: join(workspace, "bin"),
        allowUnpinned: true,
        force: true,
        releaseBaseUrl: `${server.origin}/releases`,
        version
      })
    ).rejects.toThrow(/checksum mismatch/i);
  });

  test("refuses unpinned official Gitlawb releases before download", async () => {
    await expect(
      setupGitlawbHelper({
        binDir: "/tmp/nipmod-unused",
        force: true,
        version: "v9.9.9"
      })
    ).rejects.toThrow(/not pinned by Nipmod/i);
  });
});

async function createGitlawbReleaseArchive(workspace: string, archiveName: string): Promise<{ bytes: Buffer; digest: string }> {
  const payloadDir = join(workspace, "payload");
  const archivePath = join(workspace, archiveName);
  await mkdir(payloadDir, { recursive: true });
  await writeFile(join(payloadDir, "gl"), "#!/bin/sh\nprintf 'gl\\n'\n");
  await writeFile(join(payloadDir, "git-remote-gitlawb"), "#!/bin/sh\nprintf 'gitlawb\\n'\n");
  await chmod(join(payloadDir, "gl"), 0o755);
  await chmod(join(payloadDir, "git-remote-gitlawb"), 0o755);
  await run("tar", ["-czf", archivePath, "-C", payloadDir, "gl", "git-remote-gitlawb"]);
  const bytes = await readFile(archivePath);
  return {
    bytes,
    digest: createHash("sha256").update(bytes).digest("hex")
  };
}

async function serveGitlawbRelease(
  version: string,
  archiveName: string,
  archiveBytes: Buffer,
  digest: string
): Promise<{ origin: string }> {
  const server = createServer((request, response) => {
    if (request.url === `/releases/${version}/${archiveName}`) {
      response.writeHead(200, {
        "content-length": String(archiveBytes.byteLength),
        "content-type": "application/gzip"
      });
      response.end(archiveBytes);
      return;
    }
    if (request.url === `/releases/${version}/${archiveName}.sha256`) {
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end(`${digest}  ${archiveName}\n`);
      return;
    }
    response.writeHead(404);
    response.end("not found");
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  servers.push(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      })
  );
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("release test server did not bind to tcp");
  }
  return { origin: `http://127.0.0.1:${address.port}` };
}

function currentTestTarget(): string {
  if (process.platform === "darwin" && process.arch === "arm64") return "aarch64-apple-darwin";
  if (process.platform === "darwin" && process.arch === "x64") return "x86_64-apple-darwin";
  if (process.platform === "linux" && process.arch === "arm64") return "aarch64-unknown-linux-musl";
  if (process.platform === "linux" && process.arch === "x64") return "x86_64-unknown-linux-musl";
  throw new Error(`unsupported test platform: ${process.platform}/${process.arch}`);
}

async function run(command: string, args: string[]): Promise<void> {
  const child = spawn(command, args, { stdio: "ignore" });
  const code = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  if (code !== 0) {
    throw new Error(`command failed (${code}): ${command} ${args.join(" ")}`);
  }
}

async function writeExecutable(path: string, content: string): Promise<void> {
  await writeFile(path, content);
  await chmod(path, 0o755);
}
