# Changelog

## 1.2.5 - 2026-05-21

### Added

- Ready host documentation for Codex, Claude Code, Cursor, OpenCode and Hermes.
- Cleaner public install path using `curl https://nipmod.com/i|bash`.
- API-first public surface for package search, source inspection, safe install plans and archive preparation.
- Old draft integration tracks removed from the public product surface.
- Live readiness checks for public setup, discovery, platform status and system health.

### Verified

- GitHub CI and production monitor pass on `main`.
- Live platform readiness passes.
- Live system readiness passes.
- GitHub and Gitlawb mirrors are synced.

### Security

- Public agent discovery points to the hosted API, source resolver and MCP boundary.
- Draft or owner-unapproved integrations stay out of public product claims.

## 1.2.4 - 2026-05-20

### Added

- Public package archive improvements on `https://nipmod.com/packages`.
- Featured package start set for agent onboarding, safety review, CI and Gitlawb source reading.
- Codex and Claude Code setup page with shared MCP workflow.
- Stronger `/package` flow for source check, draft creation, owner verification and publish dry run.
- Public trust contract section covering registry, transparency, witness, advisories and discovery.
- Telegram community bot documentation and runtime support.

### Verified

- CLI and site tests pass.
- TypeScript checks pass for CLI and site.
- Production build passes.
- Secret scan and open-source readiness checks pass.
- GitHub CI and production monitor pass on `main`.

### Security

- Package text, README content, prompts and metadata remain untrusted input.
- Controlled MCP install requires explicit write approval.
- Releases remain distributed through the signed installer and signed tarball on `nipmod.com`.

### Dependencies

- Updated `@scure/base`, `@types/node`, `tsx` and `typescript` after Dependabot review.
