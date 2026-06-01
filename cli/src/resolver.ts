import { type Manifest } from "./protocol.js";

export type DependencyKind = "dependencies" | "devDependencies" | "optionalDependencies" | "peerDependencies";

export interface DependencyRequest {
  kind: DependencyKind;
  name: string;
  optional?: boolean;
  spec: string;
}

export interface RegistryResolverPackage {
  canonical: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  digest: string;
  distTags?: Record<string, string>;
  name: string;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean | undefined }>;
  trustScore?: number;
  version: string;
}

export interface ResolvedDependency {
  canonical: string;
  digest: string;
  kind: DependencyKind;
  name: string;
  spec: string;
  version: string;
}

export interface UnresolvedDependency {
  kind: DependencyKind;
  name: string;
  reason: string;
  spec: string;
}

export interface DependencyGraphResult {
  resolved: ResolvedDependency[];
  unresolved: UnresolvedDependency[];
}

const DEPENDENCY_KINDS: DependencyKind[] = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies"
];

export function dependencyEntriesFromManifest(manifest: Manifest): DependencyRequest[] {
  return DEPENDENCY_KINDS.flatMap((kind) =>
    Object.entries(manifest[kind] ?? {}).map(([name, spec]) => ({
      kind,
      name,
      ...(isOptionalDependency(kind, name, manifest) ? { optional: true } : {}),
      spec
    }))
  );
}

export function resolveDependencyGraph(options: {
  packages: readonly RegistryResolverPackage[];
  requests: readonly DependencyRequest[];
}): DependencyGraphResult {
  const resolved: ResolvedDependency[] = [];
  const unresolved: UnresolvedDependency[] = [];

  for (const request of options.requests) {
    const result = resolveOne(request, options.packages);
    if ("reason" in result) {
      unresolved.push(result);
    } else {
      resolved.push(result);
    }
  }

  return { resolved, unresolved };
}

export function resolveDependencyClosure(options: {
  packages: readonly RegistryResolverPackage[];
  requests: readonly DependencyRequest[];
}): DependencyGraphResult {
  const queue = [...options.requests];
  const resolved: ResolvedDependency[] = [];
  const unresolved: UnresolvedDependency[] = [];
  const visitedPackages = new Set<string>();
  const visitedRequests = new Set<string>();

  while (queue.length > 0) {
    const request = queue.shift();
    if (!request) {
      break;
    }
    const requestKey = `${request.kind}:${request.name}@${request.spec}`;
    if (visitedRequests.has(requestKey)) {
      continue;
    }
    visitedRequests.add(requestKey);

    const result = resolveOne(request, options.packages);
    if ("reason" in result) {
      unresolved.push(result);
      continue;
    }

    resolved.push(result);
    const packageKey = `${result.canonical}@${result.version}`;
    if (visitedPackages.has(packageKey)) {
      continue;
    }
    visitedPackages.add(packageKey);

    const pkg = options.packages.find((candidate) => candidate.canonical === result.canonical && candidate.version === result.version);
    if (pkg) {
      queue.push(...dependencyEntriesFromRegistryPackage(pkg));
    }
  }

  return { resolved, unresolved };
}

export function versionSatisfies(version: string, spec: string, distTags: Record<string, string> = {}): boolean {
  if (spec === "*") {
    return true;
  }
  if (isDistTag(spec)) {
    return distTags[spec] === version;
  }
  if (spec.startsWith("^")) {
    return caretSatisfies(parseSemver(version), parseSemver(spec.slice(1)));
  }
  if (spec.startsWith("~")) {
    return tildeSatisfies(parseSemver(version), parseSemver(spec.slice(1)));
  }
  return version === spec;
}

function resolveOne(
  request: DependencyRequest,
  packages: readonly RegistryResolverPackage[]
): ResolvedDependency | UnresolvedDependency {
  const candidates = trustedCandidatesForRequest(request, packages);
  if (candidates.length === 0) {
    return unresolved(request, "no trusted package matches dependency");
  }

  const canonicalIds = [...new Set(candidates.map((candidate) => candidate.canonical))];
  if (!request.name.startsWith("pkg:") && canonicalIds.length > 1) {
    return unresolved(request, `ambiguous package name matches ${canonicalIds.length} canonical packages`);
  }

  const selected = selectVersion(candidates, request.spec);
  if (!selected) {
    return unresolved(request, "no version satisfies dependency spec");
  }

  return {
    canonical: selected.canonical,
    digest: selected.digest,
    kind: request.kind,
    name: selected.name,
    spec: request.spec,
    version: selected.version
  };
}

