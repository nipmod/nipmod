import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as z from "zod";
import { readResponseBytes } from "./http.js";

export const DEFAULT_REGISTRY_URL = "https://nipmod.com/registry/packages.json";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const PackageIdSchema = z.string().regex(/^pkg:did:key:z[A-Za-z0-9]+\/[a-z0-9][a-z0-9._-]*$/);
const PackageNameSchema = z.string().regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/);
const SemverSchema = z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
const DependencyMapSchema = z.record(z.string().min(1), z.string().min(1));
const DistTagsSchema = z.record(z.string().regex(/^[a-z][a-z0-9._-]{0,31}$/), SemverSchema);
const JSON_LIMIT = 1024 * 1024;

const PermissionCountsSchema = z.strictObject({
  env: z.number().int().min(0).optional(),
  exec: z.boolean().optional(),
  filesystem: z.number().int().min(0).optional(),
  mcpTools: z.number().int().min(0).optional(),
  network: z.number().int().min(0).optional(),
  postinstall: z.boolean().optional(),
  secrets: z.number().int().min(0).optional()
});

const QuarantineSchema = z.strictObject({
  active: z.boolean().optional(),
  advisoryId: z.string().regex(/^NIPMOD-\d{4}-\d{4}$/),
  artifactSha256: Sha256Schema.optional(),
  package: PackageIdSchema,
  publishedAt: z.string().datetime(),
  reason: z.string().min(1).max(180),
  severity: z.enum(["low", "moderate", "high", "critical"]),
  status: z.enum(["active", "withdrawn"]),
  type: z.literal("dev.nipmod.quarantine.v1"),
  version: SemverSchema
});

const DeprecationSchema = z.strictObject({
  active: z.boolean().optional(),
  package: PackageIdSchema,
  publishedAt: z.string().datetime(),
  reason: z.string().min(1).max(280),
  type: z.literal("dev.nipmod.deprecation.v1"),
  version: SemverSchema
});

const YankSchema = z.strictObject({
  active: z.boolean().optional(),
  package: PackageIdSchema,
  publishedAt: z.string().datetime(),
  reason: z.string().min(1).max(280),
  type: z.literal("dev.nipmod.yank.v1"),
  version: SemverSchema
});

const CompatibilityReceiptSchema = z.strictObject({
  exampleUrl: z.string().url().startsWith("https://nipmod.com/compatibility/"),
  externalFormat: z.enum(["apm-package", "git-source-provenance", "mcp-server-json"]),
  externalInputSha256: Sha256Schema,
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,80}$/),
  label: z.string().min(1).max(48),
  package: PackageIdSchema,
  packageDigest: Sha256Schema,
  preservedFields: z.array(z.string().min(1).max(120)).max(32),
  provenanceLoss: z.array(z.string()).length(0),
  receiptUrl: z.string().url().startsWith("https://nipmod.com/compatibility/"),
  sourceCommit: z.string().regex(/^[a-f0-9]{40}$/),
  sourceRepo: z.string().min(1).max(240),
  sourceTag: z.string().min(1).max(60),
  type: z.literal("dev.nipmod.compatibility-receipt.v1"),
  unsupportedFields: z.array(z.string().min(1).max(120)).max(32),
  version: SemverSchema
});

const RegistrySearchPackageSchema = z.strictObject({
  canonical: PackageIdSchema,
  compatibilityReceipts: z.array(CompatibilityReceiptSchema).max(16).optional(),
  dependencies: DependencyMapSchema.optional(),
  description: z.string().optional(),
  devDependencies: DependencyMapSchema.optional(),
  deprecated: DeprecationSchema.optional(),
  digest: Sha256Schema,
  distTags: DistTagsSchema.optional(),
  name: PackageNameSchema,
  owner: z.string().min(1).optional(),
  optionalDependencies: DependencyMapSchema.optional(),
  permissions: PermissionCountsSchema.optional(),
  peerDependencies: DependencyMapSchema.optional(),
  peerDependenciesMeta: z.record(z.string().min(1), z.strictObject({ optional: z.boolean().optional() })).optional(),
  quarantine: QuarantineSchema.optional(),
  trust: z.strictObject({
    level: z.enum(["verified", "signed", "review", "unknown"]),
    score: z.number().int().min(0).max(100)
  }).passthrough(),
  type: z.string().min(1).optional(),
  version: SemverSchema,
  yanked: YankSchema.optional()
}).passthrough();

const RegistrySearchIndexSchema = z.strictObject({
  formatVersion: z.literal(1),
  packages: z.array(RegistrySearchPackageSchema).max(10_000),
  source: z.string().min(1)
}).passthrough();

