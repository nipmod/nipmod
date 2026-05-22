import { createHash, randomUUID } from "node:crypto";

export type MonitorMode = "normal" | "probe";

export interface MonitorDestination {
  bearerToken?: string;
  url: string;
}

export interface MonitorEndpointConfig {
  archivePrepare: string;
  archiveStatus: string;
  discovery: string;
  home: string;
  installPlan: string;
  mcp: string;
  nodeHealth: string;
  openapi: string;
  registry: string;
  search: string;
  sourceHealth: string;
  trust: string;
  witnessHealth: string;
}

export interface MonitorCheck {
  data?: Record<string, unknown>;
  durationMs: number;
  error?: string;
  name: string;
  status: "fail" | "pass";
}

export interface MonitorDelivery {
  destination: string;
  error?: string;
  status: "failed" | "sent";
}

export interface ProductionMonitorResult {
  alertAttempted: boolean;
  alertSent: boolean;
  alertTriggered: boolean;
  checkedAt: string;
  checks: MonitorCheck[];
  deliveries: MonitorDelivery[];
  deliverySummary: {
    failed: number;
    sent: number;
    total: number;
  };
  formatVersion: 1;
  mode: MonitorMode;
  ok: boolean;
  runId: string;
  status: "firing" | "healthy" | "probe";
  summary: {
    failedChecks: number;
    totalChecks: number;
  };
  type: "dev.nipmod.production-monitor.v1";
}

const DEFAULT_ENDPOINTS: MonitorEndpointConfig = {
  archivePrepare: "https://nipmod.com/api/archive/prepare?source=npm&name=react",
  archiveStatus: "https://nipmod.com/api/archive/status",
  discovery: "https://nipmod.com/.well-known/nipmod.json",
  home: "https://nipmod.com",
  installPlan: "https://nipmod.com/api/install-plan?source=npm&name=react",
  mcp: "https://nipmod.com/api/mcp",
  nodeHealth: "https://node.nipmod.com/health",
  openapi: "https://nipmod.com/api/openapi",
  registry: "https://nipmod.com/registry/packages.json",
  search: "https://nipmod.com/api/search?q=react&sources=npm&limit=1",
  sourceHealth: "https://nipmod.com/api/sources/health",
  trust: "https://nipmod.com/trust",
  witnessHealth: "https://nipmod-witness.fly.dev/health"
};

const DEFAULT_TIMEOUT_MS = 10_000;

