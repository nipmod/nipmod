#!/usr/bin/env node
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  ExternalPackageError,
  inspectExternalPackage,
  type ExternalPackageRecord,
  type ExternalPackageSource
} from "../site/lib/external-packages.ts";
import {
  createPackageIntelligenceRecord,
  ensurePackageIntelligenceEvidence,
  mergePackageIntelligenceRecords,
  packageIntelligenceSourceDriftMaterial,
  validatePackageIntelligenceRecord,
  type PackageIntelligenceRecord
} from "../site/lib/package-intelligence.ts";
import { canaryAuthHeaders, readCanaryApiKey } from "./canary-auth.ts";

const DEFAULT_BASE_URL = "https://nipmod.com";
const DEFAULT_LIMIT = 50;

type ArchiveDriftChangeSeverity = "high" | "low" | "medium";
type ArchiveDriftChangeCategory = "freshness" | "identity" | "install" | "metadata";

interface ArchiveDriftField {
  category: ArchiveDriftChangeCategory;
  path: string;
  severity: ArchiveDriftChangeSeverity;
}

interface ArchiveDriftChange {
  category: ArchiveDriftChangeCategory;
  current: string | null;
  path: string;
  previous: string | null;
  severity: ArchiveDriftChangeSeverity;
}

interface ArchiveDriftChangeSummary {
  high: number;
  highestSeverity: ArchiveDriftChangeSeverity | null;
  low: number;
  medium: number;
  paths: string[];
}

interface ArchiveDriftTrustChange {
  currentDecision: ExternalPackageRecord["trust"]["decision"];
  currentScore: number;
  previousDecision: ExternalPackageRecord["trust"]["decision"];
  previousScore: number;
  severity: ArchiveDriftChangeSeverity;
}

export interface ArchiveDriftReviewOptions {
  apiKey?: string;
  baseUrl?: string;
  failOnChanged?: boolean;
  failOnFailed?: boolean;
  fetchFn?: typeof fetch;
  inspectFn?: (source: ExternalPackageSource, name: string) => Promise<ExternalPackageRecord>;
  limit?: number;
  name?: string;
  source?: ExternalPackageSource;
}

export async function runArchiveDriftReview(options: ArchiveDriftReviewOptions = {}) {
  const startedAt = Date.now();
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const fetchFn = options.fetchFn ?? fetch;
  const apiKey =
    options.apiKey ??
    (await readCanaryApiKey({
      baseUrl,
      fetchFn,
      label: "archive-drift-review",
      userAgent: "nipmod-archive-drift-review/1.0 (+https://nipmod.com)"
    }));
  const archiveRecords = await fetchArchiveRecords(baseUrl, normalizeLimit(options.limit), apiKey, fetchFn);
  const records = archiveRecords
    .map(ensurePackageIntelligenceEvidence)
    .filter((record) => (options.source ? record.source === options.source : true))
    .filter((record) => (options.name ? record.name === options.name : true));
  const inspectFn =
    options.inspectFn ??
    ((source: ExternalPackageSource, name: string) => inspectExternalPackage(source, name, { fetchImpl: fetchFn, timeoutMs: 15_000 }));
  const results = [];

  for (const record of records) {
    results.push(await reviewRecord(record, inspectFn));
  }

  const changed = results.filter((result) => result.status === "changed").length;
  const failed = results.filter((result) => result.status === "failed").length;
  const summary = {
    changed,
    failed,
    fresh: results.filter((result) => result.status === "fresh").length,
    reviewed: results.length,
    skipped: archiveRecords.length - records.length,
    totalFetched: archiveRecords.length
  };

  return {
    baseUrl,
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    formatVersion: 1,
    ok: (!options.failOnFailed || failed === 0) && (!options.failOnChanged || changed === 0),
    readOnly: true,
    results,
    summary,
    type: "dev.nipmod.archive-drift-review.v1"
  };
}

