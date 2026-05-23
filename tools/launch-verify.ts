#!/usr/bin/env node
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const skipLocal = args.includes("--skip-local");
const requireDistributedRateLimit = args.includes("--require-distributed-rate-limit");
const baseUrl = readOption("--base-url")?.replace(/\/+$/, "") ?? "https://nipmod.com";
const checks = [];

if (!skipLocal) {
  await runCheck("local_verify", () => run("pnpm", ["verify"]));
}

await runCheck("live_api_contract", () => verifyLiveApi(baseUrl, { requireDistributedRateLimit }));
await runCheck("api_contract_canary", () =>
  run(process.execPath, ["--experimental-strip-types", "tools/api-contract-canary.ts", "--base-url", baseUrl], { timeoutMs: 60_000 })
);
await runCheck("source_depth_canary", () =>
  run(process.execPath, ["--experimental-strip-types", "tools/source-depth-canary.ts", "--base-url", baseUrl], { timeoutMs: 90_000 })
);
await runCheck("api_usage_canary", () => run(process.execPath, ["--experimental-strip-types", "tools/api-usage-canary.ts", "--base-url", baseUrl], { timeoutMs: 60_000 }));
await runCheck("rate_limit_canary", () =>
  run(
    process.execPath,
    [
      "--experimental-strip-types",
      "tools/rate-limit-canary.ts",
      "--base-url",
      baseUrl,
      ...(requireDistributedRateLimit ? ["--require-active"] : [])
    ],
    { timeoutMs: 60_000 }
  )
);
await runCheck("production_synthetic_monitor", () => run(process.execPath, ["--experimental-strip-types", "tools/prod-synthetic-monitor.ts"]));
await runCheck("production_load_smoke", () =>
  run(process.execPath, ["--experimental-strip-types", "tools/prod-load-smoke.ts", "--profile", "launch"], { timeoutMs: 180_000 })
);
await runCheck("node_edge_resilience", () =>
  run(process.execPath, ["--experimental-strip-types", "tools/node-edge-resilience-smoke.ts"], { timeoutMs: 60_000 })
);

const summary = {
  fail: checks.filter((check) => check.status === "fail").length,
  pass: checks.filter((check) => check.status === "pass").length,
  total: checks.length
};

const result = {
  baseUrl,
  checkedAt: new Date().toISOString(),
  formatVersion: 1,
  ok: summary.fail === 0,
  summary,
  checks,
  type: "dev.nipmod.launch-verify.v1"
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) {
  process.exitCode = 1;
}

async function runCheck(name, fn) {
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

async function verifyLiveApi(targetBaseUrl, { requireDistributedRateLimit = false } = {}) {
  const openApi = await fetchJson(`${targetBaseUrl}/api/openapi`);
  assertEqual(openApi.openapi, "3.1.0", "OpenAPI version mismatch");
  assertEqual(
    openApi.paths?.["/api/install-plan"]?.get?.responses?.["200"]?.content?.["application/json"]?.schema?.$ref,
    "#/components/schemas/ExternalInstallPlan",
    "install-plan response schema missing"
  );
  if (!openApi.components?.schemas?.ExternalInstallPlan?.properties?.plan?.required?.includes("commandDetails")) {
    throw new Error("install-plan commandDetails is not required in OpenAPI");
  }
  if (!openApi.components?.schemas?.ExternalInstallPlan?.properties?.safety?.required?.includes("blocked")) {
    throw new Error("install-plan safety.blocked is not required in OpenAPI");
  }

  const search = await fetchJson(`${targetBaseUrl}/api/search?q=http%20client&sources=npm,pypi&limit=2`);
  assertEqual(search.type, "dev.nipmod.external-search.v1", "search response type mismatch");
  if (!Array.isArray(search.sourceReports) || search.sourceReports.length !== 2) {
    throw new Error("search source reports missing");
  }
  for (const report of search.sourceReports) {
    if (!report.resolver?.resolverVersion || !report.circuit?.status) {
      throw new Error(`source report missing resolver or circuit metadata for ${report.source ?? "unknown"}`);
    }
  }

  const plan = await fetchJson(`${targetBaseUrl}/api/install-plan?source=npm&name=react`);
  assertEqual(plan.type, "dev.nipmod.external-install-plan.v1", "install-plan response type mismatch");
  assertEqual(plan.safety?.blocked, false, "safe npm plan should not be blocked");
  assertEqual(plan.safety?.requiresApprovalBeforeWrite, true, "install-plan approval boundary mismatch");
  const firstCommand = plan.plan?.commandDetails?.[0];
  assertEqual(firstCommand?.hostedApiExecutes, false, "hosted API execution boundary mismatch");
  assertEqual(firstCommand?.requiresApprovalBeforeWrite, true, "command approval boundary mismatch");
  assertEqual(firstCommand?.boundary, "manual-after-user-approval", "safe command boundary mismatch");

  const sourceHealth = await fetchJson(`${targetBaseUrl}/api/sources/health`);
  assertEqual(sourceHealth.type, "dev.nipmod.source-health.v1", "source health type mismatch");
  assertEqual(sourceHealth.summary?.workspaceWritesFromHostedApi, false, "source health write boundary mismatch");
  if (requireDistributedRateLimit && sourceHealth.rateLimit?.activeStore !== "supabase") {
    throw new Error(`distributed rate-limit store is not active: ${sourceHealth.rateLimit?.activeStore ?? "unknown"}`);
  }
  const liveSourceHealth = await fetchJson(`${targetBaseUrl}/api/sources/health?probe=live`);
  assertEqual(liveSourceHealth.type, "dev.nipmod.source-health.v1", "live source health type mismatch");
  if (liveSourceHealth.summary?.liveFailed !== 0) {
    throw new Error(`live source probe failed for ${liveSourceHealth.summary?.liveFailed ?? "unknown"} sources`);
  }
  const liveSources = Array.isArray(liveSourceHealth.sources) ? liveSourceHealth.sources : [];
  const failedLiveSource = liveSources.find((source) => source?.live?.status !== "ok");
  if (failedLiveSource) {
    throw new Error(`live source probe failed for ${failedLiveSource.source ?? "unknown"}`);
  }

  return {
    installPlanCommandBoundary: firstCommand.boundary,
    liveSourceProbeOk: liveSources.length,
    openApi: `${targetBaseUrl}/api/openapi`,
    rateLimitStore: sourceHealth.rateLimit?.activeStore ?? null,
    requireDistributedRateLimit,
    searchSources: search.sourceReports.map((report) => report.source),
    sourceCount: sourceHealth.sources?.length ?? 0
  };
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`${url} returned ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function run(command, commandArgs, { timeoutMs = 300_000 } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: root,
      env: process.env,
      stdio: "inherit"
    });
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${command} ${commandArgs.join(" ")} timed out`));
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code, signal) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolvePromise({ command, args: commandArgs });
        return;
      }
      reject(new Error(`${command} ${commandArgs.join(" ")} failed with ${signal ?? code}`));
    });
  });
}

function readOption(name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }
  const value = args[index + 1];
  return value && !value.startsWith("--") ? value : null;
}
