import { createHash, createPublicKey, verify } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as z from "zod";
import { digestFromIntegrity } from "./integrity.js";
import { PermissionSchema } from "./protocol.js";
import {
  verifyTransparencyEntry,
  verifyTransparencyLog,
  verifyWitnessStatement,
  type TransparencyLog,
  type TransparencyLogEntry,
  type WitnessStatement
} from "./transparency.js";

export type AuditStatus = "ok" | "warn" | "fail";

export interface AuditPackageResult {
  canonical: string;
  version: string;
  status: AuditStatus;
  trustLevel: string;
  trustScore: number;
  advisories: string[];
  findings: string[];
}

export interface AuditResult {
  ready: boolean;
  summary: {
    total: number;
    ok: number;
    warn: number;
    fail: number;
  };
  packages: AuditPackageResult[];
}

export interface AuditProjectOptions {
  allowedLogIds?: string[];
  allowedWitnesses?: string[];
  registry?: unknown;
  advisories?: unknown;
  advisoriesBytes?: Buffer | Uint8Array | string;
  advisoriesSignature?: unknown;
  advisoriesSignatureUrl?: string;
  advisoryPublicKeySpkiBase64?: string;
  advisoryPublicKeySpkiSha256?: string;
  registryUrl?: string;
  advisoriesUrl?: string;
  discoveryUrl?: string;
  fetchImpl?: typeof fetch;
}

const DEFAULT_DISCOVERY_URL = "https://nipmod.com/.well-known/nipmod.json";
const DEFAULT_ADVISORIES_URL = "https://nipmod.com/advisories.json";
const ADVISORIES_ARTIFACT_NAME = "advisories.json";
const ADVISORY_SIGNATURE_TYPE = "dev.nipmod.advisory.signature.v1";
const DEFAULT_ADVISORY_PUBLIC_KEY_SPKI_BASE64 = "MCowBQYDK2VwAyEAI+Y0SgEn/OH7BW0OZzSnf3S1Eu+koiKosrAo3c/12DU=";
const DEFAULT_ADVISORY_PUBLIC_KEY_SPKI_SHA256 = "448bb21fae566abf873b04f05623f137c7629d5f10131d951d79d40f71c0b90b";
const DEFAULT_ALLOWED_LOG_IDS = ["did:key:z6MkugeJcjgGhG1EpUMhhJ1Q5SoYn65T4cmiuBFE8E82TMyk"];
const DEFAULT_ALLOWED_WITNESSES = ["did:key:z6Mkv8WH5QeiZU1sJwGrCs8xe35AiH4gMfAy86zFMiEkewWJ"];
const ADVISORY_MAX_TTL_MS = 45 * 24 * 60 * 60 * 1000;
const ADVISORY_FUTURE_SKEW_MS = 5 * 60 * 1000;
const JSON_LIMIT = 1024 * 1024;
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const IntegritySchema = z.string().regex(/^sha256-[a-f0-9]{64}$/);
const PackageIdSchema = z.string().regex(/^pkg:did:key:z[A-Za-z0-9]+\/[a-z0-9][a-z0-9._-]*$/);
const SemverSchema = z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
const DidKeySchema = z.string().regex(/^did:key:z[A-Za-z0-9]+$/);

const RegistryProofSchema = z.strictObject({
  checkpointUrl: z.string().min(1),
  eventHash: Sha256Schema,
  leafHash: Sha256Schema,
  leafIndex: z.number().int().min(0),
  leafUrl: z.string().min(1),
  proofUrl: z.string().min(1),
  rootHash: Sha256Schema,
  subject: z.string().min(1),
  treeSize: z.number().int().min(1),
  type: z.literal("dev.nipmod.registry.proof.v1"),
  witnesses: z.array(DidKeySchema).optional(),
  witnessUrls: z.array(z.string().min(1)).optional()
});

const InclusionProofStepSchema = z.strictObject({
  hash: Sha256Schema,
  side: z.enum(["left", "right"])
});

