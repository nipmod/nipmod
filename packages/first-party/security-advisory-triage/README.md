# security-advisory-triage

Triage package security reports into advisory, quarantine and user-action decisions.

## What it does

- Reviews vulnerability reports against package identity, version, digest and registry evidence.
- Produces severity, affected versions, reproduction evidence and advisory action.
- Keeps package quarantine decisions separate from Gitlawb content ownership.

## Permissions

This skill package requests no runtime permissions. It contains instructions only. Any file, network, MCP tool, secret or shell access must be supplied by the host agent after user approval and outside the package itself.

## Install

```bash
nipmod add pkg:did:key:z6MkrEUHLE6XQq8e8W3EXKYVdznbsj4BJVGSKXuu8ahNu68j/security-advisory-triage@0.1.0 --online
```

## Trust report

```bash
nipmod inspect pkg:did:key:z6MkrEUHLE6XQq8e8W3EXKYVdznbsj4BJVGSKXuu8ahNu68j/security-advisory-triage@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
