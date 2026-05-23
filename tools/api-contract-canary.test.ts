import { describe, expect, test, vi } from "vitest";
import { runApiContractCanary } from "./api-contract-canary.ts";

describe("api contract canary", () => {
  test("passes stable success and error contracts", async () => {
    const fetchFn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const requestId = new Headers(init?.headers).get("x-request-id") ?? "missing-request-id";
      const headers = contractHeaders(requestId);
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
      return Response.json({ records: [], sourceReports: [], type: "dev.nipmod.external-search.v1" }, { headers, status: 200 });
    }) as unknown as typeof fetch;

    const result = await runApiContractCanary({ baseUrl: "https://nipmod.test", fetchFn });

    expect(result.ok).toBe(true);
    expect(result.summary).toEqual({ fail: 0, pass: 5, total: 5 });
    expect(fetchFn).toHaveBeenCalledTimes(5);
  });

  test("fails when validation errors omit rate-limit headers", async () => {
    const fetchFn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const requestId = new Headers(init?.headers).get("x-request-id") ?? "missing-request-id";
      const headers = contractHeaders(requestId);
      if (String(input).includes("/api/search?q=&")) {
        headers.delete("x-ratelimit-store");
        return Response.json(apiError(400, "invalid_query", "query must not be empty"), { headers, status: 400 });
      }
      return Response.json({ records: [], sourceReports: [], type: "dev.nipmod.external-search.v1" }, { headers, status: 200 });
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
    expect(result.checks[0].error).toContain("missing rate-limit header x-ratelimit-store");
  });

  test("fails malformed API error payloads", async () => {
    const fetchFn = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
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
    expect(result.checks[0].error).toContain("API error type mismatch");
  });
});

function contractHeaders(requestId: string) {
  return new Headers({
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
    "content-type": "application/json",
    "server-timing": "app;dur=1",
    "x-nipmod-api-version": "2026-05-22",
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
