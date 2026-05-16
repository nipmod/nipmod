# nipmod-audit-ci

Turn nipmod audit and policy output into CI decisions agents can explain and enforce.

## What it does

- Maps audit findings to pass, warn or fail decisions.
- Explains blocked packages in language suitable for pull requests.
- Keeps CI policy deterministic and separate from package marketing copy.

## Permissions

This skill package requests no runtime permissions. It contains instructions only. Any file, network, MCP tool, secret or shell access must be supplied by the host agent after user approval and outside the package itself.

## Install

```bash
nipmod add pkg:did:key:z6MkksqjSMsbUAMozjiRgHXrReksjgYqo7URn5opt3Us6knt/nipmod-audit-ci@0.1.0 --online
```

## Trust report

```bash
nipmod inspect pkg:did:key:z6MkksqjSMsbUAMozjiRgHXrReksjgYqo7URn5opt3Us6knt/nipmod-audit-ci@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