const TransparencyLeafSchema = z.strictObject({
  artifactSha256: Sha256Schema,
  eventHash: Sha256Schema,
  package: PackageIdSchema,
  publisher: DidKeySchema,
  version: SemverSchema
});

const TransparencyEntrySchema = z.strictObject({
  inclusionProof: z.array(InclusionProofStepSchema),
  leaf: TransparencyLeafSchema,
  leafHash: Sha256Schema,
  leafIndex: z.number().int().min(0)
});

const SignedTreeHeadSchema = z.strictObject({
  formatVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  logId: DidKeySchema,
  rootHash: Sha256Schema,
  signature: z.strictObject({
    algorithm: z.literal("Ed25519"),
    keyId: DidKeySchema,
    signatureBase64: z.string().min(1)
  }),
  treeSize: z.number().int().min(0)
});

const WitnessStatementSchema = z.strictObject({
  formatVersion: z.literal(1),
  signature: z.strictObject({
    algorithm: z.literal("Ed25519"),
    keyId: DidKeySchema,
    signatureBase64: z.string().min(1)
  }),
  treeHead: SignedTreeHeadSchema.omit({ signature: true }),
  type: z.literal("dev.nipmod.transparency.witness.v1"),
  witness: DidKeySchema
});

const TransparencyLogSchema = z.strictObject({
  entries: z.array(TransparencyEntrySchema).max(10_000),
  formatVersion: z.literal(1),
  treeHead: SignedTreeHeadSchema,
  witnesses: z.array(WitnessStatementSchema).optional()
}).passthrough();

const LockfilePackageSchema = z.strictObject({
  name: z.string().min(1),
  canonical: PackageIdSchema,
  version: SemverSchema,
  resolved: z.string().min(1),
  integrity: IntegritySchema,
  manifestDigest: Sha256Schema,
  publisher: DidKeySchema,
  permissions: PermissionSchema,
  files: z.array(z.string().min(1))
});

const LockfileSchema = z.strictObject({
  formatVersion: z.literal(1),
  generatedBy: z.string().min(1),
  packages: z.record(z.string(), LockfilePackageSchema)
});

const RegistryPackageSchema = z.strictObject({
  canonical: PackageIdSchema,
  version: SemverSchema,
  digest: Sha256Schema,
  proof: RegistryProofSchema.optional(),
  publisher: DidKeySchema,
  trust: z.strictObject({
    level: z.enum(["verified", "signed", "review", "unknown"]),
    score: z.number().int().min(0).max(100),
    evidence: z.strictObject({
      artifactDigestVerified: z.boolean(),
      bundleSignatureVerified: z.boolean(),
      immutableSnapshotMatched: z.boolean(),
      publisherMatchesCanonical: z.boolean(),
      releaseEventSigned: z.boolean(),
      sourceProvenanceVerified: z.boolean(),
      transparencyLogIncluded: z.boolean(),
      transparencyLogVerified: z.boolean()
    })
  }).passthrough()
}).passthrough();

const RegistrySchema = z.strictObject({
  formatVersion: z.literal(1),
  packages: z.array(RegistryPackageSchema).max(10_000),
  source: z.string().min(1),
  transparencyLog: TransparencyLogSchema.optional()
}).passthrough();

const AdvisorySchema = z.strictObject({
  id: z.string().regex(/^NIPMOD-\d{4}-\d{4}$/),
  package: PackageIdSchema,
  versions: z.array(SemverSchema).min(1),
  severity: z.enum(["low", "moderate", "high", "critical"]),
  status: z.enum(["active", "withdrawn"]),
  title: z.string().min(1).max(140)
});

const AdvisoryFeedSchema = z.strictObject({
  formatVersion: z.literal(1),
  type: z.literal("dev.nipmod.advisories.v1"),
  generatedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  advisories: z.array(AdvisorySchema).max(1_000)
});

const AdvisorySignatureSchema = z.strictObject({
  algorithm: z.literal("Ed25519"),
  artifact: z.literal(ADVISORIES_ARTIFACT_NAME),
  publicKeySpkiSha256: Sha256Schema,
  signatureBase64: z.string().min(1),
  type: z.literal(ADVISORY_SIGNATURE_TYPE)
});

