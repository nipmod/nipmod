# gitlawb-repo-reader

Read a public Gitlawb repository and return a compact provenance-focused summary for agents.

## What it does

- Identifies the repository owner DID, package name, default branch and available version tags.
- Separates source facts from package claims so mutable repository content is never treated as registry truth.
- Produces a short evidence table that can feed `nipmod inspect`, README review or release review work.

## Permissions

This skill package requests no runtime permissions. It contains instructions only. Any network access must be provided by the host agent after user approval.

## Install

```bash
nipmod add pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
