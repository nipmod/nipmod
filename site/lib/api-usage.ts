import { createHash } from "node:crypto";
import type { ApiAccess } from "./api-auth";
import type { ApiHttpContext } from "./api-http";

type UsageEnv = Record<string, string | undefined>;

interface ApiUsageInput {
  access: ApiAccess;
  context: ApiHttpContext;
  request: Request;
  responseBody: unknown;
  route: string;
  status: number;
}

interface UsageSummary {
  errorCode: string | null;
  packageHash: string | null;
  queryHash: string | null;
  resultCount: number | null;
  source: string | null;
  sources: string[];
}

const SUPABASE_URL_ENV = "NIPMOD_ARCHIVE_SUPABASE_URL";
const SUPABASE_SERVICE_ROLE_KEY_ENV = "NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY";
const USAGE_HASH_SALT_ENV = "NIPMOD_USAGE_HASH_SALT";
const USAGE_WRITE_TIMEOUT_MS = 700;
const USAGE_METRICS_TIMEOUT_MS = 1_200;
const USAGE_METRICS_EVENT_LIMIT = 5_000;

export async function recordApiUsage(input: ApiUsageInput, env: UsageEnv = process.env, fetchImpl: typeof fetch = fetch): Promise<void> {
  const baseUrl = env[SUPABASE_URL_ENV];
  const serviceRoleKey = env[SUPABASE_SERVICE_ROLE_KEY_ENV];
  if (!baseUrl || !serviceRoleKey) {
    return;
  }

  const summary = summarizeResponse(input.responseBody, input.request);
  const row = {
    access_tier: input.access.tier,
    api_key_id: input.access.keyId,
    client_hash: hashClient(input.request, env),
    duration_ms: Math.max(0, Date.now() - input.context.startedAt),
    error_code: summary.errorCode,
    method: input.request.method,
    package_hash: summary.packageHash,
    query_hash: summary.queryHash,
    request_id: input.context.requestId,
    result_count: summary.resultCount,
    route: input.route,
    source: summary.source,
    sources: summary.sources,
    status: input.status
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), USAGE_WRITE_TIMEOUT_MS);
    try {
      const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/rest/v1/api_usage_events`, {
        body: JSON.stringify([row]),
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
          "content-type": "application/json",
          Prefer: "return=minimal"
        },
        method: "POST",
        signal: controller.signal
      });
      if (!response.ok) {
        return;
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return;
  }
}

export function usageStoreStatus(env: UsageEnv = process.env): {
  configured: boolean;
  driver: "supabase-rest";
  missing: string[];
  type: "dev.nipmod.usage-store-status.v1";
} {
  const missing = [SUPABASE_URL_ENV, SUPABASE_SERVICE_ROLE_KEY_ENV].filter((key) => !env[key]);
  return {
    configured: missing.length === 0,
    driver: "supabase-rest",
    missing,
    type: "dev.nipmod.usage-store-status.v1"
  };
}

export type ApiUsageMetricsResult =
  | {
      metrics: unknown;
      ok: true;
    }
  | {
      code: string;
      error: string;
      missing?: string[];
      ok: false;
      retryable: boolean;
      status: number;
    };

export async function readApiUsageMetrics(
  input: { limit: number; since: Date },
  env: UsageEnv = process.env,
  fetchImpl: typeof fetch = fetch
): Promise<ApiUsageMetricsResult> {
  const baseUrl = env[SUPABASE_URL_ENV];
  const serviceRoleKey = env[SUPABASE_SERVICE_ROLE_KEY_ENV];
  const missing = [SUPABASE_URL_ENV, SUPABASE_SERVICE_ROLE_KEY_ENV].filter((key) => !env[key]);
  if (!baseUrl || !serviceRoleKey) {
    return {
      code: "usage_store_not_configured",
      error: "usage metrics store is not configured",
      missing,
      ok: false,
      retryable: false,
      status: 503
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), USAGE_METRICS_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/rest/v1/rpc/read_api_usage_metrics`, {
      body: JSON.stringify({
        p_limit: input.limit,
        p_since: input.since.toISOString()
      }),
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json"
      },
      method: "POST",
      signal: controller.signal
    });
    if (!response.ok) {
      if (response.status === 404) {
        return readApiUsageMetricsFromEvents(input, env, fetchImpl);
      }
      return {
        code: "usage_metrics_unavailable",
        error: "usage metrics are temporarily unavailable",
        ok: false,
        retryable: response.status >= 500,
        status: response.status === 401 || response.status === 403 ? 503 : response.status
      };
    }
    const metrics = await response.json();
    if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) {
      return {
        code: "usage_metrics_invalid_response",
        error: "usage metrics response had an unexpected shape",
        ok: false,
        retryable: true,
        status: 503
      };
    }
    return { metrics, ok: true };
  } catch (error) {
    return {
      code: error instanceof DOMException && error.name === "AbortError" ? "usage_metrics_timeout" : "usage_metrics_network_error",
      error: "usage metrics are temporarily unavailable",
      ok: false,
      retryable: true,
      status: 503
    };
  } finally {
    clearTimeout(timeout);
  }
}

