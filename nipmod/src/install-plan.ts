import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { verifyBundle, type NipmodBundle } from "./bundle.js";
import { fetchGitlawbBundle, parseRemoteSpecifier } from "./gitlawb.js";
import { digestFromIntegrity } from "./integrity.js";
import { installBundlePackage, installPackageGraph, isValidLockfilePackage, type InstallResult } from "./install.js";
import { type InstallGraphPackage } from "./install-types.js";
import { evaluateTrustReportPolicy, type NipmodPolicy, type PolicyDecision } from "./policy.js";
import { DEFAULT_REGISTRY_URL, searchRegistry, type RegistrySearchPackage } from "./registry.js";
import {
  resolveDependencyClosure,
  type DependencyRequest,
  type RegistryResolverPackage,
  type ResolvedDependency,
  type UnresolvedDependency
} from "./resolver.js";
import { inspectRegistryPackage, type TrustReport } from "./trust-report.js";

export type InstallPlanAction = "install" | "add";

export interface RegistryTrustOptions {
  allowedLogIds?: readonly string[];
  allowedWitnesses?: readonly string[];
  fetchImpl?: typeof fetch;
  registryUrl?: string;
}

export interface CreateInstallPlanOptions extends RegistryTrustOptions {
  action: InstallPlanAction;
  policy?: NipmodPolicy | undefined;
  projectDir: string;
  specifier: string;
}

export interface ResolveAddPlanOptions extends RegistryTrustOptions {
  policy?: NipmodPolicy | undefined;
  projectDir: string;
  query: string;
}

export interface ExecuteInstallPlanOptions {
  fetchImpl?: typeof fetch;
  nodeUrl: string;
  projectDir: string;
}

export interface InstallPlan {
  formatVersion: 1;
  action: InstallPlanAction;
  readyToInstall: boolean;
  package: {
    canonical: string;
    name: string;
    version: string;
    type: string;
  };
  integrity: string;
  policyDecision?: PolicyDecision | undefined;
  resolved?: string;
  lockfile: {
    changed: boolean;
    packageKey: string;
    path: string;
    reason: string;
  };
  trustReport: TrustReport;
  graph?: {
    packageCount: number;
    packages: GraphInstallPlanPackage[];
    rootDependency: DependencyRequest;
    unresolved: UnresolvedDependency[];
  };
}

export interface GraphInstallPlanPackage {
  canonical: string;
  integrity: string;
  name: string;
  policyDecision?: PolicyDecision | undefined;
  resolved?: string;
  root: boolean;
  trustReport: TrustReport;
  version: string;
}

