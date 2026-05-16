import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as z from "zod";

export const DEFAULT_REGISTRY_URL = "https://nipmod.com/registry/packages.json";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const PackageIdSchema = z.string().regex(/^pkg:did:key:z[A-Za-z0-9]+\/[a-z0-9][a-z0-9._-]*$/);
const SemverSchema = z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
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
  description: z.string().optional(),
  digest: Sha256Schema,
  name: z.string().min(1),
  owner: z.string().min(1).optional(),
  permissions: PermissionCountsSchema.optional(),
  quarantine: QuarantineSchema.optional(),
  trust: z.strictObject({
    level: z.enum(["verified", "signed", "review", "unknown"]),
    score: z.number().int().min(0).max(100)
  }).passthrough(),
  type: z.string().min(1).optional(),
  version: SemverSchema
}).passthrough();

const RegistrySearchIndexSchema = z.strictObject({
  formatVersion: z.literal(1),
  packages: z.array(RegistrySearchPackageSchema).max(10_000),
  source: z.string().min(1)
}).passthrough();

export interface RegistrySearchPackage {
  advisories: string[];
  canonical: string;
  compatibilityReceipts: string[];
  description: string;
  digest: string;
  install?: string;
  installBlockedReason?: string;
  name: string;
  permissionSummary: string;
  quarantined: boolean;
  trust: string;
  trustLevel: string;
  trustScore: number;
  type: string;
  version: string;
}

export interface RegistrySearchResult {
  packages: RegistrySearchPackage[];
  query: string;
  total: number;
}

export async function searchRegistry(options: {
  fetchImpl?: typeof fetch;
  includeQuarantined?: boolean;
  limit: number;
  query: string;
  registryUrl: string;
}): Promise<RegistrySearchResult> {
  const registry = RegistrySearchIndexSchema.parse(await readJsonSource(options.registryUrl, options.fetchImpl ?? fetch));
  const query = options.query.trim().toLowerCase();
  const packages = registry.packages
    .filter((pkg) => options.includeQuarantined === true || !isActivelyQuarantined(pkg))
    .filter((pkg) => registryPackageMatches(pkg, query))
    .sort(compareRegistryPackages)
    .slice(0, options.limit)
    .map(toSearchPackage);

  return {
    packages,
    query: options.query,
    total: packages.length
  };
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
  right: z.infer<typeof RegistrySearchPackageSchema>
): number {
  return right.trust.score - left.trust.score || left.name.localeCompare(right.name) || left.version.localeCompare(right.version);
}

function toSearchPackage(pkg: z.infer<typeof RegistrySearchPackageSchema>): RegistrySearchPackage {
  const quarantine = activeQuarantine(pkg);
  const installBlockedReason = quarantine ? quarantineBlockedReason(quarantine) : undefined;
  return {
    advisories: quarantine ? [quarantine.advisoryId] : [],
    canonical: pkg.canonical,
    compatibilityReceipts: (pkg.compatibilityReceipts ?? []).map((receipt) => receipt.label),
    description: pkg.description ?? "",
    digest: pkg.digest,
    ...(installBlockedReason ? { installBlockedReason } : { install: `nipmod add ${pkg.canonical}@${pkg.version} --online` }),
    name: pkg.name,
    permissionSummary: permissionSummary(pkg.permissions),
    quarantined: Boolean(quarantine),
    trust: `${pkg.trust.level}/${pkg.trust.score}`,
    trustLevel: pkg.trust.level,
    trustScore: pkg.trust.score,
    type: pkg.type ?? "package",
    version: pkg.version
  };
}

function isActivelyQuarantined(pkg: z.infer<typeof RegistrySearchPackageSchema>): boolean {
  return activeQuarantine(pkg) !== undefined;
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
  return Buffer.from(await response.arrayBuffer());
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
