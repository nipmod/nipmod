import { describe, expect, test } from "vitest";
import { runLoadSmoke } from "./prod-load-smoke.ts";

describe("production load smoke", () => {
  test("crawls allowlisted pages and runs bounded concurrent probes", async () => {
    const calls = [];
    const result = await runLoadSmoke({
      concurrency: 2,
      fetchFn: async (url) => {
        calls.push(url);
        return responseFor(url);
      },
      iterations: 3,
      now: () => 1_776_444_800_000,
      targets: {
        home: "https://nipmod.test",
        nodeHealth: "https://node.nipmod.test/health",
        registry: "https://nipmod.test/registry/packages.json",
        security: "https://nipmod.test/security",
        trust: "https://nipmod.test/trust"
      }
    });

    expect(result).toMatchObject({
      ok: true,
      summary: {
        fail: 0,
        pass: 4,
        total: 4
      },
      type: "dev.nipmod.prod-load-smoke.v1"
    });
    expect(calls).toContain("https://nipmod.test/trust");
    expect(calls.filter((url) => url === "https://nipmod.test/registry/packages.json")).toHaveLength(3);
  });

  test("fails when a target returns a server error", async () => {
    const result = await runLoadSmoke({
      concurrency: 1,
      fetchFn: async (url) => (url.endsWith("/health") ? new Response("down", { status: 503 }) : responseFor(url)),
      iterations: 1,
      targets: {
        home: "https://nipmod.test",
        nodeHealth: "https://node.nipmod.test/health",
        registry: "https://nipmod.test/registry/packages.json",
        security: "https://nipmod.test/security",
        trust: "https://nipmod.test/trust"
      }
    });

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === "node_health_load")).toMatchObject({
      status: "fail"
    });
  });

  test("allows an intentionally empty public registry", async () => {
    const result = await runLoadSmoke({
      concurrency: 1,
      fetchFn: async (url) => (url.endsWith("/registry/packages.json") ? emptyRegistryResponse() : responseFor(url)),
      iterations: 1,
      targets: {
        home: "https://nipmod.test",
        nodeHealth: "https://node.nipmod.test/health",
        registry: "https://nipmod.test/registry/packages.json",
        security: "https://nipmod.test/security",
        trust: "https://nipmod.test/trust"
      }
    });

    expect(result.ok).toBe(true);
    expect(result.checks.find((check) => check.name === "registry_load")).toMatchObject({
      status: "pass"
    });
  });
});

function responseFor(url) {
  if (url.endsWith("/registry/packages.json")) {
    return Response.json({ packages: [{ name: "@nipmod/test" }] });
  }
  if (url.endsWith("/health")) {
    return Response.json({ status: "ok" });
  }
  if (url.endsWith("/trust")) {
    return new Response("<main>What makes a package Five anchors Source</main>", {
      headers: { "content-type": "text/html" }
    });
  }
  if (url.endsWith("/security")) {
    return new Response("<main>Report with proof</main>", {
      headers: { "content-type": "text/html" }
    });
  }
  return new Response('<main>nipmod <a href="/trust">Trust</a></main>', {
    headers: { "content-type": "text/html" }
  });
}

function emptyRegistryResponse() {
  return Response.json({
    packages: [],
    skipped: [{ reason: "Seed archive cleared; public packages must be republished through the verified flow." }]
  });
}
