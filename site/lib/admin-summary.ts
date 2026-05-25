import { readApiUsageMetrics } from "./api-usage";

type AdminSummaryEnv = Record<string, string | undefined>;

type CountRow = Record<string, unknown>;

const SUPABASE_URL_ENV = "NIPMOD_ARCHIVE_SUPABASE_URL";
const SUPABASE_SERVICE_ROLE_KEY_ENV = "NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY";
const ADMIN_SUMMARY_TIMEOUT_MS = 1_500;
const ARCHIVE_ROW_LIMIT = 5_000;
const KEY_ACTIVITY_EVENT_LIMIT = 5_000;
const KEY_ROW_LIMIT = 500;

export interface AdminSummaryInput {
  limit: number;
  since: Date;
}

export async function readAdminSummary(
  input: AdminSummaryInput,
  env: AdminSummaryEnv = process.env,
  fetchImpl: typeof fetch = fetch
): Promise<Record<string, unknown>> {
  const [usage, archive, keys, keyActivity] = await Promise.all([
    readApiUsageMetrics(input, env, fetchImpl),
    readArchiveMetrics(input, env, fetchImpl),
    readKeyMetrics(input, env, fetchImpl),
    readKeyActivityMetrics(input, env, fetchImpl)
  ]);

  return {
    archive,
    generatedAt: new Date().toISOString(),
    keyActivity,
    keys,
    notes: [
      "Archive records are stored in public.package_intelligence_records on Supabase.",
      "Usage metrics are aggregated and privacy limited. Raw keys, raw IPs, raw queries, prompts and workspace paths are not returned.",
      "Traffic origin separates public/keyed usage from Nipmod canaries and monitors for events recorded after the traffic-origin schema is live.",
      "Trust-decision and blocked-install metrics are populated for events recorded after the decision-metrics schema is live."
    ],
    privacy: "admin-only aggregated metrics; no raw keys, IPs, queries, prompts, package names from usage events, user agents or workspace data",
    since: input.since.toISOString(),
    type: "dev.nipmod.admin-summary.v1",
    usage: usage.ok ? usage.metrics : { error: usage.error, ok: false, status: usage.status }
  };
}

async function readKeyActivityMetrics(input: AdminSummaryInput, env: AdminSummaryEnv, fetchImpl: typeof fetch) {
  const status = storeStatus(env);
  if (!status.configured) {
    return {
      ...status,
      excludedAdminKeyRequestCount: 0,
      externalKeyCount: 0,
      privacy: "external key aggregates only; raw keys, raw IPs and raw queries are not returned",
      rows: []
    };
  }

  try {
    const [keyResponse, eventResponse] = await Promise.all([
      supabaseFetch(
        env,
        "/rest/v1/api_keys?select=id,label,tier,status,rate_limit_multiplier,created_at,expires_at,revoked_at&limit=" + KEY_ROW_LIMIT,
        fetchImpl
      ),
      supabaseFetch(env, keyActivityEventsPath(input.since), fetchImpl)
    ]);
    if (!keyResponse.ok || !eventResponse.ok) {
      throw new Error("key activity metrics unavailable");
    }
    const keyRows = await keyResponse.json();
    const eventRows = await eventResponse.json();
    const keyMap = new Map((Array.isArray(keyRows) ? keyRows.filter(isKeyMetricRow) : []).map((key) => [key.id, key]));
    const events = Array.isArray(eventRows) ? eventRows.filter(isKeyActivityEventRow) : [];
    const aggregates = new Map<string, KeyActivityAggregate>();
    let excludedAdminKeyRequestCount = 0;

    for (const event of events) {
      const origin = readTrafficOrigin(event.traffic_origin);
      if (origin === "authenticated_admin") {
        excludedAdminKeyRequestCount += 1;
        continue;
      }
      if (origin !== "authenticated_beta" && origin !== "authenticated_partner") {
        continue;
      }
      const keyId = event.api_key_id;
      if (!keyId) {
        continue;
      }
      const key = keyMap.get(keyId);
      const aggregate = aggregates.get(keyId) ?? createKeyActivityAggregate(keyId, key);
      aggregate.requestCount += 1;
      aggregate.successCount += event.status < 400 ? 1 : 0;
      aggregate.errorCount += event.status >= 400 ? 1 : 0;
      aggregate.lastSeenAt = latestIso(aggregate.lastSeenAt, event.created_at);
      aggregate.routes.set(event.route, (aggregate.routes.get(event.route) ?? 0) + 1);
      for (const source of metricSources(event)) {
        aggregate.sources.set(source, (aggregate.sources.get(source) ?? 0) + 1);
      }
      if (event.error_code) {
        aggregate.errors.set(event.error_code, (aggregate.errors.get(event.error_code) ?? 0) + 1);
      }
      aggregate.installPlanCount += event.install_blocked === null ? 0 : 1;
      aggregate.blockedInstallPlanCount += event.install_blocked === true ? 1 : 0;
      aggregate.archivePreviewCount += event.archive_stored === false ? 1 : 0;
      aggregate.archiveStoredCount += event.archive_stored === true ? 1 : 0;
      aggregate.trafficOrigins.set(origin, (aggregate.trafficOrigins.get(origin) ?? 0) + 1);
      aggregates.set(keyId, aggregate);
    }

    return {
      ...status,
      excludedAdminKeyRequestCount,
      externalKeyCount: aggregates.size,
      privacy: "external beta and partner key aggregates only; raw keys, raw IPs and raw queries are not returned",
      rows: [...aggregates.values()]
        .map(keyActivityRow)
        .sort((left, right) => right.requestCount - left.requestCount || String(right.lastSeenAt).localeCompare(String(left.lastSeenAt)))
        .slice(0, input.limit),
      type: "dev.nipmod.admin-key-activity.v1"
    };
  } catch {
    return {
      ...status,
      error: "key activity metrics are temporarily unavailable",
      excludedAdminKeyRequestCount: null,
      externalKeyCount: null,
      privacy: "external key aggregates only; raw keys, raw IPs and raw queries are not returned",
      rows: [],
      type: "dev.nipmod.admin-key-activity.v1"
    };
  }
}

