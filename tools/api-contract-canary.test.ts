import { describe, expect, test, vi } from "vitest";
import { runApiContractCanary } from "./api-contract-canary.ts";

describe("api contract canary", () => {
  test("passes stable success and error contracts", async () => {
    const fetchFn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const requestId = new Headers(init?.headers).get("x-request-id") ?? "missing-request-id";
      const headers = contractHeaders(requestId);
      if (url.endsWith("/api/openapi")) {
        return Response.json(openApiFixture(), {
          headers: {
            ...Object.fromEntries(headers.entries()),
            "content-type": "application/openapi+json; charset=utf-8"
          },
          status: 200
        });
      }
      if (url.includes("/api/search?") && new Headers(init?.headers).get("x-nipmod-api-key") === "short-key") {
        return Response.json(apiError(401, "invalid_api_key", "api key is too short"), { headers, status: 401 });
      }
      if (url.includes("/api/search?q=&")) {
        return Response.json(apiError(400, "invalid_query", "query must not be empty"), { headers, status: 400 });
      }
      if (url.includes("/api/inspect?source=unknown")) {
        return Response.json(apiError(400, "invalid_source", "source must be valid"), { headers, status: 400 });
      }
      if (url.endsWith("/api/install-plan")) {
        return Response.json(apiError(400, "invalid_json", "invalid JSON"), { headers, status: 400 });
      }
      return Response.json(searchFixture(), { headers, status: 200 });
    }) as unknown as typeof fetch;

    const result = await runApiContractCanary({ baseUrl: "https://nipmod.test", fetchFn });

    expect(result.ok).toBe(true);
    expect(result.summary).toEqual({ fail: 0, pass: 6, total: 6 });
    expect(result.checks[0]).toMatchObject({
      data: {
        openapi: "3.1.0",
        operationCount: 15,
        pathCount: 13,
        title: "Nipmod API"
      },
      name: "openapi_contract",
      status: "pass"
    });
    expect(fetchFn).toHaveBeenCalledTimes(6);
  });

  test("fails when validation errors omit rate-limit headers", async () => {
    const fetchFn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const requestId = new Headers(init?.headers).get("x-request-id") ?? "missing-request-id";
      const headers = contractHeaders(requestId);
      if (String(input).endsWith("/api/openapi")) {
        return Response.json(openApiFixture(), { headers, status: 200 });
      }
      if (String(input).includes("/api/search?q=&")) {
        headers.delete("x-ratelimit-store");
        return Response.json(apiError(400, "invalid_query", "query must not be empty"), { headers, status: 400 });
      }
      return Response.json(searchFixture(), { headers, status: 200 });
    }) as unknown as typeof fetch;

    const result = await runApiContractCanary({
      checks: [
        {
          expectCode: "invalid_query",
          expectError: true,
          expectRateLimitHeaders: true,
          expectedStatus: 400,
          method: "GET",
          name: "search_invalid_query_error",
          path: "/api/search?q=&sources=npm"
        }
      ],
      fetchFn
    });

    expect(result.ok).toBe(false);
    expect(result.checks[1].error).toContain("missing rate-limit header x-ratelimit-store");
  });

  test("fails malformed API error payloads", async () => {
    const fetchFn = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      if (String(_input).endsWith("/api/openapi")) {
        return Response.json(openApiFixture(), { headers: contractHeaders("openapi-request"), status: 200 });
      }
      const requestId = new Headers(init?.headers).get("x-request-id") ?? "missing-request-id";
      return Response.json({ code: "invalid_query", error: "query must not be empty", status: 400 }, {
        headers: contractHeaders(requestId),
        status: 400
      });
    }) as unknown as typeof fetch;

    const result = await runApiContractCanary({
      checks: [
        {
          expectCode: "invalid_query",
          expectError: true,
          expectRateLimitHeaders: true,
          expectedStatus: 400,
          method: "GET",
          name: "search_invalid_query_error",
          path: "/api/search?q=&sources=npm"
        }
      ],
      fetchFn
    });

    expect(result.ok).toBe(false);
    expect(result.checks[1].error).toContain("API error type mismatch");
  });

  test("fails OpenAPI operations without operation ids", async () => {
    const fixture = openApiFixture();
    delete fixture.paths["/api/search"].get.operationId;
    const fetchFn = vi.fn(async () => Response.json(fixture, { headers: contractHeaders("openapi-request"), status: 200 })) as unknown as typeof fetch;

    const result = await runApiContractCanary({ checks: [], fetchFn });

    expect(result.ok).toBe(false);
    expect(result.checks[0]).toMatchObject({
      name: "openapi_contract",
      status: "fail"
    });
    expect(result.checks[0].error).toContain("GET /api/search");
  });
});

