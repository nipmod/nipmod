import { createHmac } from "node:crypto";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createApiHttpContext } from "../lib/api-http";
import { checkApiRateLimit, checkRateLimit } from "../lib/rate-limit";

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
    const hash = createHmac("sha256", hashKey).update(rawKey).digest("hex");
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
});
