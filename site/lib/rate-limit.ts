import { webcrypto } from "node:crypto";
import { readAdminPasswordAccess } from "./admin-access";
import { type ApiCorsPolicy, type ApiHttpContext, apiJson, createApiHttpContext } from "./api-http";
import { publicApiAccess, readApiAccess, readApiAccessAsync, type ApiAccess } from "./api-auth";

export type RateLimitPolicy = {
  limit: number;
  name: string;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  access: ApiAccess;
  fallbackReason?: RateLimitFallbackReason | null;
  headers: Record<string, string>;
  ok: boolean;
  response?: Response;
};

export type RateLimitEnv = Record<string, string | undefined>;
type RateLimitStore = "memory" | "memory-fallback" | "supabase";
export type RateLimitFallbackReason =
  | "distributed_rpc_http_401"
  | "distributed_rpc_http_403"
  | "distributed_rpc_http_404"
  | "distributed_rpc_http_5xx"
  | "distributed_rpc_invalid_json"
  | "distributed_rpc_invalid_shape"
  | "distributed_rpc_network_error"
  | "distributed_rpc_timeout"
  | "distributed_rpc_unavailable";
type DistributedRateLimitRow = {
  allowed: boolean;
  count: number;
  remaining: number;
  reset_at: string;
};
type DistributedRateLimitResult =
  | {
      row: DistributedRateLimitRow;
      fallbackReason: null;
    }
  | {
      row: null;
      fallbackReason: RateLimitFallbackReason | null;
    };
type RateLimitCheckOptions = {
  allowAdminPassword?: boolean;
  corsPolicy?: ApiCorsPolicy | undefined;
  env?: RateLimitEnv;
  fetchImpl?: typeof fetch;
  requireApiKey?: boolean;
  timeoutMs?: number;
};
export type NamedRateLimitResult = {
  count: number;
  fallbackReason: RateLimitFallbackReason | null;
  ok: boolean;
  remaining: number;
  resetAt: string;
  store: RateLimitStore;
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;
const SUPABASE_URL_ENV = "NIPMOD_ARCHIVE_SUPABASE_URL";
const SUPABASE_SERVICE_ROLE_KEY_ENV = "NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY";
const RATE_LIMIT_STORE_ENV = "NIPMOD_RATE_LIMIT_STORE";
const DISTRIBUTED_RATE_LIMIT_TIMEOUT_MS = 700;

export function checkRateLimit(request: Request, policy: RateLimitPolicy, context: ApiHttpContext = createApiHttpContext(request)): RateLimitResult {
  return checkRateLimitForAccess(request, policy, context, publicApiAccess(), "memory");
}

export function checkApiRateLimit(request: Request, policy: RateLimitPolicy, context: ApiHttpContext = createApiHttpContext(request)): RateLimitResult {
  const access = readApiAccess(request, context);
  if (!access.ok) {
    const authFailureLimit = checkAuthFailureRateLimit(request, policy, context);
    if (!authFailureLimit.ok) {
      return authFailureLimit;
    }
    return {
      access: access.access,
      headers: access.access.headers,
      ok: false,
      response: access.response!
    };
  }
  return checkRateLimitForAccess(request, policy, context, access.access, "memory");
}

export async function checkApiRateLimitAsync(
  request: Request,
  policy: RateLimitPolicy,
  context: ApiHttpContext = createApiHttpContext(request),
  options: RateLimitCheckOptions = {}
): Promise<RateLimitResult> {
  const adminPasswordAccess = options.allowAdminPassword ? readAdminPasswordAccess(request, options.env) : null;
  const access = adminPasswordAccess
    ? { access: adminPasswordAccess, ok: true }
    : await readApiAccessAsync(request, context, options.env, options.fetchImpl, options.timeoutMs, {
        corsPolicy: options.corsPolicy
      });
  if (!access.ok) {
    const authFailureLimit = checkAuthFailureRateLimit(request, policy, context, options.corsPolicy);
    if (!authFailureLimit.ok) {
      return authFailureLimit;
    }
    return {
      access: access.access,
      headers: access.access.headers,
      ok: false,
      response: access.response!
    };
  }

  if (options.requireApiKey === true && !access.access.authenticated) {
    return {
      access: access.access,
      headers: access.access.headers,
      ok: false,
      response: apiJson(
        {
          code: "api_key_required",
          error: "API key is required for this endpoint",
          retryable: false,
          source: null,
          status: 401,
          type: "dev.nipmod.api-error.v1"
        },
        {
          context,
          corsPolicy: options.corsPolicy,
          headers: access.access.headers,
          status: 401
        }
      )
    };
  }

  const effectivePolicy = effectiveRateLimitPolicy(policy, access.access);
  const distributed = await consumeDistributedRateLimit(request, effectivePolicy, access.access, options);
  if (distributed.row) {
    return rateLimitResultFromBucket({
      access: access.access,
      allowed: distributed.row.allowed,
      context,
      count: distributed.row.count,
      policy,
      effectivePolicy,
      remaining: distributed.row.remaining,
      resetAt: Date.parse(distributed.row.reset_at),
      store: "supabase",
      corsPolicy: options.corsPolicy
    });
  }

  return checkRateLimitForAccess(request, policy, context, access.access, "memory-fallback", distributed.fallbackReason, options.corsPolicy);
}

export async function consumeNamedRateLimitAsync(
  identifier: string,
  policy: RateLimitPolicy,
  options: Pick<RateLimitCheckOptions, "env" | "fetchImpl" | "timeoutMs"> = {}
): Promise<NamedRateLimitResult> {
  const now = Date.now();
  const safePolicy = {
    ...policy,
    limit: Math.max(0, Math.floor(policy.limit)),
    windowMs: Math.max(1000, Math.floor(policy.windowMs))
  };
  if (safePolicy.limit <= 0) {
    return {
      count: 0,
      fallbackReason: null,
      ok: false,
      remaining: 0,
      resetAt: new Date(now + safePolicy.windowMs).toISOString(),
      store: "memory"
    };
  }

  const distributed = await consumeDistributedRateLimitForIdentifier(identifier, safePolicy, options);
  if (distributed.row) {
    return {
      count: distributed.row.count,
      fallbackReason: null,
      ok: distributed.row.allowed,
      remaining: distributed.row.remaining,
      resetAt: distributed.row.reset_at,
      store: "supabase"
    };
  }

  pruneBuckets(now);
  const key = `named:${safePolicy.name}:${identifier}`;
  const existing = buckets.get(key);
  const bucket = existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + safePolicy.windowMs };
  bucket.count += 1;
  buckets.set(key, bucket);
  return {
    count: bucket.count,
    fallbackReason: distributed.fallbackReason,
    ok: bucket.count <= safePolicy.limit,
    remaining: Math.max(0, safePolicy.limit - bucket.count),
    resetAt: new Date(bucket.resetAt).toISOString(),
    store: distributed.fallbackReason ? "memory-fallback" : "memory"
  };
}

