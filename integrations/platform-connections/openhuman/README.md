# OpenHuman Connection Kit

Status: Candidate

OpenHuman is a strong candidate because it is a public agent harness with local-first memory, coding tools and existing agent-facing repo surfaces such as `.agents`, `.claude` and `.codex`.

Use this wording:

> OpenHuman is a candidate for a future Nipmod agent-harness connection, pending Tiny Humans owner review.

Do not claim:

> OpenHuman officially supports Nipmod.

Do not claim:

> OpenHuman packages are already published through Nipmod.

Public path:

https://github.com/tinyhumansai/openhuman

Fit:

- OpenHuman could use Nipmod as a package discovery and trust layer for agent-installable packages.
- Nipmod could expose OpenHuman-specific setup instructions if OpenHuman supports a stable local tool, MCP or skill path.
- OpenHuman-owned packages or skills should only be listed after owner approval.

Smoke:

```sh
Review OpenHuman docs and prepare owner approved MCP, CLI or skill setup path
```

Agent instruction:

Do not package, mirror or republish OpenHuman code without owner review. Prepare metadata, setup notes and integration structure only for review.

Submission note:

Ask Tiny Humans whether OpenHuman should connect to Nipmod through local MCP, CLI install flow or an OpenHuman-native package/skill format.
