import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..", "..");
const siteRoot = join(root, "site");
const connections = JSON.parse(readFileSync(join(siteRoot, "public", "compatibility", "platform-connections.json"), "utf8"));

describe("platform connection matrix", () => {
  test("publishes honest status labels for every current connection", () => {
    expect(connections).toMatchObject({
      formatVersion: 1,
      type: "dev.nipmod.platform-connections.v1"
    });
    expect(connections.statusLegend.map((item: { status: string }) => item.status)).toEqual([
      "Live",
      "MCP ready",
      "Under review",
      "Candidate"
    ]);
    expect(connections.connections.map((connection: { id: string; status: string }) => `${connection.id}:${connection.status}`)).toEqual([
      "gitlawb:Live",
      "github:Live",
      "mcp:Live",
      "codex:MCP ready",
      "claude-code:MCP ready",
      "opencode:MCP ready",
      "hermes:MCP ready",
      "bankr:Under review",
      "aeon:Candidate"
    ]);
    expect(connections.notClaimed).toContain("MCP ready means native platform partnership");
  });

  test("backs every public connection with a repo kit and proof JSON", () => {
    for (const connection of connections.connections as Array<{ id: string; status: string }>) {
      const kitDir = join(root, "integrations", "platform-connections", connection.id);
      const readme = join(kitDir, "README.md");
      const proofPath = join(kitDir, "proof.json");

      expect(existsSync(readme), `${connection.id} README missing`).toBe(true);
      expect(existsSync(proofPath), `${connection.id} proof missing`).toBe(true);

      const proof = JSON.parse(readFileSync(proofPath, "utf8"));
      expect(proof).toMatchObject({
        formatVersion: 1,
        id: connection.id,
        status: connection.status,
        type: "dev.nipmod.connection-proof.v1"
      });
      expect(readFileSync(readme, "utf8")).toContain(`Status: ${connection.status}`);
    }
  });

  test("keeps external review paths explicitly scoped", () => {
    const bankr = connections.connections.find((connection: { id: string }) => connection.id === "bankr");
    const aeon = connections.connections.find((connection: { id: string }) => connection.id === "aeon");
    const hermes = connections.connections.find((connection: { id: string }) => connection.id === "hermes");

    expect(bankr.externalApprovalRequired).toBe(true);
    expect(bankr.externalDependency).toContain("Bankr must review");
    expect(aeon.externalApprovalRequired).toBe(true);
    expect(aeon.externalDependency).toContain("Aeon owner review");
    expect(hermes.externalApprovalRequired).toBe(true);
    expect(hermes.externalDependency).toContain("NousResearch acknowledgement");
  });
});