const DiscoverySchema = z.strictObject({
  type: z.literal("dev.nipmod.discovery.v1"),
  registry: z.strictObject({
    url: z.string().url()
  }).passthrough(),
  advisories: z.string().url().optional(),
  advisoriesSignature: z.string().url().optional(),
  transparency: z.strictObject({
    logId: DidKeySchema
  }).passthrough().optional(),
  witness: z.strictObject({
    did: DidKeySchema
  }).passthrough().optional()
}).passthrough();

type Lockfile = z.infer<typeof LockfileSchema>;
type RegistryIndex = z.infer<typeof RegistrySchema>;
type AdvisoryFeed = z.infer<typeof AdvisoryFeedSchema>;
type RegistryPackage = z.infer<typeof RegistryPackageSchema>;
type Advisory = z.infer<typeof AdvisorySchema>;

type TransparencyContext =
  | {
      allowedWitnesses: readonly string[];
      entriesByLeafHash: Map<string, TransparencyLogEntry>;
      valid: false;
    }
  | {
      allowedWitnesses: readonly string[];
      entriesByLeafHash: Map<string, TransparencyLogEntry>;
      treeHead: TransparencyLog["treeHead"];
      valid: true;
    };

export async function auditProject(projectDir: string, options: AuditProjectOptions = {}): Promise<AuditResult> {
  const lockfile = await readLockfile(join(projectDir, "nipmod.lock.json"));
  const sources = await resolveAuditSources(options);
  const registry = RegistrySchema.parse(sources.registry);
  const advisoryFeed = AdvisoryFeedSchema.parse(sources.advisories);
  assertAdvisoryFeedFresh(advisoryFeed);
  const duplicateRegistryPackages = duplicateRegistryPackageKeys(registry.packages);
  const registryByPackage = new Map(registry.packages.map((pkg) => [`${pkg.canonical}@${pkg.version}`, pkg]));
  const transparency = buildTransparencyContext(registry, sources.allowedLogIds, sources.allowedWitnesses);
  const activeAdvisories = advisoryFeed.advisories.filter((advisory) => advisory.status === "active");
  const packages = Object.entries(lockfile.packages).map(([key, locked]) =>
    auditLockedPackage(key, locked, registryByPackage, duplicateRegistryPackages, activeAdvisories, transparency)
  );
  const summary = {
    total: packages.length,
    ok: packages.filter((pkg) => pkg.status === "ok").length,
    warn: packages.filter((pkg) => pkg.status === "warn").length,
    fail: packages.filter((pkg) => pkg.status === "fail").length
  };

  return {
    ready: summary.fail === 0,
    summary,
    packages
  };
}

