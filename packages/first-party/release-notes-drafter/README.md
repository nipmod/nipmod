# release-notes-drafter

Draft release notes from verified package, Gitlawb tag and changelog evidence.

## What it does

- Converts commit, diff and package metadata into a clear release note draft.
- Keeps source evidence, package digest and user-facing impact separate.
- Flags unverifiable claims before notes are published or posted publicly.

## Permissions

This skill package requests no runtime permissions. It contains instructions only. Any file, network, MCP tool, secret or shell access must be supplied by the host agent after user approval and outside the package itself.

## Install

```bash
nipmod add pkg:did:key:z6MkhLSkbSWSk4oN2QUwPMowX12uR16QGgS37EYskCWtgbsK/release-notes-drafter@0.1.0 --online
```

## Trust report

```bash
nipmod inspect pkg:did:key:z6MkhLSkbSWSk4oN2QUwPMowX12uR16QGgS37EYskCWtgbsK/release-notes-drafter@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
