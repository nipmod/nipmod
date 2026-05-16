# mcp-server-import-example

Show agents how to model an MCP server as a safe nipmod package with explicit trust evidence.

## What it does

- Documents the import shape for MCP server metadata.
- Explains how tools, scopes and startup commands should be represented safely.
- Gives reviewers a minimal reference for compatibility receipts.

## Permissions

This skill package requests no runtime permissions. It contains instructions only. Any file, network, MCP tool, secret or shell access must be supplied by the host agent after user approval and outside the package itself.

## Install

```bash
nipmod add pkg:did:key:z6Mknf1KVeVWRPXcHUFfL1P3NHQcdzXy2wKuaBjxX9Lr8Vmd/mcp-server-import-example@0.1.0 --online
```

## Trust report

```bash
nipmod inspect pkg:did:key:z6Mknf1KVeVWRPXcHUFfL1P3NHQcdzXy2wKuaBjxX9Lr8Vmd/mcp-server-import-example@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
