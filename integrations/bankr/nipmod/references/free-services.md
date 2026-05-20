# Nipmod Free Services For Bankr

Nipmod's Bankr integration is free for core package workflows.

Bankr agents should use the public Nipmod site, registry, CLI and MCP tools. Do not use x402 payment for package search, inspect, audit or install planning.

## Service Map

### package-search

Search packages:

```bash
nipmod search gitlawb --online
```

Read the public registry:

```text
https://nipmod.com/registry/packages.json
```

Browse packages:

```text
https://nipmod.com/packages
```

### package-audit

Inspect a package:

```bash
nipmod inspect gitlawb-repo-reader --json
```

Plan before install:

```bash
nipmod install --plan gitlawb-repo-reader --json
```

Audit the workspace:

```bash
nipmod audit --online
```

Read audit docs:

```text
https://nipmod.com/audit
```

### install-plan

Plan a package install:

```bash
nipmod install --plan gitlawb-repo-reader --json
```

## Bankr Coin

The $NPM Bankr coin is an investor/community token link, not a required payment rail for using Nipmod package workflows.

```text
https://bankr.bot/launches/0x5155Eaa3B5784B829DeAD78189Eb4Bf69359dbA3
```
