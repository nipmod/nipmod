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
- `nipmod view`
- `nipmod install --plan`
- `nipmod add`
- `nipmod audit`
- `nipmod ci`
- `nipmod search`
- `nipmod ls`
- `nipmod uninstall`
- `nipmod outdated`
- `nipmod policy`
- `nipmod mcp serve`

Next npm parity commands:

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

Human terminal output is optimized for scanning and may change between releases. Agents and scripts should use
`--json` or `nipmod mcp serve`. `nipmod search --details` prints canonical package ids and source registry URLs
for humans who want the security detail that is hidden from the default search view. `nipmod view` returns exact
package metadata and refuses ambiguous names unless the canonical package id is used.
`nipmod outdated` compares installed lockfile packages against the configured registry and reports `current`,
`wanted`, `latest`, `spec` and `status`; it stays quiet when every installed package is current.

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
- New installs write `nipmod.lock.json` `formatVersion: 2` with root dependency intent, verified package records and dependency snapshots.
- Lockfile package keys remain `${canonical}@${version}`.
- `.nipmod/store/sha256/<digest>/bundle.nipmod` is a cache. `uninstall` removes lockfile entries, not cached bundles.
- Explicit integrity pins remain supported.
- Public JSON field names are additive once released.
- Registry data is an index. It is never the only proof source.
- Installs recheck fetched signed bundle manifests before lockfile mutation. Registry permission counts cannot downgrade real package permissions.
- HTTPS registry mirrors that are not `https://nipmod.com` must prove signed advisory state before install; otherwise trust reports fail closed.
- Custom trust roots require explicit opt in.
