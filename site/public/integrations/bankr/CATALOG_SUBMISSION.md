# Bankr Skill Catalog Submission

This file is the submission packet for adding Nipmod to the Bankr skill catalog.

## Proposed Catalog Entry

Provider path:

```text
nipmod/nipmod
```

Source folder in this repository:

```text
integrations/bankr/nipmod
```

Public skill URL:

```text
https://nipmod.com/integrations/bankr/nipmod/SKILL.md
```

Public review folder:

```text
https://github.com/nipmod/nipmod/tree/main/integrations/bankr/nipmod
```

## Catalog PR Steps

1. Fork `https://github.com/BankrBot/skills`.
2. Create `nipmod/nipmod/`.
3. Copy this repository's `integrations/bankr/nipmod/` folder into `nipmod/nipmod/`.
4. Open a PR titled:

```text
Add Nipmod skill for package trust and install planning
```

## PR Description

```text
Adds the Nipmod skill for Bankr agents.

Nipmod lets agents discover packages, inspect trust metadata, plan installs before workspace mutation and prepare Gitlawb-sourced package drafts.

Included:
- SKILL.md with Bankr-compatible frontmatter
- references/bankr-workflow.md
- references/free-services.md

Requirements:
- curl
- git
- node
- nipmod

Safety:
- inspect before install
- install plan before workspace mutation
- no wallet, signing, token or transfer actions without explicit user approval
- no x402 requirement for core package workflows

Validation:
- public skill URL returns 200
- public service map returns 200
- Bankr Agent API smoke test confirmed the skill is reachable and service map pricing is free
- repository tests, typecheck, production build and secret scan pass
```

## User Install Prompt

Until the catalog entry is merged, tell a Bankr agent:

```text
Read https://nipmod.com/integrations/bankr/nipmod/SKILL.md and use Nipmod before installing agent packages.
```

For a GitHub folder install flow:

```text
Install the nipmod skill from https://github.com/nipmod/nipmod/tree/main/integrations/bankr/nipmod
```

## Runtime Smoke Test

Use a Bankr API key with Agent API enabled:

```bash
bankr agent prompt "Do not trade, transfer, sign, deploy, launch, swap, buy, sell, or spend anything. Read https://nipmod.com/integrations/bankr/nipmod/SKILL.md and https://nipmod.com/integrations/bankr/bankr.free.json. Reply only with whether the Nipmod Bankr skill is reachable and whether the service map pricing is free."
```

Expected result:

```text
the nipmod bankr skill is reachable.
the service map pricing is free.
```
