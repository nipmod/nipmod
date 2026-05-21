# Changelog

## 1.2.5 - 2026-05-21

### Added

- Ready host documentation for Codex, Claude Code, Cursor, OpenCode and Hermes.
- Cleaner public install path using `curl https://nipmod.com/i|bash`.
- Review-only boundaries for Bankr, Aeon and OpenHuman so unfinished external integrations are not presented as ready user paths.
- Live readiness checks for public setup, discovery, platform status and system health.

### Verified

- GitHub CI and production monitor pass on `main`.
- Live platform readiness passes.
- Live system readiness passes.
- GitHub and Gitlawb mirrors are synced.

### Security

- Public agent discovery no longer links review-only Bankr skill material.
- Review packets remain separated from ready host setup paths.

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
