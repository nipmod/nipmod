import { join } from "node:path";
import { readLockfile, type Lockfile, type LockfilePackage, type LockfileSnapshot } from "./lockfile.js";
import { resolveDependencyGraph, type DependencyKind, type RegistryResolverPackage } from "./resolver.js";

export interface ExplainReport {
  formatVersion: 1;
  matches: ExplainedPackage[];
  query: string;
  summary: {
    orphanPackageCount: number;
    packageCount: number;
    rootPackageCount: number;
    transitivePackageCount: number;
  };
  type: "dev.nipmod.explain.v1";
}

export interface ExplainedPackage extends PackageRef {
  dependents: DependentReason[];
  orphan: boolean;
  paths: ExplainPath[];
  pathsTruncated: boolean;
  root: boolean;
  rootReasons: RootReason[];
}

export interface RootReason {
  dependencyKind: DependencyKind;
  dependencyName: string;
  spec: string;
}

export interface DependentReason extends PackageRef {
  dependencyKind: DependencyKind;
  dependencyName: string;
}

export interface ExplainPath {
  edges: ExplainPathEdge[];
  nodes: PackageRef[];
  root: RootReason;
}

export interface ExplainPathEdge {
  dependencyKind: DependencyKind;
  dependencyName: string;
  from: PackageRef;
  to: PackageRef;
}

interface PackageRef {
  canonical: string;
  name: string;
  packageKey: string;
  version: string;
}

interface RootEdge {
  root: RootReason;
  toPackageKey: string;
}

interface GraphEdge {
  dependencyKind: DependencyKind;
  dependencyName: string;
  fromPackageKey: string;
  toPackageKey: string;
}

interface ExplainPathResult {
  paths: ExplainPath[];
  truncated: boolean;
}

const DEPENDENCY_KINDS: DependencyKind[] = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
const MAX_EXPLAIN_PATHS = 32;
const MAX_EXPLAIN_DEPTH = 64;

export async function explainPackage(query: string, projectDir: string): Promise<ExplainReport> {
  const lockfile = await readLockfile(join(projectDir, "nipmod.lock.json"));
  const matches = Object.entries(lockfile.packages)
    .filter(([packageKey, pkg]) => packageMatches(query, packageKey, pkg))
    .sort(comparePackageEntries)
    .map(([packageKey, pkg]) => explainOne(lockfile, packageKey, pkg));

  return {
    formatVersion: 1,
    matches,
    query,
    summary: {
      orphanPackageCount: matches.filter((pkg) => pkg.orphan).length,
      packageCount: matches.length,
      rootPackageCount: matches.filter((pkg) => pkg.root).length,
      transitivePackageCount: matches.filter((pkg) => !pkg.root && !pkg.orphan).length
    },
    type: "dev.nipmod.explain.v1"
  };
}

function explainOne(lockfile: Lockfile, packageKey: string, pkg: LockfilePackage): ExplainedPackage {
  const rootEdges = rootEdgesForLockfile(lockfile);
  const graphEdges = graphEdgesForLockfile(lockfile);
  const rootReasons = rootEdges.filter((edge) => edge.toPackageKey === packageKey).map((edge) => edge.root);
  const dependents = graphEdges
    .filter((edge) => edge.toPackageKey === packageKey)
    .map((edge) => dependentReason(lockfile, edge))
    .sort(compareDependents);
  const pathResult = pathsToPackage(lockfile, packageKey, rootEdges, graphEdges);
  return {
    ...packageRef(packageKey, pkg),
    dependents,
    orphan: rootReasons.length === 0 && dependents.length === 0 && pathResult.paths.length === 0,
    paths: pathResult.paths,
    pathsTruncated: pathResult.truncated,
    root: rootReasons.length > 0,
    rootReasons
  };
}

function rootEdgesForLockfile(lockfile: Lockfile): RootEdge[] {
  const packages = resolverPackagesFromLockfile(lockfile);
  return DEPENDENCY_KINDS.flatMap((dependencyKind) =>
    Object.entries(lockfile.root[dependencyKind]).flatMap(([dependencyName, spec]) => {
      const request = { kind: dependencyKind, name: dependencyName, spec };
      const resolved = resolveDependencyGraph({
        packages,
        requests: [request]
      }).resolved[0];
      if (!resolved) {
        return [];
      }
      return [
        {
          root: { dependencyKind, dependencyName, spec },
          toPackageKey: `${resolved.canonical}@${resolved.version}`
        }
      ];
    })
  );
}

function graphEdgesForLockfile(lockfile: Lockfile): GraphEdge[] {
  return Object.entries(lockfile.snapshots).flatMap(([fromPackageKey, snapshot]) =>
    DEPENDENCY_KINDS.flatMap((dependencyKind) => snapshotEdges(fromPackageKey, dependencyKind, snapshot))
  );
}

