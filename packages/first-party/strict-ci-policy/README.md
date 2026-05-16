# strict-ci-policy

Apply a strict agent-package policy for production repositories that require verified supply chains.

## What it does

- Defines a production-grade decision frame for package installs.
- Blocks mutable, unverified, quarantined or over-permissioned packages.
- Turns trust reports into reviewable approval criteria.

## Permissions

This skill package requests no runtime permissions. It contains instructions only. Any file, network, MCP tool, secret or shell access must be supplied by the host agent after user approval and outside the package itself.

## Install

```bash
nipmod add pkg:did:key:z6MkhmdBsWDz4gejutZzV3bHZUYXaf2UigNT7QN8MSotbHHN/strict-ci-policy@0.1.0 --online
```

## Trust report

```bash
nipmod inspect pkg:did:key:z6MkhmdBsWDz4gejutZzV3bHZUYXaf2UigNT7QN8MSotbHHN/strict-ci-policy@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
