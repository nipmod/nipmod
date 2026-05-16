import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as z from "zod";
import { verifyBundle } from "./bundle.js";
import { readResponseBytes } from "./http.js";
import { digestFromIntegrity, integrityFromDigest } from "./integrity.js";
import { PermissionSchema } from "./protocol.js";
import {
  verifyTransparencyEntry,
  verifyTransparencyLog,
  verifyWitnessStatement,
  type TransparencyLog,
  type TransparencyLogEntry,
  type WitnessStatement
} from "./transparency.js";
import { sha256Hex } from "./verifier.js";

export type TrustReportVerdict = "verified" | "signed-local" | "failed";
export type TrustEvidenceStatus = "pass" | "fail" | "missing";

export interface TrustEvidenceCheck {
  id: string;
  label: string;
  status: TrustEvidenceStatus;
  detail: string;
}

export interface TrustReport {
  formatVersion: 1;
  subject: string;
  canonical: string;
  version: string;
  name: string;
  type: string;
  description: string;
  digest: string;
  integrity: string;
  publisher: string;
  owner: string;
  verdict: TrustReportVerdict;
  readyToInstall: boolean;
  trust: {
    level: string;
    score: number;
  };
  permissions: {
    summary: string;
    counts: Record<"env" | "filesystem" | "mcpTools" | "network" | "secrets", number>;
    exec: boolean;
    postinstall: boolean;
  };
  evidence: TrustEvidenceCheck[];
  findings: string[];
  installCommand?: string;
  compatibilityReceipts?: CompatibilityReceipt[];
  quarantine?: {
    active: boolean;
    advisoryId: string;
    reason: string;
    severity: string;
    status: string;
  };
  resolved?: string;
  source?: {
    registry?: string;
    repo?: string;
    commit?: string;
    tag?: string;
  };
  transparency?: {
    logId?: string;
    rootHash?: string;
    treeSize?: number;
    witnesses: string[];
  };
}

export interface CompatibilityReceipt {
  exampleUrl: string;
  externalFormat: "apm-package" | "git-source-provenance" | "mcp-server-json";
  externalInputSha256: string;
  id: string;
  label: string;
  package: string;
  packageDigest: string;
  preservedFields: string[];
  provenanceLoss: [];
  receiptUrl: string;
  sourceCommit: string;
  sourceRepo: string;
  sourceTag: string;
  type: "dev.nipmod.compatibility-receipt.v1";
  unsupportedFields: string[];
  version: string;
}

export interface InspectRegistryPackageOptions {
  allowedLogIds?: readonly string[];
  allowedWitnesses?: readonly string[];
  fetchImpl?: typeof fetch;
  registryUrl: string;
  specifier: string;
}

export interface InspectBundleFileOptions {
  integrity?: string;
  path: string;
  subject: string;
}

const DEFAULT_ALLOWED_LOG_IDS = ["did:key:z6MkugeJcjgGhG1EpUMhhJ1Q5SoYn65T4cmiuBFE8E82TMyk"];
const DEFAULT_ALLOWED_WITNESSES = ["did:key:z6Mkv8WH5QeiZU1sJwGrCs8xe35AiH4gMfAy86zFMiEkewWJ"];
const JSON_LIMIT = 1024 * 1024;
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const PackageIdSchema = z.string().regex(/^pkg:did:key:z[A-Za-z0-9]+\/[a-z0-9][a-z0-9._-]*$/);
const SemverSchema = z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
const DidKeySchema = z.string().regex(/^did:key:z[A-Za-z0-9]+$/);

const PermissionCountsSchema = z.strictObject({
  env: z.number().int().min(0).optional(),
  exec: z.boolean().optional(),
  filesystem: z.number().int().min(0).optional(),
  mcpTools: z.number().int().min(0).optional(),
  network: z.number().int().min(0).optional(),
  postinstall: z.boolean().optional(),
  secrets: z.number().int().min(0).optional()
});

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

