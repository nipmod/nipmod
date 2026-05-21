import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..", "..");
const siteRoot = join(root, "site");

describe("OpenHuman review packet", () => {
  test("publishes an under-review skill path without official support claims", () => {
    const config = readFileSync(join(siteRoot, "public", "integrations", "openhuman", "openhuman.mcp-client.toml"), "utf8");
    const packet = readFileSync(join(siteRoot, "public", "integrations", "openhuman", "OPENHUMAN_SUBMISSION.md"), "utf8");
    const proof = JSON.parse(readFileSync(join(siteRoot, "public", "integrations", "openhuman", "proof.json"), "utf8"));

    expect(config).toContain("Draft optional MCP config");
    expect(config).toContain("[[mcp_client.servers]]");
    expect(config).toContain('name = "nipmod"');
    expect(config).toContain('endpoint = "https://nipmod.com/api/mcp"');
    expect(config).toContain('"nipmod.install_plan"');
    expect(config).not.toMatch(/nipmod\.install"|nipmod\.audit|nipmod\.verify/);

    expect(packet).toContain("Status: under review");
    expect(packet).toContain("https://github.com/tinyhumansai/openhuman/pull/2432");
    expect(packet).toContain("https://github.com/nipmod/openhuman-skills/tree/add-nipmod-skill");
    expect(packet).toContain("Do not install packages or write files");
    expect(packet).toContain("could not be submitted upstream");

    expect(proof).toMatchObject({
      externalApprovalRequired: true,
      id: "openhuman",
      status: "Under review",
      type: "dev.nipmod.connection-proof.v1"
    });
    expect(proof.reviewPr).toBe("https://github.com/tinyhumansai/openhuman/pull/2432");
    expect(proof.nativeSkillBranch).toBe("https://github.com/nipmod/openhuman-skills/tree/add-nipmod-skill");
    expect(proof.notClaimed).toContain("OpenHuman native support is live");
    expect(proof.notClaimed).toContain("The draft OpenHuman native skill is merged upstream");
  });
});
