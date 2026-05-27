import { EXTERNAL_PACKAGE_SOURCES, externalSourceCapabilities } from "./external-packages";

type PublicStatsEnv = Record<string, string | undefined>;

const SUPABASE_URL_ENV = "NIPMOD_ARCHIVE_SUPABASE_URL";
const SUPABASE_SERVICE_ROLE_KEY_ENV = "NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY";
const PUBLIC_STATS_EVENT_LIMIT = 5_000;
const PUBLIC_STATS_TIMEOUT_MS = 1_500;
const PUBLIC_STATS_EVENT_SELECT =
  "created_at,api_key_id,client_hash,route,status,source,sources,error_code,traffic_origin,trust_decision,trust_risk,install_blocked,archive_stored";

export interface PublicStatsInput {
  hours: number;
}

export async function readPublicStats(input: PublicStatsInput, env: PublicStatsEnv = process.env, fetchImpl: typeof fetch = fetch) {
  const safeHours = safeWindowHours(input.hours);
  const since = new Date(Date.now() - safeHours * 60 * 60 * 1000);
  const store = storeStatus(env);
  const sourceCapabilities = externalSourceCapabilities();
  const base = {
    generatedAt: new Date().toISOString(),
    health: {
      availableSources: sourceCapabilities.length,
      sources: sourceCapabilities.map((source) => ({
        source: source.source,
        status: source.status
      })),
      workspaceWritesFromHostedApi: false
    },
    privacy:
      "public aggregate metrics only; control-plane routes, internal monitors, canaries and unknown legacy events are excluded from external usage counts",
    since: since.toISOString(),
    store: {
      configured: store.configured,
      driver: "supabase-rest" as const,
      missing: store.missing
    },
    type: "dev.nipmod.public-stats.v1",
    windowHours: safeHours
  };

  if (!store.configured) {
    const archive = emptyArchiveStats();
    const betaKeys = { activeCount: 0 };
    const excluded = emptyExcludedStats();
    const external = emptyExternalStats();
    return {
      ...base,
      archive,
      betaKeys,
      excluded,
      external,
      recap: buildPublicRecap({ archive, betaKeys, excluded, external, windowHours: safeHours })
    };
  }

  const [events, archive, betaKeys] = await Promise.all([
    readUsageEvents(since, env, fetchImpl),
    readArchiveStats(env, fetchImpl),
    readActiveBetaKeyCount(env, fetchImpl)
  ]);
  const eventRows = events.ok ? events.rows : [];
  const external = buildExternalStats(eventRows);
  const excluded = buildExcludedStats(eventRows);

  return {
    ...base,
    archive,
    betaKeys: {
      activeCount: betaKeys
    },
    excluded,
    external,
    recap: buildPublicRecap({
      archive,
      betaKeys: {
        activeCount: betaKeys
      },
      excluded,
      external,
      windowHours: safeHours
    })
  };
}

function safeWindowHours(value: number): number {
  return Number.isFinite(value) && value >= 1 && value <= 168 ? Math.trunc(value) : 24;
}

async function readUsageEvents(
  since: Date,
  env: PublicStatsEnv,
  fetchImpl: typeof fetch
): Promise<{ ok: true; rows: PublicStatsEventRow[] } | { ok: false; rows: [] }> {
  const responses = await Promise.all([
    supabaseFetch(env, publicStatsEventsPath(since, "external"), fetchImpl),
    supabaseFetch(env, publicStatsEventsPath(since, "internal"), fetchImpl),
    supabaseFetch(env, publicStatsEventsPath(since, "unknown-null"), fetchImpl),
    supabaseFetch(env, publicStatsEventsPath(since, "unknown-legacy"), fetchImpl)
  ]);
  if (responses.some((response) => !response.ok)) {
    return { ok: false, rows: [] };
  }
  const groups = await Promise.all(responses.map((response) => response.json()));
  return {
    ok: true,
    rows: groups.flatMap((rows) => (Array.isArray(rows) ? rows.filter(isPublicStatsEventRow) : []))
  };
}