const RegistryPackageSchema = z.strictObject({
  canonical: PackageIdSchema,
  description: z.string().optional(),
  digest: Sha256Schema,
  name: z.string().min(1).optional(),
  owner: DidKeySchema.optional(),
  compatibilityReceipts: z.array(CompatibilityReceiptSchema).max(16).optional(),
  permissions: PermissionCountsSchema.optional(),
  proof: RegistryProofSchema.optional(),
  publisher: DidKeySchema,
  quarantine: QuarantineSchema.optional(),
  resolved: z.string().min(1).optional(),
  sourceCommit: z.string().regex(/^[a-f0-9]{40}$/).optional(),
  sourceRepo: z.string().min(1).optional(),
  sourceTag: z.string().min(1).optional(),
  trust: z.strictObject({
    evidence: z.strictObject({
      artifactDigestVerified: z.boolean(),
      bundleSignatureVerified: z.boolean(),
      immutableSnapshotMatched: z.boolean(),
      publisherMatchesCanonical: z.boolean(),
      releaseEventSigned: z.boolean(),
      sourceProvenanceVerified: z.boolean(),
      transparencyLogIncluded: z.boolean(),
      transparencyLogVerified: z.boolean()
    }),
    level: z.enum(["verified", "signed", "review", "unknown"]),
    score: z.number().int().min(0).max(100)
  }).passthrough(),
  type: z.string().min(1).optional(),
  version: SemverSchema
}).passthrough();

const RegistrySchema = z.strictObject({
  formatVersion: z.literal(1),
  packages: z.array(RegistryPackageSchema).max(10_000),
  source: z.string().min(1),
  transparencyLog: TransparencyLogSchema.optional()
}).passthrough();

type RegistryIndex = z.infer<typeof RegistrySchema>;
type RegistryPackage = z.infer<typeof RegistryPackageSchema>;
type PermissionCounts = z.infer<typeof PermissionCountsSchema>;

interface InspectSpecifier {
  canonical: string;
  version: string;
}

type TransparencyContext =
  | {
      allowedWitnesses: readonly string[];
      entriesByLeafHash: Map<string, TransparencyLogEntry>;
      logVerified: false;
      witnessVerified: false;
    }
  | {
      allowedWitnesses: readonly string[];
      entriesByLeafHash: Map<string, TransparencyLogEntry>;
      logVerified: true;
      treeHead: TransparencyLog["treeHead"];
      witnessVerified: boolean;
      witnesses: string[];
    };

export async function inspectRegistryPackage(options: InspectRegistryPackageOptions): Promise<TrustReport> {
  const spec = parseInspectSpecifier(options.specifier);
  const registry = RegistrySchema.parse(await readJsonSource(options.registryUrl, options.fetchImpl ?? fetch));
  const matches = registry.packages.filter((item) => item.canonical === spec.canonical && item.version === spec.version);
  if (matches.length === 0) {
    return missingRegistryPackageReport(options.specifier, spec.canonical, spec.version);
  }
  if (matches.length > 1) {
    return duplicateRegistryPackageReport(options.specifier, spec.canonical, spec.version);
  }
  const pkg = matches[0];
  if (!pkg) {
    return missingRegistryPackageReport(options.specifier, spec.canonical, spec.version);
  }

  const allowedLogIds = options.allowedLogIds ?? DEFAULT_ALLOWED_LOG_IDS;
  const allowedWitnesses = options.allowedWitnesses ?? DEFAULT_ALLOWED_WITNESSES;
  const transparency = buildTransparencyContext(registry, allowedLogIds, allowedWitnesses);
  return registryPackageReport(options.specifier, options.registryUrl, pkg, transparency);
}

