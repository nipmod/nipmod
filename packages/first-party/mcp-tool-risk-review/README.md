# mcp-tool-risk-review

Review MCP server tools and manifests before agents expose them to package workflows.

## What it does

- Inspects MCP tool descriptions for capability, data and execution risk.
- Flags unsafe write tools, hidden network reach, secret exposure and prompt injection surfaces.
- Produces a host policy recommendation for agent runtimes.

## Permissions

This skill package requests no runtime permissions. It contains instructions only. Any file, network, MCP tool, secret or shell access must be supplied by the host agent after user approval and outside the package itself.

## Install

```bash
nipmod install pkg:did:key:z6MkwYNoJqw78ZhMGWywJHkE8f7PqnR37BXA5Tagc22N6HuV/mcp-tool-risk-review@0.1.0 --online
```

## Trust report

```bash
nipmod inspect pkg:did:key:z6MkwYNoJqw78ZhMGWywJHkE8f7PqnR37BXA5Tagc22N6HuV/mcp-tool-risk-review@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
