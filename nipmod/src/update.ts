import { join } from "node:path";
import { installPackageGraph, pruneUnreachableLockfile } from "./install.js";
import {
  createRegistryGraphInstallPlan,
  prepareGraphInstallPlanPackages,
  type ExecuteInstallPlanOptions,
  type InstallPlan,
  type RegistryTrustOptions
} from "./install-plan.js";
import { readLockfile, type Lockfile } from "./lockfile.js";
import { type NipmodPolicy } from "./policy.js";
import { DEFAULT_REGISTRY_URL, searchRegistry, type RegistrySearchPackage } from "./registry.js";
import { resolveDependencyGraph, type DependencyKind, type DependencyRequest, type RegistryResolverPackage } from "./resolver.js";

export interface CreateUpdatePlanOptions extends RegistryTrustOptions {
  policy?: NipmodPolicy | undefined;
  projectDir: string;
  query?: string | undefined;
}

export interface UpdatePlan {
  formatVersion: 1;
  readyToUpdate: boolean;
  registrySources: string[];
  skipped: SkippedUpdate[];
  summary: {
    checked: number;
    skipped: number;
    unchanged: number;
    updates: number;
  };
  type: "dev.nipmod.update-plan.v1";
  unchanged: UnchangedUpdate[];
  updates: PackageUpdate[];
}

export interface PackageUpdate {
  current: string | null;
  latest: string | null;
  name: string;
  package: string;
  plan: InstallPlan;
  root: RootDependency;
  status: "install" | "update";
  wanted: string;
}

export interface UnchangedUpdate {
  current: string;
  latest: string | null;
  name: string;
  package: string;
  root: RootDependency;
  wanted: string;
}

export interface SkippedUpdate {
  name: string;
  reason: string;
  root: RootDependency;
}

export interface RootDependency {
  kind: DependencyKind;
  name: string;
  spec: string;
}

export interface ExecuteUpdatePlanResult {
  formatVersion: 1;
  lockfileChanged: boolean;
  prunedPackageCount: number;
  prunedPackageKeys: string[];
  type: "dev.nipmod.update-result.v1";
  updated: number;
}

const DEPENDENCY_KINDS: DependencyKind[] = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];

export async function createUpdatePlan(options: CreateUpdatePlanOptions): Promise<UpdatePlan> {
  const registryUrl = options.registryUrl ?? DEFAULT_REGISTRY_URL;
  const lockfile = await readLockfile(join(options.projectDir, "nipmod.lock.json"));
  const roots = selectedRootRequests(lockfile, options.query);
  const registry = await searchRegistry({
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    includeQuarantined: true,
    limit: 10_000,
    query: "",
    registryUrl
  });
  const registryPackages = registry.packages.map(registryResolverPackage);
  const installedPackages = installedResolverPackages(lockfile);

  const updates: PackageUpdate[] = [];
  const unchanged: UnchangedUpdate[] = [];
  const skipped: SkippedUpdate[] = [];

  for (const root of roots) {
    const wanted = resolveDependencyGraph({ packages: registryPackages, requests: [root] }).resolved[0];
    if (!wanted) {
      skipped.push({
        name: root.name,
        reason: `no verified registry version satisfies ${root.name}@${root.spec}`,
        root
      });
      continue;
    }
    const current = resolveDependencyGraph({ packages: installedPackages, requests: [root] }).resolved[0] ?? null;
    const latest = latestRegistryVersion(registry.packages, wanted.canonical);
    if (current?.canonical === wanted.canonical && current.version === wanted.version) {
      unchanged.push({
        current: current.version,
        latest,
        name: current.name,
        package: current.canonical,
        root,
        wanted: wanted.version
      });
      continue;
    }

    const plan = await createRegistryGraphInstallPlan(
      {
        ...options,
        action: "update",
        registryUrl
      },
      {
        kind: root.kind,
        name: wanted.canonical,
        spec: wanted.version
      }
    );
    if (plan.package.canonical !== wanted.canonical || plan.package.version !== wanted.version) {
      throw new Error(`registry update plan drifted for ${root.name}: expected ${wanted.canonical}@${wanted.version}`);
    }
    if (plan.graph) {
      plan.graph.rootDependency = root;
    }
    updates.push({
      current: current?.canonical === wanted.canonical ? current.version : null,
      latest,
      name: wanted.name,
      package: wanted.canonical,
      plan,
      root,
      status: current ? "update" : "install",
      wanted: wanted.version
    });
  }

  return {
    formatVersion: 1,
    readyToUpdate: skipped.length === 0 && updates.every((update) => update.plan.readyToInstall),
    registrySources: registry.sources,
    skipped,
    summary: {
      checked: roots.length,
      skipped: skipped.length,
      unchanged: unchanged.length,
      updates: updates.length
    },
    type: "dev.nipmod.update-plan.v1",
    unchanged,
    updates
  };
}