export interface RegistrySearchPackage {
  agent: {
    installSafety: string;
    nextSteps: string[];
    trustSummary: string;
    useCase: string;
  };
  advisories: string[];
  canonical: string;
  compatibilityReceipts: string[];
  description: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  digest: string;
  deprecated: boolean;
  deprecationReason?: string;
  distTags?: Record<string, string>;
  canonicalInstall?: string;
  install?: string;
  installBlockedReason?: string;
  name: string;
  nameAmbiguous: boolean;
  optionalDependencies?: Record<string, string>;
  permissionSummary: string;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean | undefined }>;
  quarantined: boolean;
  sourceRegistry: string;
  trust: string;
  trustLevel: string;
  trustScore: number;
  type: string;
  version: string;
  yanked: boolean;
  yankReason?: string;
}

export interface RegistrySearchResult {
  packages: RegistrySearchPackage[];
  query: string;
  sources: string[];
  total: number;
}

export async function searchRegistry(options: {
  fetchImpl?: typeof fetch;
  includeQuarantined?: boolean;
  includeYanked?: boolean;
  limit: number;
  query: string;
  registryUrl: string;
}): Promise<RegistrySearchResult> {
  const registry = RegistrySearchIndexSchema.parse(await readJsonSource(options.registryUrl, options.fetchImpl ?? fetch));
  return searchParsedRegistries({
    ...(options.includeQuarantined === undefined ? {} : { includeQuarantined: options.includeQuarantined }),
    ...(options.includeYanked === undefined ? {} : { includeYanked: options.includeYanked }),
    limit: options.limit,
    query: options.query,
    registries: [{ registry, sourceRegistry: options.registryUrl }]
  });
}

export async function searchRegistries(options: {
  fetchImpl?: typeof fetch;
  includeQuarantined?: boolean;
  includeYanked?: boolean;
  limit: number;
  query: string;
  registryUrls: readonly string[];
}): Promise<RegistrySearchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const registries = await Promise.all(
    uniqueRegistryUrls(options.registryUrls).map(async (registryUrl) => ({
      registry: RegistrySearchIndexSchema.parse(await readJsonSource(registryUrl, fetchImpl)),
      sourceRegistry: registryUrl
    }))
  );
  return searchParsedRegistries({
    ...(options.includeQuarantined === undefined ? {} : { includeQuarantined: options.includeQuarantined }),
    ...(options.includeYanked === undefined ? {} : { includeYanked: options.includeYanked }),
    limit: options.limit,
    query: options.query,
    registries
  });
}

export async function viewRegistryPackages(options: {
  fetchImpl?: typeof fetch;
  includeQuarantined?: boolean;
  includeYanked?: boolean;
  query: string;
  registryUrl: string;
}): Promise<RegistrySearchResult> {
  const registry = RegistrySearchIndexSchema.parse(await readJsonSource(options.registryUrl, options.fetchImpl ?? fetch));
  return viewParsedRegistries({
    ...(options.includeQuarantined === undefined ? {} : { includeQuarantined: options.includeQuarantined }),
    ...(options.includeYanked === undefined ? {} : { includeYanked: options.includeYanked }),
    query: options.query,
    registries: [{ registry, sourceRegistry: options.registryUrl }]
  });
}

export async function viewRegistriesPackages(options: {
  fetchImpl?: typeof fetch;
  includeQuarantined?: boolean;
  includeYanked?: boolean;
  query: string;
  registryUrls: readonly string[];
}): Promise<RegistrySearchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const registries = await Promise.all(
    uniqueRegistryUrls(options.registryUrls).map(async (registryUrl) => ({
      registry: RegistrySearchIndexSchema.parse(await readJsonSource(registryUrl, fetchImpl)),
      sourceRegistry: registryUrl
    }))
  );
  return viewParsedRegistries({
    ...(options.includeQuarantined === undefined ? {} : { includeQuarantined: options.includeQuarantined }),
    ...(options.includeYanked === undefined ? {} : { includeYanked: options.includeYanked }),
    query: options.query,
    registries
  });
}

