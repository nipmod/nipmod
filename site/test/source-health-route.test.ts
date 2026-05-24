import { afterEach, describe, expect, test, vi } from "vitest";
import { GET, OPTIONS, resetSourceHealthProbeCacheForTests } from "../app/api/sources/health/route";

describe("source health route", () => {
  afterEach(() => {
    resetSourceHealthProbeCacheForTests();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("publishes source capability metadata without secrets or workspace writes", async () => {
    const response = await GET(new Request("https://nipmod.com/api/sources/health", { headers: { "x-request-id": "source-health-test" } }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("x-nipmod-request-id")).toBe("source-health-test");
    expect(body).toMatchObject({
      apiAccess: {
        keyRegistry: {
          configured: false,
          driver: "env-or-supabase-rest",
          hashingConfigured: false,
          registryConfigured: false
        },
        publicBeta: true
      },
      probe: {
        cacheTtlMs: expect.any(Number),
        mode: "capability"
      },
      rateLimit: {
        activeStore: "memory-fallback",
        configured: false,
        distributedActive: false,
        driver: "supabase-rpc",
        fallbackReason: null,
        fallback: "memory"
      },
      summary: {
        workspaceWritesFromHostedApi: false
      },
      type: "dev.nipmod.source-health.v1"
    });
    expect(body.usage).toMatchObject({ driver: "supabase-rest" });
    expect(typeof body.usage.configured).toBe("boolean");
    expect(body.rateLimit.missing).toEqual(["NIPMOD_ARCHIVE_SUPABASE_URL", "NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY"]);
    expect(body.sources.map((source: { source: string }) => source.source)).toEqual([
      "npm",
      "pypi",
      "github",
      "huggingface-model",
      "huggingface-dataset",
      "mcp"
    ]);
    expect(body.sources.every((source: { installPlanWritesWorkspace: boolean }) => source.installPlanWritesWorkspace === false)).toBe(true);
    expect(body.sources[0].circuit).toMatchObject({
      failureCount: 0,
      lastErrorCode: null,
      openedUntil: null,
      status: "closed"
    });
    expect(body.sources[0].resolver).toMatchObject({
      endpointHost: "registry.npmjs.org",
      normalization: {
        installPlanWritesWorkspace: false,
        metadataIsInstruction: false,
        originalUrlPreserved: true,
        sourceOwnerRetained: true
      },
      resolverVersion: "source-resolver-v2",
      searchStrategy: "registry-ranked-search"
    });
    expect(JSON.stringify(body)).not.toMatch(/secret|service-role|bearer|publishable-key/i);
  });

  test("publishes distributed rate-limit activation without leaking secrets", async () => {
    const resetAt = new Date(Date.now() + 60_000).toISOString();
    vi.stubEnv("NIPMOD_ARCHIVE_SUPABASE_URL", "https://db.example.test");
    vi.stubEnv("NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([{ allowed: true, count: 1, remaining: 9, reset_at: resetAt }]), { status: 200 }))
    );

    const response = await GET(new Request("https://nipmod.com/api/sources/health", { headers: { "user-agent": "source-health-test" } }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-ratelimit-store")).toBe("supabase");
    expect(body.rateLimit).toMatchObject({
      activeStore: "supabase",
      configured: true,
      distributedActive: true,
      fallbackReason: null,
      driver: "supabase-rpc",
      missing: []
    });
    expect(JSON.stringify(body)).not.toContain("service-role-key");
  });

  test("publishes a coarse distributed rate-limit fallback reason", async () => {
    vi.stubEnv("NIPMOD_ARCHIVE_SUPABASE_URL", "https://db.example.test");
    vi.stubEnv("NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "missing_function" }, { status: 404 })));

    const response = await GET(new Request("https://nipmod.com/api/sources/health", { headers: { "user-agent": "source-health-fallback-test" } }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-ratelimit-store")).toBe("memory-fallback");
    expect(response.headers.get("x-ratelimit-fallback-reason")).toBe("distributed_rpc_http_404");
    expect(body.rateLimit).toMatchObject({
      activeStore: "memory-fallback",
      configured: true,
      distributedActive: false,
      fallbackReason: "distributed_rpc_http_404",
      missing: []
    });
    expect(JSON.stringify(body)).not.toContain("service-role-key");
  });

  test("can run bounded live source probes on demand", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: true }))
    );

    const response = await GET(new Request("https://nipmod.com/api/sources/health?probe=live"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.probe.mode).toBe("live");
    expect(body.probe.cacheTtlMs).toBeGreaterThan(0);
    expect(body.probe.timeoutMsBySource.mcp).toBeGreaterThan(body.probe.timeoutMs);
    expect(body.summary.liveOk).toBe(6);
    expect(body.summary.liveFailed).toBe(0);
    expect(body.summary.liveCached).toBe(0);
    expect(
      body.sources.every(
        (source: { live?: { cached: boolean; checkedAt: string; degraded: boolean; durationMs: number; probePath: string; retryable: boolean; status: string } }) =>
          source.live?.status === "ok" &&
          source.live.cached === false &&
          source.live.degraded === false &&
          source.live.probePath === "upstream-live" &&
          source.live.retryable === false &&
          typeof source.live.checkedAt === "string"
      )
    ).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(6);
  });

  test("marks failed live probes as degraded and retryable when upstream rejects requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "busy" }, { status: 503 }))
    );

    const response = await GET(new Request("https://nipmod.com/api/sources/health?probe=live"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary.liveOk).toBe(1);
    expect(body.summary.liveFailed).toBe(5);
    expect(
      body.sources
        .filter((source: { source: string }) => source.source !== "mcp")
        .every(
          (source: { live?: { degraded: boolean; retryable: boolean; status: string; statusCode: number } }) =>
            source.live?.status === "failed" && source.live.degraded === true && source.live.retryable === true && source.live.statusCode === 503
        )
    ).toBe(true);
    expect(body.sources.find((source: { source: string }) => source.source === "mcp").live).toMatchObject({
      degraded: false,
      fallback: {
        recordCount: 1,
        snapshot: "2026-05-22",
        type: "pinned-public-registry-snapshot"
      },
      probePath: "resolver-fallback",
      retryable: false,
      status: "ok",
      statusCode: null
    });
  });

  test("keeps MCP source usable through pinned resolver fallback when the registry times out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (new URL(url).hostname === "registry.modelcontextprotocol.io") {
          throw new DOMException("timeout", "AbortError");
        }
        return Response.json({ ok: true });
      })
    );

    const response = await GET(new Request("https://nipmod.com/api/sources/health?probe=live"));
    const body = await response.json();
    const mcp = body.sources.find((source: { source: string }) => source.source === "mcp");

    expect(response.status).toBe(200);
    expect(body.summary.liveOk).toBe(6);
    expect(body.summary.liveFailed).toBe(0);
    expect(mcp.live).toMatchObject({
      degraded: false,
      endpointHost: "registry.modelcontextprotocol.io",
      fallback: {
        recordCount: 1,
        snapshot: "2026-05-22",
        type: "pinned-public-registry-snapshot"
      },
      probePath: "resolver-fallback",
      retryable: false,
      status: "ok",
      statusCode: null
    });
  });

  test("caches repeated live source probes within the probe TTL", async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await GET(new Request("https://nipmod.com/api/sources/health?probe=live"));
    const second = await GET(new Request("https://nipmod.com/api/sources/health?probe=live"));
    const firstBody = await first.json();
    const secondBody = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(firstBody.summary.liveCached).toBe(0);
    expect(secondBody.summary.liveCached).toBe(6);
    expect(secondBody.sources.every((source: { live?: { cached: boolean } }) => source.live?.cached === true)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  test("supports CORS preflight", () => {
    const response = OPTIONS(new Request("https://nipmod.com/api/sources/health"));

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-methods")).toContain("GET");
  });
});
