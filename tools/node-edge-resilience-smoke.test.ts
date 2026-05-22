import { describe, expect, test } from "vitest";
import { runNodeEdgeResilienceSmoke } from "./node-edge-resilience-smoke.ts";

describe("node edge resilience smoke", () => {
  test("proves bounded public read and auth-fail paths without 5xx", async () => {
    const fixture = createFixture();
    const result = await runNodeEdgeResilienceSmoke({
      baseUrl: fixture.baseUrl,
      fetchFn: fixture.fetchFn,
      now: Date.parse("2026-05-16T14:30:00.000Z"),
      requestBudget: 5
    });

    expect(result.ok).toBe(true);
    expect(result.summary).toEqual({ fail: 0, pass: 4, total: 4 });
    expect(result.requestBudget).toEqual({ max: 5, used: 5 });
    expect(result.checks.map((check) => check.name)).toEqual([
      "health_before",
      "repo_catalog_bounded",
      "receive_pack_auth_gate",
      "health_after"
    ]);
  });

  test("fails closed when the bounded probe would exceed the request budget", async () => {
    await expect(
      runNodeEdgeResilienceSmoke({
        baseUrl: "https://node.nipmod.test",
        fetchFn: createFixture().fetchFn,
        requestBudget: 4
      })
    ).rejects.toThrow(/request budget exceeded/i);
  });

  test("fails when a public read path returns a 5xx", async () => {
    const fixture = createFixture({
      overrides: {
        "GET https://node.nipmod.test/api/v1/repos": jsonResponse({ error: "boom" }, 503)
      }
    });
    const result = await runNodeEdgeResilienceSmoke({
      baseUrl: fixture.baseUrl,
      fetchFn: fixture.fetchFn,
      requestBudget: 5
    });

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === "repo_catalog_bounded")).toMatchObject({
      status: "fail"
    });
  });

  test("fails when repo catalog response exceeds the crawler cap", async () => {
    const fixture = createFixture({
      overrides: {
        "GET https://node.nipmod.test/api/v1/repos": textResponse("x".repeat(300_000), 200, "application/json")
      }
    });
    const result = await runNodeEdgeResilienceSmoke({
      baseUrl: fixture.baseUrl,
      fetchFn: fixture.fetchFn,
      maxCatalogBytes: 256 * 1024,
      requestBudget: 5
    });

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === "repo_catalog_bounded")).toMatchObject({
      error: expect.stringContaining("exceeded 262144 bytes"),
      status: "fail"
    });
  });

  test("fails when unauthenticated receive-pack is not auth-gated", async () => {
    const fixture = createFixture({
      overrides: {
        "POST https://node.nipmod.test/z6MknipmodUnauthProbe/receive-pack-abuse/git-receive-pack": textResponse("accepted", 200)
      }
    });
    const result = await runNodeEdgeResilienceSmoke({
      baseUrl: fixture.baseUrl,
      fetchFn: fixture.fetchFn,
      requestBudget: 5
    });

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === "receive_pack_auth_gate")).toMatchObject({
      status: "fail"
    });
  });
});

function createFixture({ overrides = {} } = {}) {
  const baseUrl = "https://node.nipmod.test";
  const owner = "z6MkgXXLN2Qt3GKL9KJPo7SH7WGcQqRYcpT5MrwbTJ9qHpZu";
  const repo = "repo-readme-audit";
  const routes = {
    [`GET ${baseUrl}/health`]: jsonResponse({ status: "ok" }),
    [`GET ${baseUrl}/api/v1/repos`]: jsonResponse([
      {
        clone_url: `${baseUrl}/${owner}/${repo}.git`,
        name: repo,
        owner_did: `did:key:${owner}`
      }
    ]),
    [`POST ${baseUrl}/z6MknipmodUnauthProbe/receive-pack-abuse/git-receive-pack`]: textResponse("", 401, "text/plain", {
      "www-authenticate": "Signature realm=\"gitlawb-alpha\""
    }),
    ...overrides
  };
  return {
    baseUrl,
    fetchFn: async (url, init = {}) => {
      const method = init.method ?? "GET";
      const response = routes[`${method} ${url}`];
      if (!response) {
        throw new Error(`unexpected fetch ${method} ${url}`);
      }
      return response;
    }
  };
}

function jsonResponse(payload, status = 200) {
  const body = JSON.stringify(payload);
  return textResponse(body, status, "application/json");
}

function textResponse(body, status = 200, contentType = "text/plain", headers = {}) {
  return {
    arrayBuffer: async () => Buffer.from(body),
    headers: new Headers({ "content-type": contentType, ...headers }),
    ok: status >= 200 && status < 300,
    status,
    text: async () => body
  };
}
