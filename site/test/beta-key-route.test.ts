import { afterEach, describe, expect, test, vi } from "vitest";
import { POST, OPTIONS } from "../app/api/keys/beta/route";
import { createApiHttpContext } from "../lib/api-http";
import { deriveApiKeyDigestForStorage } from "../lib/api-auth";
import { checkApiRateLimitAsync } from "../lib/rate-limit";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("beta key route", () => {
  test("issues a self-service beta key and stores only the keyed hash", async () => {
    const env = stubIssuerEnv();
    let storedRow: Record<string, unknown> | null = null;
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://db.example.test/rest/v1/api_keys" && init?.method === "POST") {
        storedRow = JSON.parse(String(init.body)) as Record<string, unknown>;
        expect(new Headers(init.headers).get("authorization")).toBe("Bearer service-role-key");
        expect(new Headers(init.headers).get("prefer")).toBe("return=minimal");
        return new Response(null, { status: 201 });
      }
      if (url.startsWith("https://db.example.test/rest/v1/api_keys?")) {
        return Response.json([
          {
            expires_at: storedRow?.expires_at,
            id: storedRow?.id,
            label: storedRow?.label,
            rate_limit_multiplier: storedRow?.rate_limit_multiplier,
            tier: storedRow?.tier
          }
        ]);
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("https://nipmod.com/api/keys/beta", {
        body: JSON.stringify({ label: "agent-ci-private-build-name" }),
        headers: {
          "content-type": "application/json",
          "user-agent": "beta-key-route-test",
          "x-forwarded-for": "203.0.113.10"
        },
        method: "POST"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-nipmod-access-tier")).toBe("beta");
    expect(body).toMatchObject({
      auth: { bearer: true, header: "x-nipmod-api-key" },
      label: "self-serve/agent",
      rateLimitMultiplier: 10,
      storage: {
        rawKeyReturnedOnce: true,
        serverStoresHashOnly: true,
        serverStoresRawKey: false
      },
      tier: "beta",
      type: "dev.nipmod.beta-api-key.v1"
    });
    expect(body.key).toMatch(/^nka_beta_[A-Za-z0-9_-]{40,}$/);
    expect(body.keyId).toMatch(/^key_[a-f0-9]{16}$/);
    expect(storedRow).toMatchObject({
      id: body.keyId,
      label: "self-serve/agent",
      rate_limit_multiplier: 10,
      status: "active",
      tier: "beta"
    });
    expect(storedRow?.key_hash).toBe(deriveApiKeyDigestForStorage(body.key, env.NIPMOD_API_KEY_HASH_SECRET));
    expect(JSON.stringify(storedRow)).not.toContain(body.key);
    expect(JSON.stringify(storedRow)).not.toContain("agent-ci-private-build-name");
    expect(JSON.stringify(body)).not.toContain("agent-ci-private-build-name");

    const keyedRequest = new Request("https://nipmod.com/api/search?q=http%20client", {
      headers: {
        "user-agent": "beta-key-verification-test",
        "x-nipmod-api-key": body.key
      }
    });
    const keyedResult = await checkApiRateLimitAsync(
      keyedRequest,
      { limit: 1, name: "issued-beta-key", windowMs: 60_000 },
      createApiHttpContext(keyedRequest),
      { env, fetchImpl: fetchMock }
    );

    expect(keyedResult.ok).toBe(true);
    expect(keyedResult.access).toMatchObject({
      authenticated: true,
      keyId: body.keyId,
      tier: "beta"
    });
    expect(keyedResult.headers["x-ratelimit-limit"]).toBe("10");
    expect(JSON.stringify(keyedResult)).not.toContain(body.key);
  });

  test("returns a clear 503 when the key registry is not configured", async () => {
    stubRateLimitMemory();
    vi.stubEnv("NIPMOD_API_KEY_HASH_SECRET", "");
    vi.stubEnv("NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("NIPMOD_ARCHIVE_SUPABASE_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("https://nipmod.com/api/keys/beta", {
        headers: {
          "user-agent": "beta-key-missing-store-test",
          "x-forwarded-for": "203.0.113.11"
        },
        method: "POST"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      code: "beta_key_store_not_configured",
      retryable: false,
      status: 503,
      type: "dev.nipmod.api-error.v1"
    });
    expect(JSON.stringify(body)).not.toContain("nka_beta_");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("does not mint a key when JSON is malformed", async () => {
    stubIssuerEnv();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("https://nipmod.com/api/keys/beta", {
        body: "{",
        headers: {
          "content-type": "application/json",
          "user-agent": "beta-key-invalid-json-test",
          "x-forwarded-for": "203.0.113.12"
        },
        method: "POST"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      code: "invalid_json",
      retryable: false,
      status: 400
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("reports a missing Data API table without returning a raw key", async () => {
    stubIssuerEnv();
    const fetchMock = vi.fn(async () => new Response(null, { status: 404 })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("https://nipmod.com/api/keys/beta", {
        headers: {
          "user-agent": "beta-key-table-missing-test",
          "x-forwarded-for": "203.0.113.13"
        },
        method: "POST"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      code: "beta_key_store_unavailable",
      retryable: true,
      status: 503
    });
    expect(JSON.stringify(body)).not.toContain("nka_beta_");
  });

  test("supports CORS preflight", () => {
    const response = OPTIONS(new Request("https://nipmod.com/api/keys/beta"));

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
  });
});

function stubIssuerEnv() {
  const env = {
    NIPMOD_API_KEY_HASH_SECRET: "test-hash-secret",
    NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    NIPMOD_ARCHIVE_SUPABASE_URL: "https://db.example.test",
    NIPMOD_RATE_LIMIT_STORE: "memory"
  };
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
  return env;
}

function stubRateLimitMemory() {
  vi.stubEnv("NIPMOD_RATE_LIMIT_STORE", "memory");
}
