import { afterEach, describe, expect, test, vi } from "vitest";
import { createApiHttpContext } from "../lib/api-http";
import { deriveApiKeyDigestForStorage } from "../lib/api-auth";
import { checkApiRateLimit, checkApiRateLimitAsync, checkRateLimit, rateLimitStoreStatus } from "../lib/rate-limit";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("API rate limits", () => {
  test("returns the public API error contract with request headers", async () => {
    const request = new Request("https://nipmod.com/api/search", {
      headers: {
        "user-agent": "rate-limit-test",
        "x-forwarded-for": `203.0.113.${Math.floor(Math.random() * 200) + 1}`,
        "x-request-id": "test-request-1"
      }
    });
    const context = createApiHttpContext(request);

    expect(checkRateLimit(request, { limit: 1, name: "test-rate-limit", windowMs: 60_000 }, context).ok).toBe(true);
    const limited = checkRateLimit(request, { limit: 1, name: "test-rate-limit", windowMs: 60_000 }, context);

    expect(limited.ok).toBe(false);
    expect(limited.response?.status).toBe(429);
    expect(limited.response?.headers.get("access-control-allow-origin")).toBe("*");
    expect(limited.response?.headers.get("retry-after")).toBeTruthy();
    expect(limited.response?.headers.get("x-nipmod-request-id")).toBe("test-request-1");
    await expect(limited.response?.json()).resolves.toMatchObject({
      code: "rate_limited",
      retryable: true,
      source: null,
      status: 429,
      type: "dev.nipmod.api-error.v1"
    });
  });

  test("rejects invalid API keys before rate limiting", async () => {
    const request = new Request("https://nipmod.com/api/search", {
      headers: {
        "x-nipmod-api-key": "short",
        "x-request-id": "bad-key-test"
      }
    });
    const limited = checkApiRateLimit(request, { limit: 1, name: "test-bad-key", windowMs: 60_000 }, createApiHttpContext(request));

    expect(limited.ok).toBe(false);
    expect(limited.response?.status).toBe(401);
    expect(limited.response?.headers.get("x-nipmod-access-tier")).toBe("public");
    await expect(limited.response?.json()).resolves.toMatchObject({
      code: "invalid_api_key",
      retryable: false,
      status: 401,
      type: "dev.nipmod.api-error.v1"
    });
  });

  test("applies configured API key tiers without exposing the raw key", () => {
    const rawKey = "nka_test_builder_key_1234567890";
    const hashKey = ["test", "api", "key", "hash", "fixture"].join("-");
    const hash = deriveApiKeyDigestForStorage(rawKey, hashKey);
    vi.stubEnv("NIPMOD_API_KEY_HASH_SECRET", hashKey);
    vi.stubEnv("NIPMOD_API_KEY_HASHES", `builder-test:builder:${hash}`);
    const request = new Request("https://nipmod.com/api/search", {
      headers: {
        "user-agent": "key-tier-test",
        "x-nipmod-api-key": rawKey
      }
    });

    const result = checkApiRateLimit(request, { limit: 1, name: "test-key-tier", windowMs: 60_000 }, createApiHttpContext(request));

    expect(result.ok).toBe(true);
    expect(result.access).toMatchObject({
      authenticated: true,
      keyId: `key_${hash.slice(0, 16)}`,
      tier: "builder"
    });
    expect(result.headers["x-ratelimit-limit"]).toBe("10");
    expect(JSON.stringify(result)).not.toContain(rawKey);
  });

  test("uses the distributed Supabase bucket when configured", async () => {
    const resetAt = new Date(Date.now() + 60_000).toISOString();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify([{ allowed: true, count: 1, remaining: 4, reset_at: resetAt }]), { status: 200 })
    );
    const request = new Request("https://nipmod.com/api/search", {
      headers: {
        "user-agent": "distributed-rate-limit-test",
        "x-forwarded-for": "203.0.113.250"
      }
    });

    const result = await checkApiRateLimitAsync(
      request,
      { limit: 5, name: "distributed-test", windowMs: 60_000 },
      createApiHttpContext(request),
      {
        env: {
          NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
          NIPMOD_ARCHIVE_SUPABASE_URL: "https://db.example.test"
        },
        fetchImpl: fetchMock as unknown as typeof fetch
      }
    );

    expect(result.ok).toBe(true);
    expect(result.headers["x-ratelimit-store"]).toBe("supabase");
    expect(result.headers["x-ratelimit-remaining"]).toBe("4");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://db.example.test/rest/v1/rpc/consume_api_rate_limit");
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({
      p_limit_count: 5,
      p_policy: "distributed-test",
      p_window_ms: 60_000
    });
    expect(String((init as RequestInit).body)).not.toContain("203.0.113.250");
  });

  test("returns a rate-limit response from the distributed bucket", async () => {
    const resetAt = new Date(Date.now() + 45_000).toISOString();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify([{ allowed: false, count: 6, remaining: 0, reset_at: resetAt }]), { status: 200 })
    );
    const request = new Request("https://nipmod.com/api/search", {
      headers: {
        "user-agent": "distributed-deny-test",
        "x-forwarded-for": "203.0.113.251"
      }
    });

    const result = await checkApiRateLimitAsync(
      request,
      { limit: 5, name: "distributed-deny", windowMs: 60_000 },
      createApiHttpContext(request),
      {
        env: {
          NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
          NIPMOD_ARCHIVE_SUPABASE_URL: "https://db.example.test"
        },
        fetchImpl: fetchMock as unknown as typeof fetch
      }
    );

    expect(result.ok).toBe(false);
    expect(result.response?.status).toBe(429);
    expect(result.response?.headers.get("x-ratelimit-store")).toBe("supabase");
    await expect(result.response?.json()).resolves.toMatchObject({
      code: "rate_limited",
      status: 429
    });
  });

  test("falls back to local buckets when the distributed store is unavailable", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: "missing_function" }), { status: 404 }));
    const request = new Request("https://nipmod.com/api/search", {
      headers: {
        "user-agent": "distributed-fallback-test",
        "x-forwarded-for": "203.0.113.252"
      }
    });
    const options = {
      env: {
        NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        NIPMOD_ARCHIVE_SUPABASE_URL: "https://db.example.test"
      },
      fetchImpl: fetchMock as unknown as typeof fetch
    };

    const first = await checkApiRateLimitAsync(request, { limit: 1, name: "distributed-fallback", windowMs: 60_000 }, createApiHttpContext(request), options);
    const second = await checkApiRateLimitAsync(request, { limit: 1, name: "distributed-fallback", windowMs: 60_000 }, createApiHttpContext(request), options);

    expect(first.ok).toBe(true);
    expect(first.headers["x-ratelimit-store"]).toBe("memory-fallback");
    expect(second.ok).toBe(false);
    expect(second.response?.headers.get("x-ratelimit-store")).toBe("memory-fallback");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("reports distributed rate-limit store readiness without secrets", () => {
    expect(rateLimitStoreStatus({})).toMatchObject({
      configured: false,
      driver: "supabase-rpc",
      fallback: "memory",
      type: "dev.nipmod.rate-limit-store-status.v1"
    });
    expect(rateLimitStoreStatus({
      NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      NIPMOD_ARCHIVE_SUPABASE_URL: "https://db.example.test"
    })).toMatchObject({
      configured: true,
      driver: "supabase-rpc"
    });
    expect(JSON.stringify(rateLimitStoreStatus({
      NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      NIPMOD_ARCHIVE_SUPABASE_URL: "https://db.example.test"
    }))).not.toContain("service-role-key");
  });
});
