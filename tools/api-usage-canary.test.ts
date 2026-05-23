import { describe, expect, test, vi } from "vitest";
import { parseEnvFile, runApiUsageCanary } from "./api-usage-canary.ts";

describe("API usage canary", () => {
  test("skips cleanly when Supabase usage env is not available", async () => {
    const result = await runApiUsageCanary({ env: {}, requestId: "usage-test-missing" });

    expect(result.ok).toBe(true);
    expect(result.summary).toMatchObject({ fail: 0, skip: 1, total: 1 });
    expect(result.checks[0]).toMatchObject({
      name: "usage_store_config",
      status: "skip"
    });
  });

  test("fails missing env when configured as required", async () => {
    const result = await runApiUsageCanary({ env: {}, requestId: "usage-test-required", requireConfigured: true });

    expect(result.ok).toBe(false);
    expect(result.summary).toMatchObject({ fail: 1, total: 1 });
  });

  test("proves a request is ingested into the usage table", async () => {
    const calls: string[] = [];
    const fetchFn = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/api/search")) {
        return Response.json({ total: 1, type: "dev.nipmod.external-search.v1" });
      }
      return Response.json([
        {
          created_at: "2026-05-23T00:00:00.000Z",
          request_id: "usage-test-ok",
          result_count: 1,
          route: "/api/search",
          status: 200
        }
      ]);
    }) as unknown as typeof fetch;

    const result = await runApiUsageCanary({
      env: {
        NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        NIPMOD_ARCHIVE_SUPABASE_URL: "https://db.example.test"
      },
      fetchFn,
      pollDelayMs: 1,
      requestId: "usage-test-ok"
    });

    expect(result.ok).toBe(true);
    expect(result.summary).toMatchObject({ fail: 0, pass: 2, total: 2 });
    expect(result.checks[1]).toMatchObject({
      data: {
        requestId: "usage-test-ok",
        route: "/api/search",
        status: 200
      },
      name: "usage_event_ingested",
      status: "pass"
    });
    expect(calls[0]).toBe("https://nipmod.com/api/search?q=http%20client&sources=npm&limit=1");
    expect(calls[1]).toContain("https://db.example.test/rest/v1/api_usage_events?");
    expect(JSON.stringify(result)).not.toContain("service-role-key");
  });

  test("parses env files without keeping quotes", () => {
    expect(parseEnvFile("NIPMOD_ARCHIVE_SUPABASE_URL='https://db.example.test'\nEMPTY=\"x\"")).toEqual({
      EMPTY: "x",
      NIPMOD_ARCHIVE_SUPABASE_URL: "https://db.example.test"
    });
  });
});