async function readArchiveStats(env: PublicStatsEnv, fetchImpl: typeof fetch) {
  try {
    const response = await supabaseFetch(
      env,
      "/rest/v1/package_intelligence_records?select=source,status,trust_score&limit=5000",
      fetchImpl
    );
    if (!response.ok) {
      throw new Error("archive stats unavailable");
    }
    const rows = await response.json();
    const records = Array.isArray(rows) ? rows.filter(isArchiveStatsRow) : [];
    return {
      confirmedRecords: countFromHeader(response.headers.get("content-range")) ?? records.length,
      sources: sortedRequestCounts(countBy(records, (row) => row.source), "source", EXTERNAL_PACKAGE_SOURCES.length),
      statuses: sortedRequestCounts(countBy(records, (row) => row.status), "status", 10),
      trustBands: trustBands(records)
    };
  } catch {
    return emptyArchiveStats();
  }
}

async function readActiveBetaKeyCount(env: PublicStatsEnv, fetchImpl: typeof fetch): Promise<number> {
  try {
    const response = await supabaseFetch(
      env,
      "/rest/v1/api_keys?select=id&status=eq.active&tier=eq.beta&label=like.self-serve/%25&limit=1000",
      fetchImpl
    );
    if (!response.ok) {
      return 0;
    }
    const rows = await response.json();
    return countFromHeader(response.headers.get("content-range")) ?? (Array.isArray(rows) ? rows.length : 0);
  } catch {
    return 0;
  }
}

function buildExternalStats(rows: PublicStatsEventRow[]) {
  const externalRows = rows.filter((row) => isExternalOrigin(row.traffic_origin) && !isControlPlaneRoute(row.route));
  const clients = new Set<string>();
  const keys = new Set<string>();
  const routes = new Map<string, number>();
  const sources = new Map<string, number>();
  const errors = new Map<string, number>();
  const trustDecisions = new Map<string, number>();
  const trustRisks = new Map<string, number>();
  let successCount = 0;
  let errorCount = 0;
  let publicRequestCount = 0;
  let authenticatedRequestCount = 0;
  let installPlanCount = 0;
  let blockedInstallPlanCount = 0;
  let archivePreviewCount = 0;
  let archiveStoredCount = 0;

  for (const row of externalRows) {
    if (row.client_hash) {
      clients.add(row.client_hash);
    }
    if (row.api_key_id && (row.traffic_origin === "authenticated_beta" || row.traffic_origin === "authenticated_partner")) {
      keys.add(row.api_key_id);
    }
    if (row.status >= 400) {
      errorCount += 1;
    } else {
      successCount += 1;
    }
    if (row.traffic_origin === "public") {
      publicRequestCount += 1;
    } else {
      authenticatedRequestCount += 1;
    }
    routes.set(row.route, (routes.get(row.route) ?? 0) + 1);
    for (const source of metricSources(row)) {
      sources.set(source, (sources.get(source) ?? 0) + 1);
    }
    if (row.error_code) {
      errors.set(row.error_code, (errors.get(row.error_code) ?? 0) + 1);
    }
    if (row.trust_decision) {
      trustDecisions.set(row.trust_decision, (trustDecisions.get(row.trust_decision) ?? 0) + 1);
    }
    if (row.trust_risk) {
      trustRisks.set(row.trust_risk, (trustRisks.get(row.trust_risk) ?? 0) + 1);
    }
    installPlanCount += row.install_blocked === null ? 0 : 1;
    blockedInstallPlanCount += row.install_blocked === true ? 1 : 0;
    archivePreviewCount += row.archive_stored === false ? 1 : 0;
    archiveStoredCount += row.archive_stored === true ? 1 : 0;
  }

  return {
    activeKeyCount: keys.size,
    archivePreviewCount,
    archiveStoredCount,
    authenticatedRequestCount,
    blockedInstallPlanCount,
    errorCount,
    errors: sortedRequestCounts(errors, "code", 10),
    installPlanCount,
    publicRequestCount,
    requestCount: externalRows.length,
    routes: sortedRequestCounts(routes, "route", 10),
    sources: sortedRequestCounts(sources, "source", EXTERNAL_PACKAGE_SOURCES.length),
    successCount,
    trustDecisions: sortedRequestCounts(trustDecisions, "decision", 10),
    trustRisks: sortedRequestCounts(trustRisks, "risk", 10),
    uniqueClientCount: clients.size
  };
}

