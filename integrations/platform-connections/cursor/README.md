# Cursor Connection Kit

Status: MCP ready

Cursor can use Nipmod through a project scoped `.cursor/mcp.json` file and the local Nipmod MCP server.

Accurate claim:

> Cursor users can connect Nipmod through MCP.

Do not claim:

> Nipmod is officially integrated into Cursor.

## Public page

https://nipmod.com/cursor

## One click install

Cursor supports MCP install deeplinks. Nipmod publishes a Cursor page with an Add to Cursor button using this config:

```text
cursor://anysphere.cursor-deeplink/mcp/install?name=nipmod&config=eyJjb21tYW5kIjoibmlwbW9kIiwiYXJncyI6WyJtY3AiLCJzZXJ2ZSJdLCJlbnYiOnt9fQ%3D%3D
```

The deeplink registers:

```json
{
  "command": "nipmod",
  "args": ["mcp", "serve"],
  "env": {}
}
```

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

For Cursor CLI:

```bash
cursor-agent mcp list
cursor-agent mcp list-tools nipmod
```

## Source

Cursor documents project MCP configuration through `.cursor/mcp.json` and stdio servers with `command` plus `args`:

https://docs.cursor.com/en/context/mcp

Cursor documents MCP install deeplinks:

https://docs.cursor.com/deeplinks

## Submission packet

`CURSOR_SUBMISSION.md` contains the exact copy, links and safety model for Cursor review.

## Boundary

No native Cursor marketplace listing or partnership is claimed. Cursor acceptance is only required before using official, native or partner wording.
