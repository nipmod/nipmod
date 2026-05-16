# CLI contract

This document defines the public command behavior for agents and scripts.

## Commands

P0 commands:

- `nipmod help`
- `nipmod init`
- `nipmod manifest validate`
- `nipmod pack`
- `nipmod verify`
- `nipmod publish --dry-run`
- `nipmod inspect`
- `nipmod install --plan`
- `nipmod add`
- `nipmod audit`
- `nipmod ci`
- `nipmod search`
- `nipmod ls`
- `nipmod uninstall`
- `nipmod policy`
- `nipmod mcp serve`

Next npm parity commands:

- `nipmod outdated`
- `nipmod update`
- `nipmod explain`
- `nipmod version`
- `nipmod dist-tag`
- `nipmod deprecate`
- `nipmod sbom`

## JSON output

Commands that support `--json` return the compatibility envelope:

```json
{
  "ok": true,
  "data": {}
}
```

Unexpected failures return:

```json
{
  "ok": false,
  "error": {
    "message": "human readable failure"
  },
  "exitCode": 1
}
```

Trust and advisory blocks can return `ok: false` with structured `data` and a nonzero `exitCode`. Clients should preserve this data because it contains the actionable trust report.

Command specific data lives under `data`. Scripts should check `ok` and `exitCode` first.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | ok |
| 1 | usage or unexpected error |
| 7 | trust or advisory block |
| 12 | preflight not ready |

## Network mode

Commands that need public data require `--online`. Commands that can run locally must not silently use network access.

Use `--offline` for checks that should never touch public services.

## Stability rules

- Existing v1 lockfiles remain readable.
- Explicit integrity pins remain supported.
- Public JSON field names are additive once released.
- Registry data is an index. It is never the only proof source.
- Custom trust roots require explicit opt in.
