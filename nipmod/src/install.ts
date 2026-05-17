import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { type NipmodBundle, verifyBundle } from "./bundle.js";
import { readResponseBytes } from "./http.js";
import { digestFromIntegrity } from "./integrity.js";
import {
  emptySnapshot,
  isAllowedResolvedUrl,
  readOptionalFile,
  readLockfile,
  type Lockfile,
  type LockfilePackage,
  type LockfileSnapshot
} from "./lockfile.js";
import {
  dependencyEntriesFromManifest,
  resolveDependencyGraph,
  type DependencyRequest,
  type RegistryResolverPackage
} from "./resolver.js";
import {
  type InstallGraphPackage,
  type InstallOptions,
  type InstalledPackageSummary,
  type InstallResult,
  type UninstallResult
} from "./install-types.js";
import { canonicalJson } from "./verifier.js";

export { isValidLockfilePackage } from "./lockfile.js";
export type { InstallGraphPackage, InstallOptions, InstalledPackageSummary, InstallResult, UninstallResult } from "./install-types.js";

interface VerifiedGraphPackage {
  bundle: NipmodBundle;
  bundleBytes: Uint8Array;
  digest: string;
  integrity: string;
  packageKey: string;
  record: LockfilePackage;
  rootDependency?: DependencyRequest;
}

export interface InstallLockfileResult extends InstallResult {
  fetched: number;
  packageCount: number;
  restored: number;
}

type LockedBundleSource = "file" | "remote" | "store";
type LockfileValidator = (lockfile: Lockfile) => Promise<void> | void;

const BUNDLE_LIMIT = 50 * 1024 * 1024;
const LOCKFILE_PACKAGE_LIMIT = 128;

export async function installFilePackage(
  bundlePath: string,
  projectDir: string,
  options: InstallOptions = {}
): Promise<InstallResult> {
  const absoluteBundlePath = resolve(bundlePath);
  const bytes = await readFile(absoluteBundlePath);

  return installBundlePackage(bytes, pathToFileURL(absoluteBundlePath).href, projectDir, options);
}

export async function installBundlePackage(
  bundleBytes: Uint8Array,
  resolved: string,
  projectDir: string,
  options: InstallOptions = {}
): Promise<InstallResult> {
  if (!options.integrity) {
    throw new Error("external integrity is required for install");
  }

  const graphPackage: InstallGraphPackage = {
    bundleBytes,
    integrity: options.integrity,
    resolved
  };
  if (options.expected) {
    graphPackage.expected = options.expected;
  }
  if (options.rootDependency) {
    graphPackage.rootDependency = options.rootDependency;
  }
  const verified = verifyGraphPackage(graphPackage);
  return installVerifiedPackages([verified], projectDir, { enforceRequiredDependencies: false });
}

export async function installPackageGraph(
  packages: readonly InstallGraphPackage[],
  projectDir: string,
  options: {
    validateLockfile?: (lockfile: Lockfile) => Promise<void> | void;
  } = {}
): Promise<InstallResult> {
  const verified = packages.map(verifyGraphPackage);
  const installOptions: {
    enforceRequiredDependencies: boolean;
    validateLockfile?: LockfileValidator;
  } = { enforceRequiredDependencies: true };
  if (options.validateLockfile) {
    installOptions.validateLockfile = options.validateLockfile;
  }
  return installVerifiedPackages(verified, projectDir, installOptions);
}

async function installVerifiedPackages(
  packages: readonly VerifiedGraphPackage[],
  projectDir: string,
  options: {
    enforceRequiredDependencies: boolean;
    validateLockfile?: LockfileValidator;
  }
): Promise<InstallResult> {
  const lockfilePath = join(projectDir, "nipmod.lock.json");
  const lockfile = await readLockfile(lockfilePath);
  applyVerifiedPackages(lockfile, packages, { enforceRequiredDependencies: options.enforceRequiredDependencies });
  await options.validateLockfile?.(lockfile);
  await writeVerifiedStores(projectDir, packages);

  const nextLockfile = `${canonicalJson(lockfile)}\n`;
  const previousLockfile = await readOptionalFile(lockfilePath);
  if (previousLockfile === nextLockfile) {
    return { lockfileChanged: false };
  }

  await mkdir(projectDir, { recursive: true });
  await writeFile(lockfilePath, nextLockfile);
  return { lockfileChanged: true };
}

