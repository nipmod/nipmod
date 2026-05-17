# external-review-packet

Prepare a complete external review packet from nipmod proof and gate output.

## What it does

- Turns source, docs, production checks and known limitations into an auditor handoff.
- Ensures the packet includes scope, commit, commands, evidence and reviewer sign off fields.
- Separates audit readiness from a completed independent audit.

## Permissions

This package requests no runtime permissions. It contains instructions only. Any file, network, MCP tool, secret or shell access must be supplied by the host agent after user approval and outside the package itself.

## Install

```bash
nipmod install pkg:did:key:z6MktDAiA6JWkGr5oLe9pDmygCL73aaa6yud93Hzyh2DUHjF/external-review-packet@0.1.0 --online
```

## Trust report

```bash
nipmod inspect pkg:did:key:z6MktDAiA6JWkGr5oLe9pDmygCL73aaa6yud93Hzyh2DUHjF/external-review-packet@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