export async function inspectBundleFile(options: InspectBundleFileOptions): Promise<TrustReport> {
  const bytes = await readFile(options.path);
  const digest = sha256Hex(bytes);
  const expectedDigest = options.integrity ? digestFromIntegrity(options.integrity) : undefined;
  const bundle = verifyBundle(bytes, expectedDigest, { requireSignature: true });
  const owner = packageOwner(bundle.manifest.canonical);
  const findings: string[] = [];
  if (bundle.manifest.publish.signingKey !== owner) {
    findings.push("package publisher does not match canonical owner");
  }

  const evidence = [
    evidenceCheck("artifact-digest", "Artifact digest", "pass", `sha256-${digest}`),
    evidenceCheck("bundle-signature", "Bundle signature", "pass", `signed by ${bundle.manifest.publish.signingKey}`),
    evidenceCheck(
      "publisher-canonical",
      "Publisher matches canonical owner",
      bundle.manifest.publish.signingKey === owner ? "pass" : "fail",
      bundle.manifest.publish.signingKey === owner ? owner : "publisher mismatch"
    ),
    evidenceCheck("source-provenance", "Source provenance", "missing", "not available for local bundle"),
    evidenceCheck("transparency", "Transparency proof", "missing", "not available for local bundle"),
    evidenceCheck("witness", "Witness statement", "missing", "not available for local bundle")
  ];

  return {
    canonical: bundle.manifest.canonical,
    description: bundle.manifest.description ?? "",
    digest,
    evidence,
    findings,
    formatVersion: 1,
    integrity: integrityFromDigest(digest),
    name: bundle.manifest.name,
    owner,
    permissions: manifestPermissionReport(bundle.manifest.permissions),
    publisher: bundle.manifest.publish.signingKey,
    readyToInstall: false,
    subject: options.subject,
    trust: {
      level: "signed-local",
      score: findings.length === 0 ? 60 : 0
    },
    type: bundle.manifest.type,
    verdict: findings.length === 0 ? "signed-local" : "failed",
    version: bundle.manifest.version
  };
}

