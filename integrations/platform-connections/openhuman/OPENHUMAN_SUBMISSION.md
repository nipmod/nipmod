# Nipmod for OpenHuman review

Status: review packet. Not official until Tiny Humans reviews or accepts it.

OpenHuman already has the right integration shape for Nipmod: a generic MCP client bridge with `mcp_list_servers`, `mcp_list_tools` and `mcp_call_tool`, plus `mcp_client.servers` config for named remote MCP servers.

Nipmod exposes a hosted read-only MCP endpoint:

```text
https://nipmod.com/api/mcp
```

That gives OpenHuman agents a safe package path:

- search packages
- view package metadata
- inspect trust evidence
- create install plans
- run demos

The hosted endpoint does not install packages or write into an OpenHuman workspace. Writes stay on local setup paths and should only be added if OpenHuman wants a native package flow later.

## Config example

Add this to OpenHuman `config.toml`:

```toml
[mcp_client]
enabled = true

[[mcp_client.servers]]
name = "nipmod"
endpoint = "https://nipmod.com/api/mcp"
description = "Nipmod shared package archive for agents. Search packages, inspect trust and create install plans before workspace writes."
enabled = true
allowed_tools = [
  "nipmod.search",
  "nipmod.view",
  "nipmod.inspect",
  "nipmod.install_plan",
  "nipmod.demo"
]
timeout_secs = 30
```

Public config:

```text
https://nipmod.com/integrations/openhuman/openhuman.mcp-client.toml
```

## Review smoke

Ask an OpenHuman agent:

```text
Use the registered nipmod MCP server. Run mcp_list_servers, mcp_list_tools for nipmod, then search for gitlawb-repo-reader, inspect trust and return an install plan. Do not install packages or write files.
```

Expected behavior:

- `nipmod` appears as a registered MCP server
- read-only Nipmod tools are visible
- package search returns real Nipmod registry data
- install plan is returned as plan output only

## Claim boundary

Accurate public line:

> OpenHuman has a review-ready Nipmod MCP connection packet.

Do not claim:

> OpenHuman officially supports Nipmod.

Do not claim:

> OpenHuman skills are already published through Nipmod.

Owner approval is required before any official OpenHuman support or OpenHuman-owned package collection is claimed.