function buildExcludedStats(rows: PublicStatsEventRow[]) {
  return {
    controlPlaneRequestCount: rows.filter((row) => isControlPlaneRoute(row.route)).length,
    internalRequestCount: rows.filter((row) => isInternalOrigin(row.traffic_origin) && !isControlPlaneRoute(row.route)).length,
    unknownLegacyRequestCount: rows.filter((row) => (row.traffic_origin === null || row.traffic_origin === "unknown_legacy") && !isControlPlaneRoute(row.route)).length
  };
}

function emptyExcludedStats() {
  return {
    controlPlaneRequestCount: 0,
    internalRequestCount: 0,
    unknownLegacyRequestCount: 0
  };
}

function emptyExternalStats() {
  return {
    activeKeyCount: 0,
    archivePreviewCount: 0,
    archiveStoredCount: 0,
    authenticatedRequestCount: 0,
    blockedInstallPlanCount: 0,
    errorCount: 0,
    errors: [],
    installPlanCount: 0,
    publicRequestCount: 0,
    requestCount: 0,
    routes: [],
    sources: [],
    successCount: 0,
    trustDecisions: [],
    trustRisks: [],
    uniqueClientCount: 0
  };
}

function emptyArchiveStats() {
  return {
    confirmedRecords: 0,
    sources: [],
    statuses: [],
    trustBands: [
      { count: 0, label: "90-100" },
      { count: 0, label: "70-89" },
      { count: 0, label: "50-69" },
      { count: 0, label: "0-49" }
    ]
  };
}

function buildPublicRecap(input: {
  archive: ReturnType<typeof emptyArchiveStats> | Awaited<ReturnType<typeof readArchiveStats>>;
  betaKeys: { activeCount: number };
  excluded: ReturnType<typeof emptyExcludedStats>;
  external: ReturnType<typeof emptyExternalStats> | ReturnType<typeof buildExternalStats>;
  windowHours: number;
}) {
  const hasMeaningfulUsage =
    input.external.authenticatedRequestCount > 0 ||
    input.external.installPlanCount > 0 ||
    input.external.archiveStoredCount > 0 ||
    input.archive.confirmedRecords > 0;
  const hasQualitySignal =
    input.external.trustDecisions.length > 0 ||
    input.external.trustRisks.length > 0 ||
    input.external.blockedInstallPlanCount > 0;
  const publicShareRecommended = hasMeaningfulUsage && (input.external.requestCount >= 10 || hasQualitySignal);
  const bullets = [
    `${input.external.requestCount} external API requests in ${input.windowHours}h`,
    `${input.external.authenticatedRequestCount} authenticated beta or partner requests`,
    `${input.external.activeKeyCount} external keys observed`,
    `${input.betaKeys.activeCount} active self-serve beta keys`,
    `${input.external.installPlanCount} install plans returned`,
    `${input.external.blockedInstallPlanCount} install plans blocked`,
    `${input.external.archiveStoredCount} archive records stored from confirmed useful results`,
    `${input.archive.confirmedRecords} confirmed package intelligence records in archive`
  ];
  return {
    bullets,
    draft: publicShareRecommended
      ? [
          `Nipmod ${input.windowHours}h operator snapshot:`,
          ...bullets.map((bullet) => `- ${bullet}`),
          "",
          "These are public-safe aggregates only. Internal monitors, canaries, admin routes and old legacy events are excluded."
        ].join("\n")
      : null,
    exclusions: [
      `${input.excluded.controlPlaneRequestCount} control-plane requests excluded`,
      `${input.excluded.internalRequestCount} internal monitor or canary requests excluded`,
      `${input.excluded.unknownLegacyRequestCount} unknown legacy events excluded`
    ],
    headline: publicShareRecommended ? "Public recap is safe to draft" : "No public recap recommended yet",
    publicShareRecommended,
    privacy:
      "recap contains only public aggregate counts; no raw API keys, IPs, user agents, prompts, workspace paths, package hashes or private package names"
  };
}

