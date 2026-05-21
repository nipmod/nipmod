type RateLimitPolicy = {
  limit: number;
  name: string;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  headers: Record<string, string>;
  ok: boolean;
  response?: Response;
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export function checkRateLimit(request: Request, policy: RateLimitPolicy): RateLimitResult {
  const now = Date.now();
  pruneBuckets(now);

  const client = clientKey(request);
  const key = `${policy.name}:${client}`;
  const existing = buckets.get(key);
  const bucket = existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + policy.windowMs };
  bucket.count += 1;
  buckets.set(key, bucket);

  const remaining = Math.max(0, policy.limit - bucket.count);
  const resetSeconds = Math.ceil((bucket.resetAt - now) / 1000);
  const headers = rateLimitHeaders(policy, remaining, bucket.resetAt);

  if (bucket.count > policy.limit) {
    return {
      headers,
      ok: false,
      response: Response.json(
        {
          error: `rate limit exceeded for ${policy.name}`,
          retryAfter: resetSeconds,
          type: "dev.nipmod.rate-limit.v1"
        },
        {
          headers: {
            ...headers,
            "cache-control": "no-store",
            "retry-after": String(resetSeconds)
          },
          status: 429
        }
      )
    };
  }

  return { headers, ok: true };
}

function rateLimitHeaders(policy: RateLimitPolicy, remaining: number, resetAt: number): Record<string, string> {
  return {
    "x-ratelimit-limit": String(policy.limit),
    "x-ratelimit-policy": policy.name,
    "x-ratelimit-remaining": String(remaining),
    "x-ratelimit-reset": new Date(resetAt).toISOString()
  };
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const userAgent = request.headers.get("user-agent")?.trim() ?? "unknown-agent";
  return `${forwarded || realIp || "anonymous"}:${userAgent}`.slice(0, 220);
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
