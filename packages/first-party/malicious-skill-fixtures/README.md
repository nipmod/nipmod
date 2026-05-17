# malicious-skill-fixtures

Provide safe negative-test fixtures for agent package scanners and policy reviews.

## What it does

- Defines harmless fixture scenarios for prompt injection and unsafe package behavior.
- Covers postinstall, broad egress, secret read, typosquat and mutable-ref risks.
- Helps agents prove that scanners block bad patterns without publishing malware.

## Permissions

This skill package requests no runtime permissions. It contains instructions only. Any file, network, MCP tool, secret or shell access must be supplied by the host agent after user approval and outside the package itself.

## Install

```bash
nipmod install pkg:did:key:z6MknNXQoTp1JBT2MMpTrGnBervGBCW4z8bWfRHUReN7EPWP/malicious-skill-fixtures@0.1.0 --online
```

## Trust report

```bash
nipmod inspect pkg:did:key:z6MknNXQoTp1JBT2MMpTrGnBervGBCW4z8bWfRHUReN7EPWP/malicious-skill-fixtures@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
