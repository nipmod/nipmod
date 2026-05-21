# OpenHuman Connection Kit

Status: Under review

OpenHuman is a strong fit because it is a public agent harness with local-first memory, coding tools, existing agent-facing repo surfaces such as `.agents`, `.claude` and `.codex`, and a public `SKILL.md` installer path.

Current best path:

OpenHuman skill installer -> Nipmod `SKILL.md` -> package search, trust inspection and install plans.

This lets an OpenHuman agent use Nipmod before package writes. The agent can search packages, inspect trust evidence and ask for install plans without treating package content as trusted instructions.

Additional prepared path:

`nipmod/openhuman-skills:add-nipmod-skill` contains a draft native OpenHuman skill. It could not be submitted to `tinyhumansai/openhuman-skills` because that repository is archived and read-only.

Use this wording:

> OpenHuman has a Nipmod docs PR open and a draft native skill branch prepared for Tiny Humans review.

Do not claim:

> OpenHuman officially supports Nipmod.

Do not claim:

> OpenHuman packages are already published through Nipmod.

Public path:

https://github.com/tinyhumansai/openhuman

OpenHuman docs PR:

https://github.com/tinyhumansai/openhuman/pull/2432

Draft native skill branch:

https://github.com/nipmod/openhuman-skills/tree/add-nipmod-skill

Nipmod review page:

https://nipmod.com/openhuman

Nipmod skill:

https://github.com/nipmod/nipmod/blob/main/skills/nipmod/SKILL.md

Fit:

- OpenHuman can install public GitHub `SKILL.md` files.
- The OpenHuman repo rewrites GitHub `blob` URLs to raw Markdown before install.
- Nipmod also exposes a hosted read-only MCP endpoint at `https://nipmod.com/api/mcp` for compatible MCP clients.
- Nipmod can act as an additional package discovery and trust layer for OpenHuman agents.
- OpenHuman-owned packages or skills should only be listed after owner approval.

Smoke:

```sh
OpenHuman agent: use Nipmod to search gitlawb-repo-reader, inspect trust and return an install plan only.
```

Agent instruction:

Do not package, mirror or republish OpenHuman code without owner review. Use Nipmod for search, trust inspection and install plans only.

Submission note:

Ask Tiny Humans to review `OPENHUMAN_SUBMISSION.md`, the docs PR and the draft native skill branch before any official support or OpenHuman-owned package listing is claimed.
