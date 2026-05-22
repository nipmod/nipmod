# Contributing to Nipmod

Nipmod is open source. GitHub is the primary public repository, review surface and CI surface.

## Development

Requirements:

- Node.js 22 or newer
- pnpm
- Git

Useful checks:

```bash
pnpm install
pnpm verify
```

## Pull requests

- Keep changes scoped.
- Add or update tests for behavior changes.
- Treat registry metadata, package READMEs and prompt text as untrusted input.
- Do not commit `.env` files, private keys, tokens, local identity files or generated local service state.
- Do not claim third party endorsement unless the third party has explicitly approved it.
- Do not commit tool handoff files, assistant scratch folders, private prompts or generated design notes.
- Keep runtime and operator tooling in TypeScript. Do not add new `tools/*.js`, `tools/*.mjs`, or `site/scripts/*.mjs` files.
- Type annotations for migrated operator tooling should be added in focused patches, with tests kept green.
- Add a decision record under `docs/decisions/` for changes that affect public API shape, source policy, trust scoring, archive semantics or security boundaries.
- Update `docs/specs/` when public behavior changes.

## Commit Style

Use short, product-grade commit subjects:

```text
Harden package resolver
Update public preview image
Improve API error handling
Document source policy
```

Avoid internal process language, tool names, personal notes and vague launch language in commit subjects.

## Community

Use https://t.me/nipmod for public community discussion. Keep active vulnerability details out of public chats and use `SECURITY.md` for security reports.

## Security reports

Use `SECURITY.md`. Do not open public issues for active vulnerabilities.
