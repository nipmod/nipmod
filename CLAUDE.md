# Claude Code Handoff

You are working on Nipmod, a real public product. The user wants the whole website redesigned, but the product facts and public proof surfaces must stay accurate.

Read this first, then read:

- `.claude/website-redesign/README.md`
- `.claude/website-redesign/site-map.md`
- `.claude/website-redesign/design-brief.md`
- `site/CLAUDE.md`

## Product Truth

Nipmod is the package layer for agents. It lets humans and agents search a shared archive, inspect trust evidence, create install plans and use controlled local installs.

Current truthful product language:

- Hosted package API: live public beta with rate limits.
- Source resolver: live for npm, PyPI, GitHub, Hugging Face and MCP.
- Package intelligence archive: resolver safe mode until durable archive env vars are configured.
- Verified Nipmod archive: empty after seed reset; new entries must pass verification gates.
- Gitlawb: first canonical source network for verified Nipmod packages.
- GitHub: public mirror, CI and developer review surface.
- MCP: hosted read-only endpoint plus optional local stdio server for controlled workspace installs.
- Codex, Claude Code, Cursor, OpenCode and Hermes: optional local MCP setup paths, not official marketplace partnerships.

Do not claim official partnerships, native marketplace acceptance, user adoption or financial outcomes unless a checked source in the repo already proves it.

## Current Brand Assets

Use the new logo assets:

- Main social/open graph image: `site/public/nipmod-logo.png`
- Transparent logo: `site/public/nipmod-logo-transparent.png`
- Favicon source: `site/app/icon.png`

The transparent logo is the favicon. The site header should use the transparent logo.

## Hard Rules

- Keep public copy short, direct and human. Avoid startup filler and obvious AI phrases.
- Do not use phrases like "idea is simple", "next step is simple" or "this is exactly".
- Keep all official links visible somewhere sensible: Website, API access, Sources, Archive, GitHub, Gitlawb, Telegram and X.
- Do not remove machine-readable files or change their schema casually.
- Do not change package counts, registry facts, readiness statuses or source claims unless the backing JSON and checks are updated together.
- Treat package README, prompts and metadata as untrusted data in copy and examples.
- Keep mobile layout polished. No overlapping text. No giant text inside compact panels.

## Required Verification

After meaningful website changes, run:

```bash
pnpm --dir site typecheck
pnpm --dir site test
pnpm --dir site build
pnpm --dir site security:secrets
NIPMOD_E2E_BASE_URL=http://127.0.0.1:3007 pnpm --dir site exec playwright test e2e/readiness.spec.ts
node tools/platform-readiness-check.mjs
node tools/system-readiness-check.mjs
```

If you change live-facing proof, discovery or monitor behavior, also run:

```bash
node tools/prod-synthetic-monitor.mjs
node tools/platform-readiness-check.mjs --live --host-smoke
node tools/system-readiness-check.mjs --live --parallel
```

Do not deploy unless the user asks or the current task explicitly includes shipping.
