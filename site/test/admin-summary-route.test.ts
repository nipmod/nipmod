import { afterEach, describe, expect, test, vi } from "vitest";
import { GET } from "../app/api/admin/summary/route";
import { deriveApiKeyDigestForStorage } from "../lib/api-auth";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("admin summary route", () => {
  test("requires an admin API key", async () => {
    const response = await GET(new Request("https://nipmod.com/api/admin/summary"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      code: "api_key_required",
      status: 401,
      type: "dev.nipmod.api-error.v1"
    });
  });

  test("returns private aggregate launch metrics without raw keys or hashes", async () => {
    const rawKey = "nka_test_admin_key_for_summary_123456";
    const hashSecret = "test-admin-summary-secret";
    const hash = deriveApiKeyDigestForStorage(rawKey, hashSecret);
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/rest/v1/rpc/read_api_usage_metrics")) {
        return Response.json(usageFixture());
      }
      if (url.includes("/rest/v1/package_intelligence_records?")) {
        return Response.json([
          {
            display_name: "undici",
            name: "undici",
            original_url: "https://www.npmjs.com/package/undici",
            source: "npm",
            status: "external_indexed",
            trust_score: 100,
            updated_at: "2026-05-24T00:00:00.000Z",
            version: "8.3.0"
          }
        ], { headers: { "content-range": "0-0/1" } });
      }
      if (url.includes("/rest/v1/api_keys?")) {
        return Response.json([
          {
            created_at: "2026-05-24T00:00:00.000Z",
            expires_at: "2026-08-22T00:00:00.000Z",
            id: "key_1234567890abcdef",
            label: "self-serve/test-agent",
            rate_limit_multiplier: 10,
            revoked_at: null,
            status: "active",
            tier: "beta"
          }
        ], { headers: { "content-range": "0-0/1" } });
      }
      if (url.includes("/rest/v1/api_usage_events?")) {
        return Response.json([
          {
            access_tier: "beta",
            api_key_id: "key_1234567890abcdef",
            archive_stored: false,
            created_at: "2026-05-24T01:00:00.000Z",
            error_code: null,
            install_blocked: false,
            route: "/api/install-plan",
            source: "npm",
            sources: ["npm"],
            status: 200,
            traffic_origin: "authenticated_beta"
          },
          {
            access_tier: "admin",
            api_key_id: "admin_password",
            archive_stored: null,
            created_at: "2026-05-24T01:05:00.000Z",
            error_code: null,
            install_blocked: null,
            route: "/api/admin/summary",
            source: null,
            sources: null,
            status: 200,
            traffic_origin: "authenticated_admin"
          }
        ]);
      }
      if (url.endsWith("/rest/v1/api_usage_events")) {
        const row = JSON.parse(String(init?.body))[0];
        expect(row.route).toBe("/api/admin/summary");
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
      new Request("https://nipmod.com/api/admin/summary?hours=24&limit=5", {
        headers: {
          authorization: `Bearer ${rawKey}`,
          "x-request-id": "admin-summary-test"
        }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      archive: {
        totalRecords: 1
      },
      keys: {
        activeCount: 1,
        selfServeBetaCount: 1,
        totalKeys: 1
      },
      keyActivity: {
        excludedAdminKeyRequestCount: 1,
        externalKeyCount: 1,
        rows: [
          {
            keyId: "key_1234567890abcdef",
            label: "self-serve/test-agent",
            requestCount: 1,
            routeSummary: "/api/install-plan 1",
            sourceSummary: "npm 1",
            status: "active",
            tier: "beta"
          }
        ]
      },
      sourceQuality: {
        summary: {
          averageDepthScore: 95,
          moderateOrBetter: 6,
          strong: 5,
          total: 6
        },
        type: "dev.nipmod.admin-source-quality.v1"
      },
      type: "dev.nipmod.admin-summary.v1",
      usage: {
        totals: {
          requestCount: 3
        },
        type: "dev.nipmod.api-usage-metrics.v1"
      }
    });
    expect(JSON.stringify(body)).not.toContain(rawKey);
    expect(JSON.stringify(body)).not.toContain(hash);
    expect(JSON.stringify(body)).not.toContain("service-role-key");
    expect(body.sourceQuality.profiles[0]).toMatchObject({
      coverage: "strong",
      source: "npm"
    });
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
});

function usageFixture() {
  return {
    accessTiers: [{ requestCount: 3, tier: "beta" }],
    archiveWrites: { observedCount: 1, previewCount: 0, storedCount: 1 },
    errors: [],
    generatedAt: "2026-05-24T00:00:00.000Z",
    installPlans: { allowedCount: 2, blockedCount: 0, observedCount: 2 },
    packages: [{ packageHash: "a".repeat(64), requestCount: 2 }],
    privacy: "aggregated metrics only",
    routes: [{ avgDurationMs: 10, errorCount: 0, requestCount: 3, route: "/api/search" }],
    since: "2026-05-23T00:00:00.000Z",
    sources: [{ requestCount: 3, source: "npm" }],
    totals: { avgDurationMs: 10, clientCount: 2, errorCount: 0, keyCount: 1, requestCount: 3 },
    trafficOrigins: [{ origin: "authenticated_beta", requestCount: 3 }],
    trafficSummary: {
      authenticatedRequestCount: 3,
      externalRequestCount: 3,
      internalRequestCount: 0,
      publicRequestCount: 0,
      unknownLegacyRequestCount: 0
    },
    trustDecisions: [{ decision: "recommended", requestCount: 3 }],
    trustRisks: [{ requestCount: 3, risk: "low" }],
    type: "dev.nipmod.api-usage-metrics.v1"
  };
}
