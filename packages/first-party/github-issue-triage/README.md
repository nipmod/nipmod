# github-issue-triage

Triage GitHub issues into reproducible bugs, support requests and security-sensitive reports for agents.

## What it does

- Classifies an issue by evidence, severity and next owner.
- Extracts reproduction steps, environment facts and missing diagnostics.
- Keeps untrusted issue text separate from agent instructions.

## Permissions

This skill package requests no runtime permissions. It contains instructions only. Any file, network, MCP tool, secret or shell access must be supplied by the host agent after user approval and outside the package itself.

## Install

```bash
nipmod install pkg:did:key:z6MkneCPKedfzXaRzEtGkFrniUy5aWrmhANfP9uwajn3kXUS/github-issue-triage@0.1.0 --online
```

## Trust report

```bash
nipmod inspect pkg:did:key:z6MkneCPKedfzXaRzEtGkFrniUy5aWrmhANfP9uwajn3kXUS/github-issue-triage@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