function publicStatsEventsPath(since: Date, bucket: "external" | "internal" | "unknown-null" | "unknown-legacy"): string {
  const params = new URLSearchParams({
    created_at: `gte.${since.toISOString()}`,
    limit: String(PUBLIC_STATS_EVENT_LIMIT),
    order: "created_at.desc",
    select: PUBLIC_STATS_EVENT_SELECT
  });
  if (bucket === "external") {
    params.set("traffic_origin", "in.(public,authenticated_beta,authenticated_partner)");
  } else if (bucket === "internal") {
    params.set("traffic_origin", "in.(authenticated_admin,internal_canary,internal_monitor,internal_operator)");
  } else if (bucket === "unknown-null") {
    params.set("traffic_origin", "is.null");
  } else {
    params.set("traffic_origin", "eq.unknown_legacy");
  }
  return `/rest/v1/api_usage_events?${params.toString()}`;
}

async function supabaseFetch(env: PublicStatsEnv, path: string, fetchImpl: typeof fetch): Promise<Response> {
  const baseUrl = env[SUPABASE_URL_ENV];
  const serviceRoleKey = env[SUPABASE_SERVICE_ROLE_KEY_ENV];
  if (!baseUrl || !serviceRoleKey) {
    return Response.json({ error: "not configured" }, { status: 503 });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PUBLIC_STATS_TIMEOUT_MS);
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

function storeStatus(env: PublicStatsEnv) {
  const missing = [SUPABASE_URL_ENV, SUPABASE_SERVICE_ROLE_KEY_ENV].filter((key) => !env[key]);
  return {
    configured: missing.length === 0,
    missing
  };
}

type PublicStatsEventRow = {
  api_key_id: string | null;
  archive_stored: boolean | null;
  client_hash: string | null;
  created_at: string;
  error_code: string | null;
  install_blocked: boolean | null;
  route: string;
  source: string | null;
  sources: string[] | null;
  status: number;
  traffic_origin: string | null;
  trust_decision: string | null;
  trust_risk: string | null;
};

type ArchiveStatsRow = {
  source: string;
  status: string;
  trust_score: number;
};

function isPublicStatsEventRow(value: unknown): value is PublicStatsEventRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const row = value as Partial<PublicStatsEventRow>;
  return (
    (typeof row.api_key_id === "string" || row.api_key_id === null) &&
    (typeof row.archive_stored === "boolean" || row.archive_stored === null) &&
    (typeof row.client_hash === "string" || row.client_hash === null) &&
    typeof row.created_at === "string" &&
    (typeof row.error_code === "string" || row.error_code === null) &&
    (typeof row.install_blocked === "boolean" || row.install_blocked === null) &&
    typeof row.route === "string" &&
    (typeof row.source === "string" || row.source === null) &&
    (Array.isArray(row.sources) || row.sources === null) &&
    typeof row.status === "number" &&
    (typeof row.traffic_origin === "string" || row.traffic_origin === null) &&
    (typeof row.trust_decision === "string" || row.trust_decision === null) &&
    (typeof row.trust_risk === "string" || row.trust_risk === null)
  );
}

function isArchiveStatsRow(value: unknown): value is ArchiveStatsRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const row = value as Partial<ArchiveStatsRow>;
  return typeof row.source === "string" && typeof row.status === "string" && typeof row.trust_score === "number";
}

function isExternalOrigin(value: string | null): boolean {
  return value === "public" || value === "authenticated_beta" || value === "authenticated_partner";
}

function isInternalOrigin(value: string | null): boolean {
  return value === "authenticated_admin" || value === "internal_canary" || value === "internal_monitor" || value === "internal_operator";
}

function isControlPlaneRoute(route: string): boolean {
  return route === "/api/stats" || route === "/api/usage/stats" || route.startsWith("/api/admin/");
}

function metricSources(row: PublicStatsEventRow): string[] {
  const fromSources = Array.isArray(row.sources) ? row.sources.filter((source): source is string => typeof source === "string" && source.length > 0) : [];
  if (fromSources.length > 0) {
    return [...new Set(fromSources)];
  }
  return row.source ? [row.source] : [];
}

function countBy<T>(rows: T[], readKey: (row: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = readKey(row);
    if (key) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

function sortedRequestCounts<Key extends string>(map: Map<Key, number>, keyName: string, limit: number): Array<Record<string, number | string>> {
  return [...map.entries()]
    .map(([key, requestCount]) => ({ [keyName]: key, requestCount }))
    .sort((left, right) => Number(right.requestCount) - Number(left.requestCount) || String(left[keyName]).localeCompare(String(right[keyName])))
    .slice(0, limit);
}

function trustBands(rows: ArchiveStatsRow[]) {
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
