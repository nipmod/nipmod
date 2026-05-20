# Nipmod Bankr Workflow

## Install in Bankr

Bankr skills use one `SKILL.md` file with optional sibling `references/` files. The Nipmod folder follows that layout and is ready for a public GitHub mirror or Bankr skill catalog PR.

Tell a Bankr agent:

```text
Read https://nipmod.com/integrations/bankr/nipmod/SKILL.md and use Nipmod before installing agent packages.
```

Public skill file:

```text
https://nipmod.com/integrations/bankr/nipmod/SKILL.md
```

Public GitHub skill folder:

```text
https://github.com/nipmod/nipmod/tree/main/integrations/bankr/nipmod
```

Catalog submission packet:

```text
https://nipmod.com/integrations/bankr/CATALOG_SUBMISSION.md
```

The Bankr catalog path requires a fork and PR to `BankrBot/skills`. Until that PR is merged, users can install the skill directly from the public GitHub folder.

The canonical source remains Gitlawb:

```text
https://gitlawb.com/node/repos/z6Mkwbud/nipmod
```

## First run

```bash
curl -fsSL https://nipmod.com/.well-known/nipmod.json
curl -fsSL https://nipmod.com/llms.txt
nipmod doctor --online
nipmod search gitlawb --online
```

If `nipmod` is missing:

```bash
curl -fsSL https://nipmod.com/i | bash
```

## Agent package use

1. Search the registry.
2. Inspect the package as JSON.
3. Plan the install.
4. Ask for approval before workspace mutation.
5. Install.
6. Audit.
7. Export SBOM when reporting completion.

```bash
nipmod search gitlawb --online
nipmod inspect gitlawb-repo-reader --json
nipmod install --plan gitlawb-repo-reader --json
nipmod install gitlawb-repo-reader
nipmod audit --online
nipmod sbom --json
```

## Agent proof run

Use this when a Bankr agent needs to show the complete Nipmod path without changing a workspace.

```text
Do not trade, transfer, sign, deploy, launch, swap, buy, sell, or spend anything. Read https://nipmod.com/integrations/bankr/nipmod/SKILL.md and https://nipmod.com/integrations/bankr/bankr.agent-proof.json. Prove the Nipmod workflow by returning JSON with: skillRead, packageFound, trustChecked, installPlanReady and safety. Use the proof package and commands from the proof JSON. Do not install packages or mutate the user's workspace.
```

The proof manifest is:

```text
https://nipmod.com/integrations/bankr/bankr.agent-proof.json
```

It uses the live `gitlawb-repo-reader` package and checks:

```bash
nipmod search gitlawb-repo-reader --online --json
nipmod inspect pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0 --json
nipmod install --plan pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0 --json
```

## Real Bankr Agent API smoke

Use this only with a Bankr API key that has Agent API access enabled:

```bash
BANKR_API_KEY=bk_... node tools/bankr-agent-smoke.mjs --require-auth
```

The smoke submits the safe proof prompt to `https://api.bankr.bot/agent/prompt`, polls the job, and expects JSON fields for `skillRead`, `packageFound`, `trustChecked`, `installPlanReady` and `safety`. It does not request wallet, trading, signing, token launch or workspace mutation actions.

## Bankr profile

When authenticated in Bankr, Nipmod can maintain a public Agent Profile. This is an operator action, not an automatic package install step.

```bash
bankr agent profile create \
  --name "Nipmod" \
  --description "Package layer for agents." \
  --token 0x5155Eaa3B5784B829DeAD78189Eb4Bf69359dbA3 \
  --image "https://nipmod.com/nipmod-logo.png" \
  --website "https://nipmod.com"
```

Updates should be concise and factual:

```bash
bankr agent profile add-update \
  --title "Bankr skill ready" \
  --content "Bankr agents can install the Nipmod skill and use free package search, inspect, audit and install planning."
```

Profile creation and public listing require Bankr authentication and Bankr review.

## External references

- Bankr skill format: https://docs.bankr.bot/skills/in-bankr/skill-format/
