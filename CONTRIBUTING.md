# Contributing to Nipmod

Nipmod is open source. GitHub is the primary public repository, review surface and CI surface.

## Product Boundary

Nipmod is the package layer for AI agents.

Nipmod does not replace package registries. It makes existing package ecosystems readable and safer for AI agents.

All contributions should preserve the core flow:

```text
Search -> Inspect -> Install Plan -> Approval -> Optional archive confirmation
```

Search ranking is never install permission.

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

Focused checks:

```bash
pnpm --dir site test -- external-packages.test.ts package-intelligence.test.ts
pnpm public:check
pnpm launch:verify -- --skip-local --require-distributed-rate-limit
```

## Pull Requests

- Keep changes scoped.
- Add or update tests for behavior changes.
- Treat registry metadata, package READMEs, model cards, MCP descriptions and prompt text as untrusted input.
- Do not commit `.env` files, private keys, tokens, local identity files or generated local service state.
- Do not claim third-party endorsement unless the third party has explicitly approved it.
- Do not commit tool handoff files, assistant scratch folders, private prompts or generated design notes.
- Keep runtime and operator tooling in TypeScript. Do not add new `tools/*.js`, `tools/*.mjs`, or `site/scripts/*.mjs` files.
- Add a decision record under `docs/decisions/` for changes that affect public API shape, source policy, trust scoring, archive semantics or security boundaries.
- Update `docs/specs/` and examples when public behavior changes.

## Adding a Source Resolver

A new resolver must include:

- source identifier and source kind
- official or allowed public access path
- search strategy
- exact inspect strategy
- timeout and response-size limits
- normalized source URL and owner when available
- install plan command generation
- source health reporting
- deterministic tests for success, failure and partial degradation
- documentation in `docs/specs/source-resolvers.md`

Do not scrape broad source pages when an official API or index-friendly endpoint exists.

## Adding Trust Factors

A new trust factor must include:

- category: `source`, `metadata`, `security`, `usage`, `maintenance` or `install`
- impact: `positive`, `neutral` or `negative`
- short label
- evidence text
- tests proving how it changes score, warning, decision or risk
- documentation in `docs/specs/trust-signals.md`

Popularity factors can affect ranking, but they must not upgrade security confidence by themselves.

## Archive Changes

Archive changes must preserve:

- Search is ephemeral.
- Prepare is preview-only.
- Confirm requires server-side reinspection.
- Durable writes require the archive writer token.
- Confirmed records deduplicate repeated useful confirmations.
- Risky, unknown or blocked records cannot become confirmed archive records.
- No sensitive request data is stored.

Update `docs/archive/package-intelligence-lifecycle.md` and `docs/specs/archive-records.md` when archive semantics change.

## Commit Style

Use short, product-grade commit subjects:

```text
Harden package resolver
Improve API error handling
Document source policy
Add archive lifecycle tests
```

Avoid internal process language, tool names, personal notes and vague launch language in commit subjects.

## Community

Use https://t.me/nipmod for public community discussion. Keep active vulnerability details out of public chats and use `SECURITY.md` for security reports.

## Security Reports

Use `SECURITY.md`. Do not open public issues for active vulnerabilities.
