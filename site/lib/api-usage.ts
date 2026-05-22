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
