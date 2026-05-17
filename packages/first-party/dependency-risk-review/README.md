# dependency-risk-review

Review agent package dependencies, permissions and lockfiles for supply-chain risk.

## What it does

- Reads a package manifest or lockfile and identifies permission, provenance and advisory risk.
- Highlights risky changes such as new network egress, secret access, postinstall hooks or mutable refs.
- Produces a concise decision that can be used before `nipmod install`, `nipmod audit` or `nipmod ci`.

## Permissions

This skill package requests no runtime permissions. It contains instructions only. The host agent decides which files may be read and which network calls are allowed.

## Install

```bash
nipmod install pkg:did:key:z6Mkqm8Ub1wbA79siRozF1Q7j1DjixxFNAsHnSSfPaT2iA1C/dependency-risk-review@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