function auditLockedPackage(
  key: string,
  locked: Lockfile["packages"][string],
  registryByPackage: Map<string, RegistryPackage>,
  duplicateRegistryPackages: ReadonlySet<string>,
  advisories: Advisory[],
  transparency: TransparencyContext
): AuditPackageResult {
  const findings: string[] = [];
  const packageKey = `${locked.canonical}@${locked.version}`;
  const canonicalOwner = packageOwner(locked.canonical);
  const matchingAdvisories = advisories.filter(
    (advisory) => advisory.package === locked.canonical && advisory.versions.includes(locked.version)
  );
  let status: AuditStatus = "ok";
  const registryPackage = registryByPackage.get(packageKey);
  let trustLevel = "missing";
  let trustScore = 0;

  if (key !== packageKey) {
    status = "fail";
    findings.push("lockfile package key does not match package identity");
  }
  if (locked.publisher !== canonicalOwner) {
    status = "fail";
    findings.push("package publisher does not match canonical owner");
  }
  if (!registryPackage) {
    status = "fail";
    findings.push("package is missing from the public registry");
  } else {
    if (duplicateRegistryPackages.has(packageKey)) {
      status = "fail";
      findings.push("registry contains duplicate package records");
    }
    trustLevel = registryPackage.trust.level;
    trustScore = registryPackage.trust.score;
    if (registryPackage.digest !== digestFromIntegrity(locked.integrity)) {
      status = "fail";
      findings.push("registry digest does not match lockfile integrity");
    }
    if (registryPackage.publisher !== locked.publisher) {
      status = "fail";
      findings.push("registry publisher does not match lockfile publisher");
    }
    if (
      registryPackage.trust.level !== "verified" ||
      registryPackage.trust.score !== 100 ||
      !hasCompleteTrustEvidence(registryPackage.trust.evidence)
    ) {
      status = "fail";
      findings.push("package is not verified by the public registry");
    }
    if (!verifyPackageTransparency(registryPackage, transparency, locked.publisher)) {
      status = "fail";
      findings.push("transparency proof is invalid");
    }
  }

  for (const advisory of matchingAdvisories) {
    findings.push(`${advisory.id}: ${advisory.title}`);
    if (advisory.severity === "high" || advisory.severity === "critical") {
      status = "fail";
    } else if (status === "ok") {
      status = "warn";
    }
  }

  return {
    canonical: locked.canonical,
    version: locked.version,
    status,
    trustLevel,
    trustScore,
    advisories: matchingAdvisories.map((advisory) => advisory.id),
    findings
  };
}

function duplicateRegistryPackageKeys(packages: readonly RegistryPackage[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const pkg of packages) {
    const key = `${pkg.canonical}@${pkg.version}`;
    if (seen.has(key)) {
      duplicates.add(key);
      continue;
    }
    seen.add(key);
  }
  return duplicates;
}

function verifyPackageTransparency(
  pkg: RegistryPackage,
  transparency: TransparencyContext,
  expectedPublisher: string
): boolean {
  if (!transparency.valid || !pkg.proof) {
    return false;
  }
  if (
    pkg.proof.subject !== `${pkg.canonical}@${pkg.version}` ||
    pkg.proof.rootHash !== transparency.treeHead.rootHash ||
    pkg.proof.treeSize !== transparency.treeHead.treeSize ||
    pkg.proof.witnesses?.some((witness) => transparency.allowedWitnesses.includes(witness)) !== true
  ) {
    return false;
  }
  const entry = transparency.entriesByLeafHash.get(pkg.proof.leafHash);
  if (!verifyTransparencyEntry(entry, transparency.treeHead)) {
    return false;
  }
  const canonicalOwner = packageOwner(pkg.canonical);
  return (
    entry?.leaf.package === pkg.canonical &&
    entry.leaf.version === pkg.version &&
    entry.leaf.artifactSha256 === pkg.digest &&
    entry.leaf.eventHash === pkg.proof.eventHash &&
    entry.leafIndex === pkg.proof.leafIndex &&
    entry.leaf.publisher === pkg.publisher &&
    pkg.publisher === expectedPublisher &&
    pkg.publisher === canonicalOwner
  );
}

function packageOwner(canonical: string): string {
  return canonical.slice("pkg:".length, canonical.indexOf("/"));
}

function buildTransparencyContext(
  registry: RegistryIndex,
  allowedLogIds: readonly string[],
  allowedWitnesses: readonly string[]
): TransparencyContext {
  const empty = (): TransparencyContext => ({
    allowedWitnesses,
    entriesByLeafHash: new Map(),
    valid: false
  });
  if (allowedLogIds.length === 0 || allowedWitnesses.length === 0 || !registry.transparencyLog) {
    return empty();
  }

  const log = registry.transparencyLog as TransparencyLog & { witnesses?: WitnessStatement[] };
  if (!verifyTransparencyLog(log, allowedLogIds)) {
    return empty();
  }
  if (!(log.witnesses ?? []).some((witness) => verifyWitnessStatement(witness, log.treeHead, allowedWitnesses))) {
    return empty();
  }

  return {
    allowedWitnesses,
    entriesByLeafHash: new Map(log.entries.map((entry) => [entry.leafHash, entry])),
    treeHead: log.treeHead,
    valid: true
  };
}

