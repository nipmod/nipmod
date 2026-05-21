import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..", "..");
const siteRoot = join(root, "site");
const readiness = JSON.parse(readFileSync(join(siteRoot, "public", "compatibility", "platform-readiness.json"), "utf8"));
const connections = JSON.parse(readFileSync(join(siteRoot, "public", "compatibility", "platform-connections.json"), "utf8"));
const discovery = JSON.parse(readFileSync(join(siteRoot, "public", ".well-known", "nipmod.json"), "utf8"));
const llms = readFileSync(join(siteRoot, "public", "llms.txt"), "utf8");

describe("API first readiness receipt", () => {
  test("publishes the current source and access set without integration overclaiming", () => {
    expect(readiness).toMatchObject({
      formatVersion: 1,
      type: "dev.nipmod.platform-readiness.v1"
    });
    expect(readiness.platforms.map((platform: { id: string }) => platform.id)).toEqual([
      "api",
      "sources",
      "archive",
      "mcp",
      "github",
      "gitlawb"
    ]);
    expect(readiness.platforms.find((platform: { id: string }) => platform.id === "archive")?.connectionStatus).toBe(
      "Safe mode"
    );
    expect(readiness.meaning).toContain("API-first Nipmod surface");
    expect(readiness.meaning).toContain("does not claim native third-party platform partnerships");
    expect(readiness.notClaimed).toContain("native platform partnership or marketplace approval is required for API use");
    expect(connections.connections.map((connection: { id: string }) => connection.id)).toEqual([
      "api",
      "sources",
      "archive",
      "mcp",
      "github",
      "gitlawb"
    ]);
  });

  test("binds readiness proof to public discovery and agent entrypoints", () => {
    expect(discovery.review.platformReadiness).toBe("https://nipmod.com/compatibility/platform-readiness.json");
    expect(discovery.mcp.remoteEndpoint).toBe("https://nipmod.com/api/mcp");
    expect(llms).toContain("Platform readiness receipt: https://nipmod.com/compatibility/platform-readiness.json");
    expect(llms).toContain("Hosted read-only MCP endpoint: https://nipmod.com/api/mcp");
    expect(readiness.archive).toEqual({
      discovery: "https://nipmod.com/.well-known/nipmod.json",
      llms: "https://nipmod.com/llms.txt",
      platformConnections: "https://nipmod.com/compatibility/platform-connections.json",
      registry: "https://nipmod.com/registry/packages.json",
      setup: "https://nipmod.com/setup"
    });
  });

  test("keeps hosted MCP read-only and separated from local writes", () => {
    const mcp = readiness.platforms.find((platform: { id: string }) => platform.id === "mcp");
    const mcpConnection = connections.connections.find((connection: { id: string }) => connection.id === "mcp");

    expect(mcp.claim).toContain("Hosted read-only MCP");
    expect(mcp.evidence).toContain("https://nipmod.com/api/mcp");
    expect(mcp.checks).toContain("hosted MCP exposes only safe read tools");
    expect(mcpConnection.evidence).toContain("https://nipmod.com/api/mcp");
    expect(mcpConnection.proofLevel).toContain("Hosted MCP exposes only safe read tools");
  });

  test("keeps external review tracks out of readiness", () => {
    const body = JSON.stringify({ readiness, connections });

    expect(body).not.toContain("/integrations/");
    expect(body).not.toContain("Under review");
    expect(readiness.notClaimed).toContain("Nipmod owns or republishes external npm, PyPI, GitHub, Hugging Face or MCP packages");
  });

  test("keeps Gitlawb readiness honest about owner claim proofs", () => {
    const gitlawb = readiness.platforms.find((platform: { id: string }) => platform.id === "gitlawb");
    const gitlawbConnection = connections.connections.find((connection: { id: string }) => connection.id === "gitlawb");

    expect(gitlawb.productReadiness).toBe(100);
    expect(gitlawb.connectionStatus).toBe("Live");
    expect(gitlawb.claim).toContain("claim workflow");
    expect(gitlawb.checks.join("\n")).toContain("without treating them as verified");
    expect(gitlawbConnection.proofLevel).toContain("Owner Package Claim verification");
    expect(JSON.stringify({ gitlawb, gitlawbConnection })).not.toContain("all owner claims are verified");
  });
});
