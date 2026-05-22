import { describe, expect, test } from "vitest";
import { agentHostContent } from "../app/agents/mcp-hosts/content";

describe("agent host content", () => {
  test("documents the shared setup path", () => {
    expect(agentHostContent.headline).toBe("Use Nipmod from your agent host");
    expect(agentHostContent.installCommand).toBe("curl https://nipmod.com/i|bash");
    expect(agentHostContent.hosts.map((host) => host.name)).toEqual(["Codex", "Claude Code"]);
    expect(agentHostContent.hosts[0]?.setup).toBe("nipmod setup codex");
    expect(agentHostContent.hosts[1]?.setup).toBe("nipmod setup claude");
    expect(agentHostContent.sharedPrompt).toContain("Search the archive first");
    expect(agentHostContent.sharedPrompt).toContain("ask before writing files");
  });

  test("keeps the host workflow centered on controlled package use", () => {
    expect(agentHostContent.workflow.map((item) => item.label)).toEqual([
      "Search",
      "Inspect",
      "Plan",
      "Approve",
      "Audit"
    ]);
    expect(agentHostContent.boundaries).toContain("The install tool requires explicit write approval.");
    expect(agentHostContent.boundaries).toContain("Codex and Claude Code use the same archive, proof and package ids.");
  });
});
