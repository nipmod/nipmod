#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

type ArchiveDriftReviewStatus = "changed" | "failed" | "fresh";
type ArchiveDriftSeverity = "high" | "low" | "medium";

interface ArchiveDriftReviewRecord {
  baselineDigestPrefix?: string;
  changeSummary?: {
    high: number;
    highestSeverity: ArchiveDriftSeverity | null;
    low: number;
    medium: number;
    paths: string[];
  };
  currentDigestPrefix?: string;
  error?: {
    code?: string;
    retryable?: boolean;
    status?: number;
  };
  id: string;
  name: string;
  source: string;
  status: ArchiveDriftReviewStatus;
  trustChange?: {
    currentDecision: string;
    currentScore: number;
    previousDecision: string;
    previousScore: number;
    severity: ArchiveDriftSeverity;
  } | null;
  trustDecision?: string;
  trustScore?: number;
  validationOk?: boolean;
}

interface ArchiveDriftReviewSummaryInput {
  baseUrl: string;
  checkedAt: string;
  ok: boolean;
  readOnly: boolean;
  results: ArchiveDriftReviewRecord[];
  summary: {
    changed: number;
    failed: number;
    fresh: number;
    reviewed: number;
    skipped: number;
    totalFetched: number;
  };
  type: string;
}

export function renderArchiveDriftReviewSummary(input: ArchiveDriftReviewSummaryInput): string {
  const needsReview = input.results.filter((result) => result.status !== "fresh" || result.trustChange || result.validationOk === false);
  const lines = [
    "## Archive drift review",
    "",
    `- Result: ${input.ok ? "ok" : "attention required"}`,
    `- Base URL: ${input.baseUrl}`,
    `- Checked at: ${input.checkedAt}`,
    `- Read-only: ${input.readOnly ? "yes" : "no"}`,
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| Reviewed | ${input.summary.reviewed} |`,
    `| Fresh | ${input.summary.fresh} |`,
    `| Changed | ${input.summary.changed} |`,
    `| Failed | ${input.summary.failed} |`,
    `| Skipped | ${input.summary.skipped} |`,
    `| Fetched | ${input.summary.totalFetched} |`
  ];

  if (needsReview.length === 0) {
    lines.push("", "No changed or failed archive records were found.");
    return lines.join("\n");
  }

  lines.push(
    "",
    "### Records to review",
    "",
    "| Source | Name | Status | Severity | Trust | Changes | Digest | Error |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |"
  );

  for (const result of needsReview.slice(0, 25)) {
    const trust =
      typeof result.trustScore === "number" && result.trustDecision
        ? `${result.trustDecision} ${result.trustScore}`
        : "";
    const digest =
      result.baselineDigestPrefix && result.currentDigestPrefix
        ? `${result.baselineDigestPrefix} -> ${result.currentDigestPrefix}`
        : "";
    const error = result.error
      ? [result.error.code, result.error.status ? String(result.error.status) : null].filter(Boolean).join(" ")
      : "";
    lines.push(
      `| ${escapeTableCell(result.source)} | ${escapeTableCell(result.name)} | ${result.status} | ${escapeTableCell(
        displaySeverity(result)
      )} | ${escapeTableCell(trust)} | ${escapeTableCell(displayChanges(result))} | ${escapeTableCell(digest)} | ${escapeTableCell(error)} |`
    );
  }

  if (needsReview.length > 25) {
    lines.push("", `${needsReview.length - 25} additional changed or failed records are present in the JSON artifact.`);
  }

  return lines.join("\n");
}

export function parseArchiveDriftReviewPayload(raw: string): ArchiveDriftReviewSummaryInput {
  try {
    return JSON.parse(raw) as ArchiveDriftReviewSummaryInput;
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("archive drift review payload did not include JSON");
    }
    return JSON.parse(raw.slice(start, end + 1)) as ArchiveDriftReviewSummaryInput;
  }
}

function escapeTableCell(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function displaySeverity(result: ArchiveDriftReviewRecord): string {
  let severity = result.changeSummary?.highestSeverity ?? null;
  if (result.trustChange) {
    severity = higherSeverity(severity, result.trustChange.severity);
  }
  if (result.validationOk === false) {
    severity = "high";
  }
  return severity ?? "";
}

function displayChanges(result: ArchiveDriftReviewRecord): string {
  const paths = [...(result.changeSummary?.paths ?? [])];
  if (result.trustChange) {
    paths.push(
      `trust ${result.trustChange.previousDecision} ${result.trustChange.previousScore} -> ${result.trustChange.currentDecision} ${result.trustChange.currentScore}`
    );
  }
  if (result.validationOk === false) {
    paths.push("validation");
  }
  if (paths.length === 0) {
    return "";
  }
  const visible = paths.slice(0, 5).join(", ");
  return paths.length > 5 ? `${visible}, +${paths.length - 5} more` : visible;
}

function higherSeverity(previous: ArchiveDriftSeverity | null, current: ArchiveDriftSeverity): ArchiveDriftSeverity {
  const rank: Record<ArchiveDriftSeverity, number> = { high: 3, medium: 2, low: 1 };
  return !previous || rank[current] > rank[previous] ? current : previous;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = process.argv[2];
  if (!path) {
    throw new Error("usage: archive-drift-review-summary <archive-drift-review.json>");
  }
  const payload = parseArchiveDriftReviewPayload(await readFile(path, "utf8"));
  process.stdout.write(`${renderArchiveDriftReviewSummary(payload)}\n`);
}
