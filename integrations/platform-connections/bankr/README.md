# Bankr Connection Kit

Status: Under review

Bankr has a prepared Nipmod skill, free service map, catalog submission packet and agent proof workflow.

Use this wording:

> We prepared a Nipmod skill for Bankr agents and would like Bankr to review it.

Do not claim:

> Nipmod is officially live inside Bankr.

Public path:

https://nipmod.com/bankr

Skill:

https://nipmod.com/integrations/bankr/nipmod/SKILL.md

Smoke:

```sh
BANKR_API_KEY=bk_... node tools/bankr-agent-smoke.mjs --require-auth
```

Agent instruction:

Read the Bankr skill and proof JSON. Return package search, trust check and install plan evidence. Do not trade, transfer, sign, swap, buy, sell or spend anything.

Submission note:

Bankr must review or merge the skill before native Bankr support can be claimed.
