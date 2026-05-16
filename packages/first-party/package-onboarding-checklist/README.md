# package-onboarding-checklist

Guide new package authors through a clean nipmod publish candidate.

## What it does

- Turns a Gitlawb repo or local package folder into an author checklist.
- Checks manifest, README, permissions, smoke proof, source provenance and publish dry run readiness.
- Produces a clear claim path for humans and agents without requiring a nipmod account.

## Permissions

This skill package requests no runtime permissions. It contains instructions only. Any file, network, MCP tool, secret or shell access must be supplied by the host agent after user approval and outside the package itself.

## Install

```bash
nipmod add pkg:did:key:z6Mkm5CnkZuC7XKBbB1UQxKsKQGmEktcpD7rWXPMnRnrrB8B/package-onboarding-checklist@0.1.0 --online
```

## Trust report

```bash
nipmod inspect pkg:did:key:z6Mkm5CnkZuC7XKBbB1UQxKsKQGmEktcpD7rWXPMnRnrrB8B/package-onboarding-checklist@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
