import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { type NipmodBundle, verifyBundle } from "./bundle.js";
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
  const lockfilePath = join(projectDir, "nipmod.lock.json");
  const lockfile = await readLockfile(lockfilePath);
  applyVerifiedPackages(lockfile, [verified], { enforceRequiredDependencies: false });
  await writeVerifiedStores(projectDir, [verified]);

  const nextLockfile = `${canonicalJson(lockfile)}\n`;
  const previousLockfile = await readOptionalFile(lockfilePath);
  if (previousLockfile === nextLockfile) {
    return { lockfileChanged: false };
  }

  await mkdir(projectDir, { recursive: true });
  await writeFile(lockfilePath, nextLockfile);
  return { lockfileChanged: true };
}

export async function installPackageGraph(
  packages: readonly InstallGraphPackage[],
  projectDir: string
): Promise<InstallResult> {
  const verified = packages.map(verifyGraphPackage);
  const lockfilePath = join(projectDir, "nipmod.lock.json");
  const lockfile = await readLockfile(lockfilePath);
  applyVerifiedPackages(lockfile, verified, { enforceRequiredDependencies: true });
  await writeVerifiedStores(projectDir, verified);

  const nextLockfile = `${canonicalJson(lockfile)}\n`;
  const previousLockfile = await readOptionalFile(lockfilePath);
  if (previousLockfile === nextLockfile) {
    return { lockfileChanged: false };
  }

  await mkdir(projectDir, { recursive: true });
  await writeFile(lockfilePath, nextLockfile);
  return { lockfileChanged: true };
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

async function writeStoreBundle(projectDir: string, digest: string, bundleBytes: Uint8Array): Promise<string> {
  const relativePath = `.nipmod/store/sha256/${digest}/bundle.nipmod`;
  const absolutePath = join(projectDir, relativePath);
  await mkdir(join(projectDir, ".nipmod", "store", "sha256", digest), { recursive: true });
  await writeFile(absolutePath, bundleBytes);
  return relativePath;
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