function registryPackageReport(
  subject: string,
  registryUrl: string,
  pkg: RegistryPackage,
  transparency: TransparencyContext
): TrustReport {
  const owner = packageOwner(pkg.canonical);
  const findings: string[] = [];
  const transparencyResult = verifyPackageTransparency(pkg, transparency);
  const evidence = [
    evidenceFromRegistry("artifact-digest", "Artifact digest", pkg.trust.evidence.artifactDigestVerified),
    evidenceFromRegistry("bundle-signature", "Bundle signature", pkg.trust.evidence.bundleSignatureVerified),
    evidenceFromRegistry("immutable-snapshot", "Immutable version snapshot", pkg.trust.evidence.immutableSnapshotMatched),
    evidenceFromRegistry(
      "publisher-canonical",
      "Publisher matches canonical owner",
      pkg.trust.evidence.publisherMatchesCanonical && pkg.publisher === owner
    ),
    evidenceFromRegistry("release-event", "Signed release event", pkg.trust.evidence.releaseEventSigned),
    evidenceFromRegistry("source-provenance", "Source provenance", pkg.trust.evidence.sourceProvenanceVerified),
    evidenceCheck(
      "transparency",
      "Transparency proof",
      transparencyResult.transparencyVerified ? "pass" : "fail",
      transparencyResult.transparencyVerified ? `${pkg.proof?.rootHash ?? ""}` : "transparency proof is invalid"
    ),
    evidenceCheck(
      "witness",
      "Witness statement",
      transparencyResult.witnessVerified ? "pass" : "fail",
      transparencyResult.witnessVerified ? transparencyResult.witnesses.join(", ") : "witness statement is invalid"
    )
  ];

  for (const check of evidence) {
    if (check.status === "fail") {
      findings.push(check.detail);
    }
  }
  for (const finding of transparencyResult.findings) {
    if (!findings.includes(finding)) {
      findings.push(finding);
    }
  }
  if (pkg.trust.level !== "verified" || pkg.trust.score !== 100 || !hasCompleteTrustEvidence(pkg.trust.evidence)) {
    findings.push("package is not verified by the public registry");
  }
  const quarantine = activeQuarantine(pkg);
  if (quarantine) {
    findings.push(`package is quarantined: ${quarantine.advisoryId}: ${quarantine.reason}`);
  }
  const registryUrlTrustedForCompatibility = trustsRegistryCompatibilityReceipts(registryUrl);
  const compatibilityReceipts = registryUrlTrustedForCompatibility ? matchingCompatibilityReceipts(pkg) : [];
  if (registryUrlTrustedForCompatibility && (pkg.compatibilityReceipts?.length ?? 0) !== compatibilityReceipts.length) {
    findings.push("compatibility receipt does not match package evidence");
  }

  const verified = findings.length === 0 && evidence.every((check) => check.status === "pass");
  const source: NonNullable<TrustReport["source"]> = {
    registry: registryUrl
  };
  if (pkg.sourceRepo) {
    source.repo = pkg.sourceRepo;
  }
  if (pkg.sourceCommit) {
    source.commit = pkg.sourceCommit;
  }
  if (pkg.sourceTag) {
    source.tag = pkg.sourceTag;
  }

  let transparencyReport: TrustReport["transparency"];
  if (pkg.proof || transparency.logVerified) {
    transparencyReport = {
      witnesses: transparencyResult.witnesses
    };
    if (transparency.logVerified) {
      transparencyReport.logId = transparency.treeHead.logId;
    }
    if (pkg.proof) {
      transparencyReport.rootHash = pkg.proof.rootHash;
      transparencyReport.treeSize = pkg.proof.treeSize;
    }
  }

  const report: TrustReport = {
    canonical: pkg.canonical,
    description: pkg.description ?? "",
    digest: pkg.digest,
    evidence,
    findings,
    formatVersion: 1,
    integrity: integrityFromDigest(pkg.digest),
    name: pkg.name ?? pkg.canonical.split("/").at(-1) ?? pkg.canonical,
    owner,
    permissions: countPermissionReport(pkg.permissions),
    publisher: pkg.publisher,
    readyToInstall: verified,
    source,
    subject,
    trust: {
      level: pkg.trust.level,
      score: pkg.trust.score
    },
    type: pkg.type ?? "package",
    verdict: verified ? "verified" : "failed",
    version: pkg.version
  };
  if (pkg.resolved) {
    report.resolved = pkg.resolved;
  }
  if (compatibilityReceipts.length > 0) {
    report.compatibilityReceipts = compatibilityReceipts;
  }
  if (quarantine) {
    report.quarantine = {
      active: true,
      advisoryId: quarantine.advisoryId,
      reason: quarantine.reason,
      severity: quarantine.severity,
      status: quarantine.status
    };
  }
  if (transparencyReport) {
    report.transparency = transparencyReport;
  }
  if (verified) {
    report.installCommand = `nipmod add ${pkg.canonical}@${pkg.version} --online`;
  }

  return report;
}

function matchingCompatibilityReceipts(pkg: RegistryPackage): CompatibilityReceipt[] {
  return (pkg.compatibilityReceipts ?? [])
    .filter((receipt) => compatibilityReceiptMatchesPackage(receipt, pkg))
    .map((receipt) => ({
      exampleUrl: receipt.exampleUrl,
      externalFormat: receipt.externalFormat,
      externalInputSha256: receipt.externalInputSha256,
      id: receipt.id,
      label: receipt.label,
      package: receipt.package,
      packageDigest: receipt.packageDigest,
      preservedFields: receipt.preservedFields,
      provenanceLoss: [],
      receiptUrl: receipt.receiptUrl,
      sourceCommit: receipt.sourceCommit,
      sourceRepo: receipt.sourceRepo,
      sourceTag: receipt.sourceTag,
      type: receipt.type,
      unsupportedFields: receipt.unsupportedFields,
      version: receipt.version
    }));
}

function compatibilityReceiptMatchesPackage(receipt: z.infer<typeof CompatibilityReceiptSchema>, pkg: RegistryPackage): boolean {
  return (
    receipt.package === pkg.canonical &&
    receipt.version === pkg.version &&
    receipt.packageDigest === pkg.digest &&
    receipt.sourceRepo === pkg.sourceRepo &&
    receipt.sourceCommit === pkg.sourceCommit &&
    receipt.sourceTag === pkg.sourceTag
  );
}

