# gitlawb-review-tool-bundle

Bundle Gitlawb repo review, diff summary and release review guidance.

## What it does

- Combines repo reading, README audit, diff summary and release review into one safe tool bundle.
- Keeps every step read only and evidence first.
- Produces a single review path for Gitlawb maintainers and agents.

## Permissions

This package requests no runtime permissions. It contains instructions only. Any file, network, MCP tool, secret or shell access must be supplied by the host agent after user approval and outside the package itself.

## Install

```bash
nipmod add pkg:did:key:z6Mknhqe5iXdzxNheEHf74zyZ9DVNiefnsyq4EQ5qRV4gaH2/gitlawb-review-tool-bundle@0.1.0 --online
```

## Trust report

```bash
nipmod inspect pkg:did:key:z6Mknhqe5iXdzxNheEHf74zyZ9DVNiefnsyq4EQ5qRV4gaH2/gitlawb-review-tool-bundle@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