function snapshotEdges(fromPackageKey: string, dependencyKind: DependencyKind, snapshot: LockfileSnapshot): GraphEdge[] {
  return Object.entries(snapshot[dependencyKind]).map(([dependencyName, toPackageKey]) => ({
    dependencyKind,
    dependencyName,
    fromPackageKey,
    toPackageKey
  }));
}

function pathsToPackage(
  lockfile: Lockfile,
  targetPackageKey: string,
  rootEdges: readonly RootEdge[],
  graphEdges: readonly GraphEdge[]
): ExplainPathResult {
  const paths: ExplainPath[] = [];
  const adjacency = adjacencyMap(graphEdges);
  const queue = rootEdges.map((edge) => ({
    edges: [] as GraphEdge[],
    root: edge.root,
    visited: new Set([edge.toPackageKey]),
    packageKeys: [edge.toPackageKey]
  }));
  let truncated = false;

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }
    const last = current.packageKeys.at(-1);
    if (!last) {
      continue;
    }
    if (last === targetPackageKey) {
      paths.push(toExplainPath(lockfile, current.root, current.packageKeys, current.edges));
      if (paths.length >= MAX_EXPLAIN_PATHS) {
        truncated = queue.length > 0 || (adjacency.get(last)?.length ?? 0) > 0;
        break;
      }
      continue;
    }
    if (current.packageKeys.length >= MAX_EXPLAIN_DEPTH) {
      truncated = true;
      continue;
    }
    for (const edge of adjacency.get(last) ?? []) {
      if (!current.visited.has(edge.toPackageKey)) {
        queue.push({
          edges: [...current.edges, edge],
          root: current.root,
          visited: new Set([...current.visited, edge.toPackageKey]),
          packageKeys: [...current.packageKeys, edge.toPackageKey]
        });
      }
    }
  }

  return { paths: paths.sort(comparePaths), truncated };
}

function adjacencyMap(graphEdges: readonly GraphEdge[]): Map<string, GraphEdge[]> {
  const adjacency = new Map<string, GraphEdge[]>();
  for (const edge of graphEdges) {
    const edges = adjacency.get(edge.fromPackageKey) ?? [];
    edges.push(edge);
    adjacency.set(edge.fromPackageKey, edges);
  }
  return adjacency;
}

function toExplainPath(
  lockfile: Lockfile,
  root: RootReason,
  packageKeys: readonly string[],
  edges: readonly GraphEdge[]
): ExplainPath {
  return {
    edges: edges.map((edge) => ({
      dependencyKind: edge.dependencyKind,
      dependencyName: edge.dependencyName,
      from: packageRefForKey(lockfile, edge.fromPackageKey),
      to: packageRefForKey(lockfile, edge.toPackageKey)
    })),
    nodes: packageKeys.map((packageKey) => packageRefForKey(lockfile, packageKey)),
    root
  };
}

function dependentReason(lockfile: Lockfile, edge: GraphEdge): DependentReason {
  return {
    ...packageRefForKey(lockfile, edge.fromPackageKey),
    dependencyKind: edge.dependencyKind,
    dependencyName: edge.dependencyName
  };
}

function packageRefForKey(lockfile: Lockfile, packageKey: string): PackageRef {
  const pkg = lockfile.packages[packageKey];
  if (!pkg) {
    throw new Error(`lockfile snapshot references missing package ${packageKey}`);
  }
  return packageRef(packageKey, pkg);
}

function packageRef(packageKey: string, pkg: LockfilePackage): PackageRef {
  return {
    canonical: pkg.canonical,
    name: pkg.name,
    packageKey,
    version: pkg.version
  };
}

function packageMatches(query: string, packageKey: string, pkg: LockfilePackage): boolean {
  return [packageKey, pkg.name, `${pkg.name}@${pkg.version}`, pkg.canonical, `${pkg.canonical}@${pkg.version}`].includes(query);
}

function resolverPackagesFromLockfile(lockfile: Lockfile): RegistryResolverPackage[] {
  return Object.values(lockfile.packages).map((pkg) => ({
    canonical: pkg.canonical,
    digest: pkg.manifestDigest,
    name: pkg.name,
    version: pkg.version
  }));
}

function comparePackageEntries([leftKey, left]: [string, LockfilePackage], [rightKey, right]: [string, LockfilePackage]) {
  return left.name.localeCompare(right.name) || left.version.localeCompare(right.version) || leftKey.localeCompare(rightKey);
}

function compareDependents(left: DependentReason, right: DependentReason): number {
  return left.name.localeCompare(right.name) || left.version.localeCompare(right.version);
}

function comparePaths(left: ExplainPath, right: ExplainPath): number {
  return left.nodes.length - right.nodes.length || left.nodes.at(-1)!.name.localeCompare(right.nodes.at(-1)!.name);
}
