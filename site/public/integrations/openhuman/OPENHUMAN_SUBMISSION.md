# Nipmod for OpenHuman review

Status: review packet. Not official until Tiny Humans reviews or accepts it.

OpenHuman can register named remote MCP servers through `mcp_client.servers`.

Nipmod exposes hosted read-only MCP at:

```text
https://nipmod.com/api/mcp
```

Config:

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

Review smoke:

```text
Use the registered nipmod MCP server. Run mcp_list_servers, mcp_list_tools for nipmod, then use mcp_call_tool to search for gitlawb-repo-reader, inspect trust and return an install plan. Do not install packages or write files.
```

Accurate public line:

> OpenHuman has a review-ready Nipmod MCP connection packet.

Do not claim official OpenHuman support, OpenHuman endorsement, or OpenHuman-owned packages until Tiny Humans reviews or accepts the connection.
