# package-safety-eval-pack

Evaluate package safety scanners against known unsafe agent package fixtures.

## What it does

- Defines eval cases for prompt injection, secret exfiltration, unsafe lifecycle claims and permission overreach.
- Uses safe text fixtures rather than executable malware.
- Produces expected block decisions for scanners and policy packs.

## Permissions

This package requests no runtime permissions. It contains instructions only. Any file, network, MCP tool, secret or shell access must be supplied by the host agent after user approval and outside the package itself.

## Install

```bash
nipmod install pkg:did:key:z6Mkp52AN6L6AymVvV9bVJfmt5UG3Lwrx7JUm2VPfcTG2bJF/package-safety-eval-pack@0.1.0 --online
```

## Trust report

```bash
nipmod inspect pkg:did:key:z6Mkp52AN6L6AymVvV9bVJfmt5UG3Lwrx7JUm2VPfcTG2bJF/package-safety-eval-pack@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
