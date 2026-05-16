# package-evidence-brief

Turn nipmod inspect output into a short human review brief.

## What it does

- Converts package evidence into a founder, reviewer or maintainer friendly brief.
- Explains digest, signer, source commit, transparency proof, witness and permissions.
- Keeps install advice separate from package author claims.

## Permissions

This package requests no runtime permissions. It contains instructions only. Any file, network, MCP tool, secret or shell access must be supplied by the host agent after user approval and outside the package itself.

## Install

```bash
nipmod add pkg:did:key:z6MkfCMAxqkvoMNtoxmU3yon2YGnigvQxRz2QF3Ltfeq5xRK/package-evidence-brief@0.1.0 --online
```

## Trust report

```bash
nipmod inspect pkg:did:key:z6MkfCMAxqkvoMNtoxmU3yon2YGnigvQxRz2QF3Ltfeq5xRK/package-evidence-brief@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
