# Nipmod CLI

This folder contains the public Nipmod CLI source.

The CLI is the local, host-controlled side of Nipmod. It is meant for humans and agent hosts that need package review commands, local deep-scan, sandbox-audit receipts and decision-bound runtime checks before approving local execution.

## Boundary

The CLI can inspect files and run local host-controlled commands when explicitly requested.

The hosted Nipmod API remains read-only with respect to caller workspaces. Hosted API calls do not install packages, clone repositories, unpack artifacts, execute code or edit files.

## Install

After npm publication:

```bash
npx nipmod --help
pnpm dlx nipmod --help
npm install -g nipmod
```

Until npm publication, run the public source directly:

```bash
pnpm --dir cli install --frozen-lockfile
pnpm --dir cli cli -- help
```

## Main Commands

| Command | Purpose |
| --- | --- |
| `search`, `inspect`, `view` | Read hosted Nipmod package intelligence from an agent host or terminal. |
| `deep-scan` | Inspect local package files for risky install behavior and supply-chain signals. |
| `sandbox-audit` | Produce a cached, content-hash-bound local audit receipt. |
| `sandbox-runtime` | Run an explicitly confirmed command in an isolated sandbox and bind the receipt to the audit preflight. |
| `mcp serve` | Expose Nipmod tools to local agent hosts. |

## Experimental Local Setup

`setup` and `setup-cloudflare` are local setup helpers for wiring agent hosts and development credentials.
They are not part of the hosted API boundary and are not production deployment tooling.

## Local Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Run the CLI from source:

```bash
pnpm --dir cli cli -- help
pnpm --dir cli cli -- sandbox-audit <artifact-or-source-path> --json
pnpm --dir cli cli -- sandbox-runtime <artifact-or-source-path> --target-confirmed --dry-run -- node --version
```

`sandbox-runtime` requires explicit `--confirm-runtime` before executing a command in an isolated sandbox. Use `--dry-run` to inspect the receipt shape without execution.

## Public Scope

This source is public so local execution and receipt behavior can be inspected.

Private production site code, backend implementation, ranking internals, Supabase schema and operational deployment tooling are not part of this folder.
