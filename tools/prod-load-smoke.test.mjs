import { describe, expect, test } from "vitest";
import { runLoadSmoke } from "./prod-load-smoke.mjs";

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
        trust: "https://nipmod.test/trust"
      }
    });

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === "node_health_load")).toMatchObject({
      status: "fail"
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
    return new Response("<main>Verified registry Current public roots Release key</main>", {
      headers: { "content-type": "text/html" }
    });
  }
  return new Response('<main>nipmod <a href="/trust">Trust</a></main>', {
    headers: { "content-type": "text/html" }
  });
}