async function readArchiveMetrics(input: AdminSummaryInput, env: AdminSummaryEnv, fetchImpl: typeof fetch) {
  const status = storeStatus(env);
  if (!status.configured) {
    return {
      ...status,
      recentRecords: [],
      sources: [],
      statuses: [],
      totalRecords: 0,
      trustBands: []
    };
  }

  try {
    const response = await supabaseFetch(
      env,
      "/rest/v1/package_intelligence_records?select=source,status,trust_score,updated_at,name,display_name,version,original_url&order=updated_at.desc&limit=" +
        ARCHIVE_ROW_LIMIT,
      fetchImpl
    );
    if (!response.ok) {
      throw new Error(`archive metrics unavailable: ${response.status}`);
    }
    const rows = await response.json();
    const records = Array.isArray(rows) ? rows.filter(isArchiveMetricRow) : [];
    return {
      ...status,
      recentRecords: records.slice(0, input.limit).map((record) => ({
        displayName: record.display_name,
        name: record.name,
        originalUrl: record.original_url,
        source: record.source,
        status: record.status,
        trustScore: record.trust_score,
        updatedAt: record.updated_at,
        version: record.version
      })),
      sources: sortedCounts(records, (row) => row.source, "source", input.limit),
      statuses: sortedCounts(records, (row) => row.status, "status", input.limit),
      totalRecords: countFromHeader(response.headers.get("content-range")) ?? records.length,
      trustBands: trustBands(records)
    };
  } catch {
    return {
      ...status,
      error: "archive metrics are temporarily unavailable",
      recentRecords: [],
      sources: [],
      statuses: [],
      totalRecords: null,
      trustBands: []
    };
  }
}

async function readKeyMetrics(input: AdminSummaryInput, env: AdminSummaryEnv, fetchImpl: typeof fetch) {
  const status = storeStatus(env);
  if (!status.configured) {
    return {
      ...status,
      activeCount: 0,
      recentKeys: [],
      revokedCount: 0,
      selfServeBetaCount: 0,
      tiers: [],
      totalKeys: 0
    };
  }

  try {
    const response = await supabaseFetch(
      env,
      "/rest/v1/api_keys?select=id,label,tier,status,rate_limit_multiplier,created_at,expires_at,revoked_at&order=created_at.desc&limit=" + KEY_ROW_LIMIT,
      fetchImpl
    );
    if (!response.ok) {
      throw new Error(`key metrics unavailable: ${response.status}`);
    }
    const rows = await response.json();
    const keys = Array.isArray(rows) ? rows.filter(isKeyMetricRow) : [];
    return {
      ...status,
      activeCount: keys.filter((key) => key.status === "active").length,
      recentKeys: keys.slice(0, input.limit).map((key) => ({
        createdAt: key.created_at,
        expiresAt: key.expires_at,
        id: key.id,
        label: key.label,
        rateLimitMultiplier: key.rate_limit_multiplier,
        revokedAt: key.revoked_at,
        status: key.status,
        tier: key.tier
      })),
      revokedCount: keys.filter((key) => key.status === "revoked").length,
      selfServeBetaCount: keys.filter((key) => key.tier === "beta" && key.label.startsWith("self-serve/")).length,
      tiers: sortedCounts(keys, (key) => key.tier, "tier", input.limit),
      totalKeys: countFromHeader(response.headers.get("content-range")) ?? keys.length
    };
  } catch {
    return {
      ...status,
      activeCount: null,
      error: "key metrics are temporarily unavailable",
      recentKeys: [],
      revokedCount: null,
      selfServeBetaCount: null,
      tiers: [],
      totalKeys: null
    };
  }
}

