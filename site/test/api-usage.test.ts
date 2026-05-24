import { describe, expect, test, vi } from "vitest";
import { createApiHttpContext } from "../lib/api-http";
import { publicApiAccess } from "../lib/api-auth";
import { readApiUsageMetrics, recordApiUsage, usageStoreStatus } from "../lib/api-usage";

describe("API usage logging", () => {
  test("stores hashed usage fields without raw query, package, client or key data", async () => {
    const rows: unknown[] = [];
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      rows.push(JSON.parse(String(init?.body))[0]);
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;
    const request = new Request("https://nipmod.com/api/search?q=secret%20package&sources=npm,pypi&limit=2", {
      headers: {
        "user-agent": "raw-user-agent",
        "x-forwarded-for": "203.0.113.20",
        "x-request-id": "usage-test"
      }
    });
    const context = createApiHttpContext(request);

    await recordApiUsage(
      {
        access: publicApiAccess(),
        context,
        request,
        responseBody: {
          records: [],
          sources: ["npm", "pypi"],
          total: 0,
          type: "dev.nipmod.external-search.v1"
        },
        route: "/api/search",
        status: 200
      },
      {
        NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        NIPMOD_ARCHIVE_SUPABASE_URL: "https://db.example.test",
        NIPMOD_USAGE_HASH_SALT: "test-salt"
      },
      fetchMock
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      access_tier: "public",
      archive_stored: null,
      install_blocked: null,
      method: "GET",
      request_id: "usage-test",
      result_count: 0,
      route: "/api/search",
      sources: ["npm", "pypi"],
      status: 200,
      traffic_origin: "public",
      trust_decision: null,
      trust_risk: null
    });
    expect(JSON.stringify(rows[0])).not.toContain("secret package");
    expect(JSON.stringify(rows[0])).not.toContain("raw-user-agent");
    expect(JSON.stringify(rows[0])).not.toContain("203.0.113.20");
    expect(JSON.stringify(rows[0])).not.toContain("service-role-key");
  });

  test("stores decision, risk and blocked plan signals for recap metrics", async () => {
    const rows: unknown[] = [];
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      rows.push(JSON.parse(String(init?.body))[0]);
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;
    const request = new Request("https://nipmod.com/api/install-plan?source=npm&name=unsafe-package", {
      headers: {
        "user-agent": "usage-plan-test",
        "x-forwarded-for": "203.0.113.21"
      }
    });

    await recordApiUsage(
      {
        access: publicApiAccess(),
        context: createApiHttpContext(request),
        request,
        responseBody: {
          package: {
            name: "unsafe-package",
            source: "npm",
            trust: {
              decision: "avoid",
              risk: "high"
            }
          },
          safety: {
            blocked: true
          },
          type: "dev.nipmod.external-install-plan.v1"
        },
        route: "/api/install-plan",
        status: 200
      },
      {
        NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        NIPMOD_ARCHIVE_SUPABASE_URL: "https://db.example.test",
        NIPMOD_USAGE_HASH_SALT: "test-salt"
      },
      fetchMock
    );

    expect(rows[0]).toMatchObject({
      install_blocked: true,
      route: "/api/install-plan",
      source: "npm",
      trust_decision: "avoid",
      trust_risk: "high"
    });
    expect(JSON.stringify(rows[0])).not.toContain("unsafe-package");
  });

  test("normalizes malformed source query fragments before storing usage rows", async () => {
    const rows: unknown[] = [];
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      rows.push(JSON.parse(String(init?.body))[0]);
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;
    const request = new Request("https://nipmod.com/api/inspect?source=npmu0026name=undici", {
      headers: {
        "user-agent": "usage-source-test",
        "x-forwarded-for": "203.0.113.22"
      }
    });

    await recordApiUsage(
      {
        access: publicApiAccess(),
        context: createApiHttpContext(request),
        request,
        responseBody: {
          code: "invalid_source",
          error: "invalid source",
          type: "dev.nipmod.api-error.v1"
        },
        route: "/api/inspect",
        status: 400
      },
      {
        NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        NIPMOD_ARCHIVE_SUPABASE_URL: "https://db.example.test",
        NIPMOD_USAGE_HASH_SALT: "test-salt"
      },
      fetchMock
    );

    expect(rows[0]).toMatchObject({
      error_code: "invalid_source",
      route: "/api/inspect",
      source: "npm",
      sources: []
    });
    expect(JSON.stringify(rows[0])).not.toContain("u0026name");
  });

  test("marks Nipmod canary traffic without storing raw user agents", async () => {
    const rows: unknown[] = [];
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      rows.push(JSON.parse(String(init?.body))[0]);
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;
    const request = new Request("https://nipmod.com/api/search?q=react&sources=npm&limit=1", {
      headers: {
        "user-agent": "nipmod-source-depth-canary/1.2.9 (+https://nipmod.com)",
        "x-forwarded-for": "203.0.113.30",
        "x-request-id": "source-depth-canary-test"
      }
    });

    await recordApiUsage(
      {
        access: publicApiAccess(),
        context: createApiHttpContext(request),
        request,
        responseBody: {
          records: [],
          sources: ["npm"],
          total: 0,
          type: "dev.nipmod.external-search.v1"
        },
        route: "/api/search",
        status: 200
      },
      {
        NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        NIPMOD_ARCHIVE_SUPABASE_URL: "https://db.example.test",
        NIPMOD_USAGE_HASH_SALT: "test-salt"
      },
      fetchMock
    );

    expect(rows[0]).toMatchObject({
      request_id: "source-depth-canary-test",
      route: "/api/search",
      traffic_origin: "internal_canary"
    });
    expect(JSON.stringify(rows[0])).not.toContain("nipmod-source-depth-canary");
  });

  test("reports usage store status without secrets", () => {
    expect(usageStoreStatus({})).toMatchObject({
      configured: false,
      driver: "supabase-rest",
      type: "dev.nipmod.usage-store-status.v1"
    });
  });

  test("reads aggregate metrics without raw usage details or secrets", async () => {
    const calls: Array<{ body: string; url: string }> = [];
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ body: String(init?.body), url: String(input) });
      return Response.json({
        accessTiers: [{ requestCount: 3, tier: "beta" }],
        archiveWrites: { observedCount: 0, previewCount: 0, storedCount: 0 },
        errors: [],
        generatedAt: "2026-05-24T00:00:00.000Z",
        installPlans: { allowedCount: 0, blockedCount: 0, observedCount: 0 },
        packages: [{ packageHash: "a".repeat(64), requestCount: 2 }],
        privacy: "aggregated metrics only",
        routes: [{ avgDurationMs: 10, errorCount: 0, requestCount: 3, route: "/api/search" }],
        since: "2026-05-23T00:00:00.000Z",
        sources: [
          { requestCount: 3, source: "npm" },
          { requestCount: 2, source: "npmu0026name=undici" },
          { requestCount: 1, source: "pypi?name=requests" },
          { requestCount: 7, source: "invalid-source" }
        ],
        totals: { avgDurationMs: 10, clientCount: 2, errorCount: 0, keyCount: 1, requestCount: 3 },
        trafficOrigins: [{ origin: "authenticated_beta", requestCount: 3 }],
        trafficSummary: {
          authenticatedRequestCount: 3,
          externalRequestCount: 3,
          internalRequestCount: 0,
          publicRequestCount: 0,
          unknownLegacyRequestCount: 0
        },
        trustDecisions: [],
        trustRisks: [],
        type: "dev.nipmod.api-usage-metrics.v1"
      });
    }) as unknown as typeof fetch;

    const result = await readApiUsageMetrics(
      { limit: 20, since: new Date("2026-05-23T00:00:00.000Z") },
      {
        NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        NIPMOD_ARCHIVE_SUPABASE_URL: "https://db.example.test"
      },
      fetchMock
    );

    expect(result.ok).toBe(true);
    expect(calls[0]?.url).toBe("https://db.example.test/rest/v1/rpc/read_api_usage_metrics");
    expect(calls[0]?.body).toContain("2026-05-23T00:00:00.000Z");
    expect(result.ok && result.metrics).toMatchObject({
      sources: [
        { requestCount: 5, source: "npm" },
        { requestCount: 1, source: "pypi" }
      ]
    });
    expect(JSON.stringify(result)).not.toContain("service-role-key");
    expect(JSON.stringify(result)).not.toContain("secret package");
    expect(JSON.stringify(result)).not.toContain("raw-user-agent");
    expect(JSON.stringify(result)).not.toContain("invalid-source");
    expect(JSON.stringify(result)).not.toContain("u0026name");
  });

  test("falls back to aggregating usage events when the metrics RPC is not deployed", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      calls.push(String(input));
      if (String(input).includes("/rpc/read_api_usage_metrics")) {
        return Response.json({ code: "missing_function" }, { status: 404 });
      }
      return Response.json([
        {
          access_tier: "beta",
          api_key_id: "key_test",
          client_hash: "client_hash",
          duration_ms: 12,
          error_code: null,
          archive_stored: true,
          install_blocked: false,
          package_hash: "c".repeat(64),
          route: "/api/search",
          source: null,
          sources: ["npm"],
          status: 200,
          traffic_origin: "authenticated_beta",
          trust_decision: "recommended",
          trust_risk: "low"
        },
        {
          access_tier: "public",
          api_key_id: null,
          client_hash: "client_hash_2",
          duration_ms: 20,
          error_code: "invalid_source",
          package_hash: null,
          route: "/api/inspect",
          source: "npmu0026name=undici",
          sources: [],
          status: 400,
          traffic_origin: null
        }
      ]);
    }) as unknown as typeof fetch;

    const result = await readApiUsageMetrics(
      { limit: 10, since: new Date("2026-05-23T00:00:00.000Z") },
      {
        NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        NIPMOD_ARCHIVE_SUPABASE_URL: "https://db.example.test"
      },
      fetchMock
    );

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("/rest/v1/api_usage_events?");
    expect(result.ok && result.metrics).toMatchObject({
      accessTiers: [
        { requestCount: 1, tier: "beta" },
        { requestCount: 1, tier: "public" }
      ],
      errors: [{ code: "invalid_source", requestCount: 1 }],
      installPlans: { allowedCount: 1, blockedCount: 0, observedCount: 1 },
      sources: [{ requestCount: 2, source: "npm" }],
      totals: {
        clientCount: 2,
        errorCount: 1,
        keyCount: 1,
        requestCount: 2
      },
      trafficOrigins: [
        { origin: "authenticated_beta", requestCount: 1 },
        { origin: "unknown_legacy", requestCount: 1 }
      ],
      trafficSummary: {
        authenticatedRequestCount: 1,
        externalRequestCount: 1,
        internalRequestCount: 0,
        publicRequestCount: 0,
        unknownLegacyRequestCount: 1
      },
      trustDecisions: [{ decision: "recommended", requestCount: 1 }],
      trustRisks: [{ requestCount: 1, risk: "low" }],
      type: "dev.nipmod.api-usage-metrics.v1"
    });
    expect(JSON.stringify(result)).not.toContain("service-role-key");
  });
});
