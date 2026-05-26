import { afterEach, describe, expect, test, vi } from "vitest";
import { GET } from "../app/api/stats/route";
import { apiKeyHeaders, stubApiKeyAuth } from "./api-key-test-helper";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("public stats route", () => {
  test("returns external usage stats without private key identifiers", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/rest/v1/api_usage_events?")) {
        const events = [
          {
            api_key_id: "key_external_beta",
            archive_stored: false,
            client_hash: "client-a",
            created_at: "2026-05-25T00:00:00.000Z",
            error_code: null,
            install_blocked: false,
            route: "/api/install-plan",
            source: "npm",
            sources: ["npm"],
            status: 200,
            traffic_origin: "authenticated_beta",
            trust_decision: "recommended",
            trust_risk: "low"
          },
          {
            api_key_id: null,
            archive_stored: null,
            client_hash: "client-b",
            created_at: "2026-05-25T00:01:00.000Z",
            error_code: "invalid_query",
            install_blocked: null,
            route: "/api/search",
            source: "npm",
            sources: ["npm"],
            status: 400,
            traffic_origin: "public",
            trust_decision: null,
            trust_risk: null
          },
          {
            api_key_id: "key_external_beta_2",
            archive_stored: null,
            client_hash: null,
            created_at: "2026-05-25T00:01:30.000Z",
            error_code: null,
            install_blocked: false,
            route: "/api/install-plan",
            source: "pypi",
            sources: ["pypi"],
            status: 200,
            traffic_origin: "authenticated_beta",
            trust_decision: "recommended",
            trust_risk: "low"
          },
          {
            api_key_id: "admin_password",
            archive_stored: null,
            client_hash: "client-admin",
            created_at: "2026-05-25T00:02:00.000Z",
            error_code: null,
            install_blocked: null,
            route: "/api/admin/summary",
            source: null,
            sources: null,
            status: 200,
            traffic_origin: "authenticated_admin",
            trust_decision: null,
            trust_risk: null
          },
          {
            api_key_id: null,
            archive_stored: null,
            client_hash: "client-admin-public",
            created_at: "2026-05-25T00:03:00.000Z",
            error_code: "insufficient_api_access",
            install_blocked: null,
            route: "/api/usage/stats",
            source: null,
            sources: null,
            status: 403,
            traffic_origin: "public",
            trust_decision: null,
            trust_risk: null
          }
        ];
        const trafficOrigin = new URL(url).searchParams.get("traffic_origin");
        if (trafficOrigin === "in.(public,authenticated_beta,authenticated_partner)") {
          return Response.json(events.filter((event) => event.traffic_origin === "public" || event.traffic_origin === "authenticated_beta" || event.traffic_origin === "authenticated_partner"));
        }
        if (trafficOrigin === "in.(authenticated_admin,internal_canary,internal_monitor,internal_operator)") {
          return Response.json(events.filter((event) => event.traffic_origin === "authenticated_admin"));
        }
        if (trafficOrigin === "is.null" || trafficOrigin === "eq.unknown_legacy") {
          return Response.json([]);
        }
        return Response.json({ error: "unexpected traffic origin filter" }, { status: 500 });
      }
      if (url.includes("/rest/v1/package_intelligence_records?")) {
        return Response.json([
          { source: "npm", status: "agent_confirmed", trust_score: 100 },
          { source: "pypi", status: "agent_confirmed", trust_score: 88 }
        ], { headers: { "content-range": "0-1/2" } });
      }
      if (url.includes("/rest/v1/api_keys?")) {
        return Response.json([{ id: "key_external_beta" }], { headers: { "content-range": "0-0/1" } });
      }
      if (url.endsWith("/rest/v1/api_usage_events")) {
        const row = JSON.parse(String(init?.body))[0];
        expect(row.route).toBe("/api/stats");
        return new Response(null, { status: 204 });
      }
      return Response.json({ error: "unexpected test URL" }, { status: 500 });
    }) as unknown as typeof fetch;

    stubApiKeyAuth();
    vi.stubEnv("NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    vi.stubEnv("NIPMOD_ARCHIVE_SUPABASE_URL", "https://db.example.test");
    vi.stubEnv("NIPMOD_RATE_LIMIT_STORE", "memory");
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("https://nipmod.com/api/stats?hours=24", { headers: apiKeyHeaders() }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(body).toMatchObject({
      archive: {
        confirmedRecords: 2
      },
      betaKeys: {
        activeCount: 1
      },
      excluded: {
        controlPlaneRequestCount: 2,
        internalRequestCount: 0,
        unknownLegacyRequestCount: 0
      },
      external: {
        activeKeyCount: 2,
        errorCount: 1,
        installPlanCount: 2,
        publicRequestCount: 1,
        requestCount: 3,
        successCount: 2,
        uniqueClientCount: 2
      },
      type: "dev.nipmod.public-stats.v1"
    });
    expect(JSON.stringify(body)).not.toContain("key_external_beta");
    expect(JSON.stringify(body)).not.toContain("key_external_beta_2");
    expect(JSON.stringify(body)).not.toContain("admin_password");
    expect(JSON.stringify(body)).not.toContain("service-role-key");
    expect(body.external.routes).not.toContainEqual(expect.objectContaining({ route: "/api/usage/stats" }));
    expect(body.external.routes).not.toContainEqual(expect.objectContaining({ route: "/api/admin/summary" }));
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });
});
