# MCP Connection Kit

Status: Live

MCP is the neutral agent runtime path. It lets hosts connect to Nipmod without each platform needing a native marketplace integration first.

Use this wording:

> Nipmod exposes local MCP for workspace-aware tools and hosted read-only MCP for public archive search, inspect and install planning.

Do not claim:

> Every MCP host natively ships Nipmod.

Public path:

https://nipmod.com/mcp

Hosted read-only endpoint:

https://nipmod.com/api/mcp

Hosted tools:

- `nipmod.search`
- `nipmod.view`
- `nipmod.inspect`
- `nipmod.install_plan`
- `nipmod.demo`

Smoke:

```sh
node tools/platform-readiness-check.mjs
```

Agent instruction:

Use `https://nipmod.com/api/mcp` for read-only archive access. Connect to `nipmod mcp serve` when the agent needs controlled install, audit, SBOM, local file verification, claim checks or publish planning.

Submission note:

No outside submission is required for local MCP usage.