export async function runProductionMonitor({
  destinations = readMonitorDestinationsFromEnv(process.env),
  endpoints = DEFAULT_ENDPOINTS,
  fetchFn = fetch,
  mode = "normal",
  now = Date.now(),
  runId = randomUUID(),
  timeoutMs = DEFAULT_TIMEOUT_MS
}: {
  destinations?: MonitorDestination[];
  endpoints?: MonitorEndpointConfig;
  fetchFn?: typeof fetch;
  mode?: MonitorMode;
  now?: number;
  runId?: string;
  timeoutMs?: number;
} = {}): Promise<ProductionMonitorResult> {
  const timedFetch = createTimedFetch(fetchFn, timeoutMs);
  const checks: MonitorCheck[] = [];

  await runCheck(checks, "site_home", async () => {
    const text = await fetchText(endpoints.home, timedFetch);
    assertIncludes(text, "nipmod", "homepage missing product name");
    return { url: endpoints.home };
  });

  await runCheck(checks, "trust_page", async () => {
    const text = await fetchText(endpoints.trust, timedFetch);
    for (const marker of ["Verified registry", "Current public roots", "Release key"]) {
      assertIncludes(text, marker, `trust page missing ${marker}`);
    }
    return { url: endpoints.trust };
  });

  await runCheck(checks, "discovery_manifest", async () => {
    const discovery = await fetchJson(endpoints.discovery, timedFetch);
    assertRecord(discovery, "discovery manifest");
    assertEqual(discovery.type, "dev.nipmod.discovery.v1", "discovery type mismatch");
    assertNestedEqual(discovery, ["registry", "url"], endpoints.registry, "registry URL drifted");
    assertNestedEqual(discovery, ["node", "health"], endpoints.nodeHealth, "node health URL drifted");
    assertNestedEqual(discovery, ["witness", "health"], endpoints.witnessHealth, "witness health URL drifted");
    return { url: endpoints.discovery };
  });

  await runCheck(checks, "registry_verified", async () => {
    const registry = await fetchJson(endpoints.registry, timedFetch);
    assertRecord(registry, "registry");
    if (!Array.isArray(registry.packages)) {
      throw new Error("registry packages are not an array");
    }
    const badPackage = registry.packages.find((pkg) => !isVerifiedPackage(pkg));
    if (badPackage) {
      const name = isRecordValue(badPackage) && typeof badPackage.name === "string" ? badPackage.name : "unknown";
      throw new Error(`registry package is not verified/100: ${name}`);
    }
    return {
      mode: registry.packages.length === 0 ? "empty-public-archive" : "verified-public-packages",
      packages: registry.packages.length
    };
  });

  await runCheck(checks, "api_source_health", async () => {
    const payload = await fetchJson(endpoints.sourceHealth, timedFetch);
    assertRecord(payload, "source health");
    assertEqual(payload.type, "dev.nipmod.source-health.v1", "source health type mismatch");
    assertNestedEqual(payload, ["summary", "workspaceWritesFromHostedApi"], false, "hosted API workspace write boundary drifted");
    const sources = payload.sources;
    if (!Array.isArray(sources) || sources.length < 6) {
      throw new Error("source health missing expected sources");
    }
    return { sources: sources.length, url: endpoints.sourceHealth };
  });

  await runCheck(checks, "api_openapi_contract", async () => {
    const payload = await fetchJson(endpoints.openapi, timedFetch);
    assertRecord(payload, "openapi");
    assertEqual(payload.openapi, "3.1.0", "OpenAPI version mismatch");
    const paths = payload.paths;
    assertRecord(paths, "openapi paths");
    for (const path of ["/api/search", "/api/inspect", "/api/install-plan", "/api/archive/prepare", "/api/archive/confirm", "/api/mcp"]) {
      if (!isRecordValue(paths[path])) {
        throw new Error(`OpenAPI missing ${path}`);
      }
    }
    return { paths: Object.keys(paths).length, url: endpoints.openapi };
  });

  await runCheck(checks, "api_external_search", async () => {
    const payload = await fetchJson(endpoints.search, timedFetch);
    assertRecord(payload, "external search");
    assertEqual(payload.type, "dev.nipmod.external-search.v1", "external search type mismatch");
    const records = payload.records;
    if (!Array.isArray(records) || records.length < 1) {
      throw new Error("external search returned no records");
    }
    const first = records[0];
    assertRecord(first, "external search first record");
    assertEqual(first.source, "npm", "external search first source mismatch");
    return { records: records.length, url: endpoints.search };
  });

  await runCheck(checks, "api_install_plan", async () => {
    const payload = await fetchJson(endpoints.installPlan, timedFetch);
    assertRecord(payload, "install plan");
    assertEqual(payload.type, "dev.nipmod.external-install-plan.v1", "install plan type mismatch");
    assertNestedEqual(payload, ["plan", "requiresApprovalBeforeWrite"], true, "install plan approval boundary drifted");
    return { url: endpoints.installPlan };
  });

  await runCheck(checks, "api_archive_prepare", async () => {
    const payload = await fetchJson(endpoints.archivePrepare, timedFetch);
    assertRecord(payload, "archive prepare");
    assertEqual(payload.type, "dev.nipmod.archive-prepare.v1", "archive prepare type mismatch");
    assertEqual(payload.preparedOnly, true, "archive prepare must remain prepare-only");
    assertEqual(payload.stored, false, "archive prepare must not persist records");
    return { url: endpoints.archivePrepare };
  });

  await runCheck(checks, "api_archive_status", async () => {
    const payload = await fetchJson(endpoints.archiveStatus, timedFetch);
    assertRecord(payload, "archive status");
    assertEqual(payload.type, "dev.nipmod.archive-status.v1", "archive status type mismatch");
    assertEqual(payload.driver, "supabase-rest", "archive store driver mismatch");
    return { url: endpoints.archiveStatus };
  });

  await runCheck(checks, "api_remote_mcp", async () => {
    const payload = await fetchJsonPost(
      endpoints.mcp,
      {
        id: 1,
        jsonrpc: "2.0",
        method: "tools/list",
        params: {}
      },
      timedFetch
    );
    assertRecord(payload, "remote MCP");
    assertEqual(payload.jsonrpc, "2.0", "remote MCP jsonrpc mismatch");
    assertNestedArrayIncludes(payload, ["result", "tools"], "nipmod.resolve", "remote MCP missing resolve tool");
    return { url: endpoints.mcp };
  });

  await runCheck(checks, "node_health", async () => {
    const payload = await fetchJson(endpoints.nodeHealth, timedFetch);
    assertRecord(payload, "node health");
    assertEqual(payload.status, "ok", "node health status mismatch");
    return { url: endpoints.nodeHealth };
  });

  await runCheck(checks, "witness_health", async () => {
    const payload = await fetchJson(endpoints.witnessHealth, timedFetch);
    assertRecord(payload, "witness health");
    assertEqual(payload.ok, true, "witness health is not ok");
    assertEqual(payload.lastError, null, "witness has lastError");
    return { url: endpoints.witnessHealth };
  });

  const failedChecks = checks.filter((check) => check.status !== "pass");
  const status = mode === "probe" ? "probe" : failedChecks.length > 0 ? "firing" : "healthy";
  const alert = status === "probe" || status === "firing" ? buildAlert({ checks, failedChecks, now, runId, status }) : null;
  const deliveries = alert ? await deliverAlert({ alert, destinations, fetchFn, timeoutMs }) : [];
  const deliverySummary = summarizeDeliveries(deliveries, alert);
  const deliveryOk = !alert || deliverySummary.failed === 0;

  return {
    alertAttempted: Boolean(alert) && deliveries.length > 0 && destinations.length > 0,
    alertSent: deliverySummary.sent > 0,
    alertTriggered: Boolean(alert),
    checkedAt: new Date(now).toISOString(),
    checks,
    deliveries,
    deliverySummary,
    formatVersion: 1,
    mode,
    ok: failedChecks.length === 0 && deliveryOk,
    runId,
    status,
    summary: {
      failedChecks: failedChecks.length,
      totalChecks: checks.length
    },
    type: "dev.nipmod.production-monitor.v1"
  };
}

