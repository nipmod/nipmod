#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { runSyntheticMonitor } from "./prod-synthetic-monitor.ts";
import { runRestoreDrill } from "./restore-drill.ts";

const DEFAULT_TIMEOUT_MS = 10_000;

export async function runAlertCycle({
  bearerToken = process.env.NIPMOD_ALERT_WEBHOOK_BEARER_TOKEN,
  destinations = readDestinationsFromEnv(process.env),
  fetchFn = fetch,
  mode = "normal",
  now = Date.now(),
  restoreDrillFn = runRestoreDrill,
  runId = randomUUID(),
  syntheticMonitorFn = runSyntheticMonitor,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  const suites = [
    await runSuite("synthetic_monitor", syntheticMonitorFn),
    await runSuite("restore_drill", restoreDrillFn)
  ];
  const failedChecks = suites.flatMap((suite) => suite.failures.map((failure) => ({ ...failure, suite: suite.name })));
  const needsAlert = mode === "probe" || failedChecks.length > 0;
  const status = mode === "probe" ? "probe" : failedChecks.length > 0 ? "firing" : "healthy";
  const alert = needsAlert ? buildAlert({ failedChecks, now, runId, status, suites }) : null;
  const deliveries = alert ? await deliverAlert({ alert, bearerToken, destinations, fetchFn, timeoutMs }) : [];
  const deliverySummary = summarizeDeliveries(deliveries, alert);
  const checksOk = failedChecks.length === 0;
  const deliveryOk = !alert || deliverySummary.failed === 0;

  return {
    alertAttempted: Boolean(alert) && deliveries.length > 0 && destinations.length > 0,
    alertSent: deliverySummary.sent > 0,
    alertTriggered: Boolean(alert),
    checkedAt: new Date(now).toISOString(),
    deliveries,
    deliverySummary,
    formatVersion: 1,
    mode,
    ok: checksOk && deliveryOk,
    runId,
    status,
    summary: {
      failedChecks: failedChecks.length,
      suites: suites.length,
      totalChecks: suites.reduce((sum, suite) => sum + suite.summary.total, 0)
    },
    suites,
    type: "dev.nipmod.alert-delivery.v1"
  };
}

async function runSuite(name, fn) {
  try {
    return normalizeSuite(name, await fn());
  } catch (error) {
    return {
      failures: [
        {
          error: error instanceof Error ? error.message : String(error),
          name: "runner",
          status: "error"
        }
      ],
      name,
      ok: false,
      summary: { fail: 1, pass: 0, total: 1 },
      type: "dev.nipmod.runner-error.v1"
    };
  }
}

function normalizeSuite(name, result) {
  const checks = Array.isArray(result?.checks) ? result.checks : [];
  const failures = checks
    .filter((check) => check?.status !== "pass")
    .map((check) => ({
      error: check.error,
      name: check.name ?? "unknown",
      status: check.status ?? "unknown"
    }));
  return {
    checkedAt: result?.checkedAt,
    failures,
    name,
    ok: result?.ok === true && failures.length === 0,
    summary: {
      fail: result?.summary?.fail ?? failures.length,
      pass: result?.summary?.pass ?? checks.filter((check) => check?.status === "pass").length,
      total: result?.summary?.total ?? checks.length
    },
    type: result?.type ?? "unknown"
  };
}

function buildAlert({ failedChecks, now, runId, status, suites }) {
  const isProbe = status === "probe";
  return {
    formatVersion: 1,
    generatedAt: new Date(now).toISOString(),
    runId,
    severity: isProbe ? "info" : "critical",
    status,
    summary: {
      failedChecks: failedChecks.length,
      suites: suites.length,
      totalChecks: suites.reduce((sum, suite) => sum + suite.summary.total, 0)
    },
    suites: suites.map((suite) => ({
      failures: suite.failures,
      name: suite.name,
      ok: suite.ok,
      summary: suite.summary,
      type: suite.type
    })),
    title: isProbe ? "nipmod alert delivery probe" : "nipmod production checks failed",
    type: "dev.nipmod.production-alert.v1"
  };
}

async function deliverAlert({ alert, bearerToken, destinations, fetchFn, timeoutMs }) {
  if (destinations.length === 0) {
    return [
      {
        destination: "none",
        error: "no alert destinations configured",
        status: "failed"
      }
    ];
  }

  return Promise.all(destinations.map((destination) => deliverOne({ alert, bearerToken, destination, fetchFn, timeoutMs })));
}

async function deliverOne({ alert, bearerToken, destination, fetchFn, timeoutMs }) {
  const normalizedDestination = normalizeDestination(destination);
  const destinationHash = destinationId(normalizedDestination.url);
  const headers = {
    "content-type": "application/json",
    "user-agent": "nipmod-alert-runner"
  };
  const normalizedBearerToken = (normalizedDestination.bearerToken ?? bearerToken)?.trim();
  if (normalizedBearerToken) {
    headers.authorization = `Bearer ${normalizedBearerToken}`;
  }
  try {
    const response = await fetchFn(normalizedDestination.url, {
      body: JSON.stringify(alert),
      headers,
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) {
      return {
        destination: destinationHash,
        error: `alert destination returned ${response.status}`,
        status: "failed"
      };
    }
    return {
      destination: destinationHash,
      status: "sent"
    };
  } catch (error) {
    return {
      destination: destinationHash,
      error: error instanceof Error ? error.message : String(error),
      status: "failed"
    };
  }
}

function summarizeDeliveries(deliveries, alert) {
  if (!alert) {
    return { failed: 0, sent: 0, total: 0 };
  }
  return {
    failed: deliveries.filter((delivery) => delivery.status !== "sent").length,
    sent: deliveries.filter((delivery) => delivery.status === "sent").length,
    total: deliveries.length
  };
}

export function readDestinationsFromEnv(env) {
  return [
    {
      bearerToken: env.NIPMOD_ALERT_PRIMARY_WEBHOOK_BEARER_TOKEN,
      url: env.NIPMOD_ALERT_PRIMARY_WEBHOOK_URL
    },
    {
      bearerToken: env.NIPMOD_ALERT_SECONDARY_WEBHOOK_BEARER_TOKEN,
      url: env.NIPMOD_ALERT_SECONDARY_WEBHOOK_URL
    },
    ...(env.NIPMOD_ALERT_WEBHOOK_URLS ?? "").split(",")
  ]
    .map(normalizeDestination)
    .filter((destination) => destination.url);
}

function normalizeDestination(destination) {
  if (typeof destination === "string") {
    return { url: destination.trim() };
  }
  return {
    bearerToken: destination?.bearerToken?.trim(),
    url: destination?.url?.trim() ?? ""
  };
}

function destinationId(destination) {
  return `sha256:${createHash("sha256").update(destination).digest("hex").slice(0, 16)}`;
}

function parseMode(args) {
  if (args.includes("--probe")) {
    return "probe";
  }
  return "normal";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await runAlertCycle({ mode: parseMode(process.argv.slice(2)) });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}
