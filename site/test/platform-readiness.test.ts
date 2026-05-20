import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..", "..");
const siteRoot = join(root, "site");
const readiness = JSON.parse(readFileSync(join(siteRoot, "public", "compatibility", "platform-readiness.json"), "utf8"));
const connections = JSON.parse(readFileSync(join(siteRoot, "public", "compatibility", "platform-connections.json"), "utf8"));
const discovery = JSON.parse(readFileSync(join(siteRoot, "public", ".well-known", "nipmod.json"), "utf8"));
const llms = readFileSync(join(siteRoot, "public", "llms.txt"), "utf8");
const claudeConfig = JSON.parse(readFileSync(join(root, ".mcp.json"), "utf8"));
const cursorConfig = JSON.parse(readFileSync(join(root, ".cursor", "mcp.json"), "utf8"));
const opencodeConfig = JSON.parse(readFileSync(join(root, "opencode.json"), "utf8"));

describe("platform readiness receipt", () => {
  test("publishes the complete current platform set without adoption overclaiming", () => {
    expect(readiness).toMatchObject({
      formatVersion: 1,
      type: "dev.nipmod.platform-readiness.v1"
    });
    expect(readiness.platforms.map((platform: { id: string }) => platform.id)).toEqual([
      "github",
      "gitlawb",
      "mcp",
      "codex",
      "claude-code",
      "cursor",
      "opencode",
      "hermes",
      "bankr",
      "aeon"
    ]);
    expect(readiness.platforms.find((platform: { id: string }) => platform.id === "bankr")?.productReadiness).toBe(80);
    expect(readiness.platforms.find((platform: { id: string }) => platform.id === "hermes")?.productReadiness).toBe(90);
    expect(readiness.platforms.find((platform: { id: string }) => platform.id === "aeon")?.productReadiness).toBe(20);
    expect(readiness.platforms.find((platform: { id: string }) => platform.id === "claude-code")?.connectionStatus).toBe(
      "MCP ready"
    );
    expect(readiness.meaning).toContain("does not claim third-party adoption");
    expect(readiness.notClaimed).toContain("every Gitlawb package has a verified Owner Package Claim proof");
    expect(readiness.notClaimed).toContain("Bankr has accepted the skill into a native marketplace");
    expect(readiness.notClaimed).toContain("Bankr Agent API smoke has run unless BANKR_API_KEY is provided");
    expect(readiness.notClaimed).toContain("Aeon has approved or published a Nipmod skill collection");
    expect(connections.type).toBe("dev.nipmod.platform-connections.v1");
    expect(connections.connections.map((connection: { id: string }) => connection.id)).toEqual([
      "gitlawb",
      "github",
      "mcp",
      "codex",
      "claude-code",
      "cursor",
      "opencode",
      "hermes",
      "bankr",
      "aeon"
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

  test("ships project configs for Claude Code, Cursor and OpenCode", () => {
    expect(claudeConfig).toEqual({
      mcpServers: {
        nipmod: {
          args: ["mcp", "serve"],
          command: "nipmod",
          env: {},
          type: "stdio"
        }
      }
    });
    expect(cursorConfig).toEqual({
      mcpServers: {
        nipmod: {
          args: ["mcp", "serve"],
          command: "nipmod",
          env: {}
        }
      }
    });
    expect(opencodeConfig).toEqual({
      $schema: "https://opencode.ai/config.json",
      mcp: {
        nipmod: {
          command: ["nipmod", "mcp", "serve"],
          enabled: true,
          type: "local"
        }
      }
    });
  });

  test("keeps Cursor ready without claiming marketplace listing", () => {
    const cursor = readiness.platforms.find((platform: { id: string }) => platform.id === "cursor");
    const cursorConnection = connections.connections.find((connection: { id: string }) => connection.id === "cursor");

    expect(cursor.connectionStatus).toBe("MCP ready");
    expect(cursor.claim).toContain("Add to Cursor deeplink");
    expect(cursor.evidence).toContain("https://nipmod.com/cursor");
    expect(cursor.evidence).toContain("https://docs.cursor.com/deeplinks");
    expect(cursorConnection.url).toBe("https://nipmod.com/cursor");
    expect(cursorConnection.externalApprovalRequired).toBe(false);
    expect(cursorConnection.externalDependency).toContain("Cursor review is required before official marketplace wording");
  });

  test("keeps Hermes MCP ready scoped away from official wording", () => {
    const hermes = readiness.platforms.find((platform: { id: string }) => platform.id === "hermes");
    const hermesConnection = connections.connections.find((connection: { id: string }) => connection.id === "hermes");

    expect(hermes.connectionStatus).toBe("MCP ready");
    expect(hermes.status).toBe("runtime-smoke-passed");
    expect(hermes.claim).toContain("local stdio MCP server");
    expect(hermes.claim).toContain("/nipmod skill bundle");
    expect(hermes.skillBundle).toBe("https://nipmod.com/integrations/hermes/skill-bundles/nipmod.yaml");
    expect(hermes.runtimeSmoke).toBe("integrations/platform-connections/hermes/runtime-smoke.json");
    expect(hermesConnection.externalApprovalRequired).toBe(true);
    expect(hermesConnection.proofLevel).toContain("discovered all 14 Nipmod MCP tools");
    expect(hermesConnection.proofLevel).toContain("/nipmod skill bundle");
    expect(hermesConnection.externalDependency).toContain("NousResearch acknowledgement");
  });

  test("keeps hosted MCP read-only and separated from local writes", () => {
    const mcp = readiness.platforms.find((platform: { id: string }) => platform.id === "mcp");
    const mcpConnection = connections.connections.find((connection: { id: string }) => connection.id === "mcp");

    expect(mcp.claim).toContain("hosted endpoint exposes a read-only registry subset");
    expect(mcp.evidence).toContain("https://nipmod.com/api/mcp");
    expect(mcp.checks).toContain("https://nipmod.com/api/mcp exposes only search, view, inspect, install_plan and demo");
    expect(mcpConnection.evidence).toContain("https://nipmod.com/api/mcp");
    expect(mcpConnection.proofLevel).toContain("hosted read-only tool subset");
  });

  test("keeps Bankr readiness scoped to safe package workflows", () => {
    const bankr = readiness.platforms.find((platform: { id: string }) => platform.id === "bankr");

    expect(bankr.status).toBe("agent-proof-ready");
    expect(bankr.connectionStatus).toBe("Under review");
    expect(bankr.claim).toContain("without wallet actions");
    expect(bankr.externalDependency).toContain("not claimed");
    expect(bankr.runtimeSmoke).toBe("BANKR_API_KEY=bk_... node tools/bankr-agent-smoke.mjs --require-auth");
    expect(bankr.checks).toContain("real Bankr Agent API smoke is available with BANKR_API_KEY");
    expect(bankr.checks).toContain("core package workflows do not require x402 or Nipmod payment");
    expect(JSON.stringify(bankr)).not.toMatch(/paymentScheme|walletTransfer|trade|swap/i);
  });

  test("keeps Gitlawb readiness honest about owner claim proofs", () => {
    const gitlawb = readiness.platforms.find((platform: { id: string }) => platform.id === "gitlawb");
    const gitlawbConnection = connections.connections.find((connection: { id: string }) => connection.id === "gitlawb");

    expect(gitlawb.productReadiness).toBe(100);
    expect(gitlawb.connectionStatus).toBe("Live");
    expect(gitlawb.claim).toContain("claim verification workflow");
    expect(gitlawb.checks.join("\n")).toContain("without treating missing proofs as verified");
    expect(gitlawbConnection.proofLevel).toContain("missing proofs are reported");
    expect(JSON.stringify({ gitlawb, gitlawbConnection })).not.toContain("all owner claims are verified");
  });

  test("keeps Aeon candidate scoped to owner review", () => {
    const aeon = readiness.platforms.find((platform: { id: string }) => platform.id === "aeon");
    const aeonConnection = connections.connections.find((connection: { id: string }) => connection.id === "aeon");

    expect(aeon.connectionStatus).toBe("Candidate");
    expect(aeon.externalDependency).toContain("owner review");
    expect(aeonConnection.externalApprovalRequired).toBe(true);
    expect(aeonConnection.proofLevel).toContain("Candidate only");
  });
});
