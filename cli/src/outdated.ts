import { join } from "node:path";
import { readLockfile, type Lockfile, type LockfilePackage } from "./lockfile.js";
import { searchRegistries, searchRegistry, type RegistrySearchPackage } from "./registry.js";
import { versionSatisfies, type DependencyKind } from "./resolver.js";

export interface OutdatedPackage {
  canonical: string;
  current: string;
  latest: string | null;
  name: string;
  packageKey: string;
  rootKind: DependencyKind | null;
  spec: string;
  status: "missing" | "outdated";
  wanted: string | null;
}

export interface OutdatedReport {
  formatVersion: 1;
  outdated: OutdatedPackage[];
  registrySources: string[];
  summary: {
    checked: number;
    current: number;
    missing: number;
    outdated: number;
  };
}

export async function checkOutdatedPackages(options: {
  fetchImpl?: typeof fetch;
  includeQuarantined?: boolean;
  projectDir: string;
  registryUrls: readonly string[];
}): Promise<OutdatedReport> {
  const lockfile = await readLockfile(join(options.projectDir, "nipmod.lock.json"));
  const registry =
    options.registryUrls.length > 1
      ? await searchRegistries({
          ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
          ...(options.includeQuarantined === undefined ? {} : { includeQuarantined: options.includeQuarantined }),
          limit: 10_000,
          query: "",
          registryUrls: options.registryUrls
        })
      : await searchRegistry({
          ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
          ...(options.includeQuarantined === undefined ? {} : { includeQuarantined: options.includeQuarantined }),
          limit: 10_000,
          query: "",
          registryUrl: options.registryUrls[0]!
        });

  const packages = Object.entries(lockfile.packages).map(([packageKey, pkg]) =>
    outdatedPackage(packageKey, pkg, lockfile, registry.packages)
  );
  const outdated = packages.filter((pkg): pkg is OutdatedPackage => pkg !== null);

  return {
    formatVersion: 1,
    outdated,
    registrySources: registry.sources,
    summary: {
      checked: Object.keys(lockfile.packages).length,
      current: Object.keys(lockfile.packages).length - outdated.length,
      missing: outdated.filter((pkg) => pkg.status === "missing").length,
      outdated: outdated.filter((pkg) => pkg.status === "outdated").length
    }
  };
}

function outdatedPackage(
  packageKey: string,
  locked: LockfilePackage,
  lockfile: Lockfile,
  registryPackages: readonly RegistrySearchPackage[]
): OutdatedPackage | null {
  const spec = rootSpecForPackage(locked, lockfile);
  const candidates = registryPackages
    .filter((pkg) => pkg.canonical === locked.canonical && pkg.trustScore >= 100)
    .sort((left, right) => compareSemverDesc(left.version, right.version));
  const latest = candidates[0];
  if (!latest) {
    return {
      canonical: locked.canonical,
      current: locked.version,
      latest: null,
      name: locked.name,
      packageKey,
      rootKind: spec.kind,
      spec: spec.value,
      status: "missing",
      wanted: null
    };
  }

  const wanted = candidates.find((candidate) => versionSatisfies(candidate.version, spec.value, candidate.distTags ?? {})) ?? latest;
  if (compareSemverDesc(wanted.version, locked.version) >= 0 && compareSemverDesc(latest.version, locked.version) >= 0) {
    return null;
  }

  return {
    canonical: locked.canonical,
    current: locked.version,
    latest: latest.version,
    name: locked.name,
    packageKey,
    rootKind: spec.kind,
    spec: spec.value,
    status: "outdated",
    wanted: wanted.version
  };
}

function rootSpecForPackage(locked: LockfilePackage, lockfile: Lockfile): { kind: DependencyKind | null; value: string } {
  const kinds: DependencyKind[] = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
  for (const kind of kinds) {
    const spec = lockfile.root[kind][locked.name] ?? lockfile.root[kind][locked.canonical];
    if (spec) {
      return { kind, value: spec };
    }
  }
  return { kind: null, value: "latest" };
}

function compareSemverDesc(left: string, right: string): number {
  const leftParts = parseSemver(left);
  const rightParts = parseSemver(right);
  return rightParts[0] - leftParts[0] || rightParts[1] - leftParts[1] || rightParts[2] - leftParts[2];
}

function parseSemver(value: string): [major: number, minor: number, patch: number] {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  if (!match) {
    throw new Error(`invalid semver: ${value}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