export function rateLimitStoreStatus(env: RateLimitEnv = process.env): {
  configured: boolean;
  driver: "supabase-rpc";
  fallback: "memory";
  missing: string[];
  type: "dev.nipmod.rate-limit-store-status.v1";
} {
  const missing = [SUPABASE_URL_ENV, SUPABASE_SERVICE_ROLE_KEY_ENV].filter((key) => !env[key]);
  return {
    configured: missing.length === 0 && env[RATE_LIMIT_STORE_ENV] !== "memory",
    driver: "supabase-rpc",
    fallback: "memory",
    missing,
    type: "dev.nipmod.rate-limit-store-status.v1"
  };
}

function checkRateLimitForAccess(
  request: Request,
  policy: RateLimitPolicy,
  context: ApiHttpContext,
  access: ApiAccess,
  store: RateLimitStore,
  fallbackReason: RateLimitFallbackReason | null = null,
  corsPolicy?: ApiCorsPolicy
): RateLimitResult {
  const now = Date.now();
  pruneBuckets(now);

  const effectivePolicy = effectiveRateLimitPolicy(policy, access);
  const client = access.keyId ?? clientKey(request);
  const key = `${effectivePolicy.name}:${client}`;
  const existing = buckets.get(key);
  const bucket = existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + effectivePolicy.windowMs };
  bucket.count += 1;
  buckets.set(key, bucket);

  const remaining = Math.max(0, effectivePolicy.limit - bucket.count);
  return rateLimitResultFromBucket({
    access,
    context,
    count: bucket.count,
    policy,
    effectivePolicy,
    remaining,
    resetAt: bucket.resetAt,
    store,
    fallbackReason,
    corsPolicy
  });
}

