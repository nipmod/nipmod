import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..", "..");
const siteRoot = join(root, "site");

describe("OpenHuman review packet", () => {
  test("publishes a read-only MCP config without official support claims", () => {
    const config = readFileSync(join(siteRoot, "public", "integrations", "openhuman", "openhuman.mcp-client.toml"), "utf8");
    const packet = readFileSync(join(siteRoot, "public", "integrations", "openhuman", "OPENHUMAN_SUBMISSION.md"), "utf8");
    const proof = JSON.parse(readFileSync(join(siteRoot, "public", "integrations", "openhuman", "proof.json"), "utf8"));

    expect(config).toContain("[[mcp_client.servers]]");
    expect(config).toContain('name = "nipmod"');
    expect(config).toContain('endpoint = "https://nipmod.com/api/mcp"');
    expect(config).toContain('"nipmod.install_plan"');
    expect(config).not.toMatch(/nipmod\.install"|nipmod\.audit|nipmod\.verify/);

    expect(packet).toContain("Not official until Tiny Humans reviews or accepts it");
    expect(packet).toContain("Do not install packages or write files");
    expect(packet).toContain("mcp_list_servers");
    expect(packet).toContain("mcp_call_tool");

    expect(proof).toMatchObject({
      externalApprovalRequired: true,
      id: "openhuman",
      status: "Candidate",
      type: "dev.nipmod.connection-proof.v1"
    });
    expect(proof.notClaimed).toContain("OpenHuman native support is live");
  });
});
