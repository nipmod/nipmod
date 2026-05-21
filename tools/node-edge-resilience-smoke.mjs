#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { assertUnauthenticatedReceivePackBlocked } from "./receive-pack-abuse-smoke.mjs";

const DEFAULT_NODE_URL = "https://node.nipmod.com";
const DEFAULT_REQUEST_BUDGET = 5;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_CATALOG_BYTES = 256 * 1024;
const MIN_REQUESTS = 5;

export async function runNodeEdgeResilienceSmoke({
  baseUrl = DEFAULT_NODE_URL,
  fetchFn = fetch,
  maxCatalogBytes = MAX_CATALOG_BYTES,
  now = Date.now(),
  requestBudget = DEFAULT_REQUEST_BUDGET
} = {}) {
  if (requestBudget < MIN_REQUESTS) {
    throw new Error(`request budget exceeded: ${requestBudget} < required ${MIN_REQUESTS}`);
  }

  const budget = createBudgetedFetch(fetchFn, requestBudget);
  const timedFetch = createTimedFetch(budget.fetch, FETCH_TIMEOUT_MS);
  const checks = [];
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  await runCheck(checks, "health_before", async () => {
    const payload = await fetchJson(`${normalizedBaseUrl}/health`, timedFetch);
    assertEqual(payload.status, "ok", "node health status mismatch");
    return { url: `${normalizedBaseUrl}/health` };
  });

  await runCheck(checks, "repo_catalog_bounded", async () => {
    const bytes = await fetchBytes(`${normalizedBaseUrl}/api/v1/repos`, timedFetch, maxCatalogBytes);
    const repos = JSON.parse(bytes.toString("utf8"));
    if (!Array.isArray(repos) || repos.length === 0) {
      throw new Error("repo catalog is empty or invalid");
    }
    const repo = repos.find((candidate) => typeof candidate?.clone_url === "string") ?? repos[0];
    if (typeof repo?.clone_url !== "string") {
      throw new Error("repo catalog has no clone_url");
    }
    return {
      bytes: bytes.length,
      repos: repos.length
    };
  });

  await runCheck(checks, "receive_pack_auth_gate", async () => {
    const result = await assertUnauthenticatedReceivePackBlocked({
      baseUrl: normalizedBaseUrl,
      fetchFn: timedFetch
    });
    return {
      probes: result.probes.map((probe) => ({
        bytes: probe.bytes,
        label: probe.label,
        status: probe.status
      }))
    };
  });

  await runCheck(checks, "health_after", async () => {
    const payload = await fetchJson(`${normalizedBaseUrl}/health`, timedFetch);
    assertEqual(payload.status, "ok", "node health status mismatch after edge probes");
    return { url: `${normalizedBaseUrl}/health` };
  });

  const summary = {
    fail: checks.filter((check) => check.status === "fail").length,
    pass: checks.filter((check) => check.status === "pass").length,
    total: checks.length
  };

  return {
    checkedAt: new Date(now).toISOString(),
    checks,
    formatVersion: 1,
    mode: "bounded-non-destructive",
    ok: summary.fail === 0,
    requestBudget: {
      max: requestBudget,
      used: budget.used()
    },
    summary,
    type: "dev.nipmod.node-edge-resilience.v1"
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

async function fetchJson(url, fetchFn) {
  const bytes = await fetchBytes(url, fetchFn);
  return JSON.parse(bytes.toString("utf8"));
}

async function fetchBytes(url, fetchFn, maxBytes = Number.POSITIVE_INFINITY) {
  const response = await fetchFn(url, { redirect: "error" });
  assertNoServerError(response, url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxBytes) {
    throw new Error(`${url} exceeded ${maxBytes} bytes`);
  }
  return bytes;
}

function assertNoServerError(response, label) {
  if (response.status >= 500) {
    throw new Error(`${label} returned ${response.status}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function createBudgetedFetch(fetchFn, maxRequests) {
  let used = 0;
  return {
    fetch: async (url, init) => {
      used += 1;
      if (used > maxRequests) {
        throw new Error(`request budget exceeded: ${used} > ${maxRequests}`);
      }
      return fetchFn(url, init);
    },
    used: () => used
  };
}

function createTimedFetch(fetchFn, timeoutMs) {
  return (url, init = {}) =>
    fetchFn(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(timeoutMs)
    });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await runNodeEdgeResilienceSmoke();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}
