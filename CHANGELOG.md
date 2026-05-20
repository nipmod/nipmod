# Changelog

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
