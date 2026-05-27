#!/usr/bin/env node
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
  validatePackageIntelligenceRecord,
  type PackageIntelligenceRecord
} from "../site/lib/package-intelligence.ts";
import { canaryAuthHeaders, readCanaryApiKey } from "./canary-auth.ts";

const DEFAULT_BASE_URL = "https://nipmod.com";
const DEFAULT_LIMIT = 50;

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
    return {
      baselineDigestPrefix: drift.baselineSourceRecordDigest.slice(0, 12),
      changed: drift.changed,
      currentDigestPrefix: drift.currentSourceRecordDigest.slice(0, 12),
      id: record.id,
      name: record.name,
      source: record.source,
      status: drift.status,
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
