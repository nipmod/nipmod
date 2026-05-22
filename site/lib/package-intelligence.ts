import { createHash } from "node:crypto";
import { createExternalInstallPlan, type ExternalInstallPlan, type ExternalPackageRecord } from "./external-packages";

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
    installCommandRisk: "low" | "medium" | "high";
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
    warnings.push("install command risk is high");
  }
  if (record.trust.risk === "high" || record.trust.decision === "avoid") {
    warnings.push("trust result indicates avoid or high risk");
  }

  return {
    errors,
    ok: errors.length === 0,
    warnings
  };
}

export function createStableKey(record: ExternalPackageRecord): string {
  return [record.source, record.name.toLowerCase(), record.version ?? "latest", record.originalUrl].join(":");
}

function sanitizeExternalRecord(record: ExternalPackageRecord): ExternalPackageRecord {
  return {
    ...record,
    description: cleanText(record.description, 800),
    displayName: cleanText(record.displayName, 220),
    install: {
      ...record.install,
      notes: record.install.notes.map((note) => cleanText(note, 300)).filter(Boolean)
    },
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
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function installCommandRisk(commands: string[]): "low" | "medium" | "high" {
  const normalizedCommands = commands.map(normalizeCommandForRisk);
  if (normalizedCommands.some(hasPipedShellDownload)) {
    return "high";
  }
  if (normalizedCommands.some(hasPrivilegedOrDestructiveCommand)) {
    return "high";
  }
  if (normalizedCommands.some(hasCompoundShellSyntax)) {
    return "medium";
  }
  return "low";
}

function normalizeCommandForRisk(command: string): string {
  return cleanText(command, 1000).toLowerCase();
}

function hasPipedShellDownload(command: string): boolean {
  const pipeIndex = command.indexOf("|");
  if (pipeIndex === -1) {
    return false;
  }
  const beforePipe = command.slice(0, pipeIndex);
  const afterPipe = command.slice(pipeIndex + 1);
  return containsAnyToken(beforePipe, ["curl", "wget"]) && containsAnyToken(afterPipe, ["bash", "sh"]);
}

function hasPrivilegedOrDestructiveCommand(command: string): boolean {
  return containsAnyToken(command, ["sudo", "chmod", "chown"]) || containsRecursiveForcedRemove(command);
}

function hasCompoundShellSyntax(command: string): boolean {
  return command.includes("&&") || command.includes("||") || command.includes(";") || command.includes("`") || command.includes("$(");
}

function containsRecursiveForcedRemove(command: string): boolean {
  const tokens = commandTokens(command);
  const removeIndex = tokens.indexOf("rm");
  if (removeIndex === -1) {
    return false;
  }
  const flags = new Set(tokens.slice(removeIndex + 1).filter((token) => token.startsWith("-")));
  return flags.has("-rf") || flags.has("-fr") || (flags.has("-r") && flags.has("-f"));
}

function containsAnyToken(value: string, tokens: string[]): boolean {
  const found = new Set(commandTokens(value));
  return tokens.some((token) => found.has(token));
}

function commandTokens(value: string): string[] {
  const tokens: string[] = [];
  let current = "";
  for (const char of value) {
    if (isCommandTokenChar(char)) {
      current += char;
      continue;
    }
    if (current) {
      tokens.push(current);
      current = "";
    }
  }
  if (current) {
    tokens.push(current);
  }
  return tokens;
}

function isCommandTokenChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 97 && code <= 122) ||
    char === "-" ||
    char === "_" ||
    char === "."
  );
}

function commandWarnings(commands: string[]): string[] {
  const risk = installCommandRisk(commands);
  if (risk === "high") {
    return ["Install command contains shell patterns that require manual review before execution."];
  }
  if (risk === "medium") {
    return ["Install command contains compound shell syntax. Review the command before execution."];
  }
  return [];
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
