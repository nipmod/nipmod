import { createHash } from "node:crypto";
import { createExternalInstallPlan, type ExternalInstallPlan, type ExternalPackageRecord } from "./external-packages";
import {
  cleanPlainText,
  commandWarnings,
  installCommandRisk,
  metadataInstructionWarnings,
  type InstallCommandRisk
} from "./package-command-safety";

export const PACKAGE_INTELLIGENCE_STATUSES = [
  "external_indexed",
  "agent_confirmed",
  "claimed",
  "verified_nipmod",
  "quarantined",
  "yanked"
] as const;

export type PackageIntelligenceStatus = (typeof PACKAGE_INTELLIGENCE_STATUSES)[number];

export const PACKAGE_INTELLIGENCE_LIFECYCLE_STATES = [
  "indexed",
  "confirmed_use",
  "verified",
  "quarantined",
  "blocked"
] as const;

export type PackageIntelligenceLifecycleState = (typeof PACKAGE_INTELLIGENCE_LIFECYCLE_STATES)[number];

export interface PackageIntelligenceEvent {
  actor: string;
  at: string;
  message: string;
  type:
    | "external_resolved"
    | "agent_confirmed"
    | "owner_claimed"
    | "verified"
    | "quarantined"
    | "yanked"
    | "restored";
}

export interface PackageIntelligenceRecord {
  archive: {
    confirmationCount: number;
    firstSeenAt: string;
    firstSeenReason: string;
    persistence: "database";
    status: PackageIntelligenceStatus;
    updatedAt: string;
  };
  evidence: {
    archivePolicy: "agent-confirmed-source-owned-v1";
    generatedFrom: "server-reinspected-source";
    installPlanDigest: string;
    sourceRecordDigest: string;
    sourceSnapshotDigest: string;
    trustDigest: string;
  };
  events: PackageIntelligenceEvent[];
  formatVersion: 1;
  id: string;
  installPlan: ExternalInstallPlan;
  name: string;
  ownership: {
    claimRequiredForVerified: true;
    originalOwner: string | null;
    originalUrl: string;
    retainedByOriginalSource: true;
  };
  security: {
    installCommandRisk: InstallCommandRisk;
    metadataIsInstruction: false;
    requiresHumanOrAgentApprovalBeforeWrite: true;
    warnings: string[];
  };
  source: ExternalPackageRecord["source"];
  sourceKind: ExternalPackageRecord["sourceKind"];
  sourceRecord: ExternalPackageRecord;
  sourceSnapshot: {
    license: string | null;
    metrics: ExternalPackageRecord["metrics"];
    originalUrl: string;
    owner: string | null;
    registryUrl: string;
    repo: string | null;
    updatedAt: string | null;
    version: string | null;
  };
  stableKey: string;
  trust: ExternalPackageRecord["trust"];
  type: "dev.nipmod.package-intelligence-record.v1";
  version: string | null;
}

export interface CreatePackageIntelligenceOptions {
  firstSeenReason?: string;
  now?: string;
}

export interface ConfirmPackageIntelligenceOptions {
  actor: string;
  message?: string;
  now?: string;
}

export interface PackageIntelligenceValidation {
  eligibility: PackageIntelligenceArchiveEligibility;
  errors: string[];
  ok: boolean;
  warnings: string[];
}

export interface PackageIntelligenceArchiveEligibility {
  errors: string[];
  minimumTrustScore: number;
  ok: boolean;
  type: "dev.nipmod.package-intelligence-eligibility.v1";
  warnings: string[];
}

export interface PackageIntelligenceReceipt {
  archiveStatus: PackageIntelligenceStatus;
  confirmationCount: number;
  dryRun: boolean;
  generatedAt: string;
  name: string;
  receiptId: string;
  recordId: string;
  source: ExternalPackageRecord["source"];
  evidenceDigest: string;
  stableKeyDigest: string;
  stored: boolean;
  trustDecision: ExternalPackageRecord["trust"]["decision"];
  trustScore: number;
  type: "dev.nipmod.package-intelligence-receipt.v1";
}