function contractHeaders(requestId: string) {
  return new Headers({
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
    "content-type": "application/json",
    "server-timing": "app;dur=1",
    "x-nipmod-api-version": "2026-05-23",
    "x-nipmod-request-id": requestId,
    "x-nipmod-response-time-ms": "1",
    "x-ratelimit-limit": "120",
    "x-ratelimit-policy": "external-search",
    "x-ratelimit-remaining": "119",
    "x-ratelimit-reset": "2026-05-23T06:30:00.000Z",
    "x-ratelimit-store": "memory-fallback"
  });
}

function apiError(status: number, code: string, error: string) {
  return {
    code,
    error,
    retryable: false,
    source: null,
    status,
    type: "dev.nipmod.api-error.v1"
  };
}

function searchFixture() {
  return {
    generatedAt: "2026-05-23T00:00:00.000Z",
    partial: false,
    query: "undici",
    records: [
      {
        id: "npm:undici",
        name: "undici",
        source: "npm",
        trust: {
          decision: "recommended",
          score: 91
        },
        type: "dev.nipmod.external-package.v1"
      }
    ],
    selection: {
      candidateCount: 1,
      candidates: [
        {
          gate: "pass",
          id: "npm:undici",
          rank: {
            commandPenalty: 0,
            exactMatch: 18,
            metadataPenalty: 0,
            metricsBonus: 8,
            prefixMatch: 0,
            qualityPenalty: 0,
            recencyBonus: 0,
            score: 125,
            sourceReliabilityBonus: 8,
            textMatch: 0,
            trustScore: 91
          },
          reasons: ["Selected by agent-selection-v1 ranking."],
          source: "npm"
        }
      ],
      gates: ["Remove avoid/high-risk candidates before ranking."],
      policy: "agent-selection-v1",
      recommendedId: "npm:undici",
      rankSignals: ["trust score", "exact match"]
    },
    sourceReports: [],
    sourceSummary: { empty: 0, failed: 0, ok: 1, requested: 1 },
    sources: ["npm"],
    total: 1,
    type: "dev.nipmod.external-search.v1"
  };
}

function openApiFixture() {
  return {
    "x-nipmod-agent-flow": ["search", "inspect", "install-plan", "host-approval", "optional-archive-confirm"],
    "x-nipmod-safety-boundary": {
      hostedApiExecutesCommands: false,
      hostedApiReadsCallerWorkspace: false,
      hostedApiWritesCallerWorkspace: false,
      installPlanRequiresHostApproval: true,
      packageMetadataIsInstruction: false,
      searchScoreIsInstallPermission: false
    },
    info: {
      title: "Nipmod API",
      version: "2026-05-23"
    },
    openapi: "3.1.0",
    paths: {
      "/api/openapi": {
        get: operation("getOpenApiContract")
      },
      "/api/keys/beta": {
        post: operation("issueBetaApiKey")
      },
      "/api/archive/prepare": {
        get: operation("prepareArchiveRecord"),
        post: operation("prepareArchiveRecordFromBody")
      },
      "/api/archive/confirm": {
        post: operation("confirmArchiveRecord")
      },
      "/api/archive/search": {
        get: operation("searchArchiveRecords")
      },
      "/api/archive/status": {
        get: operation("getArchiveStatus")
      },
      "/api/inspect": {
        get: operation("inspectPackage")
      },
      "/api/install-plan": {
        get: operation("createInstallPlan"),
        post: operation("createInstallPlanFromRecord")
      },
      "/api/mcp": {
        post: operation("callHostedMcp")
      },
      "/api/resolve": {
        get: operation("resolvePackages")
      },
      "/api/search": {
        get: operation("searchPackages")
      },
      "/api/sources/health": {
        get: operation("getSourceHealth")
      },
      "/api/usage/stats": {
        get: operation("getUsageStats")
      }
    }
  };
}

function operation(operationId: string) {
  return {
    operationId,
    responses: {
      "200": {
        description: "OK"
      }
    },
    summary: operationId
  };
}
