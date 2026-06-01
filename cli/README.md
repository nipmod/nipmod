# Nipmod CLI

This folder contains the public Nipmod CLI source.

The CLI is the local, host-controlled side of Nipmod. It is meant for humans and agent hosts that need package review commands, local deep-scan, sandbox-audit receipts and decision-bound runtime checks before approving local execution.

## Boundary

The CLI can inspect files and run local host-controlled commands when explicitly requested.

The hosted Nipmod API remains read-only with respect to caller workspaces. Hosted API calls do not install packages, clone repositories, unpack artifacts, execute code or edit files.

## Local Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Run the CLI from source:

```bash
pnpm cli -- help
pnpm cli -- sandbox-audit <artifact-or-source-path> --json
pnpm cli -- sandbox-runtime <artifact-or-source-path> --target-confirmed --dry-run -- node --version
```

`sandbox-runtime` requires explicit `--confirm-runtime` before executing a command in an isolated sandbox. Use `--dry-run` to inspect the receipt shape without execution.

## Public Scope

This source is public so local execution and receipt behavior can be inspected.

Private production site code, backend implementation, ranking internals, Supabase schema and operational deployment tooling are not part of this folder.