function searchParsedRegistries(options: {
  includeQuarantined?: boolean;
  includeYanked?: boolean;
  limit: number;
  query: string;
  registries: Array<{
    registry: z.infer<typeof RegistrySearchIndexSchema>;
    sourceRegistry: string;
  }>;
}): RegistrySearchResult {
  const query = options.query.trim().toLowerCase();
  const matched = dedupeRegistryPackages(options.registries)
    .filter((pkg) => options.includeQuarantined === true || !isActivelyQuarantined(pkg))
    .filter((pkg) => options.includeYanked === true || !isActivelyYanked(pkg))
    .filter((pkg) => registryPackageMatches(pkg, query));
  const ambiguousNames = ambiguousPackageNames(matched);
  const packages = matched
    .sort((left, right) => compareRegistryPackages(left, right, query))
    .slice(0, options.limit)
    .map((pkg) => toSearchPackage(pkg, ambiguousNames.has(pkg.name)));

  return {
    packages,
    query: options.query,
    sources: options.registries.map((entry) => entry.sourceRegistry),
    total: matched.length
  };
}

function viewParsedRegistries(options: {
  includeQuarantined?: boolean;
  includeYanked?: boolean;
  query: string;
  registries: Array<{
    registry: z.infer<typeof RegistrySearchIndexSchema>;
    sourceRegistry: string;
  }>;
}): RegistrySearchResult {
  const rawQuery = options.query.trim();
  const nameQuery = rawQuery.toLowerCase();
  const matched = dedupeRegistryPackages(options.registries)
    .filter((pkg) => options.includeQuarantined === true || !isActivelyQuarantined(pkg))
    .filter((pkg) => options.includeYanked === true || !isActivelyYanked(pkg))
    .filter((pkg) => pkg.name === nameQuery || pkg.canonical === rawQuery);
  const ambiguousNames = ambiguousPackageNames(matched);
  const packages = matched
    .sort(compareRegistryViewPackages)
    .map((pkg) => toSearchPackage(pkg, ambiguousNames.has(pkg.name)));

  return {
    packages,
    query: options.query,
    sources: options.registries.map((entry) => entry.sourceRegistry),
    total: packages.length
  };
}

function uniqueRegistryUrls(registryUrls: readonly string[]): string[] {
  return [...new Set(registryUrls.map((url) => url.trim()).filter(Boolean))];
}

function ambiguousPackageNames(packages: readonly RegistryPackageWithSource[]): Set<string> {
  const canonicalsByName = new Map<string, Set<string>>();
  for (const pkg of packages) {
    const canonicals = canonicalsByName.get(pkg.name) ?? new Set<string>();
    canonicals.add(pkg.canonical);
    canonicalsByName.set(pkg.name, canonicals);
  }
  return new Set([...canonicalsByName.entries()].filter(([, canonicals]) => canonicals.size > 1).map(([name]) => name));
}

type RegistryPackageWithSource = z.infer<typeof RegistrySearchPackageSchema> & {
  sourceRegistry: string;
};

function dedupeRegistryPackages(
  registries: Array<{
    registry: z.infer<typeof RegistrySearchIndexSchema>;
    sourceRegistry: string;
  }>
): RegistryPackageWithSource[] {
  const byKey = new Map<string, RegistryPackageWithSource>();
  for (const entry of registries) {
    for (const pkg of entry.registry.packages) {
      const key = `${pkg.canonical}@${pkg.version}`;
      const existing = byKey.get(key);
      if (existing && existing.digest !== pkg.digest) {
        throw new Error(`conflicting registry records for ${key}`);
      }
      if (!existing) {
        byKey.set(key, { ...pkg, sourceRegistry: entry.sourceRegistry });
      }
    }
  }
  return [...byKey.values()];
}

function registryPackageMatches(pkg: z.infer<typeof RegistrySearchPackageSchema>, query: string): boolean {
  if (!query) {
    return true;
  }
  return [
    pkg.name,
    pkg.canonical,
    pkg.description ?? "",
    pkg.type ?? "",
    pkg.owner ?? "",
    ...(pkg.compatibilityReceipts ?? []).flatMap((receipt) => [receipt.label, receipt.externalFormat])
  ]
    .some((value) => value.toLowerCase().includes(query));
}

function compareRegistryPackages(
  left: z.infer<typeof RegistrySearchPackageSchema>,
  right: z.infer<typeof RegistrySearchPackageSchema>,
  query: string
): number {
  return (
    registrySearchScore(right, query) - registrySearchScore(left, query) ||
    left.name.localeCompare(right.name) ||
    left.version.localeCompare(right.version)
  );
}

