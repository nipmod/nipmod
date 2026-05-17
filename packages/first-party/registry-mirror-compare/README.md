# registry-mirror-compare

Compare registry mirrors and flag digest, trust root, witness or advisory drift.

## What it does

- Compares two or more nipmod registry indexes before an agent trusts a mirror.
- Flags package digest mismatch, root mismatch, witness mismatch and advisory drift.
- Produces a fail closed decision for install and search plans.

## Permissions

This package requests no runtime permissions. It contains instructions only. Any file, network, MCP tool, secret or shell access must be supplied by the host agent after user approval and outside the package itself.

## Install

```bash
nipmod install pkg:did:key:z6MkfJVpnZrHEGKvhSQz5SXaHPD3bM6ktHHB18u11vcDwAnS/registry-mirror-compare@0.1.0 --online
```

## Trust report

```bash
nipmod inspect pkg:did:key:z6MkfJVpnZrHEGKvhSQz5SXaHPD3bM6ktHHB18u11vcDwAnS/registry-mirror-compare@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
