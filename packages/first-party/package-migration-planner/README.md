# package-migration-planner

Plan a Gitlawb, MCP or APM source migration into a nipmod package.

## What it does

- Maps an existing repo, MCP server or APM package into a nipmod package candidate.
- Identifies manifest fields, permission claims, compatibility receipts and missing proof.
- Produces a staged migration plan that avoids false ownership claims.

## Permissions

This package requests no runtime permissions. It contains instructions only. Any file, network, MCP tool, secret or shell access must be supplied by the host agent after user approval and outside the package itself.

## Install

```bash
nipmod add pkg:did:key:z6Mkp7vpuGY1bRKZNHH9qnuk8fPV5DtquE4q182BnYEAqG9z/package-migration-planner@0.1.0 --online
```

## Trust report

```bash
nipmod inspect pkg:did:key:z6Mkp7vpuGY1bRKZNHH9qnuk8fPV5DtquE4q182BnYEAqG9z/package-migration-planner@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
