export const setupContent = {
  headline: "Use Nipmod in your agent",
  lead:
    "Install once, connect your agent once, then tell Codex, Claude Code or OpenCode to search the Nipmod archive before installing agent packages.",
  installCommand: "curl -fsSLO https://nipmod.com/install.sh && bash install.sh",
  checkCommand: "nipmod doctor --online",
  agentPrompt:
    "Use Nipmod before installing agent packages. Read https://nipmod.com/llms.txt and https://nipmod.com/.well-known/nipmod.json. Search the Nipmod archive first, view exact metadata, inspect trust, create an install plan, ask before writing files, then audit and export SBOM.",
  steps: [
    {
      label: "Open Terminal",
      text: "Use the macOS Terminal app, your editor terminal or the terminal inside your agent tool."
    },
    {
      label: "Install once",
      text: "Paste the install command. It puts the Nipmod CLI on the machine."
    },
    {
      label: "Connect agent",
      text: "Pick Codex, Claude Code or OpenCode and paste the matching setup command."
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
      command: "codex mcp add nipmod -- nipmod mcp serve",
      verify: "codex mcp list",
      text: "Adds Nipmod as a local MCP server for Codex."
    },
    {
      name: "Claude Code",
      label: "Project scoped MCP",
      command: "claude mcp add --transport stdio --scope project nipmod -- nipmod mcp serve",
      verify: "claude mcp list",
      text: "Adds Nipmod to the current Claude Code project."
    },
    {
      name: "OpenCode",
      label: "Local opencode.json",
      command: `cat > opencode.json <<'JSON'
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "nipmod": {
      "type": "local",
      "command": ["nipmod", "mcp", "serve"],
      "enabled": true
    }
  }
}
JSON`,
      verify: "opencode mcp list",
      text: "Creates the local OpenCode MCP config."
    }
  ],
  capabilities: [
    {
      label: "Find packages",
      text: "Your agent can search the public Nipmod registry and Scout package drafts."
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
      text: "After MCP is connected, the agent can call Nipmod tools instead of guessing package names from chat memory."
    },
    {
      label: "Controlled writes",
      text: "The install tool writes only after the agent has a plan and explicit write-lockfile approval."
    }
  ]
} as const;
