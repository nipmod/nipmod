# apm-import-example

Show agents how to convert an APM package listing into Nipmod trust metadata.

## What it does

- Documents a safe APM-to-Nipmod compatibility review.
- Separates external package metadata from signed Nipmod evidence.
- Gives agents a template for migration and duplicate-risk checks.

## Permissions

This skill package requests no runtime permissions. It contains instructions only. Any file, network, MCP tool, secret or shell access must be supplied by the host agent after user approval and outside the package itself.

## Install

```bash
nipmod install pkg:did:key:z6MkrLceabxgQz6wmQBMDCpbQpy5MF9BwJi7KymayosN5CRn/apm-import-example@0.1.0 --online
```

## Trust report

```bash
nipmod inspect pkg:did:key:z6MkrLceabxgQz6wmQBMDCpbQpy5MF9BwJi7KymayosN5CRn/apm-import-example@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
