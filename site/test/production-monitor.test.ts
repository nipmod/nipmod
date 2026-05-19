import { describe, expect, test } from "vitest";
import { readMonitorDestinationsFromEnv, runProductionMonitor, type MonitorEndpointConfig } from "../lib/production-monitor";

const endpoints: MonitorEndpointConfig = {
  discovery: "https://nipmod.test/.well-known/nipmod.json",
  home: "https://nipmod.test",
  nodeHealth: "https://node.nipmod.test/health",
  registry: "https://nipmod.test/registry/packages.json",
  scoutHealth: "https://nipmod.test/scout/health",
  trust: "https://nipmod.test/trust",
  witnessHealth: "https://witness.nipmod.test/health"
};

describe("production monitor", () => {
  test("probe mode proves both alert deliveries and redacts destinations", async () => {
    const posts: Array<{ authorization: string | null; url: string }> = [];
    const result = await runProductionMonitor({
      destinations: [
        { bearerToken: "primary-token", url: "https://nipmod.test/api/alerts/primary" },
        { bearerToken: "secondary-token", url: "https://nipmod.test/api/alerts/secondary" }
      ],
      endpoints,
      fetchFn: fakeFetch({ posts }),
      mode: "probe",
      now: Date.parse("2026-05-19T20:00:00.000Z"),
      runId: "probe-run"
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("probe");
    expect(result.alertTriggered).toBe(true);
    expect(result.deliverySummary).toEqual({ failed: 0, sent: 2, total: 2 });
    expect(result.deliveries.map((delivery) => delivery.destination)).toEqual([
      "sha256:9d72d221e8c79280",
      "sha256:4b8202f2cf45d0e6"
    ]);
    expect(JSON.stringify(result)).not.toContain("primary-token");
    expect(JSON.stringify(result)).not.toContain("secondary-token");
    expect(posts.map((post) => post.authorization)).toEqual(["Bearer primary-token", "Bearer secondary-token"]);
  });

  test("healthy normal mode does not send an alert", async () => {
    const posts: Array<{ authorization: string | null; url: string }> = [];
    const result = await runProductionMonitor({
      destinations: [{ bearerToken: "primary-token", url: "https://nipmod.test/api/alerts/primary" }],
      endpoints,
      fetchFn: fakeFetch({ posts }),
      mode: "normal"
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("healthy");
    expect(result.alertTriggered).toBe(false);
    expect(posts).toEqual([]);
  });

  test("failed checks trigger a critical alert and keep the result failing", async () => {
    const posts: Array<{ authorization: string | null; url: string }> = [];
    const result = await runProductionMonitor({
      destinations: [{ bearerToken: "primary-token", url: "https://nipmod.test/api/alerts/primary" }],
      endpoints,
      fetchFn: fakeFetch({ overrides: { "https://node.nipmod.test/health": { status: "down" } }, posts }),
      mode: "normal"
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("firing");
    expect(result.summary.failedChecks).toBe(1);
    expect(result.checks.find((check) => check.name === "node_health")).toMatchObject({
      error: "node health status mismatch",
      status: "fail"
    });
    expect(posts).toHaveLength(1);
  });

  test("probe mode fails closed when no alert destinations are configured", async () => {
    const result = await runProductionMonitor({
      destinations: [],
      endpoints,
      fetchFn: fakeFetch(),
      mode: "probe"
    });

    expect(result.ok).toBe(false);
    expect(result.deliverySummary).toEqual({ failed: 1, sent: 0, total: 1 });
    expect(result.deliveries[0]).toMatchObject({
      destination: "none",
      error: "no alert destinations configured",
      status: "failed"
    });
  });

  test("environment destinations default to the public alert sinks", () => {
    expect(
      readMonitorDestinationsFromEnv({
        NIPMOD_ALERT_PRIMARY_SINK_TOKEN: " primary ",
        NIPMOD_ALERT_SECONDARY_SINK_TOKEN: " secondary ",
        NIPMOD_SITE_ORIGIN: "https://example.test/"
      } as unknown as NodeJS.ProcessEnv)
    ).toEqual([
      { bearerToken: "primary", url: "https://example.test/api/alerts/primary" },
      { bearerToken: "secondary", url: "https://example.test/api/alerts/secondary" }
    ]);
  });
});

function fakeFetch({
  overrides = {},
  posts = []
}: {
  overrides?: Record<string, unknown>;
  posts?: Array<{ authorization: string | null; url: string }>;
} = {}): typeof fetch {
  return (async (input, init) => {
    const url = String(input);
    if (init?.method === "POST") {
      posts.push({
        authorization: new Headers(init.headers).get("authorization"),
        url
      });
      return Response.json({ ok: true }, { status: 202 });
    }
    const payload = overrides[url] ?? fixture(url);
    if (typeof payload === "string") {
      return new Response(payload, {
        headers: { "content-type": "text/html; charset=utf-8" },
        status: 200
      });
    }
    return Response.json(payload);
  }) as typeof fetch;
}

function fixture(url: string): unknown {
  switch (url) {
    case endpoints.home:
      return "<html>nipmod</html>";
    case endpoints.trust:
      return "<html>Verified registry Current public roots Release key</html>";
    case endpoints.discovery:
      return {
        node: { health: endpoints.nodeHealth },
        registry: { url: endpoints.registry },
        type: "dev.nipmod.discovery.v1",
        witness: { health: endpoints.witnessHealth }
      };
    case endpoints.registry:
      return {
        packages: [
          {
            digest: "a".repeat(64),
            name: "agent-tool",
            trust: {
              evidence: {
                sourceProvenanceVerified: true,
                transparencyLogIncluded: true,
                transparencyLogVerified: true
              },
              level: "verified",
              score: 100
            }
          }
        ]
      };
    case endpoints.nodeHealth:
      return { status: "ok" };
    case endpoints.witnessHealth:
      return { lastError: null, ok: true };
    case endpoints.scoutHealth:
      return { ok: true };
    default:
      throw new Error(`unexpected fixture url: ${url}`);
  }
}
