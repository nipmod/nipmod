import { describe, expect, test } from "vitest";
import { mcpContent } from "../app/mcp/content";

describe("MCP host content", () => {
  test("documents the expected host setup commands", () => {
    expect(mcpContent.hosts.map((host) => host.name)).toEqual(["Codex", "Claude Code", "OpenCode"]);
    expect(mcpContent.hosts[0].command).toBe("nipmod setup codex");
    expect(mcpContent.hosts[0].verify).toBe("codex mcp list");
    expect(mcpContent.hosts[1].command).toBe("nipmod setup claude");
    expect(mcpContent.hosts[2].command).toBe("nipmod setup opencode");
    expect(mcpContent.hosts[1].config).toContain('"type": "stdio"');
    expect(mcpContent.hosts[2].config).toContain('"command": ["nipmod", "mcp", "serve"]');
    expect(mcpContent.hosts.every((host) => host.prompt.includes("Nipmod") || host.prompt.includes("nipmod"))).toBe(true);
  });

  test("documents MCP setup safety and tool contract", () => {
    const text = JSON.stringify(mcpContent);

    expect(mcpContent.tools.map((tool) => tool.name)).toEqual([
      "nipmod.search",
      "nipmod.view",
      "nipmod.inspect",
      "nipmod.install_plan",
      "nipmod.install",
      "nipmod.update_plan",
      "nipmod.demo",
      "nipmod.publish_plan",
      "nipmod.claim_verify",
      "nipmod.claim_index",
      "nipmod.verify",
      "nipmod.audit",
      "nipmod.sbom",
      "nipmod.explain"
    ]);
	    expect(text).toContain("publish_plan");
    expect(text).toContain("confirmInstall");
    expect(text).toContain("write-lockfile");
    expect(text).toContain("nipmod.demo");
    expect(text).toContain("claim_verify");
	    expect(text.toLowerCase()).toContain("controlled install");
	    expect(text).toContain("without local signing");
	    expect(text).toContain("Custom transparency or advisory roots require an opt in flag");
    expect(text).toContain("tools/call");
    expect(text).toContain("nipmod.install_plan");
    expect(mcpContent.demo.steps).toContain("Call nipmod.install only with confirmInstall set to write-lockfile");
    expect(mcpContent.verifyCommand).toContain("tools/list");
  });

  test("keeps the page message direct", () => {
    expect(mcpContent.headline).toBe("Connect Nipmod to agents");
    expect(mcpContent.lead.length).toBeLessThanOrEqual(130);
  });
});
