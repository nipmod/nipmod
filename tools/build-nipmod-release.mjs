#!/usr/bin/env node
import { createHash } from "node:crypto";
import { access, chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { readReleasePublicKeyInfo, signReleaseArtifact } from "./release-signing.mjs";

const root = resolve(import.meta.dirname, "..");
const nipmodDir = join(root, "nipmod");
const siteReleaseDir = join(root, "site", "public", "releases");
const releasePrivateKeyPath =
  process.env.NIPMOD_RELEASE_PRIVATE_KEY_PATH ?? join(root, ".nipmod", "release-signing-private-key.pem");
const releasePublicKeyPath =
  process.env.NIPMOD_RELEASE_PUBLIC_KEY_PATH ?? join(root, "tools", "release-signing-public-key.json");
const packageJson = JSON.parse(await readFile(join(nipmodDir, "package.json"), "utf8"));
const version = process.env.NIPMOD_VERSION ?? packageJson.version;
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:[-+][0-9A-Za-z.-]+)?$/.test(version) || version === "0.0.0") {
  throw new Error(`refusing to build mutable or invalid public release version: ${version}`);
}
const packageName = `nipmod-${version}.tgz`;
const artifactPath = join(siteReleaseDir, packageName);

await run("pnpm", ["build"], { cwd: nipmodDir });
await mkdir(siteReleaseDir, { recursive: true });
await assertReleaseDoesNotExist(artifactPath);

const stage = await mkdtemp(join(tmpdir(), "nipmod-release-"));
try {
  await mkdir(join(stage, "dist"), { recursive: true });
  await run(
    "pnpm",
    [
      "exec",
      "esbuild",
      "src/cli.ts",
      "--bundle",
      "--platform=node",
      "--format=esm",
      "--target=node22",
      `--outfile=${join(stage, "dist", "cli.js")}`
    ],
    { cwd: nipmodDir }
  );
  await chmod(join(stage, "dist", "cli.js"), 0o755);
  await writeFile(
    join(stage, "package.json"),
    `${JSON.stringify(
      {
        name: "nipmod",
        version,
        description: "Verifiable packages for agents on Gitlawb.",
        type: "module",
        bin: {
          nipmod: "./dist/cli.js"
        },
        license: "MIT"
      },
      null,
      2
    )}\n`
  );

  await run("npm", ["pack", "--pack-destination", siteReleaseDir], { cwd: stage });
  const bytes = await readFile(artifactPath);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const publicKeyInfo = await readReleasePublicKeyInfo(releasePublicKeyPath);
  const signature = await signReleaseArtifact({
    artifactName: packageName,
    artifactPath,
    privateKeyPath: releasePrivateKeyPath,
    publicKeyInfo
  });
  await writeFile(`${artifactPath}.sha256`, `${digest}  ${packageName}\n`);
  await writeFile(`${artifactPath}.sig`, `${JSON.stringify(signature, null, 2)}\n`);
  console.log(`${artifactPath}`);
  console.log(`${digest}`);
  console.log(`${artifactPath}.sig`);
} finally {
  await rm(stage, { recursive: true, force: true });
}

async function run(command, args, options) {
  const child = spawn(command, args, {
    cwd: options.cwd,
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const code = await new Promise((resolveCode, reject) => {
    child.on("error", reject);
    child.on("close", resolveCode);
  });

  if (code !== 0) {
    throw new Error(`command failed (${code}): ${command} ${args.join(" ")}\n${stdout}\n${stderr}`);
  }
}

async function assertReleaseDoesNotExist(artifactPath) {
  for (const path of [artifactPath, `${artifactPath}.sha256`, `${artifactPath}.sig`]) {
    try {
      await access(path);
      throw new Error(`refusing to overwrite existing release artifact: ${path}`);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("refusing to overwrite")) {
        throw error;
      }
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }
  }
}
