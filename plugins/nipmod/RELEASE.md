# Nipmod Codex Plugin Release Policy

This file defines how the public Nipmod Codex plugin is versioned, verified and
released.

## Versioning

- Use semantic versions in `.codex-plugin/plugin.json`.
- Patch: docs, copy, packaging checks or non-breaking MCP config changes.
- Minor: new optional tools, new examples, improved skill instructions or
  backwards-compatible response guidance.
- Major: removed tools, changed MCP server URL, changed default approval
  behavior or any breaking install/setup change.
- Keep hosted MCP response contracts versioned independently in each response
  `type` field. Plugin version changes must not silently break existing MCP
  tool names.

## Maintainer Release Checklist

Maintainers run the release-gate scripts from the Nipmod release workspace
before publishing the public plugin:

```bash
pnpm codex:plugin:selftest
pnpm codex:plugin:selftest:live
pnpm codex:mcp:canary
pnpm codex:exec:smoke
pnpm codex:exec:smoke:live
```

Required pass criteria:

- fresh plugin install succeeds from local source and live marketplace source
- `codex mcp get nipmod --json` points at `https://nipmod.com/api/mcp`
- default MCP startup does not require `NIPMOD_API_KEY`
- `tools/list` includes `nipmod.codex_preflight`, `nipmod.install_guard` and
  `nipmod.package_decision`
- live Codex exec calls `nipmod.codex_preflight` and `nipmod.install_guard`
- auth-package smoke stays on auth intent and does not select `pnpm`,
  `better-npm-audit` or `audit-ci`
- no package-manager write command executes during the smoke

## Public Install Verification

Use a temporary Codex home for local checks:

```bash
export CODEX_HOME="$(mktemp -d)"
codex plugin marketplace add nipmod/nipmod --ref main --json
codex plugin add nipmod@nipmod --json
codex mcp get nipmod --json
```

The MCP transport should be `streamable_http`, enabled, and zero-key by
default.

## Uninstall Verification

Use Codex's plugin remove command for the installed plugin, then confirm the MCP
server is gone or disabled in that Codex home:

```bash
codex plugin remove nipmod@nipmod --json
codex mcp get nipmod --json
```

Expected result: either `nipmod` is no longer present, or Codex reports it as
not enabled. A fresh install after removal must still pass `codex mcp get
nipmod --json`.

## Theme And Icon Check

The plugin uses `assets/nipmod-logo.png` for both composer and large plugin
surfaces. Before a public release, inspect the plugin card in light and dark
Codex themes and verify:

- logo remains legible on light and dark backgrounds
- no transparent edge artifacts are visible
- display name reads `Nipmod`
- short description fits the plugin card without awkward wrapping

## Failure Recovery Copy

Use this wording when a user cannot load the plugin:

```text
Nipmod is installed, but this Codex session has not loaded the MCP tools yet.
Start a new Codex session from the repo root and run `codex mcp get nipmod
--json`. Hosted read-only MCP works without `NIPMOD_API_KEY`; set a key only
for higher limits.
```