async function reviewRecord(
  record: PackageIntelligenceRecord,
  inspectFn: (source: ExternalPackageSource, name: string) => Promise<ExternalPackageRecord>
) {
  try {
    const currentExternalRecord = await inspectFn(record.source, record.name);
    const currentRecord = createPackageIntelligenceRecord(currentExternalRecord);
    const reviewed = mergePackageIntelligenceRecords(record, currentRecord);
    const drift = reviewed.evidence.sourceDrift;
    const validation = validatePackageIntelligenceRecord(reviewed);
    const changes = drift.changed ? sourceDriftChanges(record.sourceRecord, currentExternalRecord) : [];
    const trustChange = describeTrustChange(record, reviewed, validation.ok);
    return {
      baselineDigestPrefix: drift.baselineSourceRecordDigest.slice(0, 12),
      changed: drift.changed,
      changeSummary: summarizeChanges(changes),
      changes,
      currentDigestPrefix: drift.currentSourceRecordDigest.slice(0, 12),
      id: record.id,
      name: record.name,
      source: record.source,
      status: drift.status,
      trustChange,
      trustDecision: reviewed.trust.decision,
      trustScore: reviewed.trust.score,
      validationOk: validation.ok,
      warnings: validation.warnings
    };
  } catch (error) {
    return {
      error: sanitizeError(error),
      id: record.id,
      name: record.name,
      source: record.source,
      status: "failed" as const
    };
  }
}

const DRIFT_FIELDS: ArchiveDriftField[] = [
  { category: "identity", path: "id", severity: "high" },
  { category: "identity", path: "source", severity: "high" },
  { category: "identity", path: "sourceKind", severity: "high" },
  { category: "identity", path: "name", severity: "high" },
  { category: "identity", path: "originalUrl", severity: "high" },
  { category: "identity", path: "registryUrl", severity: "high" },
  { category: "identity", path: "repo", severity: "high" },
  { category: "install", path: "install.manager", severity: "high" },
  { category: "install", path: "install.command", severity: "high" },
  { category: "install", path: "install.commands", severity: "high" },
  { category: "metadata", path: "owner", severity: "medium" },
  { category: "metadata", path: "license", severity: "medium" },
  { category: "metadata", path: "version", severity: "medium" },
  { category: "metadata", path: "displayName", severity: "low" },
  { category: "freshness", path: "updatedAt", severity: "low" }
];

function sourceDriftChanges(previousRecord: ExternalPackageRecord, currentRecord: ExternalPackageRecord): ArchiveDriftChange[] {
  const previous = packageIntelligenceSourceDriftMaterial(previousRecord);
  const current = packageIntelligenceSourceDriftMaterial(currentRecord);
  return DRIFT_FIELDS.flatMap((field) => {
    const previousValue = materialValue(previous, field.path);
    const currentValue = materialValue(current, field.path);
    if (JSON.stringify(previousValue ?? null) === JSON.stringify(currentValue ?? null)) {
      return [];
    }
    return [
      {
        category: field.category,
        current: formatChangeValue(currentValue),
        path: field.path,
        previous: formatChangeValue(previousValue),
        severity: field.severity
      }
    ];
  });
}

function summarizeChanges(changes: ArchiveDriftChange[]): ArchiveDriftChangeSummary {
  const summary: ArchiveDriftChangeSummary = {
    high: 0,
    highestSeverity: null,
    low: 0,
    medium: 0,
    paths: changes.map((change) => change.path)
  };
  for (const change of changes) {
    summary[change.severity] += 1;
    summary.highestSeverity = higherSeverity(summary.highestSeverity, change.severity);
  }
  return summary;
}

function describeTrustChange(
  previous: PackageIntelligenceRecord,
  current: PackageIntelligenceRecord,
  validationOk: boolean
): ArchiveDriftTrustChange | null {
  const previousDecision = previous.trust.decision;
  const currentDecision = current.trust.decision;
  const previousScore = previous.trust.score;
  const currentScore = current.trust.score;
  if (previousDecision === currentDecision && previousScore === currentScore) {
    return null;
  }
  const scoreDrop = previousScore - currentScore;
  const severity: ArchiveDriftChangeSeverity =
    !validationOk || currentDecision === "avoid" || current.trust.risk === "high" || scoreDrop >= 30
      ? "high"
      : currentDecision !== previousDecision || scoreDrop >= 15
        ? "medium"
        : "low";
  return {
    currentDecision,
    currentScore,
    previousDecision,
    previousScore,
    severity
  };
}