export async function executeUpdatePlan(
  plan: UpdatePlan,
  options: ExecuteInstallPlanOptions
): Promise<ExecuteUpdatePlanResult> {
  if (!plan.readyToUpdate) {
    throw new Error("update plan is not ready");
  }
  const graphPackages = (
    await Promise.all(plan.updates.map((update) => prepareGraphInstallPlanPackages(update.plan, options)))
  ).flat();
  let prunedPackageKeys: string[] = [];
  const result =
    graphPackages.length > 0
      ? await installPackageGraph(graphPackages, options.projectDir, {
          finalizeLockfile(lockfile) {
            prunedPackageKeys = pruneUnreachableLockfile(lockfile, {
              rootPackageKeys: updatePlanRootPackageKeys(lockfile, plan)
            });
          }
        })
      : { lockfileChanged: false };
  return {
    formatVersion: 1,
    lockfileChanged: result.lockfileChanged,
    prunedPackageCount: prunedPackageKeys.length,
    prunedPackageKeys,
    type: "dev.nipmod.update-result.v1",
    updated: plan.updates.length
  };
}

function updatePlanRootPackageKeys(lockfile: Lockfile, plan: UpdatePlan): string[] {
  const selectedRoots = new Map<string, string>();
  for (const update of plan.updates) {
    selectedRoots.set(rootKey(update.root), `${update.plan.package.canonical}@${update.plan.package.version}`);
  }
  for (const item of plan.unchanged) {
    selectedRoots.set(rootKey(item.root), `${item.package}@${item.current}`);
  }

  const packageKeys = new Set(selectedRoots.values());
  for (const root of rootRequests(lockfile)) {
    if (selectedRoots.has(rootKey(root))) {
      continue;
    }
    const matches = Object.entries(lockfile.packages)
      .filter(([, pkg]) => (root.name.startsWith("pkg:") ? pkg.canonical === root.name : pkg.name === root.name))
      .map(([packageKey]) => packageKey);
    if (matches.length === 0) {
      throw new Error(`lockfile root cannot resolve installed package ${root.name}@${root.spec}`);
    }
    for (const packageKey of matches) {
      packageKeys.add(packageKey);
    }
  }
  return [...packageKeys].sort();
}

function rootKey(root: RootDependency): string {
  return `${root.kind}:${root.name}`;
}

function selectedRootRequests(lockfile: Lockfile, query: string | undefined): DependencyRequest[] {
  const roots = rootRequests(lockfile);
  if (!query) {
    return roots;
  }
  const matches = roots.filter((root) => rootMatches(lockfile, root, query));
  if (matches.length === 0) {
    throw new Error(`update target is not a root dependency: ${query}`);
  }
  return matches;
}

function rootRequests(lockfile: Lockfile): DependencyRequest[] {
  return DEPENDENCY_KINDS.flatMap((kind) =>
    Object.entries(lockfile.root[kind]).map(([name, spec]) => ({
      kind,
      name,
      spec
    }))
  );
}

function rootMatches(lockfile: Lockfile, root: DependencyRequest, query: string): boolean {
  if ([root.name, `${root.name}@${root.spec}`].includes(query)) {
    return true;
  }
  const current = resolveDependencyGraph({ packages: installedResolverPackages(lockfile), requests: [root] }).resolved[0];
  if (!current) {
    return false;
  }
  return [current.name, `${current.name}@${current.version}`, current.canonical, `${current.canonical}@${current.version}`].includes(query);
}

function installedResolverPackages(lockfile: Lockfile): RegistryResolverPackage[] {
  return Object.values(lockfile.packages).map((pkg) => ({
    canonical: pkg.canonical,
    digest: pkg.manifestDigest,
    name: pkg.name,
    trustScore: 100,
    version: pkg.version
  }));
}

function registryResolverPackage(pkg: RegistrySearchPackage): RegistryResolverPackage {
  return {
    canonical: pkg.canonical,
    ...(pkg.dependencies ? { dependencies: pkg.dependencies } : {}),
    ...(pkg.devDependencies ? { devDependencies: pkg.devDependencies } : {}),
    digest: pkg.digest,
    ...(pkg.distTags ? { distTags: pkg.distTags } : {}),
    name: pkg.name,
    ...(pkg.optionalDependencies ? { optionalDependencies: pkg.optionalDependencies } : {}),
    ...(pkg.peerDependencies ? { peerDependencies: pkg.peerDependencies } : {}),
    ...(pkg.peerDependenciesMeta ? { peerDependenciesMeta: pkg.peerDependenciesMeta } : {}),
    trustScore: pkg.trustLevel === "verified" ? pkg.trustScore : 0,
    version: pkg.version
  };
}

function latestRegistryVersion(packages: readonly RegistrySearchPackage[], canonical: string): string | null {
  const trusted = packages
    .filter((pkg) => pkg.canonical === canonical && pkg.trustScore >= 100)
    .sort((left, right) => compareSemverDesc(left.version, right.version));
  return trusted.find((pkg) => pkg.distTags?.latest === pkg.version)?.version ?? trusted[0]?.version ?? null;
}

function compareSemverDesc(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const diff = (rightParts[index] ?? 0) - (leftParts[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}
