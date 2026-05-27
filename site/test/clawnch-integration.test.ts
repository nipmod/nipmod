import { describe, expect, test } from "vitest";
import { GET as getClawnchIntegration } from "../app/clawnch-integration.json/route";
import { clawnchIntegrationDraft } from "../lib/clawnch-integration";

describe("Clawnch integration draft", () => {
  test("publishes a draft without approval or execution claims", () => {
    expect(clawnchIntegrationDraft).toMatchObject({
      formatVersion: 1,
      status: "draft_for_partner_review",
      type: "dev.nipmod.partner-integration-draft.v1"
    });
    expect(clawnchIntegrationDraft.partner).toMatchObject({
      approval: "not_claimed",
      docs: "https://www.clawn.ch/docs",
      name: "Clawnch",
      skill: "https://www.clawn.ch/skill"
    });
    expect(clawnchIntegrationDraft.boundaries).toContain("no partnership or approval claim before Clawnch approves the wording");
    expect(clawnchIntegrationDraft.boundaries).toContain("no token launch execution");
    expect(clawnchIntegrationDraft.boundaries).toContain("no trading or liquidity action");
    expect(clawnchIntegrationDraft.boundaries).toContain("no hosted workspace writes");
  });

  test("lists visible Clawnch surfaces as review candidates", () => {
    expect(clawnchIntegrationDraft.surfaces.map((surface) => surface.name)).toEqual([
      "@clawnch/sdk",
      "@clawnch/clawncher-sdk",
      "clawncher",
      "clawnch-mcp-server",
      "@clawnch/clawtomaton",
      "@clawnch/memory",
      "@clawnch/memory-mcp-server",
      "clawmes"
    ]);
    expect(clawnchIntegrationDraft.surfaces.every((surface) => surface.reviewStatus === "needs_partner_confirmation")).toBe(true);
    expect(clawnchIntegrationDraft.surfaces.map((surface) => surface.source)).toContain("pypi");
    expect(clawnchIntegrationDraft.surfaces.map((surface) => surface.source)).toContain("npm");
  });

  test("keeps partner review items explicit", () => {
    expect(clawnchIntegrationDraft.requiredChecks).toEqual([
      "canonical package names",
      "canonical product names",
      "preferred docs links",
      "surfaces that should be indexed",
      "surfaces that should not be indexed",
      "wording before any public announcement",
      "install commands that should be changed or removed"
    ]);
    expect(clawnchIntegrationDraft.proposedFlow.map((step) => step.id)).toEqual([
      "discover",
      "resolve",
      "inspect",
      "plan",
      "approve",
      "handoff"
    ]);
  });

  test("serves the machine-readable draft", async () => {
    const response = await getClawnchIntegration().json();

    expect(response.type).toBe("dev.nipmod.partner-integration-draft.v1");
    expect(response.links).toMatchObject({
      machine: "https://nipmod.com/clawnch-integration.json",
      page: "https://nipmod.com/integrations/clawnch"
    });
  });

  test("does not claim Clawnch endorsement", () => {
    const text = JSON.stringify(clawnchIntegrationDraft);

    expect(text).not.toMatch(/approved by Clawnch/i);
    expect(text).not.toMatch(/endorsed by Clawnch/i);
    expect(text).not.toMatch(/official Clawnch integration/i);
    expect(text).not.toMatch(/official Clawnch partnership/i);
    expect(text).not.toMatch(/Clawnch-approved/i);
  });
});
