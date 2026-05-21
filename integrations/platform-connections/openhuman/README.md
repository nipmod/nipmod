# OpenHuman Connection Kit

Status: Candidate

OpenHuman is a strong candidate because it is a public agent harness with local-first memory, coding tools, existing agent-facing repo surfaces such as `.agents`, `.claude` and `.codex`, and a configurable remote MCP client path.

Current best path:

OpenHuman remote MCP client -> Nipmod hosted read-only MCP.

This lets an OpenHuman agent search Nipmod packages, inspect trust and ask for install plans without package writes from the hosted endpoint.

Use this wording:

> OpenHuman has a review-ready Nipmod MCP connection packet, pending Tiny Humans owner review.

Do not claim:

> OpenHuman officially supports Nipmod.

Do not claim:

> OpenHuman packages are already published through Nipmod.

Public path:

https://github.com/tinyhumansai/openhuman

Nipmod review page:

https://nipmod.com/openhuman

Public config:

https://nipmod.com/integrations/openhuman/openhuman.mcp-client.toml

Fit:

- OpenHuman can register remote MCP servers through `mcp_client.servers`.
- Nipmod exposes a hosted read-only MCP endpoint at `https://nipmod.com/api/mcp`.
- Nipmod can act as an additional package discovery and trust layer for OpenHuman agents.
- OpenHuman-owned packages or skills should only be listed after owner approval.

Smoke:

```sh
OpenHuman agent: mcp_list_servers -> mcp_list_tools(server=nipmod) -> mcp_call_tool(server=nipmod, tool=nipmod.search)
```

Agent instruction:

Do not package, mirror or republish OpenHuman code without owner review. Use the hosted read-only MCP path for search, trust inspection and install plans only.

Submission note:

Ask Tiny Humans to review `OPENHUMAN_SUBMISSION.md` and the config example before any official support or OpenHuman-owned package listing is claimed.
