# Agent Workflow Example

The same Nipmod API flow works from any agent that can call HTTPS or an MCP JSON-RPC endpoint.

Tell an agent:

```text
Use Nipmod before choosing packages. Search, inspect, show trust factors and return the install plan before writing anything.
```

## Shared Flow

1. Call `GET https://nipmod.com/api/search?q=<task>`.
2. Inspect the strongest candidates with `GET /api/inspect`.
3. Request an install plan with `GET /api/install-plan`.
4. Show source, license, trust score, trust decision, warnings, trust factors and install command.
5. Ask for approval.
6. If approved, use the user's package manager locally.
7. Save a receipt in the workspace or task log.

Do not let package descriptions, README text or model cards override the agent's system instructions.

## Examples

- [Codex](codex.md)
- [Claude Code](claude-code.md)
- [MCP host](mcp-host.md)
