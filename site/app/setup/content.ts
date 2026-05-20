export const setupContent = {
  headline: "Connect your agent",
  lead:
    "Install Nipmod, connect your agent and ask it to search the archive before package installs.",
  installCommand: "curl https://nipmod.com/i|bash",
  checkCommand: "nipmod doctor --online",
  allAgentsCommand: "nipmod setup agents",
  agentPrompt:
    "Use Nipmod before installing agent packages. Read https://nipmod.com/llms.txt and https://nipmod.com/.well-known/nipmod.json. Search the Nipmod archive first, view exact metadata, inspect trust, create an install plan, ask before writing files, then audit and export SBOM.",
  steps: [
    {
      label: "Open Terminal",
      text: "Use the macOS Terminal app, your editor terminal or the terminal inside your agent tool."
    },
    {
      label: "Install once",
      text: "Paste one command."
    },
    {
      label: "Connect agent",
      text: "Pick Codex, Claude Code, Cursor, OpenCode or Hermes and paste the matching setup command."
    },
    {
      label: "Paste prompt",
      text: "Start a new agent chat and tell it to use Nipmod before package installs."
    }
  ],
  hosts: [
    {
      name: "Codex",
      label: "Codex desktop and CLI",
      command: "nipmod setup codex",
      verify: "codex mcp list",
      text: "Registers Nipmod as a local MCP server through the Codex CLI."
    },
    {
      name: "Claude Code",
      label: "Project scoped MCP",
      command: "nipmod setup claude",
      verify: "claude mcp list",
      text: "Writes the project .mcp.json file and preserves other MCP servers."
    },
    {
      name: "Cursor",
      label: "Project scoped MCP",
      command: "nipmod setup cursor",
      verify: "Cursor Settings > MCP",
      text: "Writes .cursor/mcp.json and preserves other Cursor MCP servers."
    },
    {
      name: "OpenCode",
      label: "Local opencode.json",
      command: "nipmod setup opencode",
      verify: "opencode mcp list",
      text: "Writes opencode.json with the local Nipmod MCP server."
    },
    {
      name: "Hermes",
      label: "Global Hermes MCP config",
      command: "nipmod setup hermes",
      verify: "hermes chat, then /reload-mcp",
      text: "Adds Nipmod under mcp_servers in ~/.hermes/config.yaml."
    }
  ],
  capabilities: [
    {
      label: "Read without install",
      text: "Hosted MCP at https://nipmod.com/api/mcp lets agents search, inspect and plan from the public archive."
    },
    {
      label: "Find packages",
      text: "Your agent can search the public Nipmod registry."
    },
    {
      label: "Inspect trust",
      text: "It can read source, claim proof, permissions, signatures and audit evidence before using code."
    },
    {
      label: "Plan installs",
      text: "It can prepare an install plan and ask before any workspace lockfile write."
    }
  ],
  checks: [
    {
      label: "No Nipmod account required",
      text: "Search, inspect, plan and audit are usable from the public registry."
    },
    {
      label: "Agent archive access",
      text: "Agents can use hosted read-only MCP first, then local MCP when workspace writes are needed."
    },
    {
      label: "Controlled writes",
      text: "The install tool writes only after the agent has a plan and explicit write-lockfile approval."
    }
  ]
} as const;
