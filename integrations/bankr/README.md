# Nipmod for Bankr

This folder contains the local Bankr integration pack for Nipmod.

It is intentionally split into two pieces:

- `nipmod/` is the Bankr-compatible skill folder.
- `bankr.free.json` maps free Bankr agent workflows to public Nipmod endpoints and CLI commands.

## Local validation

Run from the repository root:

```bash
pnpm --dir site test test/bankr-integration.test.ts
pnpm --dir site typecheck
```

## Bankr path

Install or point a Bankr agent at the skill folder/file. Package search, inspect, audit and repo draft workflows stay free:

```bash
nipmod search gitlawb --online
nipmod inspect gitlawb-repo-reader --json
nipmod install --plan gitlawb-repo-reader --json
nipmod package pr gitlawb://did:key:.../repo --dir repo-package-pr --json
```

No Nipmod Bankr endpoint should require x402 payment for core package workflows.

The $NPM coin is public at:

```text
https://bankr.bot/launches/0x5155Eaa3B5784B829DeAD78189Eb4Bf69359dbA3
```
