# agent-runtime-compat-check

Check whether an agent host can safely run nipmod install, audit and MCP flows.

## What it does

- Guides a host check for terminal, Codex, Claude Code, OpenCode and MCP usage.
- Verifies CLI availability, registry access, lockfile behavior and audit policy readiness.
- Produces a clear pass or blocked setup report.

## Permissions

This package requests no runtime permissions. It contains instructions only. Any file, network, MCP tool, secret or shell access must be supplied by the host agent after user approval and outside the package itself.

## Install

```bash
nipmod install pkg:did:key:z6MkwNvgoxc794HjwtR9wbNYwXgnw8SoBQr19ve1NQqEZdEQ/agent-runtime-compat-check@0.1.0 --online
```

## Trust report

```bash
nipmod inspect pkg:did:key:z6MkwNvgoxc794HjwtR9wbNYwXgnw8SoBQr19ve1NQqEZdEQ/agent-runtime-compat-check@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