function trustedCandidatesForRequest(
  request: DependencyRequest,
  packages: readonly RegistryResolverPackage[]
): RegistryResolverPackage[] {
  return packages.filter((pkg) => {
    const identityMatches = request.name.startsWith("pkg:") ? pkg.canonical === request.name : pkg.name === request.name;
    return identityMatches && (pkg.trustScore ?? 100) >= 100;
  });
}

function selectVersion(candidates: readonly RegistryResolverPackage[], spec: string): RegistryResolverPackage | null {
  if (isDistTag(spec)) {
    const tagged = candidates.find((candidate) => candidate.distTags?.[spec] === candidate.version);
    if (tagged) {
      return tagged;
    }
    if (spec !== "latest") {
      return null;
    }
  }

  return [...candidates]
    .filter((candidate) => versionSatisfies(candidate.version, spec, candidate.distTags ?? {}) || spec === "latest")
    .sort((left, right) => compareSemver(right.version, left.version))[0] ?? null;
}

function unresolved(request: DependencyRequest, reason: string): UnresolvedDependency {
  return {
    kind: request.kind,
    name: request.name,
    reason,
    spec: request.spec
  };
}

function isOptionalDependency(kind: DependencyKind, name: string, manifest: Manifest): boolean {
  return kind === "optionalDependencies" || (kind === "peerDependencies" && manifest.peerDependenciesMeta?.[name]?.optional === true);
}

function dependencyEntriesFromRegistryPackage(pkg: RegistryResolverPackage): DependencyRequest[] {
  return DEPENDENCY_KINDS.filter((kind) => kind !== "devDependencies").flatMap((kind) =>
    Object.entries(pkg[kind] ?? {}).map(([name, spec]) => ({
      kind,
      name,
      ...(kind === "optionalDependencies" || (kind === "peerDependencies" && pkg.peerDependenciesMeta?.[name]?.optional === true)
        ? { optional: true }
        : {}),
      spec
    }))
  );
}

function isDistTag(value: string): boolean {
  return /^[a-z][a-z0-9._-]{0,31}$/.test(value);
}

function parseSemver(value: string): [major: number, minor: number, patch: number] {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  if (!match) {
    throw new Error(`invalid semver: ${value}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(left: string, right: string): number {
  const leftParts = parseSemver(left);
  const rightParts = parseSemver(right);
  const majorDiff = leftParts[0] - rightParts[0];
  if (majorDiff !== 0) {
    return majorDiff;
  }
  const minorDiff = leftParts[1] - rightParts[1];
  if (minorDiff !== 0) {
    return minorDiff;
  }
  const patchDiff = leftParts[2] - rightParts[2];
  if (patchDiff !== 0) {
    return patchDiff;
  }
  return 0;
}

function caretSatisfies(version: [number, number, number], base: [number, number, number]): boolean {
  if (compareParts(version, base) < 0) {
    return false;
  }
  if (base[0] > 0) {
    return version[0] === base[0];
  }
  if (base[1] > 0) {
    return version[0] === 0 && version[1] === base[1];
  }
  return version[0] === 0 && version[1] === 0 && version[2] === base[2];
}

function tildeSatisfies(version: [number, number, number], base: [number, number, number]): boolean {
  return compareParts(version, base) >= 0 && version[0] === base[0] && version[1] === base[1];
}

function compareParts(left: [number, number, number], right: [number, number, number]): number {
  const majorDiff = left[0] - right[0];
  if (majorDiff !== 0) {
    return majorDiff;
  }
  const minorDiff = left[1] - right[1];
  if (minorDiff !== 0) {
    return minorDiff;
  }
  const patchDiff = left[2] - right[2];
  if (patchDiff !== 0) {
    return patchDiff;
  }
  return 0;
}
