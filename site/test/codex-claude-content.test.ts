import { describe, expect, test } from "vitest";
import { codexClaudeContent } from "../app/agents/codex-claude/content";

describe("Codex and Claude Code content", () => {
  test("documents the shared setup path", () => {
    expect(codexClaudeContent.headline).toBe("Use Nipmod from Codex and Claude Code");
    expect(codexClaudeContent.installCommand).toBe("curl -fsSLO https://nipmod.com/install.sh && bash install.sh");
    expect(codexClaudeContent.hosts.map((host) => host.name)).toEqual(["Codex", "Claude Code"]);
    expect(codexClaudeContent.hosts[0]?.setup).toBe("nipmod setup codex");
    expect(codexClaudeContent.hosts[1]?.setup).toBe("nipmod setup claude");
    expect(codexClaudeContent.sharedPrompt).toContain("Search the archive first");
    expect(codexClaudeContent.sharedPrompt).toContain("ask before writing files");
  });

  test("keeps the host workflow centered on controlled package use", () => {
    expect(codexClaudeContent.workflow.map((item) => item.label)).toEqual([
      "Search",
      "Inspect",
      "Plan",
      "Approve",
      "Audit"
    ]);
    expect(codexClaudeContent.boundaries).toContain("The install tool requires explicit write approval.");
    expect(codexClaudeContent.boundaries).toContain("Codex and Claude Code use the same archive, proof and package ids.");
  });
});
