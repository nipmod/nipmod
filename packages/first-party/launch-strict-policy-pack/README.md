# launch-strict-policy-pack

Apply launch strict install policy for verified agent packages.

## What it does

- Requires verified trust, pinned digest, quiet permissions and no active quarantine.
- Blocks postinstall, exec, secrets and MCP tool requests by default.
- Gives CI and agent hosts a strict launch profile.

## Permissions

This package requests no runtime permissions. It contains instructions only. Any file, network, MCP tool, secret or shell access must be supplied by the host agent after user approval and outside the package itself.

## Install

```bash
nipmod install pkg:did:key:z6Mkr8jKUSoDpRJBu1Ap3s7ffBVhgJFwkjcQbwfAJz1R9UyE/launch-strict-policy-pack@0.1.0 --online
```

## Trust report

```bash
nipmod inspect pkg:did:key:z6Mkr8jKUSoDpRJBu1Ap3s7ffBVhgJFwkjcQbwfAJz1R9UyE/launch-strict-policy-pack@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
