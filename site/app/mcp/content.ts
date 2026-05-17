export const mcpContent = {
  headline: "Connect Nipmod to agents",
  lead: "Run the CLI as MCP for search, view, trust reports, install and update plans, claim proof, verify, audit, SBOM and explain.",
  primaryAction: "Install",
  secondaryAction: "Trust",
  safety: [
    {
      label: "Default safe",
      text: "Hosts can ask for package facts, exact metadata, trust reports and install plans. They cannot add or install through MCP."
    },
    {
      label: "Unsigned preview",
      text: "publish_plan previews package metadata without remote writes and without local signing."
    },
    {
      label: "Claim proof",
      text: "claim_verify checks Gitlawb owner proof. package_patch returns files only and never opens remote PRs."
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
    { name: "nipmod.update_plan", safety: "read only" },
    { name: "nipmod.publish_plan", safety: "gated dry run" },
    { name: "nipmod.claim_verify", safety: "read only" },
    { name: "nipmod.claim_index", safety: "read only" },
    { name: "nipmod.package_patch", safety: "read only" },
    { name: "nipmod.verify", safety: "read only" },
    { name: "nipmod.audit", safety: "read only" },
    { name: "nipmod.sbom", safety: "read only" },
    { name: "nipmod.explain", safety: "read only" }
  ],
  verifyCommand:
    "printf '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2025-11-25\",\"capabilities\":{},\"clientInfo\":{\"name\":\"smoke\",\"version\":\"1.0.0\"}}}\\n{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/list\"}\\n' | nipmod mcp serve",
  examples: [
    {
      label: "Search",
      command:
        '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"nipmod.search","arguments":{"query":"gitlawb"}}}'
    },
    {
      label: "Plan install",
      command:
        '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"nipmod.install_plan","arguments":{"specifier":"gitlawb-repo-reader"}}}'
    },
    {
      label: "Verify claim",
      command:
        '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"nipmod.claim_verify","arguments":{"repo":"gitlawb://did:key:z6Mk.../repo"}}}'
    },
    {
      label: "Audit",
      command:
        '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"nipmod.audit","arguments":{"online":true}}}'
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
