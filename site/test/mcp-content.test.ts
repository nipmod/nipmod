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

  test("keeps MCP setup read only by default", () => {
    const text = JSON.stringify(mcpContent);

    expect(text).toContain("Read only");
    expect(text).toContain("They cannot mutate Gitlawb, add or install through MCP.");
    expect(text).toContain("Custom transparency or advisory roots require an opt in flag");
  });

  test("keeps the page message direct", () => {
    expect(mcpContent.headline).toBe("Connect nipmod to agents");
    expect(mcpContent.lead.length).toBeLessThanOrEqual(100);
  });
});