export function readMonitorDestinationsFromEnv(env: NodeJS.ProcessEnv): MonitorDestination[] {
  const origin = (env.NIPMOD_SITE_ORIGIN ?? "https://nipmod.com").replace(/\/+$/, "");
  return [
    monitorDestination(
      env.NIPMOD_MONITOR_PRIMARY_WEBHOOK_URL ?? `${origin}/api/alerts/primary`,
      tokenFromEnv(env.NIPMOD_MONITOR_PRIMARY_WEBHOOK_BEARER_TOKEN, env.NIPMOD_ALERT_PRIMARY_SINK_TOKEN, env.NIPMOD_ALERT_SINK_TOKEN)
    ),
    monitorDestination(
      env.NIPMOD_MONITOR_SECONDARY_WEBHOOK_URL ?? `${origin}/api/alerts/secondary`,
      tokenFromEnv(
        env.NIPMOD_MONITOR_SECONDARY_WEBHOOK_BEARER_TOKEN,
        env.NIPMOD_ALERT_SECONDARY_SINK_TOKEN,
        env.NIPMOD_ALERT_SINK_TOKEN
      )
    ),
    ...(env.NIPMOD_MONITOR_WEBHOOK_URLS ?? "").split(",").map((url) => ({ url }))
  ]
    .map(normalizeDestination)
    .filter((destination) => destination.url);
}

async function runCheck(checks: MonitorCheck[], name: string, fn: () => Promise<Record<string, unknown>>): Promise<void> {
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

function buildAlert({
  checks,
  failedChecks,
  now,
  runId,
  status
}: {
  checks: MonitorCheck[];
  failedChecks: MonitorCheck[];
  now: number;
  runId: string;
  status: "firing" | "probe";
}) {
  return {
    formatVersion: 1,
    generatedAt: new Date(now).toISOString(),
    runId,
    severity: status === "probe" ? "info" : "critical",
    status,
    summary: {
      failedChecks: failedChecks.length,
      suites: 1,
      totalChecks: checks.length
    },
    suites: [
      {
        failures: failedChecks.map((check) => ({
          error: check.error,
          name: check.name,
          status: check.status
        })),
        name: "vercel_production_monitor",
        ok: failedChecks.length === 0,
        summary: {
          fail: failedChecks.length,
          pass: checks.length - failedChecks.length,
          total: checks.length
        },
        type: "dev.nipmod.production-monitor.v1"
      }
    ],
    title: status === "probe" ? "nipmod alert delivery probe" : "nipmod production checks failed",
    type: "dev.nipmod.production-alert.v1"
  };
}

async function deliverAlert({
  alert,
  destinations,
  fetchFn,
  timeoutMs
}: {
  alert: unknown;
  destinations: MonitorDestination[];
  fetchFn: typeof fetch;
  timeoutMs: number;
}): Promise<MonitorDelivery[]> {
  if (destinations.length === 0) {
    return [
      {
        destination: "none",
        error: "no alert destinations configured",
        status: "failed"
      }
    ];
  }

  return Promise.all(destinations.map((destination) => deliverOne({ alert, destination, fetchFn, timeoutMs })));
}

async function deliverOne({
  alert,
  destination,
  fetchFn,
  timeoutMs
}: {
  alert: unknown;
  destination: MonitorDestination;
  fetchFn: typeof fetch;
  timeoutMs: number;
}): Promise<MonitorDelivery> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": "nipmod-production-monitor"
  };
  if (destination.bearerToken) {
    headers.authorization = `Bearer ${destination.bearerToken}`;
  }

  try {
    const response = await fetchFn(destination.url, {
      body: JSON.stringify(alert),
      headers,
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) {
      return {
        destination: destinationId(destination.url),
        error: `alert destination returned ${response.status}`,
        status: "failed"
      };
    }
    return {
      destination: destinationId(destination.url),
      status: "sent"
    };
  } catch (error) {
    return {
      destination: destinationId(destination.url),
      error: error instanceof Error ? error.message : String(error),
      status: "failed"
    };
  }
}

