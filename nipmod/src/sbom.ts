import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { verifyBundle } from "./bundle.js";
import { digestFromIntegrity } from "./integrity.js";
import { readLockfile, type Lockfile, type LockfilePackage, type LockfileSnapshot } from "./lockfile.js";
import { type DependencyKind } from "./resolver.js";
import { NIPMOD_VERSION } from "./version.js";

export interface AgentSbom {
  formatVersion: 1;
  generatedAt: string;
  generator: {
    name: "nipmod";
    version: string;
  };
  packages: SbomPackage[];
  root: Record<DependencyKind, Record<string, string>>;
  summary: {
    dependencyEdges: number;
    packageCount: number;
    permissions: PermissionSummary;
  };
  type: "dev.nipmod.sbom.v1";
}

export interface SbomPackage {
  canonical: string;
  dependencies: Record<DependencyKind, SbomDependency[]>;
  files: string[];
  integrity: string;
  manifest: SbomManifest | null;
  manifestDigest: string;
  manifestStatus: "missing-store" | "verified";
  name: string;
  packageKey: string;
  permissions: LockfilePackage["permissions"];
  publisher: string;
  resolved: string;
  storePath?: string;
  version: string;
}

export interface SbomDependency {
  canonical: string | null;
  missing: boolean;
  name: string;
  packageKey: string;
  version: string | null;
}

export interface SbomManifest {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  exports: Record<string, Record<string, string>>;
  optionalDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  type: string;
}

interface PermissionSummary {
  env: number;
  exec: number;
  filesystem: number;
  mcpTools: number;
  network: number;
  postinstall: number;
  secrets: number;
}

const DEPENDENCY_KINDS: DependencyKind[] = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];

export async function generateSbom(
  projectDir: string,
  options: {
    generatedAt?: string;
  } = {}
): Promise<AgentSbom> {
  const lockfile = await readLockfile(join(projectDir, "nipmod.lock.json"));
  const packages = await Promise.all(
    Object.entries(lockfile.packages)
      .sort(compareLockfilePackageEntries)
      .map(async ([packageKey, pkg]) => packageSbom(projectDir, packageKey, pkg, lockfile))
  );

  return {
    formatVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    generator: {
      name: "nipmod",
      version: NIPMOD_VERSION
    },
    packages,
    root: lockfile.root,
    summary: {
      dependencyEdges: packages.reduce(
        (total, pkg) => total + DEPENDENCY_KINDS.reduce((sum, kind) => sum + pkg.dependencies[kind].length, 0),
        0
      ),
      packageCount: packages.length,
      permissions: summarizePermissions(packages)
    },
    type: "dev.nipmod.sbom.v1"
  };
}

async function packageSbom(
  projectDir: string,
  packageKey: string,
  pkg: LockfilePackage,
  lockfile: Lockfile
): Promise<SbomPackage> {
  const manifest = await verifiedManifestFromStore(projectDir, packageKey, pkg);
  const snapshot = lockfile.snapshots[packageKey] ?? emptySnapshot();
  return {
    canonical: pkg.canonical,
    dependencies: Object.fromEntries(
      DEPENDENCY_KINDS.map((kind) => [kind, dependencyEntries(snapshot[kind], lockfile.packages)])
    ) as Record<DependencyKind, SbomDependency[]>,
    files: [...pkg.files],
    integrity: pkg.integrity,
    manifest: manifest.manifest,
    manifestDigest: pkg.manifestDigest,
    manifestStatus: manifest.status,
    name: pkg.name,
    packageKey,
    permissions: pkg.permissions,
    publisher: pkg.publisher,
    resolved: pkg.resolved,
    ...(pkg.storePath ? { storePath: pkg.storePath } : {}),
    version: pkg.version
  };
}

async function verifiedManifestFromStore(
  projectDir: string,
  packageKey: string,
  pkg: LockfilePackage
): Promise<{ manifest: SbomManifest | null; status: "missing-store" | "verified" }> {
  if (!pkg.storePath) {
    return { manifest: null, status: "missing-store" };
  }

  let bytes: Uint8Array;
  try {
    bytes = await readFile(join(projectDir, pkg.storePath));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { manifest: null, status: "missing-store" };
    }
    throw error;
  }
  const bundle = verifyBundle(bytes, digestFromIntegrity(pkg.integrity), { requireSignature: true });
  if (bundle.manifest.canonical !== pkg.canonical || bundle.manifest.version !== pkg.version) {
    throw new Error(`sbom package identity mismatch for ${packageKey}`);
  }
  if (bundle.manifestDigest !== pkg.manifestDigest) {
    throw new Error(`sbom manifest digest mismatch for ${packageKey}`);
  }
  return {
    manifest: {
      dependencies: bundle.manifest.dependencies ?? {},
      devDependencies: bundle.manifest.devDependencies ?? {},
      exports: bundle.manifest.exports,
      optionalDependencies: bundle.manifest.optionalDependencies ?? {},
      peerDependencies: bundle.manifest.peerDependencies ?? {},
      type: bundle.manifest.type
    },
    status: "verified"
  };
}

function dependencyEntries(
  dependencies: Record<string, string>,
  packages: Record<string, LockfilePackage>
): SbomDependency[] {
  return Object.entries(dependencies)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, packageKey]) => {
      const target = packages[packageKey];
      return {
        canonical: target?.canonical ?? null,
        missing: !target,
        name,
        packageKey,
        version: target?.version ?? null
      };
    });
}

function summarizePermissions(packages: SbomPackage[]): PermissionSummary {
  return packages.reduce(
    (summary, pkg) => ({
      env: summary.env + pkg.permissions.env.length,
      exec: summary.exec + (pkg.permissions.exec.allowed ? 1 : 0),
      filesystem: summary.filesystem + pkg.permissions.filesystem.length,
      mcpTools: summary.mcpTools + pkg.permissions.mcpTools.length,
      network: summary.network + pkg.permissions.network.length,
      postinstall: summary.postinstall + (pkg.permissions.postinstall.allowed ? 1 : 0),
      secrets: summary.secrets + pkg.permissions.secrets.length
    }),
    {
      env: 0,
      exec: 0,
      filesystem: 0,
      mcpTools: 0,
      network: 0,
      postinstall: 0,
      secrets: 0
    }
  );
}

function compareLockfilePackageEntries(
  [leftKey, left]: [string, LockfilePackage],
  [rightKey, right]: [string, LockfilePackage]
): number {
  return left.name.localeCompare(right.name) || left.version.localeCompare(right.version) || leftKey.localeCompare(rightKey);
}

function emptySnapshot(): LockfileSnapshot {
  return {
    dependencies: {},
    devDependencies: {},
    optionalDependencies: {},
    peerDependencies: {}
  };
}
