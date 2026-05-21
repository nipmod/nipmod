# Nipmod for OpenHuman review

Status: under review. Not official until Tiny Humans reviews or accepts it.

What is ready:

- OpenHuman docs PR: https://github.com/tinyhumansai/openhuman/pull/2432
- Nipmod skill instructions: https://github.com/nipmod/nipmod/blob/main/skills/nipmod/SKILL.md
- Draft native OpenHuman skill branch: https://github.com/nipmod/openhuman-skills/tree/add-nipmod-skill
- Hosted read-only MCP endpoint for compatible MCP clients: https://nipmod.com/api/mcp

The current OpenHuman-owned path is the `SKILL.md` install route. OpenHuman's repo includes URL normalization for GitHub `blob` links to raw Markdown, so a user can install the Nipmod skill instructions from the public GitHub file and then ask OpenHuman to search packages, inspect trust evidence and return an install plan.

The draft native skill in `nipmod/openhuman-skills` adds read-only tools for:

- Nipmod status
- package search
- package view
- package trust inspection
- install-plan generation
- demo flow

That skill branch could not be submitted upstream because `tinyhumansai/openhuman-skills` is archived and read-only.

## Safe review prompt

Ask an OpenHuman agent:

```text
Use Nipmod to search for gitlawb-repo-reader, inspect its trust record and return an install plan. Do not install packages or write files.
```

## Claim boundary

Accurate public line:

> OpenHuman has a Nipmod docs PR open and a draft native skill branch prepared for Tiny Humans review.

Do not claim:

> OpenHuman officially supports Nipmod.

Do not claim:

> OpenHuman skills are already published through Nipmod.

Do not claim:

> The OpenHuman native skill is merged upstream.

Owner approval is required before any official OpenHuman support or OpenHuman-owned package collection is claimed.
