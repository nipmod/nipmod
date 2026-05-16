# gitlawb-release-review

Review Gitlawb package releases for immutable tags, signed release events and registry readiness.

## What it does

- Checks whether a Gitlawb-backed package release has the evidence nipmod expects.
- Compares repo source, release event, bundle digest and public registry entry.
- Produces a publish-readiness verdict for agents and maintainers.

## Permissions

This skill package requests no runtime permissions. It contains instructions only. Any file, network, MCP tool, secret or shell access must be supplied by the host agent after user approval and outside the package itself.

## Install

```bash
nipmod add pkg:did:key:z6MkfAZP5ayqPdX9biypAAZAjtDM1AbztFTmUFNGVqjpn41N/gitlawb-release-review@0.1.0 --online
```

## Trust report

```bash
nipmod inspect pkg:did:key:z6MkfAZP5ayqPdX9biypAAZAjtDM1AbztFTmUFNGVqjpn41N/gitlawb-release-review@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