export function createPackageIntelligenceRecord(
  externalRecord: ExternalPackageRecord,
  options: CreatePackageIntelligenceOptions = {}
): PackageIntelligenceRecord {
  const now = options.now ?? new Date().toISOString();
  const sourceRecord = sanitizeExternalRecord(externalRecord);
  const stableKey = createStableKey(sourceRecord);
  const id = `pkgintel_${sha256(stableKey).slice(0, 24)}`;
  const installPlan = createExternalInstallPlan(sourceRecord);
  const securityWarnings = commandWarnings(installPlan.plan.commands);
  const metadataWarnings = packageMetadataInstructionWarnings(sourceRecord);
  const sourceSnapshot = {
    license: sourceRecord.license,
    metrics: sourceRecord.metrics,
    originalUrl: sourceRecord.originalUrl,
    owner: sourceRecord.owner,
    registryUrl: sourceRecord.registryUrl,
    repo: sourceRecord.repo,
    updatedAt: sourceRecord.updatedAt,
    version: sourceRecord.version
  };

  return {
    archive: {
      confirmationCount: 0,
      firstSeenAt: now,
      firstSeenReason: options.firstSeenReason ?? "Resolved through the Nipmod external package resolver.",
      persistence: "database",
      status: "external_indexed",
      updatedAt: now
    },
    events: [
      {
        actor: "nipmod-resolver",
        at: now,
        message: `Indexed ${sourceRecord.source}:${sourceRecord.name} from the original source.`,
        type: "external_resolved"
      }
    ],
    evidence: packageIntelligenceEvidence(sourceRecord, sourceSnapshot, installPlan, sourceRecord.trust),
    formatVersion: 1,
    id,
    installPlan,
    name: sourceRecord.name,
    ownership: {
      claimRequiredForVerified: true,
      originalOwner: sourceRecord.owner,
      originalUrl: sourceRecord.originalUrl,
      retainedByOriginalSource: true
    },
    security: {
      installCommandRisk: installCommandRisk(installPlan.plan.commands),
      metadataIsInstruction: false,
      requiresHumanOrAgentApprovalBeforeWrite: true,
      warnings: [...sourceRecord.trust.warnings, ...securityWarnings, ...metadataWarnings]
    },
    source: sourceRecord.source,
    sourceKind: sourceRecord.sourceKind,
    sourceRecord,
    sourceSnapshot,
    stableKey,
    trust: sourceRecord.trust,
    type: "dev.nipmod.package-intelligence-record.v1",
    version: sourceRecord.version
  };
}

export function confirmPackageIntelligenceRecord(
  record: PackageIntelligenceRecord,
  options: ConfirmPackageIntelligenceOptions
): PackageIntelligenceRecord {
  const now = options.now ?? new Date().toISOString();
  const actor = cleanText(options.actor, 120) || "unknown-agent";
  const message = cleanText(options.message ?? "Package usefulness confirmed by an agent workflow.", 400);

  return {
    ...record,
    archive: {
      ...record.archive,
      confirmationCount: record.archive.confirmationCount + 1,
      status: record.archive.status === "external_indexed" ? "agent_confirmed" : record.archive.status,
      updatedAt: now
    },
    events: [
      ...record.events,
      {
        actor,
        at: now,
        message,
        type: "agent_confirmed"
      }
    ]
  };
}

export function mergePackageIntelligenceRecords(
  existing: PackageIntelligenceRecord,
  incoming: PackageIntelligenceRecord
): PackageIntelligenceRecord {
  existing = ensurePackageIntelligenceEvidence(existing);
  incoming = ensurePackageIntelligenceEvidence(incoming);
  const incomingConfirmations = incoming.events.filter((event) => event.type === "agent_confirmed");
  const protectedStatuses: PackageIntelligenceStatus[] = ["claimed", "verified_nipmod", "quarantined", "yanked"];
  const status = protectedStatuses.includes(existing.archive.status)
    ? existing.archive.status
    : incoming.archive.status === "agent_confirmed"
      ? "agent_confirmed"
      : existing.archive.status;
  const mergedEvents = mergeEvents(existing.events, incomingConfirmations);

  return {
    ...incoming,
    archive: {
      ...incoming.archive,
      confirmationCount: existing.archive.confirmationCount + incomingConfirmations.length,
      firstSeenAt: existing.archive.firstSeenAt,
      firstSeenReason: existing.archive.firstSeenReason,
      status,
      updatedAt: incoming.archive.updatedAt
    },
    events: mergedEvents,
    ownership: protectedStatuses.includes(existing.archive.status) ? existing.ownership : incoming.ownership
  };
}