const BUNDLE_LIMIT = 50 * 1024 * 1024;
const GRAPH_PACKAGE_LIMIT = 128;
const GRAPH_FETCH_CONCURRENCY = 4;
const GRAPH_FETCH_BYTE_LIMIT = 512 * 1024 * 1024;
const PACKAGE_VERSION_SPECIFIER = /^pkg:did:key:z[A-Za-z0-9]+\/[a-z0-9][a-z0-9._-]*@(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export async function createRegistryInstallPlan(options: CreateInstallPlanOptions): Promise<InstallPlan> {
  const report = await inspectRegistryPackage(inspectOptions(options));
  if (report.resolved) {
    parseRegistryResolvedBundleUrl(report.resolved, report);
  }
  return planFromTrustReport(options.action, options.projectDir, report, options.policy);
}

export async function resolveAddInstallPlan(options: ResolveAddPlanOptions): Promise<InstallPlan> {
  if (isPackageVersionSpecifier(options.query)) {
    const spec = packageVersionSpecifierParts(options.query);
    return createRegistryGraphInstallPlan(options, {
      kind: "dependencies",
      name: spec.canonical,
      spec: spec.version
    });
  }

  const registryUrl = options.registryUrl ?? DEFAULT_REGISTRY_URL;
  const search = await searchRegistry({
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    includeQuarantined: true,
    limit: 10_000,
    query: "",
    registryUrl
  });
  const exactMatches = search.packages.filter((pkg) => pkg.name === options.query || pkg.canonical === options.query);
  if (exactMatches.length === 0) {
    throw new Error(`add requires an exact package name or pkg: canonical spec; run nipmod search "${options.query}"`);
  }
  const exactCanonicals = [...new Set(exactMatches.map((pkg) => pkg.canonical))];
  if (exactCanonicals.length > 1) {
    const matches = exactMatches.map((pkg) => `${pkg.canonical}@${pkg.version}`).join(", ");
    throw new Error(`ambiguous package query "${options.query}": ${matches}`);
  }

  const selected = exactMatches[0];
  if (!selected) {
    throw new Error(`no package found for "${options.query}"`);
  }
  return createRegistryGraphInstallPlan(options, {
    kind: "dependencies",
    name: options.query.startsWith("pkg:") ? selected.canonical : selected.name,
    spec: "latest"
  });
}

export async function executeInstallPlan(plan: InstallPlan, options: ExecuteInstallPlanOptions): Promise<InstallResult> {
  if (!plan.readyToInstall) {
    throw new Error(`package is not installable: ${plan.trustReport.findings.join("; ") || "trust report failed"}`);
  }

  if (plan.graph) {
    if (plan.graph.packages.length > GRAPH_PACKAGE_LIMIT) {
      throw new Error(`dependency graph exceeds ${GRAPH_PACKAGE_LIMIT} packages`);
    }
    const packages = await fetchGraphPackages(plan.graph, options);
    assertSignedManifestGraph(plan.graph, packages);
    return installPackageGraph(packages.map((pkg) => pkg.graphPackage), options.projectDir);
  }

  const fetched = await fetchPlanPackage(plan.trustReport, options);

  return installBundlePackage(fetched.bytes, fetched.resolved, options.projectDir, {
    expected: {
      canonical: plan.package.canonical,
      version: plan.package.version
    },
    integrity: plan.integrity
  });
}

export function isPackageVersionSpecifier(value: string): boolean {
  return PACKAGE_VERSION_SPECIFIER.test(value);
}

export function formatInstallPlan(plan: InstallPlan): string {
  const lines = [`nipmod ${plan.action} plan ${plan.readyToInstall ? "ready" : "blocked"} ${plan.package.canonical}@${plan.package.version}`];
  lines.push(`trust: ${plan.trustReport.trust.level}/${plan.trustReport.trust.score}`);
  lines.push(`digest: ${plan.integrity}`);
  lines.push(`permissions: ${plan.trustReport.permissions.summary}`);
  lines.push(`lockfile: ${plan.lockfile.reason}`);
  if (plan.resolved) {
    lines.push(`resolved: ${plan.resolved}`);
  }
  if (plan.graph) {
    lines.push(`graph: ${plan.graph.packageCount} package${plan.graph.packageCount === 1 ? "" : "s"}`);
    for (const unresolved of plan.graph.unresolved) {
      lines.push(`unresolved: ${unresolved.name}@${unresolved.spec}: ${unresolved.reason}`);
    }
  }
  for (const finding of plan.trustReport.findings) {
    lines.push(`finding: ${finding}`);
  }
  if (plan.policyDecision) {
    lines.push(`policy: ${plan.policyDecision.allowed ? "allowed" : "blocked"} (${plan.policyDecision.profile})`);
    for (const reason of plan.policyDecision.reasons) {
      lines.push(`policy finding: ${reason}`);
    }
  }
  return lines.join("\n");
}

async function createRegistryGraphInstallPlan(
  options: ResolveAddPlanOptions,
  rootDependency: DependencyRequest
): Promise<InstallPlan> {
  const registryUrl = options.registryUrl ?? DEFAULT_REGISTRY_URL;
  const search = await searchRegistry({
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    includeQuarantined: true,
    limit: 10_000,
    query: "",
    registryUrl
  });
  const candidates = search.packages.map(registryResolverPackage);
  const closure = resolveDependencyClosure({
    packages: candidates,
    requests: [rootDependency]
  });
  const rootResolved = closure.resolved[0];
  if (!rootResolved) {
    throw new Error(`add could not resolve ${rootDependency.name}@${rootDependency.spec}: ${closure.unresolved[0]?.reason ?? "not found"}`);
  }

  const resolvedPackages = uniqueResolvedPackages(closure.resolved);
  if (resolvedPackages.length > GRAPH_PACKAGE_LIMIT) {
    throw new Error(`dependency graph exceeds ${GRAPH_PACKAGE_LIMIT} packages`);
  }
  const graphPackages = await Promise.all(
    resolvedPackages.map(async (resolvedPackage, index): Promise<GraphInstallPlanPackage> => {
      const report = await inspectRegistryPackage({
        ...inspectOptions({
          ...registryTrustOptions(options),
          action: "add",
          projectDir: options.projectDir,
          specifier: `${resolvedPackage.canonical}@${resolvedPackage.version}`
        })
      });
      if (report.resolved) {
        parseRegistryResolvedBundleUrl(report.resolved, report);
      }
      const policyDecision = options.policy ? evaluateTrustReportPolicy(report, options.policy) : undefined;
      const graphPackage: GraphInstallPlanPackage = {
        canonical: report.canonical,
        integrity: report.integrity,
        name: report.name,
        root: index === 0,
        trustReport: report,
        version: report.version
      };
      if (policyDecision) {
        graphPackage.policyDecision = policyDecision;
      }
      if (report.resolved) {
        graphPackage.resolved = report.resolved;
      }
      return graphPackage;
    })
  );

  const rootPackage = graphPackages[0];
  if (!rootPackage) {
    throw new Error("add graph did not resolve a root package");
  }

  const rootReport = aggregateGraphTrustReport(rootPackage.trustReport, graphPackages, closure.unresolved);
  const lockfile = await previewLockfile(options.projectDir, rootReport);
  const graphPolicyDecision = aggregateGraphPolicyDecision(rootPackage.trustReport, graphPackages);
  const requiredUnresolved = closure.unresolved.filter((dependency) => dependency.kind === "dependencies");
  const rootIntent = lockfileRootDependency(rootDependency, rootPackage);
  const graphReady =
    requiredUnresolved.length === 0 &&
    graphPackages.every(
      (entry) =>
        entry.trustReport.readyToInstall &&
        entry.trustReport.verdict === "verified" &&
        (entry.policyDecision?.allowed ?? true)
    );

  const plan: InstallPlan = {
    action: "add",
    formatVersion: 1,
    graph: {
      packageCount: graphPackages.length,
      packages: graphPackages,
      rootDependency: rootIntent,
      unresolved: closure.unresolved
    },
    integrity: rootReport.integrity,
    lockfile,
    package: {
      canonical: rootReport.canonical,
      name: rootReport.name,
      type: rootReport.type,
      version: rootReport.version
    },
    readyToInstall: graphReady,
    trustReport: rootReport
  };
  if (graphPolicyDecision) {
    plan.policyDecision = graphPolicyDecision;
  }
  if (rootReport.resolved) {
    plan.resolved = rootReport.resolved;
  }
  return plan;
}

async function planFromTrustReport(
  action: InstallPlanAction,
  projectDir: string,
  report: TrustReport,
  policy: NipmodPolicy | undefined
): Promise<InstallPlan> {
  const lockfile = await previewLockfile(projectDir, report);
  const policyDecision = policy ? evaluateTrustReportPolicy(report, policy) : undefined;
  const plan: InstallPlan = {
    action,
    formatVersion: 1,
    integrity: report.integrity,
    lockfile,
    package: {
      canonical: report.canonical,
      name: report.name,
      type: report.type,
      version: report.version
    },
    readyToInstall: report.readyToInstall && report.verdict === "verified" && (policyDecision?.allowed ?? true),
    trustReport: report
  };
  if (policyDecision) {
    plan.policyDecision = policyDecision;
  }
  if (report.resolved) {
    plan.resolved = report.resolved;
  }
  return plan;
}

async function previewLockfile(projectDir: string, report: TrustReport): Promise<InstallPlan["lockfile"]> {
  const lockfilePath = join(projectDir, "nipmod.lock.json");
  const packageKey = `${report.canonical}@${report.version}`;
  const text = await readOptionalFile(lockfilePath);
  if (!text) {
    return {
      changed: true,
      packageKey,
      path: lockfilePath,
      reason: "package will be added"
    };
  }

  const parsed = JSON.parse(text) as unknown;
  if (!isObjectRecord(parsed) || !isObjectRecord(parsed.packages)) {
    throw new Error("lockfile invalid: packages must be an object");
  }
  const existing = parsed.packages[packageKey];
  if (!isObjectRecord(existing)) {
    return {
      changed: true,
      packageKey,
      path: lockfilePath,
      reason: "package will be added"
    };
  }
  if (!isValidLockfilePackage(existing)) {
    throw new Error("lockfile invalid: package entry is invalid");
  }

  const sameIntegrity = existing.integrity === report.integrity;
  const sameResolved = !report.resolved || existing.resolved === report.resolved;
  if (sameIntegrity && sameResolved) {
    return {
      changed: false,
      packageKey,
      path: lockfilePath,
      reason: "package is already installed"
    };
  }
  return {
    changed: true,
    packageKey,
    path: lockfilePath,
    reason: "package will be updated"
  };
}

async function fetchPlanPackage(
  report: TrustReport,
  options: ExecuteInstallPlanOptions
): Promise<{ bytes: Uint8Array; resolved: string }> {
  if (report.resolved) {
    return {
      bytes: await fetchResolvedBundle(report.resolved, report, options.fetchImpl ?? fetch),
      resolved: report.resolved
    };
  }

  return fetchGitlawbBundle({
    nodeUrl: options.nodeUrl,
    spec: parseRemoteSpecifier(`${report.canonical}@${report.version}`)
  });
}

function registryResolverPackage(pkg: RegistrySearchPackage): RegistryResolverPackage {
  return {
    canonical: pkg.canonical,
    ...(pkg.dependencies ? { dependencies: pkg.dependencies } : {}),
    ...(pkg.devDependencies ? { devDependencies: pkg.devDependencies } : {}),
    digest: pkg.digest,
    name: pkg.name,
    ...(pkg.optionalDependencies ? { optionalDependencies: pkg.optionalDependencies } : {}),
    ...(pkg.peerDependencies ? { peerDependencies: pkg.peerDependencies } : {}),
    ...(pkg.peerDependenciesMeta ? { peerDependenciesMeta: pkg.peerDependenciesMeta } : {}),
    trustScore: pkg.trustLevel === "verified" ? pkg.trustScore : 0,
    version: pkg.version
  };
}

interface FetchedGraphPackage {
  bundle: NipmodBundle;
  graphPackage: InstallGraphPackage;
}

async function fetchGraphPackages(
  graph: NonNullable<InstallPlan["graph"]>,
  options: ExecuteInstallPlanOptions
): Promise<FetchedGraphPackage[]> {
  let totalBytes = 0;
  return mapWithConcurrency(graph.packages, GRAPH_FETCH_CONCURRENCY, async (entry) => {
    const fetched = await fetchPlanPackage(entry.trustReport, options);
    totalBytes += fetched.bytes.byteLength;
    if (totalBytes > GRAPH_FETCH_BYTE_LIMIT) {
      throw new Error(`dependency graph exceeds ${GRAPH_FETCH_BYTE_LIMIT} bytes`);
    }
    const digest = digestFromIntegrity(entry.integrity);
    const bundle = verifyBundle(fetched.bytes, digest, { requireSignature: true });
    const graphPackage: InstallGraphPackage = {
      bundleBytes: fetched.bytes,
      expected: {
        canonical: entry.canonical,
        version: entry.version
      },
      integrity: entry.integrity,
      resolved: fetched.resolved
    };
    if (entry.root) {
      graphPackage.rootDependency = graph.rootDependency;
    }
    return { bundle, graphPackage };
  });
}

function assertSignedManifestGraph(
  graph: NonNullable<InstallPlan["graph"]>,
  packages: readonly FetchedGraphPackage[]
): void {
  const candidates = packages.map((pkg): RegistryResolverPackage => {
    const manifest = pkg.bundle.manifest;
    return {
      canonical: manifest.canonical,
      ...(manifest.dependencies ? { dependencies: manifest.dependencies } : {}),
      digest: digestFromIntegrity(pkg.graphPackage.integrity),
      name: manifest.name,
      ...(manifest.optionalDependencies ? { optionalDependencies: manifest.optionalDependencies } : {}),
      ...(manifest.peerDependencies ? { peerDependencies: manifest.peerDependencies } : {}),
      ...(manifest.peerDependenciesMeta ? { peerDependenciesMeta: manifest.peerDependenciesMeta } : {}),
      trustScore: 100,
      version: manifest.version
    };
  });
  const rootPackage = graph.packages.find((entry) => entry.root) ?? graph.packages[0];
  if (!rootPackage) {
    throw new Error("signed manifest graph has no root package");
  }
  const closure = resolveDependencyClosure({
    packages: candidates,
    requests: [
      {
        kind: graph.rootDependency.kind,
        name: rootPackage.canonical,
        spec: rootPackage.version
      }
    ]
  });
  const missingRequired = closure.unresolved.filter((dependency) => dependency.kind === "dependencies");
  if (missingRequired.length > 0) {
    throw new Error(
      `missing dependency from signed manifests: ${missingRequired
        .map((dependency) => `${dependency.name}@${dependency.spec}: ${dependency.reason}`)
        .join(", ")}`
    );
  }

  const reachable = new Set(closure.resolved.map((pkg) => `${pkg.canonical}@${pkg.version}`));
  const extra = packages
    .map((pkg) => `${pkg.bundle.manifest.canonical}@${pkg.bundle.manifest.version}`)
    .filter((key) => !reachable.has(key));
  if (extra.length > 0) {
    throw new Error(`registry graph includes packages not reachable from signed manifests: ${extra.join(", ")}`);
  }
}

async function mapWithConcurrency<T, U>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<U>
): Promise<U[]> {
  const results = new Array<U>(items.length);
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      if (item === undefined) {
        continue;
      }
      results[index] = await mapper(item, index);
    }
  }
  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function uniqueResolvedPackages(packages: readonly ResolvedDependency[]): ResolvedDependency[] {
  const seen = new Set<string>();
  const unique: ResolvedDependency[] = [];
  for (const pkg of packages) {
    const key = `${pkg.canonical}@${pkg.version}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(pkg);
  }
  return unique;
}

function lockfileRootDependency(
  rootRequest: DependencyRequest,
  rootPackage: GraphInstallPlanPackage
): DependencyRequest {
  return {
    kind: rootRequest.kind,
    name: rootPackage.name,
    spec: rootRequest.name.startsWith("pkg:") ? rootPackage.version : rootRequest.spec
  };
}

function aggregateGraphPolicyDecision(
  rootReport: TrustReport,
  graphPackages: readonly GraphInstallPlanPackage[]
): PolicyDecision | undefined {
  const decisions = graphPackages.map((entry) => entry.policyDecision).filter((decision): decision is PolicyDecision => Boolean(decision));
  if (decisions.length === 0) {
    return undefined;
  }
  const rootDecision = graphPackages.find((entry) => entry.root)?.policyDecision ?? decisions[0];
  if (!rootDecision) {
    return undefined;
  }
  const failedDecisions = decisions.filter((decision) => !decision.allowed);
  return {
    allowed: failedDecisions.length === 0,
    formatVersion: 1,
    profile: rootDecision.profile,
    reasons: [...new Set(decisions.flatMap((decision) => decision.reasons))],
    rules: decisions.flatMap((decision) => decision.rules),
    subject: `${rootReport.canonical}@${rootReport.version} graph`
  };
}

function aggregateGraphTrustReport(
  rootReport: TrustReport,
  graphPackages: readonly GraphInstallPlanPackage[],
  unresolved: readonly UnresolvedDependency[]
): TrustReport {
  const findings = [
    ...rootReport.findings,
    ...graphPackages.flatMap((entry) => entry.trustReport.findings),
    ...unresolved
      .filter((dependency) => dependency.kind === "dependencies")
      .map((dependency) => `${dependency.name}@${dependency.spec}: ${dependency.reason}`),
    ...graphPackages.flatMap((entry) => entry.policyDecision?.reasons ?? [])
  ];
  const uniqueFindings = [...new Set(findings)];
  return {
    ...rootReport,
    findings: uniqueFindings,
    readyToInstall:
      uniqueFindings.length === 0 &&
      rootReport.readyToInstall &&
      graphPackages.every((entry) => entry.trustReport.readyToInstall && (entry.policyDecision?.allowed ?? true)),
    verdict:
      uniqueFindings.length === 0 && graphPackages.every((entry) => entry.trustReport.verdict === "verified")
        ? rootReport.verdict
        : "failed"
  };
}

function packageVersionSpecifierParts(value: string): { canonical: string; version: string } {
  const separator = value.lastIndexOf("@");
  if (separator === -1) {
    throw new Error("package spec must include a version");
  }
  return {
    canonical: value.slice(0, separator),
    version: value.slice(separator + 1)
  };
}

async function fetchResolvedBundle(source: string, report: TrustReport, fetchImpl: typeof fetch): Promise<Uint8Array> {
  const url = parseRegistryResolvedBundleUrl(source, report);
  const bytes = await fetchRemoteBundle(url, fetchImpl);
  if (bytes.length > BUNDLE_LIMIT) {
    throw new Error("resolved package is too large");
  }
  return bytes;
}

async function fetchRemoteBundle(url: URL, fetchImpl: typeof fetch): Promise<Uint8Array> {
  const response = await fetchImpl(url.href, {
    redirect: "error",
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) {
    throw new Error(`failed to fetch package: ${response.status}`);
  }
  const length = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > BUNDLE_LIMIT) {
    throw new Error("resolved package is too large");
  }
  if (!response.body) {
    throw new Error("package response body is missing");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const read = await reader.read();
    if (read.done) {
      break;
    }
    total += read.value.byteLength;
    if (total > BUNDLE_LIMIT) {
      throw new Error("resolved package is too large");
    }
    chunks.push(read.value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function parseRegistryResolvedBundleUrl(source: string, report: TrustReport): URL {
  const url = parseResolvedBundleUrl(source);
  const sourceRepo = report.source?.repo;
  if (!sourceRepo) {
    throw new Error("resolved package requires source repository provenance");
  }
  const sourceOrigin = parseSourceRepoOrigin(sourceRepo);
  if (url.origin !== sourceOrigin) {
    throw new Error("resolved package origin does not match source repository");
  }
  const owner = report.owner.slice("did:key:".length);
  const name = report.canonical.split("/").at(-1);
  if (!name) {
    throw new Error("package canonical is invalid");
  }
  const expectedPath = `/api/v1/repos/${owner}/${name}/blob/releases/${report.version}/bundle.nipmod`;
  if (url.pathname !== expectedPath) {
    throw new Error("resolved package path does not match source repository release");
  }
  return url;
}

function parseResolvedBundleUrl(source: string): URL {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw new Error("resolved package URL is invalid");
  }
  if (url.username || url.password) {
    throw new Error("resolved package URL must not include credentials");
  }
  if (url.protocol === "https:") {
    return url;
  }
  if (url.protocol === "http:" && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)) {
    return url;
  }
  throw new Error("resolved package URL must use https or loopback http");
}

function parseSourceRepoOrigin(sourceRepo: string): string {
  let url: URL;
  try {
    url = new URL(sourceRepo);
  } catch {
    throw new Error("source repository URL is invalid");
  }
  if (url.username || url.password) {
    throw new Error("source repository URL must not include credentials");
  }
  if (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname))) {
    return url.origin;
  }
  throw new Error("source repository URL must use https or loopback http");
}

async function readOptionalFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function inspectOptions(options: CreateInstallPlanOptions): {
  allowedLogIds?: readonly string[];
  allowedWitnesses?: readonly string[];
  fetchImpl?: typeof fetch;
  registryUrl: string;
  specifier: string;
} {
  const result: {
    allowedLogIds?: readonly string[];
    allowedWitnesses?: readonly string[];
    fetchImpl?: typeof fetch;
    registryUrl: string;
    specifier: string;
  } = {
    registryUrl: options.registryUrl ?? DEFAULT_REGISTRY_URL,
    specifier: options.specifier
  };
  if (options.allowedLogIds) {
    result.allowedLogIds = options.allowedLogIds;
  }
  if (options.allowedWitnesses) {
    result.allowedWitnesses = options.allowedWitnesses;
  }
  if (options.fetchImpl) {
    result.fetchImpl = options.fetchImpl;
  }
  return result;
}

function registryTrustOptions(options: RegistryTrustOptions): RegistryTrustOptions {
  const result: RegistryTrustOptions = {};
  if (options.registryUrl) {
    result.registryUrl = options.registryUrl;
  }
  if (options.allowedLogIds) {
    result.allowedLogIds = options.allowedLogIds;
  }
  if (options.allowedWitnesses) {
    result.allowedWitnesses = options.allowedWitnesses;
  }
  if (options.fetchImpl) {
    result.fetchImpl = options.fetchImpl;
  }
  return result;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
