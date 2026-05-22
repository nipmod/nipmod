import { createHash } from "node:crypto";
import { createExternalInstallPlan, type ExternalInstallPlan, type ExternalPackageRecord } from "./external-packages";
import { cleanPlainText, commandWarnings, installCommandRisk, type InstallCommandRisk } from "./package-command-safety";

export const PACKAGE_INTELLIGENCE_STATUSES = [
  "external_indexed",
  "agent_confirmed",
  "claimed",
  "verified_nipmod",
  "quarantined",
  "yanked"
] as const;

export type PackageIntelligenceStatus = (typeof PACKAGE_INTELLIGENCE_STATUSES)[number];

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
  errors: string[];
  ok: boolean;
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
      warnings: [...sourceRecord.trust.warnings, ...securityWarnings]
    },
    source: sourceRecord.source,
    sourceKind: sourceRecord.sourceKind,
    sourceRecord,
    sourceSnapshot: {
      license: sourceRecord.license,
      metrics: sourceRecord.metrics,
      originalUrl: sourceRecord.originalUrl,
      owner: sourceRecord.owner,
      registryUrl: sourceRecord.registryUrl,
      repo: sourceRecord.repo,
      updatedAt: sourceRecord.updatedAt,
      version: sourceRecord.version
    },
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
  if (record.archive.status === "verified_nipmod" && record.ownership.claimRequiredForVerified) {
    errors.push("verified_nipmod requires an owner claim workflow before persistence");
  }
  if (record.security.installCommandRisk === "high") {
    errors.push("high risk install commands cannot be stored as confirmed archive records");
  } else if (record.security.installCommandRisk === "medium") {
    warnings.push("install command risk is medium");
  }
  if (record.trust.risk === "high" || record.trust.decision === "avoid") {
    errors.push("avoid or high risk trust results cannot be stored as confirmed archive records");
  }

  return {
    errors,
    ok: errors.length === 0,
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
    stableKeyDigest: sha256(record.stableKey),
    stored: options.stored,
    trustDecision: record.trust.decision,
    trustScore: record.trust.score,
    type: "dev.nipmod.package-intelligence-receipt.v1"
  };
}

export function createStableKey(record: ExternalPackageRecord): string {
  return [record.source, record.name.toLowerCase(), record.version ?? "latest", record.originalUrl].join(":");
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

function cleanText(value: string, maxLength: number): string {
  return cleanPlainText(value, maxLength);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
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