function compareRegistryViewPackages(left: RegistryPackageWithSource, right: RegistryPackageWithSource): number {
  return left.canonical.localeCompare(right.canonical) || compareSemverDesc(left.version, right.version);
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

function registrySearchScore(pkg: z.infer<typeof RegistrySearchPackageSchema>, query: string): number {
  let score = pkg.trust.score;
  const name = pkg.name.toLowerCase();
  if (query && name === query) {
    score += 60;
  } else if (query && name.startsWith(query)) {
    score += 35;
  }
  if (agentNativeTypes.has(pkg.type ?? "")) {
    score += 10;
  }
  const permissions = pkg.permissions;
  if (
    permissions &&
    (permissions.filesystem ?? 0) === 0 &&
    (permissions.network ?? 0) === 0 &&
    (permissions.mcpTools ?? 0) === 0 &&
    (permissions.env ?? 0) === 0 &&
    (permissions.secrets ?? 0) === 0 &&
    permissions.exec !== true &&
    permissions.postinstall !== true
  ) {
    score += 5;
  }
  return score;
}

const agentNativeTypes = new Set(["skill", "agent-profile", "workflow-pack", "policy-pack", "mcp-server"]);

function toSearchPackage(pkg: RegistryPackageWithSource, nameAmbiguous: boolean): RegistrySearchPackage {
  const quarantine = activeQuarantine(pkg);
  const yanked = activeYank(pkg);
  const deprecated = activeDeprecation(pkg);
  const installBlockedReason = quarantine
    ? quarantineBlockedReason(quarantine)
    : yanked
    ? yankBlockedReason(yanked)
    : undefined;
  return {
    agent: agentPackageMetadata(pkg),
    advisories: quarantine ? [quarantine.advisoryId] : [],
    canonical: pkg.canonical,
    compatibilityReceipts: (pkg.compatibilityReceipts ?? []).map((receipt) => receipt.label),
    description: pkg.description ?? "",
    ...(pkg.dependencies ? { dependencies: pkg.dependencies } : {}),
    ...(pkg.devDependencies ? { devDependencies: pkg.devDependencies } : {}),
    deprecated: Boolean(deprecated),
    ...(deprecated ? { deprecationReason: deprecated.reason } : {}),
    digest: pkg.digest,
    ...(pkg.distTags ? { distTags: pkg.distTags } : {}),
    ...(installBlockedReason
      ? { installBlockedReason }
      : {
          canonicalInstall: `nipmod install ${pkg.canonical}@${pkg.version}`,
          install: `nipmod install ${pkg.name}`
        }),
    name: pkg.name,
    nameAmbiguous,
    ...(pkg.optionalDependencies ? { optionalDependencies: pkg.optionalDependencies } : {}),
    permissionSummary: permissionSummary(pkg.permissions),
    ...(pkg.peerDependencies ? { peerDependencies: pkg.peerDependencies } : {}),
    ...(pkg.peerDependenciesMeta ? { peerDependenciesMeta: pkg.peerDependenciesMeta } : {}),
    quarantined: Boolean(quarantine),
    sourceRegistry: pkg.sourceRegistry,
    trust: `${pkg.trust.level}/${pkg.trust.score}`,
    trustLevel: pkg.trust.level,
    trustScore: pkg.trust.score,
    type: pkg.type ?? "package",
    version: pkg.version,
    yanked: Boolean(yanked),
    ...(yanked ? { yankReason: yanked.reason } : {})
  };
}

function agentPackageMetadata(pkg: RegistryPackageWithSource): RegistrySearchPackage["agent"] {
  const installSafety = hasQuietPermissions(pkg.permissions)
    ? "quiet manifest permissions; still inspect, plan and audit before use"
    : "package requests permissions; inspect exact permission details and use a policy profile before install";
  return {
    installSafety,
    nextSteps: [
      `nipmod inspect ${pkg.canonical}@${pkg.version}`,
      `nipmod install --plan ${pkg.canonical}@${pkg.version}`,
      "nipmod audit --online",
      "nipmod sbom --json"
    ],
    trustSummary: `${pkg.trust.level}/${pkg.trust.score} trust, ${permissionSummary(pkg.permissions)}`,
    useCase: packageUseCase(pkg)
  };
}

function packageUseCase(pkg: RegistryPackageWithSource): string {
  const type = pkg.type ?? "package";
  if (type === "skill") {
    return "agent skill instructions or workflow guidance";
  }
  if (type === "mcp-server") {
    return "MCP server package for agent host tooling";
  }
  if (type === "tool-bundle") {
    return "tool bundle for repeated agent operations";
  }
  if (type === "workflow-pack") {
    return "workflow pack for repeatable agent tasks";
  }
  if (type === "policy-pack") {
    return "policy pack for safer agent execution";
  }
  if (type === "eval-pack") {
    return "evaluation pack for checking agent behavior";
  }
  if (type === "adapter") {
    return "adapter package for connecting an agent platform";
  }
  return "agent package";
}

function hasQuietPermissions(permissions: z.infer<typeof PermissionCountsSchema> | undefined): boolean {
  return (
    Boolean(permissions) &&
    (permissions?.filesystem ?? 0) === 0 &&
    (permissions?.network ?? 0) === 0 &&
    (permissions?.mcpTools ?? 0) === 0 &&
    (permissions?.env ?? 0) === 0 &&
    (permissions?.secrets ?? 0) === 0 &&
    permissions?.exec !== true &&
    permissions?.postinstall !== true
  );
}

function isActivelyQuarantined(pkg: z.infer<typeof RegistrySearchPackageSchema>): boolean {
  return activeQuarantine(pkg) !== undefined;
}

function isActivelyYanked(pkg: z.infer<typeof RegistrySearchPackageSchema>): boolean {
  return activeYank(pkg) !== undefined;
}

function activeQuarantine(pkg: z.infer<typeof RegistrySearchPackageSchema>): z.infer<typeof QuarantineSchema> | undefined {
  if (!pkg.quarantine || pkg.quarantine.status !== "active" || pkg.quarantine.active === false) {
    return undefined;
  }
  if (pkg.quarantine.package !== pkg.canonical || pkg.quarantine.version !== pkg.version) {
    return undefined;
  }
  if (pkg.quarantine.artifactSha256 && pkg.quarantine.artifactSha256 !== pkg.digest) {
    return undefined;
  }
  if (!["high", "critical"].includes(pkg.quarantine.severity)) {
    return undefined;
  }
  return pkg.quarantine;
}

function quarantineBlockedReason(quarantine: z.infer<typeof QuarantineSchema>): string {
  return `${quarantine.advisoryId}: ${quarantine.reason}`;
}

function activeDeprecation(pkg: z.infer<typeof RegistrySearchPackageSchema>): z.infer<typeof DeprecationSchema> | undefined {
  if (!pkg.deprecated || pkg.deprecated.active === false) {
    return undefined;
  }
  if (pkg.deprecated.package !== pkg.canonical || pkg.deprecated.version !== pkg.version) {
    return undefined;
  }
  return pkg.deprecated;
}

function activeYank(pkg: z.infer<typeof RegistrySearchPackageSchema>): z.infer<typeof YankSchema> | undefined {
  if (!pkg.yanked || pkg.yanked.active === false) {
    return undefined;
  }
  if (pkg.yanked.package !== pkg.canonical || pkg.yanked.version !== pkg.version) {
    return undefined;
  }
  return pkg.yanked;
}

function yankBlockedReason(yanked: z.infer<typeof YankSchema>): string {
  return `yanked: ${yanked.reason}`;
}

function permissionSummary(permissions: z.infer<typeof PermissionCountsSchema> | undefined): string {
  if (!permissions) {
    return "permissions unknown";
  }
  const flags = [
    countPermission("network", permissions.network),
    countPermission("filesystem", permissions.filesystem),
    countPermission("env", permissions.env),
    countPermission("mcp", permissions.mcpTools),
    countPermission("secrets", permissions.secrets),
    permissions.exec ? "exec" : "",
    permissions.postinstall ? "postinstall" : ""
  ].filter(Boolean);
  return flags.length === 0 ? "no permissions" : flags.join(" ");
}

function countPermission(label: string, count: number | undefined): string {
  return count && count > 0 ? `${label}:${count}` : "";
}

async function readJsonSource(source: string, fetchImpl: typeof fetch): Promise<unknown> {
  const url = parseTrustedJsonUrl(source);
  const bytes = url.protocol === "file:" ? await readFile(fileURLToPath(url)) : await fetchBytes(url, fetchImpl);
  if (bytes.length > JSON_LIMIT) {
    throw new Error("registry response is too large");
  }
  return JSON.parse(bytes.toString("utf8")) as unknown;
}

async function fetchBytes(url: URL, fetchImpl: typeof fetch): Promise<Buffer> {
  const response = await fetchImpl(url.href, {
    redirect: "error",
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) {
    throw new Error(`failed to fetch registry: ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("registry response must be application/json");
  }
  return readResponseBytes(response, { label: "registry", maxBytes: JSON_LIMIT });
}

function parseTrustedJsonUrl(source: string): URL {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw new Error("registry URL is invalid");
  }
  if (url.username || url.password) {
    throw new Error("registry URL must not include credentials");
  }
  if (url.protocol === "file:") {
    if (url.host && url.host !== "localhost") {
      throw new Error("file URL host is not supported");
    }
    return url;
  }
  if (url.protocol === "https:") {
    return url;
  }
  if (url.protocol === "http:" && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)) {
    return url;
  }
  throw new Error("registry URL must use https, file, or loopback http");
}
