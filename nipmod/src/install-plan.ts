import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fetchGitlawbBundle, parseRemoteSpecifier } from "./gitlawb.js";
import { installBundlePackage, isValidLockfilePackage, type InstallResult } from "./install.js";
import { evaluateTrustReportPolicy, type NipmodPolicy, type PolicyDecision } from "./policy.js";
import { DEFAULT_REGISTRY_URL, searchRegistry } from "./registry.js";
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
}

const BUNDLE_LIMIT = 50 * 1024 * 1024;
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
    return createRegistryInstallPlan({
      ...registryTrustOptions(options),
      action: "add",
      policy: options.policy,
      projectDir: options.projectDir,
      specifier: options.query
    });
  }

  const registryUrl = options.registryUrl ?? DEFAULT_REGISTRY_URL;
  const search = await searchRegistry({
    includeQuarantined: true,
    limit: 100,
    query: options.query,
    registryUrl
  });
  const exactMatches = search.packages.filter((pkg) => pkg.name === options.query || pkg.canonical === options.query);
  if (exactMatches.length === 0) {
    throw new Error(`add requires an exact package name or pkg: canonical spec; run nipmod search "${options.query}"`);
  }
  if (exactMatches.length > 1) {
    const matches = exactMatches.map((pkg) => `${pkg.canonical}@${pkg.version}`).join(", ");
    throw new Error(`ambiguous package query "${options.query}": ${matches}`);
  }

  const selected = exactMatches[0];
  if (!selected) {
    throw new Error(`no package found for "${options.query}"`);
  }
  return createRegistryInstallPlan({
    ...registryTrustOptions(options),
    action: "add",
    policy: options.policy,
    projectDir: options.projectDir,
    specifier: `${selected.canonical}@${selected.version}`
  });
}

export async function executeInstallPlan(plan: InstallPlan, options: ExecuteInstallPlanOptions): Promise<InstallResult> {
  if (!plan.readyToInstall) {
    throw new Error(`package is not installable: ${plan.trustReport.findings.join("; ") || "trust report failed"}`);
  }

  const fetched = plan.resolved
    ? {
        bytes: await fetchResolvedBundle(plan.resolved, plan.trustReport, options.fetchImpl ?? fetch),
        resolved: plan.resolved
      }
    : await fetchGitlawbBundle({
        nodeUrl: options.nodeUrl,
        spec: parseRemoteSpecifier(`${plan.package.canonical}@${plan.package.version}`)
      });

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
