import { describe, expect, test, vi } from "vitest";
import { parseEnvFile, runRateLimitCanary } from "./rate-limit-canary.ts";

describe("rate limit canary", () => {
  test("uses live health even when local Supabase config is missing", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({
        rateLimit: {
          activeStore: "memory-fallback",
          configured: true,
          distributedActive: false,
          missing: []
        },
        type: "dev.nipmod.source-health.v1"
      })
    ) as unknown as typeof fetch;
    const result = await runRateLimitCanary({ env: {}, fetchFn });

    expect(result.ok).toBe(true);
    expect(result.summary).toEqual({ fail: 0, pass: 1, skip: 1, total: 2 });
    expect(result.checks.map((check) => check.name)).toEqual(["live_rate_limit_store", "rate_limit_store_config"]);
    expect(result.checks[0].data.nextAction).toBe("Run with --require-configured and a local env file to perform a direct Supabase RPC probe.");
  });

  test("fails missing config when required", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({
        rateLimit: {
          activeStore: "memory-fallback",
          configured: true,
          distributedActive: false,
          missing: []
        },
        type: "dev.nipmod.source-health.v1"
      })
    ) as unknown as typeof fetch;
    const result = await runRateLimitCanary({
      env: {},
      fetchFn,
      requireConfigured: true
    });

    expect(result.ok).toBe(false);
    expect(result.checks[1]).toMatchObject({ name: "rate_limit_store_config", status: "fail" });
  });

  test("fails live fallback when distributed store is required", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({
        rateLimit: {
          activeStore: "memory-fallback",
          configured: true,
          distributedActive: false,
          missing: []
        },
        type: "dev.nipmod.source-health.v1"
      })
    ) as unknown as typeof fetch;
    const result = await runRateLimitCanary({
      env: {},
      fetchFn,
      requireActive: true
    });

    expect(result.ok).toBe(false);
    expect(result.checks[0]).toMatchObject({ name: "live_rate_limit_store", status: "fail" });
    expect(result.checks[1]).toMatchObject({ name: "rate_limit_store_config", status: "skip" });
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
    expect(result.checks.map((check) => check.name)).toEqual(["live_rate_limit_store", "rate_limit_rpc"]);
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
    expect(result.checks[1]).toMatchObject({
      data: {
        code: "PGRST202",
        exposedToDataApi: false,
        nextAction: "Apply the rate-limit SQL migration and confirm the RPC is exposed to the Supabase Data API.",
        status: 404
      },
      name: "rate_limit_rpc",
      status: "fail"
    });
    expect(JSON.stringify(result)).not.toContain("service-role");
  });

  test("prints remediation for live missing RPC exposure", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({
        rateLimit: {
          activeStore: "memory-fallback",
          configured: true,
          distributedActive: false,
          fallbackReason: "distributed_rpc_http_404",
          missing: []
        },
        type: "dev.nipmod.source-health.v1"
      })
    ) as unknown as typeof fetch;

    const result = await runRateLimitCanary({
      env: {},
      fetchFn,
      requireActive: true
    });

    expect(result.ok).toBe(false);
    expect(result.checks[0]).toMatchObject({
      data: {
        fallbackReason: "distributed_rpc_http_404",
        nextAction:
          "Apply supabase/migrations/20260523084500_api_rate_limit_buckets.sql and expose public.consume_api_rate_limit through the Supabase Data API."
      },
      name: "live_rate_limit_store",
      status: "fail"
    });
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
