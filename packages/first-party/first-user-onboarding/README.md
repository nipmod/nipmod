# first-user-onboarding

Guide a new user through install, inspect, add, audit and publish dry run.

## What it does

- Gives first users a short terminal path that proves Nipmod works before any account setup.
- Captures evidence needed for feedback without collecting secrets.
- Separates package consumer onboarding from package author onboarding.

## Permissions

This package requests no runtime permissions. It contains instructions only. Any file, network, MCP tool, secret or shell access must be supplied by the host agent after user approval and outside the package itself.

## Install

```bash
nipmod install pkg:did:key:z6Mkho169M47Pu8rZmLqkBpCEzGAW6SCA8MXsH6YwEAjtLM4/first-user-onboarding@0.1.0 --online
```

## Trust report

```bash
nipmod inspect pkg:did:key:z6Mkho169M47Pu8rZmLqkBpCEzGAW6SCA8MXsH6YwEAjtLM4/first-user-onboarding@0.1.0 --online
```

## Smoke test

See `SMOKE.md`.
