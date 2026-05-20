export const mcpContent = {
  headline: "Connect Nipmod to agents",
  lead: "Use hosted read-only MCP for package discovery, then local MCP for controlled workspace installs.",
  primaryAction: "Setup agent",
  secondaryAction: "Trust",
  remote: {
    title: "Hosted read-only endpoint",
    text: "Agents can search the public archive, view exact metadata, inspect trust and create install plans over HTTPS without a local install. Workspace writes stay local.",
    endpoint: "https://nipmod.com/api/mcp",
    listTools:
      '{"jsonrpc":"2.0","id":1,"method":"tools/list"}',
    search:
      '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"nipmod.search","arguments":{"query":"gitlawb-repo-reader"}}}',
    tools: [
      "nipmod.search",
      "nipmod.view",
      "nipmod.inspect",
      "nipmod.install_plan",
      "nipmod.demo"
    ],
    boundary: "Remote endpoint never exposes install, audit, SBOM, local file verification, claim checks or publish planning."
  },
  oneCommand: {
    title: "One local command",
    text: "Install the CLI once, run a host setup command, then tell the agent to use Nipmod before installing agent packages.",
    command: "curl https://nipmod.com/i|bash\nnipmod setup agents"
  },
  safety: [
    {
      label: "Read first",
      text: "Hosts can search, view exact metadata, inspect trust and create install plans before any workspace write."
    },
    {
      label: "Controlled install",
      text: "nipmod.install writes only after confirmInstall is set to write-lockfile. Agents can pin expected package, version and integrity."
    },
    {
      label: "Unsigned preview",
      text: "publish_plan previews package metadata without remote writes and without local signing."
    },
    {
      label: "Claim proof",
      text: "claim_verify checks Gitlawb owner proof. Agents should not claim or publish repos without explicit owner instruction."
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
    { name: "nipmod.install", safety: "controlled workspace write" },
    { name: "nipmod.update_plan", safety: "read only" },
    { name: "nipmod.demo", safety: "read only" },
    { name: "nipmod.publish_plan", safety: "gated dry run" },
    { name: "nipmod.claim_verify", safety: "read only" },
    { name: "nipmod.claim_index", safety: "read only" },
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
      label: "Install after approval",
      command:
        '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"nipmod.install","arguments":{"specifier":"gitlawb-repo-reader","confirmInstall":"write-lockfile"}}}'
    },
    {
      label: "Demo flow",
      command:
        '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"nipmod.demo","arguments":{"host":"Codex","package":"gitlawb-repo-reader"}}}'
    },
    {
      label: "Verify claim",
      command:
        '{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"nipmod.claim_verify","arguments":{"repo":"gitlawb://did:key:z6Mk.../repo"}}}'
    },
    {
      label: "Audit",
      command:
        '{"jsonrpc":"2.0","id":8,"method":"tools/call","params":{"name":"nipmod.audit","arguments":{}}}'
    }
  ],
  hosts: [
    {
      name: "Codex",
      command: "nipmod setup codex",
      configName: "~/.codex/config.toml",
      config: `[mcp_servers.nipmod]
command = "nipmod"
args = ["mcp", "serve"]`,
      verify: "codex mcp list",
      prompt: "Use Nipmod to find gitlawb-repo-reader, inspect it, plan install, then install only after I approve the lockfile write."
    },
    {
      name: "Claude Code",
      command: "nipmod setup claude",
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
}`,
      verify: "claude mcp list, then /mcp inside Claude Code",
      prompt: "Use the nipmod MCP server. Search, view, inspect and plan before installing any agent package."
    },
    {
      name: "Cursor",
      command: "nipmod setup cursor",
      configName: ".cursor/mcp.json",
      config: `{
  "mcpServers": {
    "nipmod": {
      "command": "nipmod",
      "args": ["mcp", "serve"],
      "env": {}
    }
  }
}`,
      verify: "Cursor Settings > MCP",
      prompt: "Use the nipmod MCP server in Cursor. Search, view, inspect and plan before installing any agent package."
    },
    {
      name: "OpenCode",
      command: "nipmod setup opencode",
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
}`,
      verify: "opencode mcp list",
      prompt: "use nipmod to search packages, inspect trust and install only after a plan is ready"
    },
    {
      name: "Hermes",
      command: "nipmod setup hermes",
      configName: "~/.hermes/config.yaml + /nipmod bundle",
      config: `mcp_servers:
  nipmod:
    command: "nipmod"
    args: ["mcp", "serve"]
    enabled: true
    timeout: 120
    connect_timeout: 60
    tools:
      resources: false
      prompts: false

# Also written by setup:
# ~/.hermes/skills/nipmod/SKILL.md
# ~/.hermes/skill-bundles/nipmod.yaml`,
      verify: "hermes mcp test nipmod, hermes bundles list",
      prompt: "/nipmod search for the package, inspect trust and prepare an install plan before any package write"
    }
  ],
  demo: {
    headline: "Agent demo path",
    lead: "This is the proof path agents can run through MCP with gitlawb-repo-reader as the live package.",
    prompt:
      "Use Nipmod for package discovery before installing agent packages. Search first, view exact metadata, inspect trust, run an install plan, install only after approval, then audit and export SBOM.",
    steps: [
      "Search gitlawb-repo-reader",
      "View exact metadata and agent use case",
      "Inspect trust, source, digest and permissions",
      "Create an install plan without writes",
      "Call nipmod.install only with confirmInstall set to write-lockfile",
      "Run audit and SBOM after install"
    ]
  },
  docs: [
    {
      label: "Codex docs",
      href: "https://developers.openai.com/learn/docs-mcp"
    },
    {
      label: "Claude Code MCP docs",
      href: "https://code.claude.com/docs/en/mcp"
    },
    {
      label: "Cursor MCP docs",
      href: "https://docs.cursor.com/en/context/mcp"
    },
    {
      label: "OpenCode MCP docs",
      href: "https://opencode.ai/docs/mcp-servers"
    },
    {
      label: "Hermes MCP docs",
      href: "https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp"
    }
  ]
} as const;
