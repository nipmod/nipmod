export const mcpContent = {
  headline: "Connect nipmod to agents",
  lead: "Run the live CLI as a local MCP server for search, metadata, trust reports, install plans, explain, SBOM, verify and audit.",
  primaryAction: "Install",
  secondaryAction: "Trust",
  safety: [
    {
      label: "Default safe",
      text: "Hosts can ask for package facts, exact metadata, trust reports and install plans. They cannot add or install through MCP."
    },
    {
      label: "Gated dry run",
      text: "publish_plan is exposed as a non-read-only dry run and requires explicit local signing opt in."
    },
    {
      label: "Proof first",
      text: "Every registry answer keeps the same digest, signature, transparency and witness evidence as the CLI."
    },
    {
      label: "Explicit roots",
      text: "Custom transparency or advisory roots require an opt in flag inside the tool call."
    }
  ],
  tools: [
    { name: "nipmod.search", safety: "read only" },
    { name: "nipmod.view", safety: "read only" },
    { name: "nipmod.inspect", safety: "read only" },
    { name: "nipmod.install_plan", safety: "read only" },
    { name: "nipmod.publish_plan", safety: "gated dry run" },
    { name: "nipmod.verify", safety: "read only" },
    { name: "nipmod.audit", safety: "read only" },
    { name: "nipmod.sbom", safety: "read only" },
    { name: "nipmod.explain", safety: "read only" }
  ],
  verifyCommand:
    "printf '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2025-11-25\",\"capabilities\":{},\"clientInfo\":{\"name\":\"smoke\",\"version\":\"1.0.0\"}}}\\n{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/list\"}\\n' | nipmod mcp serve",
  hosts: [
    {
      name: "Codex",
      command: "codex mcp add nipmod -- nipmod mcp serve",
      configName: "~/.codex/config.toml",
      config: `[mcp_servers.nipmod]
command = "nipmod"
args = ["mcp", "serve"]`
    },
    {
      name: "Claude Code",
      command: "claude mcp add --transport stdio --scope project nipmod -- nipmod mcp serve",
      configName: ".mcp.json",
      config: `{
  "mcpServers": {
    "nipmod": {
      "type": "stdio",
      "command": "nipmod",
      "args": ["mcp", "serve"],
      "env": {}
    }
  }
}`
    },
    {
      name: "OpenCode",
      command: "Create opencode.json",
      configName: "opencode.json",
      config: `{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "nipmod": {
      "type": "local",
      "command": ["nipmod", "mcp", "serve"],
      "enabled": true
    }
  }
}`
    }
  ]
} as const;
