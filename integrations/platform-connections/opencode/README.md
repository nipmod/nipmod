# OpenCode Connection Kit

Status: MCP ready

OpenCode can use Nipmod through `opencode.json` and the local MCP server.

Use this wording:

> OpenCode can use Nipmod through local MCP setup.

Do not claim:

> OpenCode natively ships Nipmod.

Public path:

https://nipmod.com/setup

Setup:

```sh
nipmod setup opencode
```

Smoke:

```sh
node tools/platform-readiness-check.mjs --host-smoke
```

Agent instruction:

Use the configured `nipmod` local MCP server for search, inspect, install plan and audit before package writes.

Submission note:

No outside submission is required for the current local MCP path.
