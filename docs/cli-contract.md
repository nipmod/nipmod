# CLI contract

This document defines the public command behavior for agents and scripts.

## Commands

P0 commands:

- `nipmod help`
- `nipmod version`
- `nipmod --version`
- `nipmod init`
- `nipmod manifest validate`
- `nipmod pack`
- `nipmod verify`
- `nipmod publish --dry-run`
- `nipmod inspect`
- `nipmod view`
- `nipmod install`
- `nipmod install --plan`
- `nipmod add` (legacy alias for `nipmod install <package>`)
- `nipmod audit`
- `nipmod ci`
- `nipmod search`
- `nipmod ls`
- `nipmod uninstall`
- `nipmod outdated`
- `nipmod update`
- `nipmod explain`
- `nipmod sbom`
- `nipmod policy`
- `nipmod dist-tag add pkg:<publisher>/<name>@<version> <tag>`
- `nipmod dist-tag rm pkg:<publisher>/<name> <tag>`
- `nipmod deprecate pkg:<publisher>/<name>@<version> <reason>`
- `nipmod yank pkg:<publisher>/<name>@<version> <reason>`
- `nipmod mcp serve`

Next npm parity commands:

- signed `nipmod version <semver>` release bump
- owner and maintainer key lifecycle commands

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
`nipmod install` without a package specifier restores `.nipmod/store` from the existing lockfile and reports
`packageCount`, `restored`, `fetched` and `lockfileChanged` in JSON mode. `--offline` blocks remote bundle fetches.
`nipmod install <package>` resolves a verified registry package, installs its verified dependency graph and
writes the root dependency to the lockfile. `--plan` and `--dry-run` return the same verified graph plan without
mutating the lockfile. `nipmod add <package>` is kept as a compatibility alias.
`nipmod outdated` compares installed lockfile packages against the configured registry and reports `current`,
`wanted`, `latest`, `spec` and `status`; it stays quiet when every installed package is current.
`nipmod update [package] --plan` returns a verified update plan for root dependencies without mutating the lockfile.
`nipmod update [package]` applies ready update plans, verifies fetched signed bundles, writes the lockfile atomically and
prunes stale package records that are no longer reachable from any root dependency.
`nipmod explain <package>` reads the lockfile without network access and returns root reasons, dependents and
dependency paths for matching installed package records. `<package>` accepts `name`, `name@version`, canonical package
id, canonical package id with version, or the exact lockfile package key. Path enumeration is capped and reports
`pathsTruncated` when a dense lockfile has more paths than the response limit.
`nipmod sbom` reports `type`, `generator`, `root`, `summary` and `packages` from the installed lockfile. When local
store bundles exist, it verifies each signed bundle before including manifest exports, dependency maps and package
type. It does not fetch network data.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | ok |
| 1 | usage or unexpected error |
| 7 | trust or advisory block |
| 11 | install policy block |
| 12 | preflight not ready |

## Network mode

Registry package commands use the public registry by default. `NIPMOD_REGISTRY_URL` sets one default registry;
`NIPMOD_REGISTRY_URLS` sets a comma-separated search list for search, view and outdated checks. Audit and CI still
require `--online` unless explicit registry and advisory sources are supplied. Lockfile restore is an install command:
it may fetch digest-pinned remote bundles when the local store is missing or corrupt. Pass `--offline` to force local
store and file URL use only.

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
- Explain data comes from lockfile root intent and snapshots only. It does not inspect package text or execute code.
- SBOM manifest details come from verified local store bundles. Missing cache entries are reported without network fetch.
- HTTPS registry mirrors that are not `https://nipmod.com` must prove signed advisory state before install; otherwise trust reports fail closed.
- Custom trust roots require explicit opt in.