function summarizeDeliveries(deliveries: MonitorDelivery[], alert: unknown) {
  if (!alert) {
    return { failed: 0, sent: 0, total: 0 };
  }
  return {
    failed: deliveries.filter((delivery) => delivery.status !== "sent").length,
    sent: deliveries.filter((delivery) => delivery.status === "sent").length,
    total: deliveries.length
  };
}

function createTimedFetch(fetchFn: typeof fetch, timeoutMs: number): typeof fetch {
  return ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
    fetchFn(input, {
      ...init,
      cache: "no-store",
      signal: init?.signal ?? AbortSignal.timeout(timeoutMs)
    })) as typeof fetch;
}

async function fetchText(url: string, fetchFn: typeof fetch): Promise<string> {
  const response = await fetchFn(url, { headers: { accept: "text/html,text/plain" } });
  if (!response.ok) {
    throw new Error(`failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

async function fetchJson(url: string, fetchFn: typeof fetch): Promise<unknown> {
  const response = await fetchFn(url, { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
}

async function fetchJsonPost(url: string, body: unknown, fetchFn: typeof fetch): Promise<unknown> {
  const response = await fetchFn(url, {
    body: JSON.stringify(body),
    headers: { accept: "application/json", "content-type": "application/json" },
    method: "POST"
  });
  if (!response.ok) {
    throw new Error(`failed to post ${url}: ${response.status}`);
  }
  return response.json();
}

function isVerifiedPackage(value: unknown): boolean {
  if (!isRecordValue(value)) {
    return false;
  }
  const trust = value.trust;
  if (!isRecordValue(trust)) {
    return false;
  }
  const evidence = trust.evidence;
  return (
    trust.level === "verified" &&
    trust.score === 100 &&
    isRecordValue(evidence) &&
    evidence.sourceProvenanceVerified === true &&
    evidence.transparencyLogIncluded === true &&
    evidence.transparencyLogVerified === true &&
    typeof value.digest === "string" &&
    /^[a-f0-9]{64}$/.test(value.digest)
  );
}

function normalizeDestination(destination: MonitorDestination): MonitorDestination {
  const url = destination.url.trim();
  const bearerToken = destination.bearerToken?.trim();
  return bearerToken ? { bearerToken, url } : { url };
}

function monitorDestination(url: string, bearerToken?: string): MonitorDestination {
  return bearerToken ? { bearerToken, url } : { url };
}

function tokenFromEnv(...values: Array<string | undefined>): string | undefined {
  return values.map((value) => value?.trim()).find((value): value is string => Boolean(value));
}

function destinationId(destination: string): string {
  return `sha256:${createHash("sha256").update(destination).digest("hex").slice(0, 16)}`;
}

function assertIncludes(text: string, marker: string, message: string): void {
  if (!text.includes(marker)) {
    throw new Error(message);
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(message);
  }
}

function assertNestedEqual(value: Record<string, unknown>, path: string[], expected: unknown, message: string): void {
  let current: unknown = value;
  for (const part of path) {
    if (!isRecordValue(current)) {
      throw new Error(message);
    }
    current = current[part];
  }
  assertEqual(current, expected, message);
}

function assertNestedArrayIncludes(value: Record<string, unknown>, path: string[], expectedName: string, message: string): void {
  let current: unknown = value;
  for (const part of path) {
    if (!isRecordValue(current)) {
      throw new Error(message);
    }
    current = current[part];
  }
  if (!Array.isArray(current)) {
    throw new Error(message);
  }
  const hasExpected = current.some((item) => isRecordValue(item) && item.name === expectedName);
  if (!hasExpected) {
    throw new Error(message);
  }
}

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!isRecordValue(value)) {
    throw new Error(`${label} is not an object`);
  }
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