function rateLimitResultFromBucket(input: {
  access: ApiAccess;
  allowed?: boolean;
  context: ApiHttpContext;
  count: number;
  effectivePolicy: RateLimitPolicy;
  policy: RateLimitPolicy;
  remaining: number;
  resetAt: number;
  store: RateLimitStore;
  corsPolicy?: ApiCorsPolicy | undefined;
  fallbackReason?: RateLimitFallbackReason | null;
}): RateLimitResult {
  const resetSeconds = Math.max(1, Math.ceil((input.resetAt - Date.now()) / 1000));
  const headers = {
    ...rateLimitHeaders(input.effectivePolicy, input.remaining, input.resetAt, input.store, input.fallbackReason),
    ...input.access.headers
  };

  if (input.allowed === false || input.count > input.effectivePolicy.limit) {
    return {
      access: input.access,
      fallbackReason: input.fallbackReason ?? null,
      headers,
      ok: false,
      response: apiJson(
        {
          code: "rate_limited",
          error: `rate limit exceeded for ${input.policy.name}`,
          retryable: true,
          source: null,
          status: 429,
          type: "dev.nipmod.api-error.v1"
        },
        {
          context: input.context,
          corsPolicy: input.corsPolicy,
          headers: {
            ...headers,
            "retry-after": String(resetSeconds)
          },
          status: 429
        }
      )
    };
  }

  return { access: input.access, fallbackReason: input.fallbackReason ?? null, headers, ok: true };
}

function effectiveRateLimitPolicy(policy: RateLimitPolicy, access: ApiAccess): RateLimitPolicy {
  return {
    ...policy,
    limit: Math.min(50_000, Math.max(policy.limit, Math.floor(policy.limit * access.limitMultiplier)))
  };
}

function checkAuthFailureRateLimit(
  request: Request,
  policy: RateLimitPolicy,
  context: ApiHttpContext,
  corsPolicy?: ApiCorsPolicy
): RateLimitResult {
  return checkRateLimitForAccess(
    request,
    {
      limit: Math.max(1, Math.min(policy.limit, 30)),
      name: `${policy.name}-auth-failure`,
      windowMs: Math.max(policy.windowMs, 60_000)
    },
    context,
    publicApiAccess(),
    "memory",
    null,
    corsPolicy
  );
}

function rateLimitHeaders(
  policy: RateLimitPolicy,
  remaining: number,
  resetAt: number,
  store: RateLimitStore,
  fallbackReason: RateLimitFallbackReason | null = null
): Record<string, string> {
  return {
    "x-ratelimit-limit": String(policy.limit),
    "x-ratelimit-policy": policy.name,
    "x-ratelimit-remaining": String(remaining),
    "x-ratelimit-reset": new Date(resetAt).toISOString(),
    "x-ratelimit-store": store,
    ...(fallbackReason ? { "x-ratelimit-fallback-reason": fallbackReason } : {})
  };
}

