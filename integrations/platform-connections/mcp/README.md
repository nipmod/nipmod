# MCP Connection Kit

Status: Live

MCP is the neutral agent runtime path. It lets hosts connect to Nipmod without each platform needing a native marketplace integration first.

Use this wording:

> Nipmod exposes a local MCP server for package search, trust inspection, install planning and controlled install.

Do not claim:

> Every MCP host natively ships Nipmod.

Public path:

https://nipmod.com/mcp

Smoke:

```sh
node tools/platform-readiness-check.mjs
```

Agent instruction:

Connect to `nipmod mcp serve`. Search first, inspect trust, create an install plan, ask before writes, then audit.

Submission note:

No outside submission is required for local MCP usage.