function storeStatus(env: AdminSummaryEnv) {
  const missing = [SUPABASE_URL_ENV, SUPABASE_SERVICE_ROLE_KEY_ENV].filter((key) => !env[key]);
  return {
    configured: missing.length === 0,
    driver: "supabase-rest",
    missing
  };
}

async function supabaseFetch(env: AdminSummaryEnv, path: string, fetchImpl: typeof fetch): Promise<Response> {
  const baseUrl = env[SUPABASE_URL_ENV];
  const serviceRoleKey = env[SUPABASE_SERVICE_ROLE_KEY_ENV];
  if (!baseUrl || !serviceRoleKey) {
    return Response.json({ error: "not configured" }, { status: 503 });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ADMIN_SUMMARY_TIMEOUT_MS);
  try {
    return await fetchImpl(`${baseUrl.replace(/\/$/, "")}${path}`, {
      headers: {
        Prefer: "count=exact",
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`
      },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function sortedCounts<T extends CountRow>(
  rows: T[],
  readKey: (row: T) => string,
  keyName: string,
  limit: number
): Array<Record<string, number | string>> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = readKey(row);
    if (!key) {
      continue;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ [keyName]: key, count }))
    .sort((left, right) => Number(right.count) - Number(left.count) || String(left[keyName]).localeCompare(String(right[keyName])))
    .slice(0, limit);
}

function sortedRequestCounts<Key extends string>(map: Map<Key, number>, keyName: string, limit: number): Array<Record<string, number | string>> {
  return [...map.entries()]
    .map(([key, requestCount]) => ({ [keyName]: key, requestCount }))
    .sort((left, right) => Number(right.requestCount) - Number(left.requestCount) || String(left[keyName]).localeCompare(String(right[keyName])))
    .slice(0, limit);
}

function keyActivityEventsPath(since: Date): string {
  const params = new URLSearchParams({
    api_key_id: "not.is.null",
    created_at: `gte.${since.toISOString()}`,
    limit: String(KEY_ACTIVITY_EVENT_LIMIT),
    order: "created_at.desc",
    select:
      "created_at,api_key_id,route,status,source,sources,error_code,traffic_origin,install_blocked,archive_stored,access_tier"
  });
  return `/rest/v1/api_usage_events?${params.toString()}`;
}

type KeyActivityEventRow = {
  access_tier: string;
  api_key_id: string;
  archive_stored: boolean | null;
  created_at: string;
  error_code: string | null;
  install_blocked: boolean | null;
  route: string;
  source: string | null;
  sources: string[] | null;
  status: number;
  traffic_origin: string | null;
};

type KeyActivityAggregate = {
  archivePreviewCount: number;
  archiveStoredCount: number;
  blockedInstallPlanCount: number;
  errorCount: number;
  errors: Map<string, number>;
  installPlanCount: number;
  keyId: string;
  label: string;
  lastSeenAt: string | null;
  requestCount: number;
  routes: Map<string, number>;
  sources: Map<string, number>;
  status: string;
  successCount: number;
  tier: string;
  trafficOrigins: Map<string, number>;
};

function createKeyActivityAggregate(keyId: string, key: KeyMetricRow | undefined): KeyActivityAggregate {
  return {
    archivePreviewCount: 0,
    archiveStoredCount: 0,
    blockedInstallPlanCount: 0,
    errorCount: 0,
    errors: new Map(),
    installPlanCount: 0,
    keyId,
    label: key?.label ?? "external key",
    lastSeenAt: null,
    requestCount: 0,
    routes: new Map(),
    sources: new Map(),
    status: key?.status ?? "unknown",
    successCount: 0,
    tier: key?.tier ?? "unknown",
    trafficOrigins: new Map()
  };
}

function keyActivityRow(aggregate: KeyActivityAggregate) {
  const routeRows = sortedRequestCounts(aggregate.routes, "route", 5);
  const sourceRows = sortedRequestCounts(aggregate.sources, "source", 5);
  const errorRows = sortedRequestCounts(aggregate.errors, "code", 5);
  return {
    archivePreviewCount: aggregate.archivePreviewCount,
    archiveStoredCount: aggregate.archiveStoredCount,
    blockedInstallPlanCount: aggregate.blockedInstallPlanCount,
    errorCount: aggregate.errorCount,
    errorRate: aggregate.requestCount > 0 ? Number((aggregate.errorCount / aggregate.requestCount).toFixed(3)) : 0,
    errors: errorRows,
    errorSummary: summarizeRows(errorRows, "code"),
    installPlanCount: aggregate.installPlanCount,
    keyId: aggregate.keyId,
    label: aggregate.label,
    lastSeenAt: aggregate.lastSeenAt,
    requestCount: aggregate.requestCount,
    routes: routeRows,
    routeSummary: summarizeRows(routeRows, "route"),
    sources: sourceRows,
    sourceSummary: summarizeRows(sourceRows, "source"),
    status: aggregate.status,
    successCount: aggregate.successCount,
    tier: aggregate.tier,
    trafficOrigins: sortedRequestCounts(aggregate.trafficOrigins, "origin", 5)
  };
}

function summarizeRows(rows: Array<Record<string, number | string>>, keyName: string): string {
  return rows.map((row) => `${row[keyName]} ${row.requestCount}`).join(", ");
}

function latestIso(left: string | null, right: string): string {
  if (!left || Date.parse(right) > Date.parse(left)) {
    return right;
  }
  return left;
}

function metricSources(row: KeyActivityEventRow): string[] {
  const fromSources = Array.isArray(row.sources) ? row.sources.filter((source): source is string => typeof source === "string" && source.length > 0) : [];
  if (fromSources.length > 0) {
    return [...new Set(fromSources)];
  }
  return row.source ? [row.source] : [];
}

function readTrafficOrigin(value: string | null): string {
  return value ?? "unknown_legacy";
}

function isKeyActivityEventRow(value: unknown): value is KeyActivityEventRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const row = value as Partial<KeyActivityEventRow>;
  return (
    typeof row.access_tier === "string" &&
    typeof row.api_key_id === "string" &&
    (typeof row.archive_stored === "boolean" || row.archive_stored === null) &&
    typeof row.created_at === "string" &&
    (typeof row.error_code === "string" || row.error_code === null) &&
    (typeof row.install_blocked === "boolean" || row.install_blocked === null) &&
    typeof row.route === "string" &&
    (typeof row.source === "string" || row.source === null) &&
    (Array.isArray(row.sources) || row.sources === null) &&
    typeof row.status === "number" &&
    (typeof row.traffic_origin === "string" || row.traffic_origin === null)
  );
}

function trustBands(rows: ArchiveMetricRow[]) {
  const bands = [
    { count: 0, label: "90-100" },
    { count: 0, label: "70-89" },
    { count: 0, label: "50-69" },
    { count: 0, label: "0-49" }
  ];
  for (const row of rows) {
    if (row.trust_score >= 90) {
      bands[0]!.count += 1;
    } else if (row.trust_score >= 70) {
      bands[1]!.count += 1;
    } else if (row.trust_score >= 50) {
      bands[2]!.count += 1;
    } else {
      bands[3]!.count += 1;
    }
  }
  return bands;
}

function countFromHeader(value: string | null): number | null {
  const match = value?.match(/\/(\d+)$/);
  return match ? Number.parseInt(match[1]!, 10) : null;
}

type ArchiveMetricRow = {
  display_name: string;
  name: string;
  original_url: string;
  source: string;
  status: string;
  trust_score: number;
  updated_at: string;
  version: string | null;
};

type KeyMetricRow = {
  created_at: string;
  expires_at: string | null;
  id: string;
  label: string;
  rate_limit_multiplier: number;
  revoked_at: string | null;
  status: string;
  tier: string;
};

function isArchiveMetricRow(value: unknown): value is ArchiveMetricRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const row = value as Partial<ArchiveMetricRow>;
  return (
    typeof row.display_name === "string" &&
    typeof row.name === "string" &&
    typeof row.original_url === "string" &&
    typeof row.source === "string" &&
    typeof row.status === "string" &&
    typeof row.trust_score === "number" &&
    typeof row.updated_at === "string" &&
    (typeof row.version === "string" || row.version === null)
  );
}

function isKeyMetricRow(value: unknown): value is KeyMetricRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const row = value as Partial<KeyMetricRow>;
  return (
    typeof row.created_at === "string" &&
    (typeof row.expires_at === "string" || row.expires_at === null) &&
    typeof row.id === "string" &&
    typeof row.label === "string" &&
    typeof row.rate_limit_multiplier === "number" &&
    (typeof row.revoked_at === "string" || row.revoked_at === null) &&
    typeof row.status === "string" &&
    typeof row.tier === "string"
  );
}
