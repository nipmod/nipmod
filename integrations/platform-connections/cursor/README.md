# Cursor Connection Kit

Status: MCP ready

Cursor can use Nipmod through a project scoped `.cursor/mcp.json` file and the local Nipmod MCP server.

Accurate claim:

> Cursor users can connect Nipmod through project MCP setup.

Do not claim:

> Nipmod is officially integrated into Cursor.

## Setup

```bash
curl https://nipmod.com/i|bash
nipmod setup cursor
```

This writes:

```json
{
  "mcpServers": {
    "nipmod": {
      "command": "nipmod",
      "args": ["mcp", "serve"],
      "env": {}
    }
  }
}
```

to `.cursor/mcp.json` and preserves other existing MCP servers.

## Verify

Open Cursor Settings, then MCP, and confirm `nipmod` is listed for the project.

## Source

Cursor documents project MCP configuration through `.cursor/mcp.json` and stdio servers with `command` plus `args`:

https://docs.cursor.com/en/context/mcp

## Boundary

No native Cursor marketplace listing or partnership is claimed. Cursor acceptance is only required before using official, native or partner wording.
