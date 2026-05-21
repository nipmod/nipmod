import { createHash } from "node:crypto";
import { lstat, mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
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

export interface PruneUnreachableResult extends InstallResult {
  removedPackageKeys: string[];
}

type LockedBundleSource = "file" | "remote" | "store";
type LockfileValidator = (lockfile: Lockfile) => Promise<void> | void;
type LockfileFinalizer = (lockfile: Lockfile) => Promise<void> | void;
const DEPENDENCY_KINDS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"] as const;

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
    finalizeLockfile?: LockfileFinalizer;
    validateLockfile?: (lockfile: Lockfile) => Promise<void> | void;
  } = {}
): Promise<InstallResult> {
  const verified = packages.map(verifyGraphPackage);
  const installOptions: {
    enforceRequiredDependencies: boolean;
    finalizeLockfile?: LockfileFinalizer;
    validateLockfile?: LockfileValidator;
  } = { enforceRequiredDependencies: true };
  if (options.finalizeLockfile) {
    installOptions.finalizeLockfile = options.finalizeLockfile;
  }
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
    finalizeLockfile?: LockfileFinalizer;
    validateLockfile?: LockfileValidator;
  }
): Promise<InstallResult> {
  const lockfilePath = join(projectDir, "nipmod.lock.json");
  const lockfile = await readLockfile(lockfilePath);
  applyVerifiedPackages(lockfile, packages, { enforceRequiredDependencies: options.enforceRequiredDependencies });
  await options.finalizeLockfile?.(lockfile);
  await options.validateLockfile?.(lockfile);
  await writeVerifiedStores(projectDir, packages);

  const nextLockfile = `${canonicalJson(lockfile)}\n`;
  const previousLockfile = await readOptionalFile(lockfilePath);
  if (previousLockfile === nextLockfile) {
    return { lockfileChanged: false };
  }

  await writeTextFileAtomic(lockfilePath, nextLockfile);
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

  const removedPackages: InstalledPackageSummary[] = [installedPackageSummary(packageKey, pkg)];
  delete lockfile.packages[packageKey];
  delete lockfile.snapshots[packageKey];
  removeRootDependency(lockfile, pkg.name);
  removeRootDependency(lockfile, pkg.canonical);
  const packagesBeforePrune = new Map(Object.entries(lockfile.packages));
  const prunedPackageKeys = pruneUnreachableLockfile(lockfile);
  for (const prunedPackageKey of prunedPackageKeys) {
    const prunedPackage = packagesBeforePrune.get(prunedPackageKey);
    if (prunedPackage) {
      removedPackages.push(installedPackageSummary(prunedPackageKey, prunedPackage));
    }
  }
  await writeTextFileAtomic(lockfilePath, `${canonicalJson(lockfile)}\n`);
  return {
    lockfileChanged: true,
    removed: true,
    removedPackages
  };
}

function installedPackageSummary(packageKey: string, pkg: LockfilePackage): InstalledPackageSummary {
  return {
    canonical: pkg.canonical,
    integrity: pkg.integrity,
    name: pkg.name,
    packageKey,
    publisher: pkg.publisher,
    version: pkg.version
  };
}

export async function pruneUnreachablePackages(projectDir: string): Promise<PruneUnreachableResult> {
  const lockfilePath = join(projectDir, "nipmod.lock.json");
  const lockfile = await readLockfile(lockfilePath);
  const rootRequests = rootDependencyRequests(lockfile);
  if (rootRequests.length === 0) {
    return {
      lockfileChanged: false,
      removedPackageKeys: []
    };
  }

  const removedPackageKeys = pruneUnreachableLockfile(lockfile);
  if (removedPackageKeys.length === 0) {
    return {
      lockfileChanged: false,
      removedPackageKeys
    };
  }

  await writeTextFileAtomic(lockfilePath, `${canonicalJson(lockfile)}\n`);
  return {
    lockfileChanged: true,
    removedPackageKeys
  };
}

export function pruneUnreachableLockfile(
  lockfile: Lockfile,
  options: { rootPackageKeys?: readonly string[] } = {}
): string[] {
  const rootPackageKeys = options.rootPackageKeys ?? rootDependencyRequests(lockfile).map((request) => resolveInstalledRoot(lockfile, request));
  const reachable = reachablePackageKeys(lockfile, rootPackageKeys);
  const removedPackageKeys = Object.keys(lockfile.packages)
    .filter((packageKey) => !reachable.has(packageKey))
    .sort();
  for (const packageKey of removedPackageKeys) {
    delete lockfile.packages[packageKey];
    delete lockfile.snapshots[packageKey];
  }
  for (const snapshot of Object.values(lockfile.snapshots)) {
    for (const kind of DEPENDENCY_KINDS) {
      for (const [dependencyName, packageKey] of Object.entries(snapshot[kind])) {
        if (removedPackageKeys.includes(packageKey)) {
          delete snapshot[kind][dependencyName];
        }
      }
    }
  }
  return removedPackageKeys;
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
  const directory = join(projectDir, ".nipmod", "store", "sha256", digest);
  await mkdirNoSymlinkPath(projectDir, [".nipmod", "store", "sha256", digest]);
  await writeBytesFileAtomic(join(directory, "bundle.nipmod"), bundleBytes);
  return relativePath;
}

