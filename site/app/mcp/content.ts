export const mcpContent = {
  headline: "Connect nipmod to agents",
  lead: "Run the live CLI as a read only MCP server for search, inspect, plans, verify and audit.",
  primaryAction: "Install",
  secondaryAction: "Trust",
  safety: [
    {
      label: "Read only",
      text: "Hosts can ask for package facts and dry run plans. They cannot mutate Gitlawb, add or install through MCP."
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