export async function installLockfilePackages(
  projectDir: string,
  options: {
    allowNetwork?: boolean;
    fetchImpl?: typeof fetch;
    validateLockfile?: LockfileValidator;
  } = {}
): Promise<InstallLockfileResult> {
  const lockfile = await readLockfile(join(projectDir, "nipmod.lock.json"));
  const entries = Object.entries(lockfile.packages);
  if (entries.length === 0) {
    await options.validateLockfile?.(lockfile);
    return {
      fetched: 0,
      lockfileChanged: false,
      packageCount: 0,
      restored: 0
    };
  }
  if (entries.length > LOCKFILE_PACKAGE_LIMIT) {
    throw new Error(`lockfile install exceeds ${LOCKFILE_PACKAGE_LIMIT} packages`);
  }

  const restored: Array<{
    bundleBytes: Uint8Array;
    expected: { canonical: string; version: string };
    integrity: string;
    resolved: string;
    source: LockedBundleSource;
  }> = [];
  for (const [packageKey, pkg] of entries) {
    const bundle = await readLockedPackageBundle(projectDir, packageKey, pkg, options);
    restored.push({
      bundleBytes: bundle.bytes,
      expected: {
        canonical: pkg.canonical,
        version: pkg.version
      },
      integrity: pkg.integrity,
      resolved: pkg.resolved,
      source: bundle.source
    });
  }
  const installOptions: {
    validateLockfile?: LockfileValidator;
  } = {};
  if (options.validateLockfile) {
    installOptions.validateLockfile = options.validateLockfile;
  }
  const result = await installPackageGraph(
    restored.map((pkg) => ({
      bundleBytes: pkg.bundleBytes,
      expected: pkg.expected,
      integrity: pkg.integrity,
      resolved: pkg.resolved
    })),
    projectDir,
    installOptions
  );

  return {
    fetched: restored.filter((pkg) => pkg.source === "remote").length,
    lockfileChanged: result.lockfileChanged,
    packageCount: entries.length,
    restored: restored.filter((pkg) => pkg.source !== "store").length
  };
}

export async function listInstalledPackages(projectDir: string): Promise<InstalledPackageSummary[]> {
  const lockfile = await readLockfile(join(projectDir, "nipmod.lock.json"));
  return Object.entries(lockfile.packages)
    .map(([packageKey, pkg]) => ({
      canonical: pkg.canonical,
      integrity: pkg.integrity,
      name: pkg.name,
      packageKey,
      publisher: pkg.publisher,
      version: pkg.version
    }))
    .sort((left, right) => left.name.localeCompare(right.name) || left.version.localeCompare(right.version));
}

export async function uninstallPackage(query: string, projectDir: string): Promise<UninstallResult> {
  const lockfilePath = join(projectDir, "nipmod.lock.json");
  const lockfile = await readLockfile(lockfilePath);
  const matches = Object.entries(lockfile.packages).filter(([packageKey, pkg]) =>
    [packageKey, pkg.name, pkg.canonical, `${pkg.canonical}@${pkg.version}`].includes(query)
  );

  if (matches.length > 1) {
    throw new Error(`uninstall query is ambiguous: ${query}`);
  }

  if (matches.length === 0) {
    return {
      lockfileChanged: false,
      removed: false,
      removedPackages: []
    };
  }

  const [packageKey, pkg] = matches[0] ?? [];
  if (!packageKey || !pkg) {
    throw new Error("uninstall failed to resolve package");
  }

  delete lockfile.packages[packageKey];
  delete lockfile.snapshots[packageKey];
  removeRootDependency(lockfile, pkg.name);
  await writeFile(lockfilePath, `${canonicalJson(lockfile)}\n`);
  return {
    lockfileChanged: true,
    removed: true,
    removedPackages: [
      {
        canonical: pkg.canonical,
        integrity: pkg.integrity,
        name: pkg.name,
        packageKey,
        publisher: pkg.publisher,
        version: pkg.version
      }
    ]
  };
}