type UsageMetricsEventRow = {
  access_tier: string;
  api_key_id: string | null;
  client_hash: string;
  duration_ms: number;
  error_code: string | null;
  package_hash: string | null;
  route: string;
  source: string | null;
  sources: string[] | null;
  status: number;
};

async function readApiUsageMetricsFromEvents(
  input: { limit: number; since: Date },
  env: UsageEnv,
  fetchImpl: typeof fetch
): Promise<ApiUsageMetricsResult> {
  const baseUrl = env[SUPABASE_URL_ENV];
  const serviceRoleKey = env[SUPABASE_SERVICE_ROLE_KEY_ENV];
  if (!baseUrl || !serviceRoleKey) {
    return {
      code: "usage_store_not_configured",
      error: "usage metrics store is not configured",
      missing: [SUPABASE_URL_ENV, SUPABASE_SERVICE_ROLE_KEY_ENV].filter((key) => !env[key]),
      ok: false,
      retryable: false,
      status: 503
    };
  }

  const params = new URLSearchParams({
    created_at: `gte.${input.since.toISOString()}`,
    limit: String(USAGE_METRICS_EVENT_LIMIT),
    order: "created_at.desc",
    select: "route,status,access_tier,api_key_id,client_hash,package_hash,source,sources,error_code,duration_ms"
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), USAGE_METRICS_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/rest/v1/api_usage_events?${params.toString()}`, {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`
      },
      signal: controller.signal
    });
    if (!response.ok) {
      return {
        code: "usage_metrics_unavailable",
        error: "usage metrics are temporarily unavailable",
        ok: false,
        retryable: response.status >= 500,
        status: response.status === 401 || response.status === 403 ? 503 : response.status
      };
    }
    const rows = await response.json();
    if (!Array.isArray(rows)) {
      return {
        code: "usage_metrics_invalid_response",
        error: "usage metrics response had an unexpected shape",
        ok: false,
        retryable: true,
        status: 503
      };
    }
    return {
      metrics: buildUsageMetrics(rows.filter(isUsageMetricsEventRow), input),
      ok: true
    };
  } catch (error) {
    return {
      code: error instanceof DOMException && error.name === "AbortError" ? "usage_metrics_timeout" : "usage_metrics_network_error",
      error: "usage metrics are temporarily unavailable",
      ok: false,
      retryable: true,
      status: 503
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildUsageMetrics(rows: UsageMetricsEventRow[], input: { limit: number; since: Date }) {
  const limit = Math.min(100, Math.max(1, input.limit));
  const routes = new Map<string, { duration: number; errors: number; requests: number }>();
  const sources = new Map<string, number>();
  const packages = new Map<string, number>();
  const tiers = new Map<string, number>();
  const errors = new Map<string, number>();
  const keyIds = new Set<string>();
  const clients = new Set<string>();
  let duration = 0;
  let errorCount = 0;

  for (const row of rows) {
    duration += row.duration_ms;
    if (row.status >= 400) {
      errorCount += 1;
    }
    if (row.api_key_id) {
      keyIds.add(row.api_key_id);
    }
    if (row.client_hash) {
      clients.add(row.client_hash);
    }
    const route = routes.get(row.route) ?? { duration: 0, errors: 0, requests: 0 };
    route.requests += 1;
    route.duration += row.duration_ms;
    route.errors += row.status >= 400 ? 1 : 0;
    routes.set(row.route, route);

    for (const source of metricSources(row)) {
      sources.set(source, (sources.get(source) ?? 0) + 1);
    }
    if (row.package_hash) {
      packages.set(row.package_hash, (packages.get(row.package_hash) ?? 0) + 1);
    }
    if (row.access_tier) {
      tiers.set(row.access_tier, (tiers.get(row.access_tier) ?? 0) + 1);
    }
    if (row.error_code) {
      errors.set(row.error_code, (errors.get(row.error_code) ?? 0) + 1);
    }
  }

  return {
    accessTiers: sortedCounts(tiers, "tier", limit),
    errors: sortedCounts(errors, "code", limit),
    generatedAt: new Date().toISOString(),
    packages: sortedCounts(packages, "packageHash", limit),
    privacy: "aggregated metrics only; package values are hashes; raw keys, IPs, user agents, queries and package names are not returned",
    routes: [...routes.entries()]
      .map(([route, value]) => ({
        avgDurationMs: value.requests > 0 ? Math.round(value.duration / value.requests) : 0,
        errorCount: value.errors,
        requestCount: value.requests,
        route
      }))
      .sort((left, right) => right.requestCount - left.requestCount || left.route.localeCompare(right.route))
      .slice(0, limit),
    since: input.since.toISOString(),
    sources: sortedCounts(sources, "source", limit),
    totals: {
      avgDurationMs: rows.length > 0 ? Math.round(duration / rows.length) : 0,
      clientCount: clients.size,
      errorCount,
      keyCount: keyIds.size,
      requestCount: rows.length
    },
    type: "dev.nipmod.api-usage-metrics.v1"
  };
}

function sortedCounts(map: Map<string, number>, keyName: string, limit: number): Array<Record<string, number | string>> {
  return [...map.entries()]
    .map(([key, requestCount]) => ({ [keyName]: key, requestCount }))
    .sort((left, right) => Number(right.requestCount) - Number(left.requestCount) || String(left[keyName]).localeCompare(String(right[keyName])))
    .slice(0, limit);
}

function metricSources(row: UsageMetricsEventRow): string[] {
  if (Array.isArray(row.sources) && row.sources.length > 0) {
    return row.sources.filter((source) => typeof source === "string" && source.length > 0);
  }
  return row.source ? [row.source] : [];
}

function isUsageMetricsEventRow(value: unknown): value is UsageMetricsEventRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const row = value as Partial<UsageMetricsEventRow>;
  return (
    typeof row.access_tier === "string" &&
    (typeof row.api_key_id === "string" || row.api_key_id === null) &&
    typeof row.client_hash === "string" &&
    typeof row.duration_ms === "number" &&
    (typeof row.error_code === "string" || row.error_code === null) &&
    (typeof row.package_hash === "string" || row.package_hash === null) &&
    typeof row.route === "string" &&
    (typeof row.source === "string" || row.source === null) &&
    (Array.isArray(row.sources) || row.sources === null) &&
    typeof row.status === "number"
  );
}

function summarizeResponse(value: unknown, request: Request): UsageSummary {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  const name = url.searchParams.get("name");
  const base: UsageSummary = {
    errorCode: null,
    packageHash: name ? hashValue(name) : null,
    queryHash: query ? hashValue(query) : null,
    resultCount: null,
    source: url.searchParams.get("source"),
    sources: readSources(url.searchParams.get("sources"))
  };

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return base;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.code === "string" && record.type === "dev.nipmod.api-error.v1") {
    return { ...base, errorCode: record.code };
  }
  if (typeof record.total === "number") {
    return {
      ...base,
      resultCount: record.total,
      sources: Array.isArray(record.sources) ? record.sources.filter((source): source is string => typeof source === "string") : base.sources
    };
  }
  const responseRecord = readRecord(record.record) ?? readRecord(record.package) ?? readRecord(record.archiveRecord);
  const source = readString(responseRecord?.source) ?? base.source;
  const packageName = readString(responseRecord?.name) ?? readString(responseRecord?.displayName) ?? name;
  return {
    ...base,
    packageHash: packageName ? hashValue(packageName) : base.packageHash,
    source
  };
}

function readSources(value: string | null): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function hashClient(request: Request, env: UsageEnv): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const userAgent = request.headers.get("user-agent")?.trim() ?? "unknown-agent";
  const salt = env[USAGE_HASH_SALT_ENV] ?? "nipmod-public-api";
  return hashValue(`${salt}:${forwarded || realIp || "anonymous"}:${userAgent}`).slice(0, 32);
}

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}
