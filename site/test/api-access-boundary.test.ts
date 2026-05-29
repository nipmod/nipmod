import { afterEach, describe, expect, test, vi } from "vitest";
import { POST as adminKeysPost } from "../app/api/admin/keys/route";
import { GET as adminSummaryGet } from "../app/api/admin/summary/route";
import { POST as archiveConfirmPost } from "../app/api/archive/confirm/route";
import { GET as archivePrepareGet, POST as archivePreparePost } from "../app/api/archive/prepare/route";
import { GET as archiveSearchGet } from "../app/api/archive/search/route";
import { GET as archiveStatusGet } from "../app/api/archive/status/route";
import { GET as inspectGet } from "../app/api/inspect/route";
import { GET as installPlanGet, POST as installPlanPost } from "../app/api/install-plan/route";
import { POST as betaKeyPost } from "../app/api/keys/beta/route";
import { GET as mcpGet, POST as mcpPost } from "../app/api/mcp/route";
import { GET as openApiGet } from "../app/api/openapi/route";
import { GET as resolveGet } from "../app/api/resolve/route";
import { GET as searchGet } from "../app/api/search/route";
import { GET as sourceHealthGet } from "../app/api/sources/health/route";
import { GET as publicStatsGet } from "../app/api/stats/route";
import { GET as usageStatsGet } from "../app/api/usage/stats/route";
import { deriveApiKeyDigestForStorage } from "../lib/api-auth";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("API access boundary", () => {
  const protectedRoutes: Array<{ call: () => Promise<Response>; name: string }> = [
    {
      call: () => searchGet(new Request("https://nipmod.com/api/search?q=http%20client")),
      name: "GET /api/search"
    },
    {
      call: () => resolveGet(new Request("https://nipmod.com/api/resolve?q=http%20client")),
      name: "GET /api/resolve"
    },
    {
      call: () => inspectGet(new Request("https://nipmod.com/api/inspect?source=npm&name=undici")),
      name: "GET /api/inspect"
    },
    {
      call: () => installPlanGet(new Request("https://nipmod.com/api/install-plan?source=npm&name=undici")),
      name: "GET /api/install-plan"
    },
    {
      call: () => installPlanPost(new Request("https://nipmod.com/api/install-plan", { method: "POST" })),
      name: "POST /api/install-plan"
    },
    {
      call: () => archivePrepareGet(new Request("https://nipmod.com/api/archive/prepare?source=npm&name=undici")),
      name: "GET /api/archive/prepare"
    },
    {
      call: () => archivePreparePost(new Request("https://nipmod.com/api/archive/prepare", { method: "POST" })),
      name: "POST /api/archive/prepare"
    },
    {
      call: () => archiveConfirmPost(new Request("https://nipmod.com/api/archive/confirm", { method: "POST" })),
      name: "POST /api/archive/confirm"
    },
    {
      call: () => archiveSearchGet(new Request("https://nipmod.com/api/archive/search?q=undici")),
      name: "GET /api/archive/search"
    },
    {
      call: () => archiveStatusGet(new Request("https://nipmod.com/api/archive/status")),
      name: "GET /api/archive/status"
    },
    {
      call: () => mcpGet(new Request("https://nipmod.com/api/mcp")),
      name: "GET /api/mcp"
    },
    {
      call: () => mcpPost(new Request("https://nipmod.com/api/mcp", { method: "POST" })),
      name: "POST /api/mcp"
    },
    {
      call: () => openApiGet(new Request("https://nipmod.com/api/openapi")),
      name: "GET /api/openapi"
    },
    {
      call: () => sourceHealthGet(new Request("https://nipmod.com/api/sources/health")),
      name: "GET /api/sources/health"
    },
    {
      call: () => publicStatsGet(new Request("https://nipmod.com/api/stats")),
      name: "GET /api/stats"
    },
    {
      call: () => usageStatsGet(new Request("https://nipmod.com/api/usage/stats")),
      name: "GET /api/usage/stats"
    },
    {
      call: () => adminSummaryGet(new Request("https://nipmod.com/api/admin/summary")),
      name: "GET /api/admin/summary"
    },
    {
      call: () => adminKeysPost(new Request("https://nipmod.com/api/admin/keys", { method: "POST" })),
      name: "POST /api/admin/keys"
    }
  ];

  test.each(protectedRoutes)("$name requires an API key before request handling", async ({ call }) => {
    const response = await call();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toMatchObject({
      code: "api_key_required",
      error: "API key is required for this endpoint",
      retryable: false,
      status: 401,
      type: "dev.nipmod.api-error.v1"
    });
  });

  test("/api/keys/beta stays public but never mints on malformed input", async () => {
    const response = await betaKeyPost(
      new Request("https://nipmod.com/api/keys/beta", {
        body: "{",
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      code: "invalid_json",
      status: 400,
      type: "dev.nipmod.api-error.v1"
    });
    expect(body.code).not.toBe("api_key_required");
    expect(JSON.stringify(body)).not.toContain("nka_beta_");
  });

  test("protected package POST routes reject oversized JSON bodies after authentication", async () => {
    const rawKey = "nka_test_body_limit_key_1234567890";
    const hashSecret = "test-body-limit-secret";
    vi.stubEnv("NIPMOD_API_KEY_HASH_SECRET", hashSecret);
    vi.stubEnv("NIPMOD_API_KEY_HASHES", `test:beta:${deriveApiKeyDigestForStorage(rawKey, hashSecret)}`);
    const headers = {
      "content-type": "application/json",
      "x-nipmod-api-key": rawKey
    };
    const oversized = JSON.stringify({ record: "x".repeat(129 * 1024) });
    const routes = [
      () => installPlanPost(new Request("https://nipmod.com/api/install-plan", { body: oversized, headers, method: "POST" })),
      () => archivePreparePost(new Request("https://nipmod.com/api/archive/prepare", { body: oversized, headers, method: "POST" })),
      () => archiveConfirmPost(new Request("https://nipmod.com/api/archive/confirm", { body: oversized, headers, method: "POST" }))
    ];

    for (const call of routes) {
      const response = await call();
      const body = await response.json();

      expect(response.status).toBe(413);
      expect(body).toMatchObject({
        code: "payload_too_large",
        error: "request body is too large",
        retryable: false,
        status: 413,
        type: "dev.nipmod.api-error.v1"
      });
    }
  });
});
