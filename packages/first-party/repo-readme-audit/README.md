# repo-readme-audit

Audit a repository README for installability, trust clarity and agent-safe wording.

## What it does

- Checks whether a fresh user can find install, verify, inspect and troubleshoot steps.
- Flags unsafe copy such as pipe-to-shell installs, missing checksum verification or unclear permissions.
- Separates product explanation from executable instructions so agents can quote safely.

## Permissions

This skill package requests no runtime permissions. It contains instructions only. Any file or network reads must be supplied by the host agent after user approval.

## Install

```bash
nipmod install pkg:did:key:z6MkgXXLN2Qt3GKL9KJPo7SH7WGcQqRYcpT5MrwbTJ9qHpZu/repo-readme-audit@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
