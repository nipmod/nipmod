# Nipmod for Bankr

This folder contains the local Bankr integration pack for Nipmod.

It is intentionally split into two pieces:

- `nipmod/` is the Bankr-compatible skill folder.
- `bankr.free.json` maps free Bankr agent workflows to public Nipmod endpoints and CLI commands.
- `bankr.agent-proof.json` is a runnable proof path for skill read, package discovery, trust check and install planning.
- `CATALOG_SUBMISSION.md` is the Bankr skill catalog PR packet.

## Use with a Bankr agent

Tell the agent:

```text
Read https://nipmod.com/integrations/bankr/nipmod/SKILL.md and use Nipmod before installing agent packages.
```

For a complete proof run:

```text
Do not trade, transfer, sign, deploy, launch, swap, buy, sell, or spend anything. Read https://nipmod.com/integrations/bankr/nipmod/SKILL.md and https://nipmod.com/integrations/bankr/bankr.agent-proof.json. Prove the Nipmod workflow by returning JSON with: skillRead, packageFound, trustChecked, installPlanReady and safety. Use the proof package and commands from the proof JSON. Do not install packages or mutate the user's workspace.
```

For GitHub review or catalog installation, point the agent at:

```text
https://github.com/nipmod/nipmod/tree/main/integrations/bankr/nipmod
```

For Bankr's public skill catalog, use the PR packet in `CATALOG_SUBMISSION.md`. It includes the target folder, README row, PR body and runtime smoke command.

## Local validation

Run from the repository root:

```bash
pnpm --dir site test test/bankr-integration.test.ts
pnpm --dir site typecheck
```

With a Bankr API key that has Agent API access enabled, run the real Bankr Agent API smoke:

```bash
BANKR_API_KEY=bk_... node tools/bankr-agent-smoke.mjs --require-auth
```

Without `BANKR_API_KEY`, the smoke reports that Bankr auth is required and exits without calling Bankr.

## Bankr path

Install or point a Bankr agent at the skill folder/file. Package search, inspect, audit and install planning stay free:

```bash
nipmod search gitlawb --online
nipmod inspect gitlawb-repo-reader --json
nipmod install --plan gitlawb-repo-reader --json
```

No Nipmod Bankr endpoint should require x402 payment for core package workflows.

The $NPM coin is public at:

```text
https://bankr.bot/launches/0x5155Eaa3B5784B829DeAD78189Eb4Bf69359dbA3
```
