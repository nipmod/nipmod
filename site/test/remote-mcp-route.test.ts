import { afterEach, describe, expect, test, vi } from "vitest";
import { GET, OPTIONS, POST } from "../app/api/mcp/route";

async function postJson(body: unknown) {
  const response = await POST(
    new Request("https://nipmod.com/api/mcp", {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
  );
  return {
    body: await response.json(),
    response
  };
}

describe("hosted read-only MCP route", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("publishes endpoint metadata without workspace write tools", async () => {
    const response = await GET(new Request("https://nipmod.com/api/mcp", { headers: { "x-request-id": "mcp-route-test" } }));
    const body = await response.json();

    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-nipmod-request-id")).toBe("mcp-route-test");
    expect(body).toMatchObject({
      endpoint: "https://nipmod.com/api/mcp",
      limits: {
        maxBatchSize: 12,
        maxBodyBytes: 65_536
      },
      localServerCommand: "nipmod mcp serve",
      mode: "remote-read-only",
      type: "dev.nipmod.remote-mcp.v1"
    });
    expect(body.tools).toEqual([
      "nipmod.search",
      "nipmod.resolve",
      "nipmod.view",
      "nipmod.inspect",
      "nipmod.install_plan",
      "nipmod.external_install_plan",
      "nipmod.demo"
    ]);
    expect(body.notExposed).toContain("nipmod.install");
    expect(body.notExposed).toContain("nipmod.audit");
    expect(body.notExposed).toContain("nipmod.deep_scan");
    expect(body.writeBoundary).toContain("local deep scans");
  });

  test("supports CORS preflight for hosted MCP clients", async () => {
    const response = OPTIONS(new Request("https://nipmod.com/api/mcp", { headers: { "x-request-id": "mcp-options-test" } }));

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("x-nipmod-request-id")).toBe("mcp-options-test");
  });

  test("supports initialize and tools/list through JSON-RPC", async () => {
    const { body } = await postJson([
      {
        id: 1,
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          capabilities: {},
          clientInfo: { name: "route-test", version: "1.0.0" },
          protocolVersion: "2025-11-25"
        }
      },
      { id: 2, jsonrpc: "2.0", method: "tools/list" }
    ]);

    expect(body[0].result.serverInfo.name).toBe("nipmod-remote-readonly");
    expect(body[1].result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      "nipmod.search",
      "nipmod.resolve",
      "nipmod.view",
      "nipmod.inspect",
      "nipmod.install_plan",
      "nipmod.external_install_plan",
      "nipmod.demo"
    ]);
    expect(body[1].result.tools.every((tool: { annotations: { readOnlyHint: boolean } }) => tool.annotations.readOnlyHint)).toBe(true);
  });

  test("rejects oversized JSON-RPC request bodies before tool handling", async () => {
    const payload = `${" ".repeat(65_537)}`;
    const response = await POST(
      new Request("https://nipmod.com/api/mcp", {
        body: payload,
        headers: {
          "content-length": String(payload.length),
          "content-type": "application/json"
        },
        method: "POST"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.error).toMatchObject({
      code: -32013,
      message: "MCP request body exceeds 65536 bytes"
    });
  });

  test("rejects oversized JSON-RPC batches", async () => {
    const { body, response } = await postJson(
      Array.from({ length: 13 }, (_value, index) => ({
        id: index + 1,
        jsonrpc: "2.0",
        method: "ping"
      }))
    );

    expect(response.status).toBe(413);
    expect(body.error).toMatchObject({
      code: -32014,
      message: "MCP batch size exceeds 12"
    });
  });

  test("searches the empty public registry without local project args", async () => {
    const search = await postJson({
      id: 3,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: { limit: 5, query: "package" },
        name: "nipmod.search"
      }
    });
    expect(search.body.result.structuredContent.results).toEqual([]);
    expect(search.body.result.structuredContent.total).toBe(0);

    const inspect = await postJson({
      id: 4,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: { specifier: "gitlawb-repo-reader" },
        name: "nipmod.inspect"
      }
    });
    expect(inspect.body.error.message).toContain("no exact package found");
  });

  test("returns install plans but rejects write and local filesystem tools", async () => {
    const plan = await postJson({
      id: 5,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: { specifier: "gitlawb-repo-reader" },
        name: "nipmod.install_plan"
      }
    });
    expect(plan.body.error.message).toContain("no exact package found");

    const install = await postJson({
      id: 6,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: { confirmInstall: "write-lockfile", specifier: "gitlawb-repo-reader" },
        name: "nipmod.install"
      }
    });
    expect(install.body.error.message).toContain("does not expose nipmod.install");

    const projectDir = await postJson({
      id: 7,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: { projectDir: "/tmp", specifier: "gitlawb-repo-reader" },
        name: "nipmod.install_plan"
      }
    });
    expect(projectDir.body.error.message).toContain("projectDir is not accepted");
  });

  test("resolves external packages without claiming source ownership", async () => {
    vi.stubGlobal("fetch", mockExternalFetch);

    const search = await postJson({
      id: 8,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: { limit: 3, query: "telegram", sources: ["npm"] },
        name: "nipmod.resolve"
      }
    });
    expect(search.body.result.structuredContent.records[0]).toMatchObject({
      archive: { status: "external_indexed" },
      id: "npm:node-telegram-bot-api",
      source: "npm"
    });
    expect(search.body.result.structuredContent.ownership).toContain("original creators");

    const plan = await postJson({
      id: 9,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: { name: "node-telegram-bot-api", source: "npm" },
        name: "nipmod.external_install_plan"
      }
    });
    expect(plan.body.result.structuredContent.plan.plan.commands).toEqual(["npm install node-telegram-bot-api"]);
    expect(plan.body.result.structuredContent.plan.plan.sourceOwnership).toBe("external-owner-retained");
  });
});

async function mockExternalFetch(input: string | URL | Request): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

  if (url.includes("registry.npmjs.org/-/v1/search")) {
    return Response.json({
      objects: [
        {
          dependents: "652",
          downloads: { monthly: 1_018_117, weekly: 247_635 },
          flags: { insecure: 0 },
          package: {
            date: "2025-12-13T02:21:02.338Z",
            description: "Telegram Bot API",
            license: "MIT",
            links: {
              npm: "https://www.npmjs.com/package/node-telegram-bot-api",
              repository: "git+https://github.com/yagop/node-telegram-bot-api.git"
            },
            name: "node-telegram-bot-api",
            publisher: { username: "gochomugo" },
            version: "0.67.0"
          },
          score: { detail: { maintenance: 1, popularity: 1, quality: 1 } },
          updated: "2026-05-21T08:43:37.654Z"
        }
      ]
    });
  }

  if (url.includes("registry.npmjs.org/node-telegram-bot-api")) {
    return Response.json({
      description: "Telegram Bot API",
      "dist-tags": { latest: "0.67.0" },
      name: "node-telegram-bot-api",
      time: {
        "0.67.0": "2025-12-13T02:21:02.338Z",
        modified: "2026-05-21T08:43:37.654Z"
      },
      versions: {
        "0.67.0": {
          description: "Telegram Bot API",
          license: "MIT",
          repository: { url: "git+https://github.com/yagop/node-telegram-bot-api.git" }
        }
      }
    });
  }

  return Response.json({ error: "not found" }, { status: 404 });
}
