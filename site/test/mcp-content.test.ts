import { describe, expect, test } from "vitest";
import { mcpContent } from "../app/mcp/content";

describe("MCP host content", () => {
  test("documents the expected host setup commands", () => {
    expect(mcpContent.hosts.map((host) => host.name)).toEqual(["Codex", "Claude Code", "OpenCode"]);
    expect(mcpContent.hosts[0].command).toBe("codex mcp add nipmod -- nipmod mcp serve");
    expect(mcpContent.hosts[1].command).toBe(
      "claude mcp add --transport stdio --scope project nipmod -- nipmod mcp serve"
    );
    expect(mcpContent.hosts[1].config).toContain('"type": "stdio"');
    expect(mcpContent.hosts[2].config).toContain('"command": ["nipmod", "mcp", "serve"]');
  });

  test("documents MCP setup safety and tool contract", () => {
    const text = JSON.stringify(mcpContent);

    expect(mcpContent.tools.map((tool) => tool.name)).toEqual([
      "nipmod.search",
      "nipmod.view",
      "nipmod.inspect",
      "nipmod.install_plan",
      "nipmod.update_plan",
      "nipmod.publish_plan",
      "nipmod.verify",
      "nipmod.audit",
      "nipmod.sbom",
      "nipmod.explain"
    ]);
    expect(text).toContain("publish_plan");
    expect(text).toContain("They cannot add or install through MCP.");
    expect(text).toContain("Custom transparency or advisory roots require an opt in flag");
    expect(mcpContent.verifyCommand).toContain("tools/list");
  });

  test("keeps the page message direct", () => {
    expect(mcpContent.headline).toBe("Connect Nipmod to agents");
    expect(mcpContent.lead.length).toBeLessThanOrEqual(130);
  });
});
