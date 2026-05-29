import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { POST as adminKeysPost } from "../app/api/admin/keys/route";
import { GET as adminSummaryGet } from "../app/api/admin/summary/route";
import { POST as primaryAlertPost } from "../app/api/alerts/primary/route";
import { POST as secondaryAlertPost } from "../app/api/alerts/secondary/route";
import { POST as archiveConfirmPost } from "../app/api/archive/confirm/route";
import { GET as archivePrepareGet, POST as archivePreparePost } from "../app/api/archive/prepare/route";
import { GET as archiveSearchGet } from "../app/api/archive/search/route";
import { GET as archiveStatusGet } from "../app/api/archive/status/route";
import { GET as inspectGet } from "../app/api/inspect/route";
import { GET as installPlanGet, POST as installPlanPost } from "../app/api/install-plan/route";
import { POST as betaKeyPost } from "../app/api/keys/beta/route";
import { GET as mcpGet, POST as mcpPost } from "../app/api/mcp/route";
import { GET as monitorGet } from "../app/api/monitor/route";
import { GET as openApiGet } from "../app/api/openapi/route";
import { GET as resolveGet } from "../app/api/resolve/route";
import { GET as searchGet } from "../app/api/search/route";
import { GET as sourceHealthGet } from "../app/api/sources/health/route";
import { GET as publicStatsGet } from "../app/api/stats/route";
import { GET as usageStatsGet } from "../app/api/usage/stats/route";
import { deriveApiKeyDigestForStorage } from "../lib/api-auth";

const siteRoot = new URL("..", import.meta.url);
const apiRouteFiles = [
  "app/api/admin/keys/route.ts",
  "app/api/admin/summary/route.ts",
  "app/api/account/chat/route.ts",
  "app/api/account/keys/route.ts",
  "app/api/account/session/route.ts",
  "app/api/alerts/primary/route.ts",
  "app/api/alerts/secondary/route.ts",
  "app/api/archive/confirm/route.ts",
  "app/api/archive/prepare/route.ts",
  "app/api/archive/search/route.ts",
  "app/api/archive/status/route.ts",
  "app/api/inspect/route.ts",
  "app/api/install-plan/route.ts",
  "app/api/keys/beta/route.ts",
  "app/api/mcp/route.ts",
  "app/api/monitor/route.ts",
  "app/api/openapi/route.ts",
  "app/api/resolve/route.ts",
  "app/api/search/route.ts",
  "app/api/sources/health/route.ts",
  "app/api/stats/route.ts",
  "app/api/usage/stats/route.ts"
];

const routeAuthClass = new Map<string, "account-session" | "api-key" | "bearer-token" | "public-key-issuer">([
  ["/api/admin/keys", "api-key"],
  ["/api/admin/summary", "api-key"],
  ["/api/account/chat", "account-session"],
  ["/api/account/keys", "account-session"],
  ["/api/account/session", "account-session"],
  ["/api/alerts/primary", "bearer-token"],
  ["/api/alerts/secondary", "bearer-token"],
  ["/api/archive/confirm", "api-key"],
  ["/api/archive/prepare", "api-key"],
  ["/api/archive/search", "api-key"],
  ["/api/archive/status", "api-key"],
  ["/api/inspect", "api-key"],
  ["/api/install-plan", "api-key"],
  ["/api/keys/beta", "public-key-issuer"],
  ["/api/mcp", "api-key"],
  ["/api/monitor", "bearer-token"],
  ["/api/openapi", "api-key"],
  ["/api/resolve", "api-key"],
  ["/api/search", "api-key"],
  ["/api/sources/health", "api-key"],
  ["/api/stats", "api-key"],
  ["/api/usage/stats", "api-key"]
]);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("API access boundary", () => {
  test("classifies every API route and keeps the auth contract explicit", () => {
    expect(routeAuthClass.size).toBe(apiRouteFiles.length);

    for (const file of apiRouteFiles) {
      const path = routePathFromFile(file);
      const source = readFileSync(new URL(file, siteRoot), "utf8");
      const authClass = routeAuthClass.get(path);

      expect(authClass, `${file} must be classified`).toBeTruthy();
      if (authClass === "api-key") {
        expect(
          source.includes("requireApiKey: true") || source.includes('from "../search/route"'),
          `${path} must require a Nipmod API key or re-export a key-gated route`
        ).toBe(true);
      } else if (authClass === "bearer-token") {
        expect(
          source.includes("hasValidBearerToken") || source.includes("handleAlertSinkPost"),
          `${path} must use bearer-token protection`
        ).toBe(true);
      } else if (authClass === "account-session") {
        expect(
          source.includes("getCurrentAccountUser") || source.includes("accountAuthConfig"),
          `${path} must use account session protection or report account session state`
        ).toBe(true);
      } else {
        expect(source).toContain("issueSelfServeBetaApiKey");
        expect(source).not.toContain("requireApiKey: true");
      }
    }
  });

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

  test("operational bearer-token routes reject unauthenticated requests", async () => {
    vi.stubEnv("NIPMOD_MONITOR_SECRET", "monitor-secret");
    vi.stubEnv("NIPMOD_ALERT_PRIMARY_SINK_TOKEN", "primary-secret");
    vi.stubEnv("NIPMOD_ALERT_SECONDARY_SINK_TOKEN", "secondary-secret");

    const monitor = await monitorGet(new Request("https://nipmod.com/api/monitor"));
    const primary = await primaryAlertPost(new Request("https://nipmod.com/api/alerts/primary", { method: "POST" }));
    const secondary = await secondaryAlertPost(new Request("https://nipmod.com/api/alerts/secondary", { method: "POST" }));

    expect(monitor.status).toBe(401);
    expect(primary.status).toBe(401);
    expect(secondary.status).toBe(401);
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

function routePathFromFile(file: string): string {
  const path = `/${relative("app", file).replace(/\/route\.ts$/, "")}`;
  return path.replace(/\[[^\]]+\]/g, "<param>");
}