export function validatePackageIntelligenceRecord(record: PackageIntelligenceRecord): PackageIntelligenceValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const eligibility = archiveEligibility(record);

  if (record.type !== "dev.nipmod.package-intelligence-record.v1") {
    errors.push("record type is invalid");
  }
  if (!record.id.startsWith("pkgintel_")) {
    errors.push("record id is invalid");
  }
  if (!record.stableKey.startsWith(`${record.source}:`)) {
    errors.push("stable key does not match source");
  }
  if (!record.ownership.retainedByOriginalSource) {
    errors.push("external source ownership boundary is missing");
  }
  if (!validEvidenceDigests(record)) {
    errors.push("archive evidence digests are invalid");
  }
  if (record.archive.status === "verified_nipmod" && record.ownership.claimRequiredForVerified) {
    errors.push("verified_nipmod requires an owner claim workflow before persistence");
  }

  return {
    eligibility,
    errors: [...errors, ...eligibility.errors],
    ok: errors.length === 0 && eligibility.ok,
    warnings: [...warnings, ...eligibility.warnings]
  };
}

export function packageIntelligenceLifecycleState(record: PackageIntelligenceRecord): PackageIntelligenceLifecycleState {
  if (
    record.installPlan.safety.blocked ||
    record.security.installCommandRisk === "high" ||
    record.trust.decision === "avoid" ||
    record.trust.risk === "high" ||
    record.archive.status === "yanked"
  ) {
    return "blocked";
  }
  if (record.archive.status === "quarantined") {
    return "quarantined";
  }
  if (record.archive.status === "verified_nipmod") {
    return "verified";
  }
  if (record.archive.status === "agent_confirmed" || record.archive.confirmationCount > 0) {
    return "confirmed_use";
  }
  return "indexed";
}

export function archiveEligibility(record: PackageIntelligenceRecord): PackageIntelligenceArchiveEligibility {
  const errors: string[] = [];
  const warnings: string[] = [];
  const minimumTrustScore = record.trust.policy.thresholds.usableWithWarning;

  if (record.installPlan.safety.blocked) {
    errors.push("blocked install plans cannot be stored as confirmed archive records");
  }
  if (record.security.installCommandRisk === "high") {
    errors.push("high risk install commands cannot be stored as confirmed archive records");
  } else if (record.security.installCommandRisk === "medium") {
    warnings.push("install command risk is medium");
  }
  if (record.trust.risk === "high" || record.trust.decision === "avoid") {
    errors.push("avoid or high risk trust results cannot be stored as confirmed archive records");
  }
  if (record.trust.risk === "unknown" || record.trust.decision === "unknown" || record.trust.score < minimumTrustScore) {
    errors.push("unknown or below-threshold trust results cannot be stored as confirmed archive records");
  }
  if (record.security.warnings.some((warning) => warning.includes("agent-targeted instructions"))) {
    errors.push("agent-targeted package metadata cannot be stored as a confirmed archive record");
  }
  if (record.trust.dimensions?.securityConfidence === "low") {
    warnings.push("security confidence is low; agents should prefer stronger source evidence when alternatives exist");
  }

  return {
    minimumTrustScore,
    ok: errors.length === 0,
    type: "dev.nipmod.package-intelligence-eligibility.v1",
    errors,
    warnings
  };
}

export function createPackageIntelligenceReceipt(
  record: PackageIntelligenceRecord,
  options: { dryRun?: boolean; now?: string; stored: boolean }
): PackageIntelligenceReceipt {
  const generatedAt = options.now ?? new Date().toISOString();
  const receiptMaterial = [record.id, record.archive.updatedAt, record.archive.confirmationCount, record.archive.status, options.stored].join(":");
  return {
    archiveStatus: record.archive.status,
    confirmationCount: record.archive.confirmationCount,
    dryRun: Boolean(options.dryRun),
    generatedAt,
    name: record.name,
    receiptId: `receipt_${sha256(receiptMaterial).slice(0, 24)}`,
    recordId: record.id,
    source: record.source,
    evidenceDigest: sha256(stableJson(record.evidence)),
    stableKeyDigest: sha256(record.stableKey),
    stored: options.stored,
    trustDecision: record.trust.decision,
    trustScore: record.trust.score,
    type: "dev.nipmod.package-intelligence-receipt.v1"
  };
}