function hasCompleteTrustEvidence(evidence: RegistryPackage["trust"]["evidence"]): boolean {
  return (
    evidence.artifactDigestVerified &&
    evidence.bundleSignatureVerified &&
    evidence.immutableSnapshotMatched &&
    evidence.publisherMatchesCanonical &&
    evidence.releaseEventSigned &&
    evidence.sourceProvenanceVerified &&
    evidence.transparencyLogIncluded &&
    evidence.transparencyLogVerified
  );
}

function assertAdvisoryFeedFresh(feed: AdvisoryFeed): void {
  const now = Date.now();
  const generatedAt = Date.parse(feed.generatedAt);
  const expiresAt = Date.parse(feed.expiresAt);
  if (!Number.isFinite(generatedAt) || !Number.isFinite(expiresAt)) {
    throw new Error("advisory feed timestamps are invalid");
  }
  if (generatedAt > now + ADVISORY_FUTURE_SKEW_MS) {
    throw new Error("advisory feed generatedAt is in the future");
  }
  if (expiresAt <= now) {
    throw new Error("advisory feed expired");
  }
  if (expiresAt <= generatedAt || expiresAt - generatedAt > ADVISORY_MAX_TTL_MS) {
    throw new Error("advisory feed expiry window is invalid");
  }
}

async function resolveAuditSources(
  options: AuditProjectOptions
): Promise<{ registry: unknown; advisories: unknown; allowedLogIds: string[]; allowedWitnesses: string[] }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  let registryUrl = options.registryUrl;
  let advisoriesUrl = options.advisoriesUrl;
  let advisoriesSignatureUrl = options.advisoriesSignatureUrl;
  let allowedLogIds = options.allowedLogIds ?? DEFAULT_ALLOWED_LOG_IDS;
  let allowedWitnesses = options.allowedWitnesses ?? DEFAULT_ALLOWED_WITNESSES;
  if ((!options.registry && !registryUrl) || (!hasDirectAdvisorySource(options) && !advisoriesUrl)) {
    const discovery = DiscoverySchema.parse(
      await readJsonSource(options.discoveryUrl ?? DEFAULT_DISCOVERY_URL, "discovery manifest", fetchImpl)
    );
    registryUrl = registryUrl ?? discovery.registry.url;
    advisoriesUrl = advisoriesUrl ?? discovery.advisories ?? DEFAULT_ADVISORIES_URL;
    advisoriesSignatureUrl = advisoriesSignatureUrl ?? discovery.advisoriesSignature;
  }

  return {
    allowedLogIds,
    allowedWitnesses,
    registry: options.registry ?? (await readJsonSource(requiredSource(registryUrl, "registry"), "registry", fetchImpl)),
    advisories: await resolveAdvisoryFeed(options, advisoriesUrl, advisoriesSignatureUrl, fetchImpl)
  };
}

async function readLockfile(path: string): Promise<Lockfile> {
  const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
  return LockfileSchema.parse(parsed);
}

async function readJsonSource(source: string, label: string, fetchImpl: typeof fetch): Promise<unknown> {
  return (await readJsonBytesSource(source, label, fetchImpl, true)).payload;
}

async function readAdvisoryFeedSource(
  source: string,
  signatureSource: string | undefined,
  options: AuditProjectOptions,
  fetchImpl: typeof fetch
): Promise<unknown> {
  const advisories = await readJsonBytesSource(source, "advisories", fetchImpl, true);
  const effectiveSignatureSource = signatureSource ?? defaultAdvisorySignatureSource(advisories.url);

  const signature = (await readJsonBytesSource(effectiveSignatureSource, "advisories signature", fetchImpl, false)).payload;
  verifyAdvisoryFeedSignature(advisories.bytes, signature, options);

  return advisories.payload;
}

