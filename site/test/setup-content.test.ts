import { describe, expect, test } from "vitest";
import { setupContent } from "../app/setup/content";

describe("setup content", () => {
  test("keeps the agent setup path simple and complete", () => {
    expect(setupContent.headline).toBe("Use Nipmod in your agent");
    expect(setupContent.lead.length).toBeLessThanOrEqual(180);
    expect(setupContent.steps.map((step) => step.label)).toEqual([
      "Open Terminal",
      "Install once",
      "Connect agent",
      "Paste prompt"
    ]);
  });

  test("publishes copyable setup commands for major agent hosts", () => {
    expect(setupContent.installCommand).toBe("curl -fsSLO https://nipmod.com/install.sh && bash install.sh");
    expect(setupContent.checkCommand).toBe("nipmod doctor --online");
    expect(setupContent.hosts.map((host) => host.name)).toEqual(["Codex", "Claude Code", "OpenCode"]);
    expect(setupContent.hosts[0]?.command).toBe("codex mcp add nipmod -- nipmod mcp serve");
    expect(setupContent.hosts[1]?.command).toBe("claude mcp add --transport stdio --scope project nipmod -- nipmod mcp serve");
    expect(setupContent.hosts[2]?.command).toContain("opencode.json");
    expect(setupContent.agentPrompt).toContain("Search the Nipmod archive first");
    expect(setupContent.agentPrompt).toContain("ask before writing files");
  });
});
