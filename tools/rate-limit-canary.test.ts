import { describe, expect, test, vi } from "vitest";
import { parseEnvFile, runRateLimitCanary } from "./rate-limit-canary.ts";

describe("rate limit canary", () => {
  test("skips when Supabase config is missing unless required", async () => {
    const result = await runRateLimitCanary({ env: {}, fetchFn: vi.fn() as unknown as typeof fetch });

    expect(result.ok).toBe(true);
    expect(result.summary).toEqual({ fail: 0, pass: 0, skip: 1, total: 1 });
    expect(result.checks[0].name).toBe("rate_limit_store_config");
  });

  test("fails missing config when required", async () => {
    const result = await runRateLimitCanary({
      env: {},
      fetchFn: vi.fn() as unknown as typeof fetch,
      requireConfigured: true
    });

    expect(result.ok).toBe(false);
    expect(result.checks[0].status).toBe("fail");
  });

  test("passes direct RPC and live active store checks", async () => {
    const fetchFn = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/rest/v1/rpc/consume_api_rate_limit")) {
        return Response.json([{ allowed: true, count: 1, remaining: 9, reset_at: "2026-05-23T00:01:00.000Z" }]);
      }
      return Response.json({
        rateLimit: {
          activeStore: "supabase",
          configured: true,
          distributedActive: true,
          missing: []
        },
        type: "dev.nipmod.source-health.v1"
      });
    }) as unknown as typeof fetch;

    const result = await runRateLimitCanary({
      env: env(),
      fetchFn,
      now: new Date("2026-05-23T00:00:00.000Z"),
      requireActive: true,
      requestId: "test-request"
    });

    expect(result.ok).toBe(true);
    expect(result.summary).toEqual({ fail: 0, pass: 2, skip: 0, total: 2 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  test("detects RPC exposure failures without printing secrets", async () => {
    const fetchFn = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/rest/v1/rpc/consume_api_rate_limit")) {
        return Response.json({ code: "PGRST202", message: "function not found" }, { status: 404 });
      }
      return Response.json({
        rateLimit: {
          activeStore: "memory-fallback",
          configured: true,
          distributedActive: false,
          missing: []
        },
        type: "dev.nipmod.source-health.v1"
      });
    }) as unknown as typeof fetch;

    const result = await runRateLimitCanary({
      env: env(),
      fetchFn,
      requireActive: true,
      requestId: "test-request"
    });

    expect(result.ok).toBe(false);
    expect(result.checks[0]).toMatchObject({
      data: {
        code: "PGRST202",
        exposedToDataApi: false,
        status: 404
      },
      name: "rate_limit_rpc",
      status: "fail"
    });
    expect(JSON.stringify(result)).not.toContain("service-role");
  });

  test("parses quoted env files", () => {
    expect(parseEnvFile("NIPMOD_ARCHIVE_SUPABASE_URL='https://db.example.test'\nEMPTY=\"x\"")).toEqual({
      EMPTY: "x",
      NIPMOD_ARCHIVE_SUPABASE_URL: "https://db.example.test"
    });
  });
});

function env() {
  return {
    NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    NIPMOD_ARCHIVE_SUPABASE_URL: "https://db.example.test"
  };
}
