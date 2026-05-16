# agent-permission-review

Review agent package permissions for least privilege before install or publish.

## What it does

- Maps declared permissions to package purpose, exported files and install intent.
- Flags overbroad filesystem, network, MCP tool, secret, exec and postinstall access.
- Produces a clear allow, reduce or block recommendation for agents.

## Permissions

This skill package requests no runtime permissions. It contains instructions only. Any file, network, MCP tool, secret or shell access must be supplied by the host agent after user approval and outside the package itself.

## Install

```bash
nipmod add pkg:did:key:z6MkpfzGwdDqJtBswdLeWBPwDzisrmCbFJCVNtVwNH9qX7kM/agent-permission-review@0.1.0 --online
```

## Trust report

```bash
nipmod inspect pkg:did:key:z6MkpfzGwdDqJtBswdLeWBPwDzisrmCbFJCVNtVwNH9qX7kM/agent-permission-review@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
