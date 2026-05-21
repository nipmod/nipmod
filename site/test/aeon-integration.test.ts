import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..", "..");
const siteRoot = join(root, "site");

const collection = JSON.parse(readFileSync(join(siteRoot, "public", "integrations", "aeon", "aeon.collection.json"), "utf8"));
const proof = JSON.parse(readFileSync(join(siteRoot, "public", "integrations", "aeon", "proof.json"), "utf8"));
const packet = readFileSync(join(siteRoot, "public", "integrations", "aeon", "AEON_SUBMISSION.md"), "utf8");
const skill = readFileSync(join(root, "skills", "nipmod", "SKILL.md"), "utf8");
const readiness = JSON.parse(readFileSync(join(siteRoot, "public", "compatibility", "platform-readiness.json"), "utf8"));
const connections = JSON.parse(readFileSync(join(siteRoot, "public", "compatibility", "platform-connections.json"), "utf8"));

describe("Aeon review packet", () => {
  test("publishes a scoped first collection draft from real Aeon metadata", () => {
    expect(collection).toMatchObject({
      attribution: "Aeon by aaronjmars",
      formatVersion: 1,
      ownerReviewRequired: true,
      selectedCount: 10,
      sourceRepo: "https://github.com/aaronjmars/aeon",
      sourceTotalSkills: 121,
      status: "owner-review",
      type: "dev.nipmod.aeon.collection-draft.v1"
    });
    expect(collection.skills).toHaveLength(10);
    expect(collection.skills.map((item: { slug: string }) => item.slug)).toEqual([
      "repo-scanner",
      "pr-review",
      "code-health",
      "security-digest",
      "competitor-launch-radar",
      "product-hunt-launch",
      "fork-first-run-alert",
      "fork-skill-gap",
      "skill-security-scan",
      "github-monitor"
    ]);
    for (const item of collection.skills as Array<{ packageStatus: string; sourceUrl: string; trustPlan: { publishGate: string } }>) {
      expect(item.sourceUrl).toContain("https://github.com/aaronjmars/aeon/blob/main/skills/");
      expect(item.packageStatus).toBe("draft-not-published");
      expect(item.trustPlan.publishGate).toBe("Aeon owner review");
    }
  });

  test("keeps the Aeon skill read-only until an operator explicitly asks for local writes", () => {
    expect(skill).toContain("name: nipmod");
    expect(skill).toContain("Hosted read-only MCP: https://nipmod.com/api/mcp");
    expect(skill).toContain("nipmod.install_plan");
    expect(skill).toContain("Do not install, execute, write files, spend funds or use private credentials");
    expect(skill).not.toMatch(/wallet|trade|swap|private key/i);
  });

  test("keeps public wording scoped away from official support claims", () => {
    expect(packet).toContain("Nothing here claims official Aeon support");
    expect(packet).toContain("./add-skill nipmod/nipmod nipmod");
    expect(packet).toContain("Aeon and Nipmod are drafting a two-way package and skill bridge for review.");

    const aeon = readiness.platforms.find((platform: { id: string }) => platform.id === "aeon");
    const aeonConnection = connections.connections.find((connection: { id: string }) => connection.id === "aeon");

    expect(proof.status).toBe("Under review");
    expect(proof.notClaimed).toContain("Aeon officially supports Nipmod");
    expect(aeon.connectionStatus).toBe("Under review");
    expect(aeonConnection.externalApprovalRequired).toBe(true);
    expect(collection.status).toBe("owner-review");
    expect(collection.notClaimed).toContain("Aeon skills are live Nipmod packages");
  });
});