export function ensurePackageIntelligenceEvidence(record: PackageIntelligenceRecord): PackageIntelligenceRecord {
  const existing = (record as PackageIntelligenceRecord & { evidence?: PackageIntelligenceRecord["evidence"] }).evidence;
  if (existing && validEvidenceDigests({ ...record, evidence: existing })) {
    return { ...record, evidence: existing };
  }
  return {
    ...record,
    evidence: packageIntelligenceEvidence(record.sourceRecord, record.sourceSnapshot, record.installPlan, record.trust)
  };
}

export function createStableKey(record: ExternalPackageRecord): string {
  return [record.source, record.name.toLowerCase(), record.version ?? "latest", record.originalUrl].join(":");
}

function packageIntelligenceEvidence(
  sourceRecord: ExternalPackageRecord,
  sourceSnapshot: PackageIntelligenceRecord["sourceSnapshot"],
  installPlan: ExternalInstallPlan,
  trust: ExternalPackageRecord["trust"]
): PackageIntelligenceRecord["evidence"] {
  return {
    archivePolicy: "agent-confirmed-source-owned-v1",
    generatedFrom: "server-reinspected-source",
    installPlanDigest: sha256(stableJson(installPlan)),
    sourceRecordDigest: sha256(stableJson(sourceRecord)),
    sourceSnapshotDigest: sha256(stableJson(sourceSnapshot)),
    trustDigest: sha256(stableJson(trust))
  };
}

function validEvidenceDigests(record: PackageIntelligenceRecord): boolean {
  const expected = packageIntelligenceEvidence(record.sourceRecord, record.sourceSnapshot, record.installPlan, record.trust);
  return (
    record.evidence?.archivePolicy === "agent-confirmed-source-owned-v1" &&
    record.evidence.generatedFrom === "server-reinspected-source" &&
    record.evidence.installPlanDigest === expected.installPlanDigest &&
    record.evidence.sourceRecordDigest === expected.sourceRecordDigest &&
    record.evidence.sourceSnapshotDigest === expected.sourceSnapshotDigest &&
    record.evidence.trustDigest === expected.trustDigest &&
    isSha256(record.evidence.installPlanDigest) &&
    isSha256(record.evidence.sourceRecordDigest) &&
    isSha256(record.evidence.sourceSnapshotDigest) &&
    isSha256(record.evidence.trustDigest)
  );
}

function isSha256(value: unknown): boolean {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function sanitizeExternalRecord(record: ExternalPackageRecord): ExternalPackageRecord {
  const installBase = {
    ...record.install,
    command: cleanText(record.install.command, 1000),
    notes: record.install.notes.map((note) => cleanText(note, 300)).filter(Boolean)
  };
  return {
    ...record,
    description: cleanText(record.description, 800),
    displayName: cleanText(record.displayName, 220),
    install:
      record.install.commands === undefined
        ? installBase
        : { ...installBase, commands: record.install.commands.map((command) => cleanText(command, 1000)).filter(Boolean) },
    name: cleanText(record.name, 220),
    owner: record.owner ? cleanText(record.owner, 220) : null,
    trust: {
      ...record.trust,
      signals: record.trust.signals.map((signal) => cleanText(signal, 300)).filter(Boolean),
      warnings: record.trust.warnings.map((warning) => cleanText(warning, 300)).filter(Boolean)
    }
  };
}

function packageMetadataInstructionWarnings(record: ExternalPackageRecord): string[] {
  return metadataInstructionWarnings([
    { field: "description", value: record.description },
    { field: "displayName", value: record.displayName },
    { field: "install.notes", value: record.install.notes.join(" ") },
    { field: "trust.signals", value: record.trust.signals.join(" ") },
    { field: "trust.warnings", value: record.trust.warnings.join(" ") }
  ]);
}

function cleanText(value: string, maxLength: number): string {
  return cleanPlainText(value, maxLength);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableJson(entryValue)}`).join(",")}}`;
}

function mergeEvents(existing: PackageIntelligenceEvent[], incomingConfirmations: PackageIntelligenceEvent[]): PackageIntelligenceEvent[] {
  const seen = new Set(existing.map(eventKey));
  const newEvents = incomingConfirmations.filter((event) => {
    const key = eventKey(event);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  const firstEvent = existing[0];
  const timeline = [...existing.slice(1), ...newEvents].slice(-99);
  return firstEvent ? [firstEvent, ...timeline] : timeline;
}

function eventKey(event: PackageIntelligenceEvent): string {
  return `${event.type}:${event.actor}:${event.at}:${event.message}`;
}