function trustsRegistryCompatibilityReceipts(registryUrl: string): boolean {
  const url = parseTrustedJsonUrl(registryUrl);
  if (url.protocol === "file:") {
    return true;
  }
  return url.origin === "https://nipmod.com";
}

function activeQuarantine(pkg: RegistryPackage): z.infer<typeof QuarantineSchema> | undefined {
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

function verifyPackageTransparency(
  pkg: RegistryPackage,
  transparency: TransparencyContext
): { findings: string[]; transparencyVerified: boolean; witnessVerified: boolean; witnesses: string[] } {
  const findings: string[] = [];
  if (!transparency.logVerified) {
    findings.push("transparency log is invalid");
  }
  if (!pkg.proof) {
    findings.push("transparency proof is invalid");
    return {
      findings,
      transparencyVerified: false,
      witnessVerified: false,
      witnesses: []
    };
  }
  if (!transparency.logVerified) {
    return {
      findings,
      transparencyVerified: false,
      witnessVerified: false,
      witnesses: pkg.proof.witnesses ?? []
    };
  }
  if (
    pkg.proof.subject !== `${pkg.canonical}@${pkg.version}` ||
    pkg.proof.rootHash !== transparency.treeHead.rootHash ||
    pkg.proof.treeSize !== transparency.treeHead.treeSize ||
    pkg.proof.witnesses?.some((witness) => transparency.allowedWitnesses.includes(witness)) !== true
  ) {
    findings.push("transparency proof is invalid");
  }
  const entry = transparency.entriesByLeafHash.get(pkg.proof.leafHash);
  if (!verifyTransparencyEntry(entry, transparency.treeHead)) {
    findings.push("transparency proof is invalid");
  }
  if (
    entry?.leaf.package !== pkg.canonical ||
    entry.leaf.version !== pkg.version ||
    entry.leaf.artifactSha256 !== pkg.digest ||
    entry.leaf.eventHash !== pkg.proof.eventHash ||
    entry.leafIndex !== pkg.proof.leafIndex ||
    entry.leaf.publisher !== pkg.publisher ||
    pkg.publisher !== packageOwner(pkg.canonical)
  ) {
    findings.push("transparency proof is invalid");
  }
  if (!transparency.witnessVerified) {
    findings.push("witness statement is invalid");
  }

  const uniqueFindings = [...new Set(findings)];
  return {
    findings: uniqueFindings,
    transparencyVerified: !uniqueFindings.includes("transparency proof is invalid") && transparency.logVerified,
    witnessVerified: transparency.witnessVerified,
    witnesses: pkg.proof.witnesses ?? []
  };
}

function buildTransparencyContext(
  registry: RegistryIndex,
  allowedLogIds: readonly string[],
  allowedWitnesses: readonly string[]
): TransparencyContext {
  if (allowedLogIds.length === 0 || allowedWitnesses.length === 0 || !registry.transparencyLog) {
    return {
      allowedWitnesses,
      entriesByLeafHash: new Map(),
      logVerified: false,
      witnessVerified: false
    };
  }

  const log = registry.transparencyLog as TransparencyLog & { witnesses?: WitnessStatement[] };
  if (!verifyTransparencyLog(log, allowedLogIds)) {
    return {
      allowedWitnesses,
      entriesByLeafHash: new Map(),
      logVerified: false,
      witnessVerified: false
    };
  }

  const validWitnesses = (log.witnesses ?? [])
    .filter((witness) => verifyWitnessStatement(witness, log.treeHead, allowedWitnesses))
    .map((witness) => witness.witness);
  return {
    allowedWitnesses,
    entriesByLeafHash: new Map(log.entries.map((entry) => [entry.leafHash, entry])),
    logVerified: true,
    treeHead: log.treeHead,
    witnessVerified: validWitnesses.length > 0,
    witnesses: validWitnesses
  };
}

function missingRegistryPackageReport(subject: string, canonical: string, version: string): TrustReport {
  const owner = packageOwner(canonical);
  return {
    canonical,
    description: "",
    digest: "",
    evidence: [],
    findings: ["package is missing from the registry"],
    formatVersion: 1,
    integrity: "",
    name: canonical.split("/").at(-1) ?? canonical,
    owner,
    permissions: emptyPermissionReport(),
    publisher: owner,
    readyToInstall: false,
    subject,
    trust: {
      level: "missing",
      score: 0
    },
    type: "package",
    verdict: "failed",
    version
  };
}

function duplicateRegistryPackageReport(subject: string, canonical: string, version: string): TrustReport {
  const owner = packageOwner(canonical);
  return {
    canonical,
    description: "",
    digest: "",
    evidence: [],
    findings: ["duplicate registry package records"],
    formatVersion: 1,
    integrity: "",
    name: canonical.split("/").at(-1) ?? canonical,
    owner,
    permissions: emptyPermissionReport(),
    publisher: owner,
    readyToInstall: false,
    subject,
    trust: {
      level: "duplicate",
      score: 0
    },
    type: "package",
    verdict: "failed",
    version
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

function evidenceFromRegistry(id: string, label: string, passed: boolean): TrustEvidenceCheck {
  return evidenceCheck(id, label, passed ? "pass" : "fail", passed ? "verified by registry" : `${label.toLowerCase()} is missing`);
}

function evidenceCheck(id: string, label: string, status: TrustEvidenceStatus, detail: string): TrustEvidenceCheck {
  return {
    detail,
    id,
    label,
    status
  };
}

function manifestPermissionReport(permissions: z.infer<typeof PermissionSchema>): TrustReport["permissions"] {
  return {
    counts: {
      env: permissions.env.length,
      filesystem: permissions.filesystem.length,
      mcpTools: permissions.mcpTools.length,
      network: permissions.network.length,
      secrets: permissions.secrets.length
    },
    exec: permissions.exec.allowed,
    postinstall: permissions.postinstall.allowed,
    summary: permissionSummary({
      env: permissions.env.length,
      exec: permissions.exec.allowed,
      filesystem: permissions.filesystem.length,
      mcpTools: permissions.mcpTools.length,
      network: permissions.network.length,
      postinstall: permissions.postinstall.allowed,
      secrets: permissions.secrets.length
    })
  };
}

function countPermissionReport(permissions: PermissionCounts | undefined): TrustReport["permissions"] {
  const counts = {
    env: permissions?.env ?? 0,
    filesystem: permissions?.filesystem ?? 0,
    mcpTools: permissions?.mcpTools ?? 0,
    network: permissions?.network ?? 0,
    secrets: permissions?.secrets ?? 0
  };
  return {
    counts,
    exec: permissions?.exec ?? false,
    postinstall: permissions?.postinstall ?? false,
    summary: permissionSummary(permissions)
  };
}

function emptyPermissionReport(): TrustReport["permissions"] {
  return {
    counts: {
      env: 0,
      filesystem: 0,
      mcpTools: 0,
      network: 0,
      secrets: 0
    },
    exec: false,
    postinstall: false,
    summary: "permissions unknown"
  };
}

function permissionSummary(permissions: PermissionCounts | undefined): string {
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

function packageOwner(canonical: string): string {
  return canonical.slice("pkg:".length, canonical.indexOf("/"));
}

function parseInspectSpecifier(specifier: string): InspectSpecifier {
  const result = z
    .string()
    .regex(/^(pkg:did:key:z[A-Za-z0-9]+\/[a-z0-9][a-z0-9._-]*)@((0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*))$/)
    .safeParse(specifier);
  if (!result.success) {
    throw new Error("package spec must be pkg:did:key:<owner>/<name>@<version>");
  }
  const separator = specifier.lastIndexOf("@");
  return {
    canonical: specifier.slice(0, separator),
    version: specifier.slice(separator + 1)
  };
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