async function resolveAdvisoryFeed(
  options: AuditProjectOptions,
  advisoriesUrl: string | undefined,
  advisoriesSignatureUrl: string | undefined,
  fetchImpl: typeof fetch
): Promise<unknown> {
  if (options.advisoriesBytes !== undefined) {
    const bytes = advisoryBytes(options.advisoriesBytes);
    if (bytes.length > JSON_LIMIT) {
      throw new Error("advisories response is too large");
    }
    if (!options.advisoriesSignature) {
      throw new Error("raw signed advisory bytes require advisoriesSignature");
    }
    verifyAdvisoryFeedSignature(bytes, options.advisoriesSignature, options);
    return JSON.parse(bytes.toString("utf8")) as unknown;
  }
  if (options.advisories !== undefined) {
    throw new Error("direct advisory feed objects cannot be verified; provide raw signed advisory bytes");
  }
  return readAdvisoryFeedSource(requiredSource(advisoriesUrl, "advisories"), advisoriesSignatureUrl, options, fetchImpl);
}

function hasDirectAdvisorySource(options: AuditProjectOptions): boolean {
  return options.advisoriesBytes !== undefined || options.advisories !== undefined;
}

function advisoryBytes(value: Buffer | Uint8Array | string): Buffer {
  return typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value);
}

async function readJsonBytesSource(
  source: string,
  label: string,
  fetchImpl: typeof fetch,
  requireJsonContentType: boolean
): Promise<{ bytes: Buffer; payload: unknown; url: URL }> {
  const url = parseTrustedJsonUrl(source, label);
  if (url.protocol === "file:") {
    const bytes = await readFile(fileURLToPath(url));
    return { bytes, payload: JSON.parse(bytes.toString("utf8")) as unknown, url };
  }

  const response = await fetchImpl(url.href, {
    redirect: "error",
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) {
    throw new Error(`failed to fetch ${label}: ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (requireJsonContentType && !contentType.toLowerCase().includes("application/json")) {
    throw new Error(`${label} response must be application/json`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > JSON_LIMIT) {
    throw new Error(`${label} response is too large`);
  }
  return { bytes, payload: JSON.parse(bytes.toString("utf8")) as unknown, url };
}

function verifyAdvisoryFeedSignature(bytes: Buffer, signatureValue: unknown, options: AuditProjectOptions): void {
  const signature = AdvisorySignatureSchema.parse(signatureValue);
  const publicKeySpkiBase64 = options.advisoryPublicKeySpkiBase64 ?? DEFAULT_ADVISORY_PUBLIC_KEY_SPKI_BASE64;
  const publicKeySpkiSha256 = options.advisoryPublicKeySpkiSha256 ?? DEFAULT_ADVISORY_PUBLIC_KEY_SPKI_SHA256;
  const publicKeyDer = Buffer.from(publicKeySpkiBase64, "base64");
  const publicKeyDigest = createHash("sha256").update(publicKeyDer).digest("hex");

  if (publicKeyDigest !== publicKeySpkiSha256 || signature.publicKeySpkiSha256 !== publicKeySpkiSha256) {
    throw new Error("advisory feed signature public key mismatch");
  }

  const publicKey = createPublicKey({
    format: "der",
    key: publicKeyDer,
    type: "spki"
  });
  if (!verify(null, bytes, publicKey, Buffer.from(signature.signatureBase64, "base64"))) {
    throw new Error("advisory feed signature verification failed");
  }
}

function defaultAdvisorySignatureSource(url: URL): string {
  const signatureUrl = new URL(url.href);
  signatureUrl.pathname = `${signatureUrl.pathname}.sig`;
  return signatureUrl.href;
}

function requiredSource(source: string | undefined, label: string): string {
  if (!source) {
    throw new Error(`${label} source is missing`);
  }
  return source;
}

function parseTrustedJsonUrl(source: string, label: string): URL {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw new Error(`${label} URL is invalid`);
  }
  if (url.username || url.password) {
    throw new Error(`${label} URL must not include credentials`);
  }
  if (url.protocol === "file:") {
    return url;
  }
  if (url.protocol === "https:") {
    return url;
  }
  if (url.protocol === "http:" && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)) {
    return url;
  }
  throw new Error(`${label} URL must use https, file, or loopback http`);
}