async function readLockedPackageBundle(
  projectDir: string,
  packageKey: string,
  pkg: LockfilePackage,
  options: { allowNetwork?: boolean; fetchImpl?: typeof fetch }
): Promise<{ bytes: Uint8Array; source: LockedBundleSource }> {
  const expectedDigest = digestFromIntegrity(pkg.integrity);
  const resolved = new URL(pkg.resolved);
  if (pkg.storePath) {
    try {
      const bytes = await readFile(join(projectDir, pkg.storePath));
      if (sha256Hex(bytes) !== expectedDigest) {
        if (resolved.protocol !== "file:" && !options.allowNetwork) {
          throw new Error(`cached bundle digest mismatch for ${packageKey}; run without --offline to refetch`);
        }
      } else {
        return {
          bytes,
          source: "store"
        };
      }
    } catch (error) {
      if (!isEnoent(error)) {
        throw error;
      }
    }
  }

  if (resolved.protocol === "file:") {
    return {
      bytes: await readFile(fileURLToPath(resolved)),
      source: "file"
    };
  }
  if (!options.allowNetwork) {
    throw new Error(`lockfile install requires network access for ${packageKey}; run without --offline`);
  }
  const response = await (options.fetchImpl ?? fetch)(resolved.href, {
    redirect: "error",
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) {
    throw new Error(`failed to fetch locked package ${packageKey}: ${response.status}`);
  }
  return {
    bytes: await readResponseBytes(response, { label: "bundle", maxBytes: BUNDLE_LIMIT }),
    source: "remote"
  };
}

async function writeStoreBundle(projectDir: string, digest: string, bundleBytes: Uint8Array): Promise<string> {
  const relativePath = `.nipmod/store/sha256/${digest}/bundle.nipmod`;
  const absolutePath = join(projectDir, relativePath);
  await mkdir(join(projectDir, ".nipmod", "store", "sha256", digest), { recursive: true });
  await writeFile(absolutePath, bundleBytes);
  return relativePath;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isEnoent(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function verifyGraphPackage(input: InstallGraphPackage): VerifiedGraphPackage {
  if (!input.integrity) {
    throw new Error("external integrity is required for install");
  }
  if (!isAllowedResolvedUrl(input.resolved)) {
    throw new Error("resolved package URL must be file:, https:, or loopback http:");
  }

  const digest = digestFromIntegrity(input.integrity);
  const bundle = verifyBundle(input.bundleBytes, digest, { requireSignature: true });
  if (input.expected && (bundle.manifest.canonical !== input.expected.canonical || bundle.manifest.version !== input.expected.version)) {
    throw new Error(
      `bundle identity mismatch: expected ${input.expected.canonical}@${input.expected.version}, got ${bundle.manifest.canonical}@${bundle.manifest.version}`
    );
  }

  const storePath = `.nipmod/store/sha256/${digest}/bundle.nipmod`;
  const packageKey = `${bundle.manifest.canonical}@${bundle.manifest.version}`;
  return {
    bundle,
    bundleBytes: input.bundleBytes,
    digest,
    integrity: input.integrity,
    packageKey,
    record: {
      canonical: bundle.manifest.canonical,
      files: bundle.files.map((file) => file.path),
      integrity: input.integrity,
      manifestDigest: bundle.manifestDigest,
      name: bundle.manifest.name,
      permissions: bundle.manifest.permissions,
      publisher: bundle.manifest.publish.signingKey,
      resolved: input.resolved,
      storePath,
      version: bundle.manifest.version
    },
    ...(input.rootDependency ? { rootDependency: input.rootDependency } : {})
  };
}

function applyVerifiedPackages(
  lockfile: Lockfile,
  packages: readonly VerifiedGraphPackage[],
  options: { enforceRequiredDependencies: boolean }
): void {
  const candidates = resolverPackagesFromLockfile(lockfile, packages);
  for (const entry of packages) {
    lockfile.packages[entry.packageKey] = entry.record;
    lockfile.snapshots[entry.packageKey] = snapshotFromBundle(entry.bundle, candidates, options);
    if (entry.rootDependency) {
      lockfile.root[entry.rootDependency.kind][entry.rootDependency.name] = entry.rootDependency.spec;
    }
  }
}

async function writeVerifiedStores(projectDir: string, packages: readonly VerifiedGraphPackage[]): Promise<void> {
  for (const entry of packages) {
    await writeStoreBundle(projectDir, entry.digest, entry.bundleBytes);
  }
}

function snapshotFromBundle(
  bundle: NipmodBundle,
  candidates: readonly RegistryResolverPackage[],
  options: { enforceRequiredDependencies: boolean }
): LockfileSnapshot {
  const snapshot = emptySnapshot();
  const result = resolveDependencyGraph({
    packages: candidates,
    requests: dependencyEntriesFromManifest(bundle.manifest)
  });
  const missingRequired = result.unresolved.filter((dependency) => dependency.kind === "dependencies");
  if (options.enforceRequiredDependencies && missingRequired.length > 0) {
    const details = missingRequired.map((dependency) => `${dependency.name}@${dependency.spec}: ${dependency.reason}`).join(", ");
    throw new Error(`missing dependency for ${bundle.manifest.canonical}@${bundle.manifest.version}: ${details}`);
  }
  for (const dependency of result.resolved) {
    snapshot[dependency.kind][dependency.name] = `${dependency.canonical}@${dependency.version}`;
  }
  return snapshot;
}

function resolverPackagesFromLockfile(
  lockfile: Lockfile,
  verifiedPackages: readonly VerifiedGraphPackage[]
): RegistryResolverPackage[] {
  return [
    ...Object.values(lockfile.packages).map((pkg) => ({
      canonical: pkg.canonical,
      digest: digestFromIntegrity(pkg.integrity),
      name: pkg.name,
      trustScore: 100,
      version: pkg.version
    })),
    ...verifiedPackages.map((entry) => ({
      canonical: entry.record.canonical,
      digest: entry.digest,
      name: entry.record.name,
      trustScore: 100,
      version: entry.record.version
    }))
  ];
}

function removeRootDependency(lockfile: Lockfile, name: string): void {
  for (const kind of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"] as const) {
    if (lockfile.root[kind][name] !== undefined) {
      delete lockfile.root[kind][name];
    }
  }
}
