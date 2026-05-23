import { afterEach, describe, expect, test, vi } from "vitest";
import { GET, OPTIONS } from "../app/api/sources/health/route";

describe("source health route", () => {
  afterEach(() => {
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
        publicBeta: true
      },
      probe: {
        mode: "capability"
      },
      summary: {
        workspaceWritesFromHostedApi: false
      },
      type: "dev.nipmod.source-health.v1"
    });
    expect(body.usage).toMatchObject({ driver: "supabase-rest" });
    expect(typeof body.usage.configured).toBe("boolean");
    expect(body.sources.map((source: { source: string }) => source.source)).toEqual([
      "npm",
      "pypi",
      "github",
      "huggingface-model",
      "huggingface-dataset",
      "mcp"
    ]);
    expect(body.sources.every((source: { installPlanWritesWorkspace: boolean }) => source.installPlanWritesWorkspace === false)).toBe(true);
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

  test("can run bounded live source probes on demand", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: true }))
    );

    const response = await GET(new Request("https://nipmod.com/api/sources/health?probe=live"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.probe.mode).toBe("live");
    expect(body.summary.liveOk).toBe(6);
    expect(body.summary.liveFailed).toBe(0);
    expect(body.sources.every((source: { live?: { durationMs: number; status: string } }) => source.live?.status === "ok")).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(6);
  });

  test("supports CORS preflight", () => {
    const response = OPTIONS(new Request("https://nipmod.com/api/sources/health"));

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-methods")).toContain("GET");
  });
});
