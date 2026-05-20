# Codex Connection Kit

Status: MCP ready

Codex can use Nipmod through the local MCP server and agent readable setup files.

Use this wording:

> Codex can use Nipmod through local MCP setup.

Do not claim:

> Nipmod is officially integrated into Codex.

Public path:

https://nipmod.com/agents/codex-claude

Setup:

```sh
nipmod setup codex
```

Smoke:

```sh
node tools/platform-readiness-check.mjs --host-smoke
```

Agent instruction:

Use Nipmod before installing agent packages. Search, view, inspect, plan, ask before writing, audit and export SBOM.

Submission note:

No outside submission is required for the current local MCP path.
