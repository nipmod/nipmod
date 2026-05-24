import { afterEach, describe, expect, test, vi } from "vitest";
import { GET } from "../app/api/usage/stats/route";
import { deriveApiKeyDigestForStorage } from "../lib/api-auth";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("usage stats route", () => {
  test("requires an admin API key", async () => {
    const response = await GET(new Request("https://nipmod.com/api/usage/stats"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      code: "insufficient_api_access",
      status: 403,
      type: "dev.nipmod.api-error.v1"
    });
  });

  test("returns aggregate metrics for admin keys without leaking secrets", async () => {
    const rawKey = "nka_test_admin_key_1234567890";
    const hashSecret = "test-admin-secret";
    const hash = deriveApiKeyDigestForStorage(rawKey, hashSecret);
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/rest/v1/rpc/read_api_usage_metrics")) {
        return Response.json({
          accessTiers: [{ requestCount: 2, tier: "admin" }],
          errors: [],
          generatedAt: "2026-05-24T00:00:00.000Z",
          packages: [{ packageHash: "b".repeat(64), requestCount: 1 }],
          privacy: "aggregated metrics only",
          routes: [{ avgDurationMs: 12, errorCount: 0, requestCount: 2, route: "/api/search" }],
          since: "2026-05-23T00:00:00.000Z",
          sources: [{ requestCount: 2, source: "npm" }],
          totals: { avgDurationMs: 12, clientCount: 1, errorCount: 0, keyCount: 1, requestCount: 2 },
          type: "dev.nipmod.api-usage-metrics.v1"
        });
      }
      if (url.endsWith("/rest/v1/api_usage_events")) {
        return new Response(null, { status: 204 });
      }
      return Response.json({ error: "unexpected test URL" }, { status: 500 });
    }) as unknown as typeof fetch;
    vi.stubEnv("NIPMOD_API_KEY_HASH_SECRET", hashSecret);
    vi.stubEnv("NIPMOD_API_KEY_HASHES", `ops:admin:${hash}`);
    vi.stubEnv("NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    vi.stubEnv("NIPMOD_ARCHIVE_SUPABASE_URL", "https://db.example.test");
    vi.stubEnv("NIPMOD_RATE_LIMIT_STORE", "memory");
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("https://nipmod.com/api/usage/stats?hours=24&limit=5", {
        headers: {
          "x-nipmod-api-key": rawKey,
          "x-request-id": "usage-stats-test"
        }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      type: "dev.nipmod.api-usage-metrics.v1",
      totals: {
        requestCount: 2
      }
    });
    expect(response.headers.get("x-nipmod-access-tier")).toBe("admin");
    expect(JSON.stringify(body)).not.toContain(rawKey);
    expect(JSON.stringify(body)).not.toContain("service-role-key");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