async function consumeDistributedRateLimit(
  request: Request,
  policy: RateLimitPolicy,
  access: ApiAccess,
  options: RateLimitCheckOptions
): Promise<DistributedRateLimitResult> {
  const env = options.env ?? process.env;
  const status = rateLimitStoreStatus(env);
  if (!status.configured) {
    return { fallbackReason: null, row: null };
  }
  const baseUrl = env[SUPABASE_URL_ENV]!;
  const serviceRoleKey = env[SUPABASE_SERVICE_ROLE_KEY_ENV]!;

  const clientHash = await keyedDigest(`key-or-client:${access.keyId ?? clientKey(request)}`, serviceRoleKey);
  const bucketKey = await keyedDigest(`bucket:${policy.name}:${clientHash}`, serviceRoleKey);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DISTRIBUTED_RATE_LIMIT_TIMEOUT_MS);
  try {
    const response = await (options.fetchImpl ?? fetch)(`${baseUrl.replace(/\/$/, "")}/rest/v1/rpc/consume_api_rate_limit`, {
      body: JSON.stringify({
        p_bucket_key: bucketKey,
        p_client_hash: clientHash,
        p_limit_count: policy.limit,
        p_policy: policy.name,
        p_window_ms: policy.windowMs
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
      return { fallbackReason: httpFallbackReason(response.status), row: null };
    }
    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text ? (JSON.parse(text) as unknown) : null;
    } catch {
      return { fallbackReason: "distributed_rpc_invalid_json", row: null };
    }
    const row = Array.isArray(parsed) ? parsed.at(0) : parsed;
    return isDistributedRateLimitRow(row)
      ? { fallbackReason: null, row }
      : { fallbackReason: "distributed_rpc_invalid_shape", row: null };
  } catch (error) {
    return {
      fallbackReason: error instanceof DOMException && error.name === "AbortError" ? "distributed_rpc_timeout" : "distributed_rpc_network_error",
      row: null
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function consumeDistributedRateLimitForIdentifier(
  identifier: string,
  policy: RateLimitPolicy,
  options: Pick<RateLimitCheckOptions, "env" | "fetchImpl" | "timeoutMs">
): Promise<DistributedRateLimitResult> {
  const env = options.env ?? process.env;
  const status = rateLimitStoreStatus(env);
  if (!status.configured) {
    return { fallbackReason: null, row: null };
  }
  const baseUrl = env[SUPABASE_URL_ENV]!;
  const serviceRoleKey = env[SUPABASE_SERVICE_ROLE_KEY_ENV]!;
  const clientHash = await keyedDigest(`named:${identifier}`, serviceRoleKey);
  const bucketKey = await keyedDigest(`bucket:${policy.name}:${clientHash}`, serviceRoleKey);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DISTRIBUTED_RATE_LIMIT_TIMEOUT_MS);
  try {
    const response = await (options.fetchImpl ?? fetch)(`${baseUrl.replace(/\/$/, "")}/rest/v1/rpc/consume_api_rate_limit`, {
      body: JSON.stringify({
        p_bucket_key: bucketKey,
        p_client_hash: clientHash,
        p_limit_count: policy.limit,
        p_policy: policy.name,
        p_window_ms: policy.windowMs
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
      return { fallbackReason: httpFallbackReason(response.status), row: null };
    }
    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text ? (JSON.parse(text) as unknown) : null;
    } catch {
      return { fallbackReason: "distributed_rpc_invalid_json", row: null };
    }
    const row = Array.isArray(parsed) ? parsed.at(0) : parsed;
    return isDistributedRateLimitRow(row)
      ? { fallbackReason: null, row }
      : { fallbackReason: "distributed_rpc_invalid_shape", row: null };
  } catch (error) {
    return {
      fallbackReason: error instanceof DOMException && error.name === "AbortError" ? "distributed_rpc_timeout" : "distributed_rpc_network_error",
      row: null
    };
  } finally {
    clearTimeout(timeout);
  }
}

function httpFallbackReason(status: number): RateLimitFallbackReason {
  if (status === 401) {
    return "distributed_rpc_http_401";
  }
  if (status === 403) {
    return "distributed_rpc_http_403";
  }
  if (status === 404) {
    return "distributed_rpc_http_404";
  }
  if (status >= 500) {
    return "distributed_rpc_http_5xx";
  }
  return "distributed_rpc_unavailable";
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const userAgent = request.headers.get("user-agent")?.trim() ?? "unknown-agent";
  return `${forwarded || realIp || "anonymous"}:${userAgent}`.slice(0, 220);
}

async function keyedDigest(value: string, secret: string): Promise<string> {
  const key = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(secret), { hash: "SHA-256", name: "HMAC" }, false, ["sign"]);
  const signature = await webcrypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Buffer.from(signature).toString("hex");
}

function isDistributedRateLimitRow(value: unknown): value is DistributedRateLimitRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const row = value as Partial<DistributedRateLimitRow>;
  return (
    typeof row.allowed === "boolean" &&
    typeof row.count === "number" &&
    typeof row.remaining === "number" &&
    typeof row.reset_at === "string" &&
    Number.isFinite(Date.parse(row.reset_at))
  );
}

function pruneBuckets(now: number): void {
  if (buckets.size <= MAX_BUCKETS) {
    return;
  }
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now || buckets.size > MAX_BUCKETS) {
      buckets.delete(key);
    }
  }
}
