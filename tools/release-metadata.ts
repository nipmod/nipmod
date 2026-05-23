import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { spawnSync } from "node:child_process";

export const RELEASE_SBOM_TYPE = "dev.nipmod.release.sbom.v1";
export const RELEASE_PROVENANCE_TYPE = "dev.nipmod.release.provenance.v1";

export interface ReleaseInventoryFile {
  executable: boolean;
  path: string;
  sha256: string;
  size: number;
}

export interface ReleaseMetadataOptions {
  artifactName: string;
  artifactPath: string;
  artifactSha256: string;
  generatedAt?: string;
  publicKeyInfo: {
    publicKeySpkiSha256?: string;
    spkiSha256?: string;
  };
  rootDir: string;
  stageDir: string;
  version: string;
}

export interface ReleaseMetadataPaths {
  provenancePath: string;
  sbomPath: string;
}

export async function writeReleaseMetadata(options: ReleaseMetadataOptions): Promise<ReleaseMetadataPaths> {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const files = await collectReleaseInventory(options.stageDir);
  const source = readGitSourceState(options.rootDir);
  const packageLockPath = join(options.rootDir, "pnpm-lock.yaml");
  const packageLockSha256 = await fileSha256(packageLockPath).catch(() => null);
  const publicKeySha256 = options.publicKeyInfo.publicKeySpkiSha256 ?? options.publicKeyInfo.spkiSha256 ?? null;
  const sbom = {
    artifact: {
      mediaType: "application/gzip",
      name: options.artifactName,
      sha256: options.artifactSha256
    },
    components: files.map((file) => ({
      executable: file.executable,
      name: file.path,
      sha256: file.sha256,
      size: file.size,
      type: file.path === "package.json" ? "package-manifest" : file.executable ? "executable" : "file"
    })),
    formatVersion: 1,
    generatedAt,
    generator: "tools/build-nipmod-release.ts",
    package: {
      name: "nipmod",
      version: options.version
    },
    summary: {
      components: files.length,
      executableComponents: files.filter((file) => file.executable).length
    },
    type: RELEASE_SBOM_TYPE
  };
  const provenance = {
    artifact: {
      mediaType: "application/gzip",
      name: options.artifactName,
      sha256: options.artifactSha256
    },
    build: {
      builder: "tools/build-nipmod-release.ts",
      entrypoint: "nipmod/src/cli.ts",
      packageManager: "pnpm@10.30.0",
      target: "node22-esm-bundle"
    },
    formatVersion: 1,
    generatedAt,
    materials: [
      ...(packageLockSha256
        ? [
            {
              path: "pnpm-lock.yaml",
              sha256: packageLockSha256,
              type: "lockfile"
            }
          ]
        : []),
      ...files.map((file) => ({
        path: file.path,
        sha256: file.sha256,
        type: file.path === "package.json" ? "release-manifest" : "release-file"
      }))
    ],
    package: {
      name: "nipmod",
      version: options.version
    },
    signing: {
      algorithm: "Ed25519",
      publicKeySpkiSha256: publicKeySha256
    },
    source: {
      commit: source.commit,
      dirty: source.dirty,
      repository: "https://github.com/nipmod/nipmod"
    },
    type: RELEASE_PROVENANCE_TYPE
  };

  const sbomPath = `${options.artifactPath}.sbom.json`;
  const provenancePath = `${options.artifactPath}.provenance.json`;
  await writeFile(sbomPath, `${JSON.stringify(sbom, null, 2)}\n`);
  await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
  return { provenancePath, sbomPath };
}

export async function collectReleaseInventory(stageDir: string): Promise<ReleaseInventoryFile[]> {
  const files: ReleaseInventoryFile[] = [];
  await collect(stageDir, stageDir, files);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

async function collect(root: string, dir: string, files: ReleaseInventoryFile[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collect(root, absolute, files);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const bytes = await readFile(absolute);
    const fileStat = await stat(absolute);
    files.push({
      executable: (fileStat.mode & 0o111) !== 0,
      path: toPosix(relative(root, absolute)),
      sha256: sha256(bytes),
      size: bytes.byteLength
    });
  }
}

async function fileSha256(path: string): Promise<string> {
  return sha256(await readFile(path));
}

function sha256(bytes: Buffer | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function readGitSourceState(rootDir: string): { commit: string | null; dirty: boolean } {
  const commit = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  });
  const status = spawnSync("git", ["status", "--porcelain"], {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  });
  return {
    commit: commit.status === 0 && /^[a-f0-9]{40}$/.test(commit.stdout.trim()) ? commit.stdout.trim() : null,
    dirty: status.status !== 0 || status.stdout.trim().length > 0
  };
}

function toPosix(path: string): string {
  return path.split(sep).join("/");
}