async function mkdirNoSymlinkPath(root: string, parts: readonly string[]): Promise<void> {
  await mkdir(root, { recursive: true });
  await assertDirectoryNotSymlink(root);
  let current = root;
  for (const part of parts) {
    current = join(current, part);
    await assertNotSymlink(current);
    await mkdir(current).catch((error: unknown) => {
      if (!isEexist(error)) {
        throw error;
      }
    });
    await assertDirectoryNotSymlink(current);
  }
}

async function assertDirectoryNotSymlink(path: string): Promise<void> {
  const stats = await lstat(path);
  if (stats.isSymbolicLink()) {
    throw new Error(`refusing to write through symlinked store path: ${path}`);
  }
  if (!stats.isDirectory()) {
    throw new Error(`store path is not a directory: ${path}`);
  }
}

async function assertNotSymlink(path: string): Promise<void> {
  try {
    const stats = await lstat(path);
    if (stats.isSymbolicLink()) {
      throw new Error(`refusing to write through symlinked store path: ${path}`);
    }
  } catch (error) {
    if (!isEnoent(error)) {
      throw error;
    }
  }
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function writeTextFileAtomic(path: string, contents: string): Promise<void> {
  await writeBytesFileAtomic(path, Buffer.from(contents, "utf8"));
}

async function writeBytesFileAtomic(path: string, contents: Uint8Array): Promise<void> {
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });
  const tempPath = join(dir, `.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    handle = await open(tempPath, "wx");
    await handle.writeFile(contents);
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(tempPath, path);
    await syncDirectory(dir);
  } catch (error) {
    if (handle) {
      await handle.close().catch(() => undefined);
    }
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

function isEexist(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}

async function syncDirectory(path: string): Promise<void> {
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    handle = await open(path, "r");
    await handle.sync();
  } catch {
    return;
  } finally {
    await handle?.close().catch(() => undefined);
  }
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
  const candidates = resolverPackagesFromVerifiedPackages(packages);
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

function resolverPackagesFromVerifiedPackages(verifiedPackages: readonly VerifiedGraphPackage[]): RegistryResolverPackage[] {
  return verifiedPackages.map((entry) => ({
    canonical: entry.record.canonical,
    digest: entry.digest,
    name: entry.record.name,
    trustScore: 100,
    version: entry.record.version
  }));
}

function removeRootDependency(lockfile: Lockfile, name: string): void {
  for (const kind of DEPENDENCY_KINDS) {
    if (lockfile.root[kind][name] !== undefined) {
      delete lockfile.root[kind][name];
    }
  }
}

function rootDependencyRequests(lockfile: Lockfile): DependencyRequest[] {
  return DEPENDENCY_KINDS.flatMap((kind) =>
    Object.entries(lockfile.root[kind]).map(([name, spec]) => ({
      kind,
      name,
      spec
    }))
  );
}

function resolveInstalledRoot(lockfile: Lockfile, request: DependencyRequest): string {
  const candidates = Object.values(lockfile.packages).map((pkg): RegistryResolverPackage => ({
    canonical: pkg.canonical,
    digest: digestFromIntegrity(pkg.integrity),
    name: pkg.name,
    trustScore: 100,
    version: pkg.version
  }));
  const resolved = resolveDependencyGraph({
    packages: candidates,
    requests: [request]
  }).resolved[0];
  if (!resolved) {
    throw new Error(`lockfile root cannot resolve installed package ${request.name}@${request.spec}`);
  }
  return `${resolved.canonical}@${resolved.version}`;
}

function reachablePackageKeys(lockfile: Lockfile, rootPackageKeys: readonly string[]): Set<string> {
  const reachable = new Set<string>();
  const queue = [...rootPackageKeys];
  while (queue.length > 0) {
    const packageKey = queue.shift();
    if (!packageKey || reachable.has(packageKey)) {
      continue;
    }
    if (!lockfile.packages[packageKey]) {
      throw new Error(`lockfile snapshot references missing package ${packageKey}`);
    }
    reachable.add(packageKey);
    const snapshot = lockfile.snapshots[packageKey] ?? emptySnapshot();
    for (const kind of DEPENDENCY_KINDS) {
      for (const dependencyPackageKey of Object.values(snapshot[kind])) {
        if (!reachable.has(dependencyPackageKey)) {
          queue.push(dependencyPackageKey);
        }
      }
    }
  }
  return reachable;
}
