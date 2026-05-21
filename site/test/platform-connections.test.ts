import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..", "..");
const siteRoot = join(root, "site");
const connections = JSON.parse(readFileSync(join(siteRoot, "public", "compatibility", "platform-connections.json"), "utf8"));

describe("source and access matrix", () => {
  test("publishes only current API first paths", () => {
    expect(connections).toMatchObject({
      formatVersion: 1,
      type: "dev.nipmod.platform-connections.v1"
    });
    expect(connections.meaning).toContain("API-first package discovery");
    expect(connections.statusLegend.map((item: { status: string }) => item.status)).toEqual(["Live", "Safe mode"]);
    expect(connections.connections.map((connection: { id: string; status: string }) => `${connection.id}:${connection.status}`)).toEqual([
      "api:Live",
      "sources:Live",
      "archive:Safe mode",
      "mcp:Live",
      "github:Live",
      "gitlawb:Live"
    ]);
  });

  test("keeps draft integrations out of the public matrix", () => {
    const body = JSON.stringify(connections);

    expect(body).not.toContain("/integrations/");
    expect(body).not.toContain("Under review");
    expect(connections.notClaimed).toContain("Native platform marketplace approval is not required for API use");
    expect(connections.notClaimed).toContain("Nipmod does not own external npm, PyPI, GitHub, Hugging Face or MCP packages");
  });

  test("backs each path with public evidence and a smoke command", () => {
    for (const connection of connections.connections as Array<{ evidence: string[]; smokeCommand: string; url: string }>) {
      expect(connection.url).toMatch(/^https:\/\//);
      expect(connection.smokeCommand.length).toBeGreaterThan(0);
      expect(connection.evidence.length).toBeGreaterThan(0);
    }
  });
});
