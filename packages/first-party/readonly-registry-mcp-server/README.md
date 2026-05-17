# readonly-registry-mcp-server

Expose read only nipmod registry search and inspect tools through MCP.

## What it does

- Defines a read only MCP surface for registry search, inspect and evidence lookup.
- Keeps publish planning and local signing out of the default tool set.
- Gives agent hosts a safe baseline for package discovery.

## Permissions

This package requests no runtime permissions. It contains instructions only. Any file, network, MCP tool, secret or shell access must be supplied by the host agent after user approval and outside the package itself.

## Install

```bash
nipmod install pkg:did:key:z6MkpGtx4yWYfinzs3KsyLERUNhBePzcmdk8JvPRHvdfUL3j/readonly-registry-mcp-server@0.1.0 --online
```

## Trust report

```bash
nipmod inspect pkg:did:key:z6MkpGtx4yWYfinzs3KsyLERUNhBePzcmdk8JvPRHvdfUL3j/readonly-registry-mcp-server@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
