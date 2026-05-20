# Cursor Submission Packet

Nipmod is a shared package archive for agents. It gives Cursor users a package layer for finding agent packages, checking trust evidence and preparing install plans before package writes.

## Current status

Nipmod is MCP ready for Cursor.

This means Cursor users can connect the local Nipmod MCP server now. It does not mean Cursor has listed, endorsed or reviewed Nipmod yet.

## MCP server

Name: `nipmod`

Transport: local stdio

Command:

```bash
nipmod mcp serve
```

Cursor config:

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

One click install:

```text
cursor://anysphere.cursor-deeplink/mcp/install?name=nipmod&config=eyJjb21tYW5kIjoibmlwbW9kIiwiYXJncyI6WyJtY3AiLCJzZXJ2ZSJdLCJlbnYiOnt9fQ%3D%3D
```

## Public links

Website: https://nipmod.com

Cursor page: https://nipmod.com/cursor

MCP docs: https://nipmod.com/mcp

Setup docs: https://nipmod.com/setup

GitHub: https://github.com/nipmod/nipmod

Public config: https://nipmod.com/integrations/cursor/mcp.json

Connection matrix: https://nipmod.com/compatibility/platform-connections.json

Readiness receipt: https://nipmod.com/compatibility/platform-readiness.json

## Tools exposed

```text
nipmod.search
nipmod.view
nipmod.inspect
nipmod.install_plan
nipmod.install
nipmod.update_plan
nipmod.demo
nipmod.publish_plan
nipmod.claim_verify
nipmod.claim_index
nipmod.verify
nipmod.audit
nipmod.sbom
nipmod.explain
```

## Safety model

Search, view, inspect and install plan are read only.

`nipmod.install` writes only after `confirmInstall` is set to `write-lockfile`.

Package README files, prompts and metadata are treated as untrusted data.

The hosted MCP endpoint at https://nipmod.com/api/mcp is read only and does not expose workspace writes.

## Short listing copy

Nipmod gives Cursor agents access to a shared package archive for agent packages. Cursor can search packages, view metadata, inspect trust evidence and create install plans before any workspace package write.

## Claim boundary

Do not describe this as an official Cursor integration until Cursor accepts or lists it.