function higherSeverity(
  previous: ArchiveDriftChangeSeverity | null,
  current: ArchiveDriftChangeSeverity
): ArchiveDriftChangeSeverity {
  const rank: Record<ArchiveDriftChangeSeverity, number> = { high: 3, medium: 2, low: 1 };
  return !previous || rank[current] > rank[previous] ? current : previous;
}

function materialValue(value: unknown, path: string): unknown {
  let cursor = value;
  for (const segment of path.split(".")) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

function formatChangeValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const serialized = JSON.stringify(value);
  const raw = Array.isArray(value)
    ? value.join(" | ")
    : typeof value === "string" || typeof value === "number" || typeof value === "boolean"
      ? String(value)
      : JSON.stringify(value);
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (normalized.length <= 160 && !Array.isArray(value)) {
    return normalized;
  }
  const preview = normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
  return `${preview} [sha256:${createHash("sha256").update(serialized).digest("hex").slice(0, 12)}]`;
}

async function fetchArchiveRecords(baseUrl: string, limit: number, apiKey: string, fetchFn: typeof fetch): Promise<PackageIntelligenceRecord[]> {
  const url = new URL("/api/archive/search", baseUrl);
  url.searchParams.set("q", "");
  url.searchParams.set("limit", String(limit));
  const response = await fetchFn(url, {
    headers: {
      accept: "application/json",
      ...canaryAuthHeaders(apiKey),
      "user-agent": "nipmod-archive-drift-review/1.0 (+https://nipmod.com)"
    },
    method: "GET"
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`archive search failed with ${response.status}: ${JSON.stringify(sanitizeArchiveError(payload))}`);
  }
  if (!Array.isArray(payload.records)) {
    throw new Error("archive search response did not include records");
  }
  return payload.records.filter(isPackageIntelligenceRecord).slice(0, limit);
}

function isPackageIntelligenceRecord(value: unknown): value is PackageIntelligenceRecord {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as { type?: unknown }).type === "dev.nipmod.package-intelligence-record.v1"
  );
}

function sanitizeArchiveError(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "unknown archive error" };
  }
  const error = value as Record<string, unknown>;
  return {
    code: typeof error.code === "string" ? error.code : undefined,
    retryable: typeof error.retryable === "boolean" ? error.retryable : undefined,
    status: typeof error.status === "number" ? error.status : undefined,
    type: typeof error.type === "string" ? error.type : undefined
  };
}

function sanitizeError(error: unknown): Record<string, unknown> {
  if (error instanceof ExternalPackageError) {
    return {
      code: error.code,
      retryable: error.retryable,
      status: error.status
    };
  }
  return {
    code: "archive_drift_review_error",
    message: "archive drift review failed",
    retryable: false,
    status: 500
  };
}

function normalizeLimit(limit: number | undefined): number {
  if (!Number.isInteger(limit)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(100, Math.max(1, limit));
}

function readOption(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const options: ArchiveDriftReviewOptions = {
    baseUrl: readOption("--base-url") ?? process.env.NIPMOD_API_BASE_URL ?? DEFAULT_BASE_URL,
    failOnChanged: process.argv.includes("--fail-on-changed"),
    failOnFailed: process.argv.includes("--fail-on-failed"),
    limit: Number(readOption("--limit") ?? DEFAULT_LIMIT)
  };
  const name = readOption("--name");
  if (name) {
    options.name = name;
  }
  const source = readOption("--source");
  if (source) {
    options.source = source as ExternalPackageSource;
  }
  const result = await runArchiveDriftReview(options);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}
