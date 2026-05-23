# Changelog

## 1.2.9 - 2026-05-23

### Added

- Release SBOM sidecars for CLI tarballs.
- Release provenance sidecars with artifact digest, build material digests, source state and signing key fingerprint.

### Verified

- Production monitor now verifies release SBOM and provenance URLs, artifact digests and required materials.
- `verify-all` now fails when local or live release metadata is missing or inconsistent.

## 1.2.8 - 2026-05-23

### Added

- PyPI task-search hints for common agent queries such as HTTP clients, web frameworks, Telegram bots, data tools, testing tools, CLI tools, crawlers, databases and ML packages.
- PyPI Simple API enrichment for provenance links, core metadata hashes and dist-info metadata hashes.

### Verified

- PyPI hint candidates are still re-inspected against PyPI before they can appear in API responses.
- Source-depth canaries now require PyPI attestation-level provenance when the upstream source exposes it.

## 1.2.7 - 2026-05-23

### Added

- `agent-selection-v1` search output with recommended candidate, gate state, rank breakdown and rank reasons.
- Evidence caps that limit external trust scores when metadata, provenance or install-command evidence is weak.
- Deeper source signals for npm, PyPI, GitHub and Hugging Face records.
- Deterministic archive evidence digests and receipt evidence digests for package intelligence records.
- Expanded API docs and examples for agent selection, archive previews and install-plan review.

### Verified

- API contract, source-depth, install-plan and production monitor canaries now check v1.2.7 selection and source-depth fields.
- Hosted API calls remain read-only and install plans remain review data only.

## 1.2.6 - 2026-05-23

### Added

- Official API beta release pack for agents and builders.
- Clear agent examples for generic HTTPS, Codex, Claude Code and hosted MCP workflows.
- Finalized public trust and archive gate documentation for `external-v2`.
- Source report recovery guidance for degraded, empty or failed upstream package sources.

### Verified

- GitHub CI, CodeQL, Dependency Review, Scorecard and production monitor pass on `main`.
- Live API contract canary passes on `https://nipmod.com`.
- Live source-depth, install-plan and rate-limit canaries pass on `https://nipmod.com`.

### Security

- Archive confirmation rejects unknown, below-threshold or high-risk trust decisions.
- Hosted API calls remain read-only and never execute install commands.
- Package metadata, READMEs, model cards and registry text remain untrusted data.

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
