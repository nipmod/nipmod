#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { canaryAuthHeaders, readCanaryApiKey } from "./canary-auth.ts";

const DEFAULT_BASE_URL = "https://nipmod.com";
const DEFAULT_TARGETS = [
  { name: "react", requiredSource: "npm", source: "npm" },
  { name: "requests", requiredSource: "pypi", source: "pypi" },
  { name: "vercel/next.js", requiredSource: "github", source: "github" },
  { name: "google-bert/bert-base-uncased", requiredSource: "huggingface-model", source: "huggingface-model" },
  { name: "rajpurkar/squad", requiredSource: "huggingface-dataset", source: "huggingface-dataset" },
  { name: "ac.tandem/docs-mcp", requiredSource: "mcp", source: "mcp" }
];
const SHA256 = /^[a-f0-9]{64}$/;

export async function runArchiveDepthCanary({
  baseUrl = DEFAULT_BASE_URL,
  fetchFn = fetch,
  requireDurable = false,
  targets = DEFAULT_TARGETS
} = {}) {
  const startedAt = Date.now();
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const apiKey = await readCanaryApiKey({
    baseUrl: normalizedBaseUrl,
    fetchFn,
    label: "archive-depth",
    userAgent: "nipmod-archive-depth-canary/1.2.9 (+https://nipmod.com)"
  });
  const checks = [];

  await runCheck(checks, "archive_status", async () => {
    const status = await fetchJson(`${normalizedBaseUrl}/api/archive/status`, fetchFn, apiKey);
    assertEqual(status.type, "dev.nipmod.archive-status.v1", "archive status type mismatch");
    assertIncludes(status.writeBoundary, "authorized server writer", "archive write boundary missing");
    if (requireDurable && status.mode !== "durable-archive-enabled") {
      throw new Error(`durable archive required, got ${status.mode ?? "unknown"}`);
    }
    return {
      configured: Boolean(status.configured),
      mode: status.mode,
      rateLimitStore: status.rateLimits?.driver ?? null,
      usageStore: status.usage?.driver ?? null
    };
  });

  for (const target of targets) {
    await runCheck(checks, `${target.source}:${target.name}`, async () => {
      const payload = await postJson(`${normalizedBaseUrl}/api/archive/confirm`, {
        actor: "nipmod-archive-depth-canary",
        dryRun: true,
        message: "Dry-run archive confirmation used to verify source reinspection, trust gates and install-plan boundaries.",
        name: target.name,
        source: target.source
      }, fetchFn, apiKey);
      return assertArchiveConfirmPayload(payload, target);
    });
  }

  const summary = {
    fail: checks.filter((check) => check.status === "fail").length,
    pass: checks.filter((check) => check.status === "pass").length,
    total: checks.length
  };
  return {
    baseUrl: normalizedBaseUrl,
    checkedAt: new Date().toISOString(),
    checks,
    durationMs: Date.now() - startedAt,
    formatVersion: 1,
    ok: summary.fail === 0,
    summary,
    type: "dev.nipmod.archive-depth-canary.v1"
  };
}

