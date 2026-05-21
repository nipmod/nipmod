import { describe, expect, test } from "vitest";
import { setupContent } from "../app/setup/content";

describe("setup content", () => {
  test("keeps the agent setup path simple and complete", () => {
    expect(setupContent.headline).toBe("Connect your agent");
    expect(setupContent.lead.length).toBeLessThanOrEqual(180);
    expect(setupContent.steps.map((step) => step.label)).toEqual([
      "Open Terminal",
      "Install once",
      "Connect agent",
      "Paste prompt"
    ]);
  });

  test("publishes copyable setup commands for major agent hosts", () => {
    expect(setupContent.installCommand).toBe("curl https://nipmod.com/i|bash");
    expect(setupContent.checkCommand).toBe("nipmod doctor --online");
    expect(setupContent.allAgentsCommand).toBe("nipmod setup agents");
    expect(setupContent.hosts.map((host) => host.name)).toEqual(["Codex", "Claude Code", "Cursor", "OpenCode", "Hermes"]);
    expect(setupContent.hosts[0]?.command).toBe("nipmod setup codex");
    expect(setupContent.hosts[1]?.command).toBe("nipmod setup claude");
    expect(setupContent.hosts[2]?.command).toBe("nipmod setup cursor");
    expect(setupContent.hosts[3]?.command).toBe("nipmod setup opencode");
    expect(setupContent.hosts[4]?.command).toBe("nipmod setup hermes");
    expect(setupContent.hosts[4]?.text).not.toMatch(/skill|bundle/i);
    expect(setupContent.agentPrompt).toContain("Search the Nipmod archive first");
    expect(setupContent.agentPrompt).toContain("ask before writing files");
  });
});
