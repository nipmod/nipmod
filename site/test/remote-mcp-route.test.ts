import { describe, expect, test } from "vitest";
import { GET, POST } from "../app/api/mcp/route";

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
  test("publishes endpoint metadata without workspace write tools", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toMatchObject({
      endpoint: "https://nipmod.com/api/mcp",
      localServerCommand: "nipmod mcp serve",
      mode: "remote-read-only",
      type: "dev.nipmod.remote-mcp.v1"
    });
    expect(body.tools).toEqual([
      "nipmod.search",
      "nipmod.view",
      "nipmod.inspect",
      "nipmod.install_plan",
      "nipmod.demo"
    ]);
    expect(body.notExposed).toContain("nipmod.install");
    expect(body.notExposed).toContain("nipmod.audit");
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
      "nipmod.view",
      "nipmod.inspect",
      "nipmod.install_plan",
      "nipmod.demo"
    ]);
    expect(body[1].result.tools.every((tool: { annotations: { readOnlyHint: boolean } }) => tool.annotations.readOnlyHint)).toBe(true);
  });

  test("searches and inspects public registry packages without local project args", async () => {
    const search = await postJson({
      id: 3,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: { limit: 5, query: "gitlawb-repo-reader" },
        name: "nipmod.search"
      }
    });
    expect(search.body.result.structuredContent.results[0]).toMatchObject({
      name: "gitlawb-repo-reader",
      quorum: "passed",
      trust: { level: "verified", score: 100 }
    });

    const inspect = await postJson({
      id: 4,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: { specifier: "gitlawb-repo-reader" },
        name: "nipmod.inspect"
      }
    });
    expect(inspect.body.result.structuredContent).toMatchObject({
      mode: "remote-read-only",
      safety: {
        localWorkspaceWrite: false,
        remoteWorkspaceWrite: false
      },
      type: "dev.nipmod.remote-mcp.inspect.v1"
    });
    expect(inspect.body.result.structuredContent.package.digest).toMatch(/^[a-f0-9]{64}$/);
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
    expect(plan.body.result.structuredContent).toMatchObject({
      localInstallRequiredForWrite: true,
      mode: "remote-read-only",
      readyToInstall: true,
      remoteWrites: false,
      type: "dev.nipmod.remote-mcp.install-plan.v1"
    });
    expect(plan.body.result.structuredContent.plan.writes).toEqual([]);

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
});
