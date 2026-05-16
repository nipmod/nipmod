# developer-default-policy

Apply a practical default policy for developers trying agent packages safely before production use.

## What it does

- Balances experimentation with hard supply-chain guardrails.
- Allows verified instruction-only packages while surfacing risk clearly.
- Explains what must change before a package moves to strict CI.

## Permissions

This skill package requests no runtime permissions. It contains instructions only. Any file, network, MCP tool, secret or shell access must be supplied by the host agent after user approval and outside the package itself.

## Install

```bash
nipmod add pkg:did:key:z6MksFrmCtYGTqJzUMsi3i8aABgH7m97zf4mhfmhvfmF5pAe/developer-default-policy@0.1.0 --online
```

## Trust report

```bash
nipmod inspect pkg:did:key:z6MksFrmCtYGTqJzUMsi3i8aABgH7m97zf4mhfmhvfmF5pAe/developer-default-policy@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