function assertArchiveConfirmPayload(payload, target) {
  assertEqual(payload.type, "dev.nipmod.archive-confirm.v1", "archive confirm response type mismatch");
  assertEqual(payload.dryRun, true, "archive confirm must be dry-run");
  assertEqual(payload.stored, false, "dry-run archive confirm must not store");
  assertEqual(payload.validation?.ok, true, "archive validation must pass");
  assertEqual(payload.eligibility?.ok, true, "archive eligibility must pass");

  const record = payload.record;
  if (record?.type !== "dev.nipmod.package-intelligence-record.v1") {
    throw new Error("package intelligence record missing");
  }
  assertEqual(record.source, target.requiredSource, "archive record source mismatch");
  assertEqual(record.archive?.status, "agent_confirmed", "dry-run archive record must be agent_confirmed");
  if (!Number.isFinite(record.archive?.confirmationCount) || record.archive.confirmationCount < 1) {
    throw new Error("archive confirmation count missing");
  }
  assertEqual(record.ownership?.retainedByOriginalSource, true, "external ownership boundary missing");
  assertEqual(record.ownership?.claimRequiredForVerified, true, "verified claim boundary missing");

  for (const digestName of ["installPlanDigest", "sourceRecordDigest", "sourceSnapshotDigest", "trustDigest"]) {
    if (!SHA256.test(record.evidence?.[digestName] ?? "")) {
      throw new Error(`archive evidence digest missing: ${digestName}`);
    }
  }
  assertEqual(record.evidence?.archivePolicy, "agent-confirmed-source-owned-v1", "archive policy mismatch");
  assertEqual(record.evidence?.generatedFrom, "server-reinspected-source", "source reinspection marker missing");

  if (record.trust?.decision === "avoid" || record.trust?.decision === "unknown") {
    throw new Error(`archive trust decision is not confirmable: ${record.trust?.decision}`);
  }
  if (!Number.isFinite(record.trust?.score) || record.trust.score < record.trust.policy?.thresholds?.usableWithWarning) {
    throw new Error("archive trust score is below confirmation threshold");
  }

  const categories = new Set((record.trust?.factors ?? []).map((factor) => factor?.category).filter(Boolean));
  for (const category of ["source", "metadata", "install"]) {
    if (!categories.has(category)) {
      throw new Error(`archive trust factor category missing: ${category}`);
    }
  }

  const commandDetails = record.installPlan?.plan?.commandDetails;
  if (!Array.isArray(commandDetails) || commandDetails.length === 0) {
    throw new Error("install-plan command details missing");
  }
  for (const command of commandDetails) {
    assertEqual(command.hostedApiExecutes, false, "hosted API must not execute install commands");
    assertEqual(command.requiresApprovalBeforeWrite, true, "install command approval boundary mismatch");
  }
  assertEqual(record.installPlan?.safety?.requiresApprovalBeforeWrite, true, "install-plan approval boundary missing");
  assertEqual(record.installPlan?.safety?.metadataIsInstruction, false, "metadata instruction boundary missing");

  const receipt = payload.receipt;
  if (receipt?.type !== "dev.nipmod.package-intelligence-receipt.v1") {
    throw new Error("archive receipt missing");
  }
  assertEqual(receipt.dryRun, true, "archive receipt must be dry-run");
  assertEqual(receipt.stored, false, "archive dry-run receipt must not be stored");
  if (!SHA256.test(receipt.evidenceDigest ?? "")) {
    throw new Error("archive receipt evidence digest missing");
  }

  return {
    decision: record.trust.decision,
    factorCategories: [...categories].sort(),
    id: record.id,
    score: record.trust.score,
    source: record.source
  };
}

async function fetchJson(url, fetchFn, apiKey) {
  const response = await timedFetch(url, { headers: defaultHeaders(apiKey), method: "GET" }, fetchFn);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function postJson(url, body, fetchFn, apiKey) {
  const response = await timedFetch(
    url,
    {
      body: JSON.stringify(body),
      headers: {
        ...defaultHeaders(apiKey),
        "content-type": "application/json"
      },
      method: "POST"
    },
    fetchFn
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function timedFetch(url, init, fetchFn) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetchFn(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function defaultHeaders(apiKey) {
  return {
    accept: "application/json",
    ...canaryAuthHeaders(apiKey),
    "user-agent": "nipmod-archive-depth-canary/1.2.9 (+https://nipmod.com)"
  };
}

async function runCheck(checks, name, fn) {
  const startedAt = Date.now();
  try {
    checks.push({
      data: await fn(),
      durationMs: Date.now() - startedAt,
      name,
      status: "pass"
    });
  } catch (error) {
    checks.push({
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      name,
      status: "fail"
    });
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(value, expected, message) {
  if (typeof value !== "string" || !value.includes(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(value)} to include ${JSON.stringify(expected)}`);
  }
}

function readOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await runArchiveDepthCanary({
    baseUrl: readOption("--base-url") ?? DEFAULT_BASE_URL,
    requireDurable: process.argv.includes("--require-durable")
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}
