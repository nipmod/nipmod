# API-First 100% Plan

Status: active engineering plan

This document tracks the work required to bring Nipmod's public API-first package network to production-grade launch quality.

Scope:

- Public package discovery API.
- Public source resolvers.
- Trust, provenance and install-plan safety.
- Durable package intelligence archive.
- OpenAPI, agent examples and public docs.
- Production monitoring, abuse controls and launch verification.

Out of scope for this plan:

- Payment.
- Dashboard.
- Private packages.

## Target State

Nipmod should be a public package intelligence surface for agents.

An agent asks Nipmod for a package. Nipmod searches supported public sources, normalizes the result, evaluates trust and risk, returns a safe install plan, and can save useful confirmed records into the package intelligence archive.

The hosted API remains read-only. It must never read or write a caller workspace.

## Current Baseline

The current baseline is strong enough for a public beta, but not yet a complete production package network.

Working today:

- Public API routes for search, inspect, install plans, source health, OpenAPI, MCP and archive operations.
- Live source access for npm, PyPI, GitHub, Hugging Face models, Hugging Face datasets and MCP.
- Durable Supabase archive configured for package intelligence records.
- API usage logging path.
- Local and GitHub CI coverage.
- CodeQL currently clean.
- Branch protection, signed commits and required CI checks.
- Production synthetic monitor.
- Public docs and agent examples.

Known limits:

- The current API is mostly request-time federation plus a small durable archive.
- The public verified registry is intentionally empty after reset.
- Trust scores are useful review signals, but external records are not yet cryptographic provenance.
- Rate limits are not yet distributed across all server instances.
- Source health is mostly capability status and should become real dependency health.
- OpenAPI needs complete response schemas and contract validation.
- Launch gates are not yet unified into one non-destructive release command.

## Workstream 1: API Contract

Goal: make the API contract stable enough for agent builders to integrate without guessing.

Tasks:

- Complete OpenAPI schemas for every public response.
- Add operation ids, examples and error responses for every endpoint.
- Document both GET and POST forms where implemented.
- Add schema validation tests that call real route handlers and validate actual JSON against OpenAPI.
- Keep response fields additive unless a major version changes the contract.

Endpoints covered:

- `GET /api/search`
- `GET /api/resolve`
- `GET /api/inspect`
- `GET /api/install-plan`
- `POST /api/install-plan`
- `GET /api/archive/prepare`
- `POST /api/archive/prepare`
- `POST /api/archive/confirm`
- `GET /api/archive/search`
- `GET /api/archive/status`
- `GET /api/sources/health`
- `POST /api/mcp`
- `GET /api/openapi`

Definition of Done:

- All public routes have complete OpenAPI schemas.
- API examples in docs match live responses.
- Contract tests fail when a route returns a shape not described by OpenAPI.
- `pnpm verify` and API contract tests pass.

## Workstream 2: Trust Engine v3

Goal: make package scoring explainable, conservative and defensible.

Tasks:

- Split external package assessment into separate fields:
  - `qualityScore`
  - `popularitySignal`
  - `securityConfidence`
  - `provenanceStatus`
- Keep `trust.score` as a compatibility field during transition.
- Prevent downloads, stars or likes from being treated as security proof.
- Reserve strongest labels for packages with stronger provenance, integrity and advisory signals.
- Add golden fixtures for npm, PyPI, GitHub, Hugging Face and MCP.
- Update trust docs and API examples.

Definition of Done:

- Ranking can use popularity.
- Security language stays conservative.
- Every score has structured factors.
- No external package can be called secure only because it is popular.
- Tests prove the scoring rules across representative packages.

## Workstream 3: Non-Forgeable Trust

Goal: make sure clients cannot forge trust by posting their own package records.

Tasks:

- Treat posted package records as untrusted input.
- Recompute trust server-side from source, package name, version and fetched source metadata.
- Reject durable archive writes when supplied trust conflicts with server-generated trust.
- Add server-side receipt material for archive records.
- Add tests for forged trust score, forged trust decision, forged factors and stale records.

Definition of Done:

- A caller cannot POST a fake `recommended` package and make Nipmod store it as trusted.
- Archive records always contain server-generated trust.
- Tests cover forged trust and stale metadata attacks.

## Workstream 4: Install-Plan Safety

Goal: make install plans useful for agents without turning untrusted metadata into executable commands.

Tasks:

- Return structured command data alongside display commands.
- Generate install commands only from source-specific safe templates.
- Add `blocked: true` for high-risk install plans.
- Expand command scanner coverage for:
  - shell chaining
  - `bash -c`
  - `sh -c`
  - `python -c`
  - PowerShell
  - redirection
  - remote script downloads
  - environment exfiltration
  - package-manager lifecycle risks
- Add regression tests for unsafe command examples.

Definition of Done:

- Agents can render a safe install plan without executing anything.
- High-risk commands are blocked rather than presented as normal install commands.
- The hosted API stays read-only.
- Tests cover common shell injection and remote-script patterns.

## Workstream 5: Source Depth

Goal: make each current source genuinely useful before adding many more sources.

Tasks by source:

npm:

- Fetch package manifest and packument data.
- Track versions, maintainers, deprecations and dist tags.
- Capture integrity and registry signature metadata.
- Add advisory/provenance enrichment where available.
- Extract dependencies and package repo links.

PyPI:

- Replace exact-name-only lookup with real broad search or a durable searchable index.
- Capture release files, hashes, classifiers, requires-python and vulnerabilities.
- Normalize project URLs and dependency metadata.

GitHub:

- Move beyond repo search.
- Capture releases, tags, license, default branch, pushed date, repo health and security posture.
- Map repos to package manifests when possible.
- Use optional GitHub auth for higher limits.

Hugging Face:

- Keep models and datasets.
- Add Spaces as a new source after current sources are stable.
- Capture model cards, dataset cards, tags, license, downloads, likes and commit metadata.
- Flag gated or high-risk artifact patterns where metadata indicates risk.

MCP:

- Keep official registry as the primary MCP source.
- Add tool schema analysis.
- Capture env requirements, remote endpoints, source repo and install host notes.
- Improve fallback snapshot freshness and monitor failures.

Definition of Done:

- Each current source supports search, inspect and install-plan with source-specific tests.
- Source records include version, owner, license, source URL, metrics and risk metadata when available.
- Source failures degrade cleanly without breaking all-source search.

## Workstream 6: Crawler and Archive Pipeline

Goal: move from request-time federation to a real package intelligence archive.

Architecture:

- Source adapters with cursors, rate limits, retry/backoff and terms metadata.
- Raw source snapshots with fetched time, response hash, source id and schema version.
- Normalization workers that create canonical package intelligence records.
- Enrichment workers for vulnerabilities, dependency risk, licenses, repo health, provenance and prompt-injection scan signals.
- Durable indexes for records, versions, owners, dependencies, advisories and events.
- Serving layer for search, inspect, compare, install-plan and explain.

Initial targets:

- 100k refreshed public records.
- Daily refresh for high-value packages.
- Accurate archive counts and source filters.
- Source freshness metrics.

Later targets:

- 1M+ public records across current and added sources.
- Faceted search by source, status, license, risk, ecosystem and freshness.

Definition of Done:

- Archive records are no longer only manually seeded.
- Search can return useful persisted records even when an upstream source is degraded.
- Archive counts are accurate.
- Records can be refreshed, replayed and audited.

## Workstream 7: Rate Limits and Abuse Protection

Goal: allow broad free beta usage without exposing Nipmod or upstream sources to abuse.

Tasks:

- Move public/API-key rate limiting from process memory to a shared store or platform-native limiter.
- Add per-source quotas.
- Add circuit breakers for upstream failures.
- Cap MCP batch size.
- Cap JSON body size.
- Track rate-limited requests.
- Add load-smoke tests.

Definition of Done:

- Rate limits work across serverless instances.
- Abuse of one source does not degrade every source.
- MCP batch traffic cannot exhaust the API.
- Load smoke passes against production.

## Workstream 8: Live Source Health

Goal: source health should reflect real dependency health, not static capability metadata.

Tasks:

- Add cached health probes per source.
- Track latency, last success, last failure and degraded status.
- Avoid leaking secret/config details publicly.
- Add an admin/private detailed view later if needed.
- Add monitor assertions for source degradation.

Definition of Done:

- Public health reports coarse live source status.
- Internal checks can diagnose exact failure mode.
- Production monitor catches source outages.

## Workstream 9: Usage, Privacy and Observability

Goal: understand API usage without storing sensitive raw user data.

Tasks:

- Require a production hash salt when usage logging is enabled.
- Use HMAC-style hashes for query, package and client hashes.
- Add a usage-ingestion canary.
- Record route, status, source, result count, latency and error code.
- Do not store raw queries, raw package names, raw IPs, raw user agents or raw API keys.
- Add dashboards later only after the underlying events are correct.

Definition of Done:

- Usage rows prove ingestion works.
- Usage data is useful for ops but not raw sensitive user content.
- Production readiness fails if usage logging is configured unsafely.

## Workstream 10: Launch Verification Gate

Goal: one command should prove the release is safe enough to launch.

Tasks:

- Add `pnpm launch:verify`.
- Include:
  - `pnpm verify`
  - site e2e tests
  - production synthetic monitor
  - restore drill
  - load smoke
  - archive seed dry-run
  - OpenAPI contract tests
  - public proof loop or explicit empty-public-archive waiver
- Update stale e2e and load-smoke assumptions for the API-first product.

Definition of Done:

- One command gives a reliable launch signal.
- The command is non-destructive.
- The command can run locally and in CI.

## Workstream 11: GitHub and Supply Chain Hardening

Goal: make repository controls enforce production quality.

Tasks:

- Add Scorecard as a required branch check.
- Enable CODEOWNER review for critical paths.
- Confirm Dependabot security updates and secret scanning settings.
- Generate SBOM for release artifacts.
- Add release provenance or artifact attestations.
- Keep CodeQL clean.
- Keep signed commits and linear history.

Critical paths:

- `site/app/api/**`
- `site/lib/**`
- `nipmod/src/**`
- `tools/**`
- `.github/workflows/**`
- `supabase/migrations/**`

Definition of Done:

- Security-sensitive changes require the right checks and reviews.
- Release artifacts have digest, SBOM and provenance.
- GitHub security posture is visible and enforceable.

## Workstream 12: Public Docs and Agent Examples

Goal: every builder should understand the API flow without platform-specific handholding.

Tasks:

- Keep README API-first.
- Keep the API beta launch kit current.
- Add examples for generic HTTP, Codex-style agents, Claude Code-style agents and MCP hosts.
- Remove stale platform-integration claims.
- Make all examples use the same API flow:
  - search
  - inspect
  - trust factors
  - install plan
  - user approval before local write

Definition of Done:

- A new builder can integrate with Nipmod through HTTPS only.
- Docs do not overclaim official platform integrations.
- Examples match live API output.

## Priority Order

1. API contract and OpenAPI schemas.
2. Non-forgeable trust.
3. Trust Engine v3.
4. Install-plan safety.
5. Source health and source-depth fixes.
6. Launch verification gate.
7. Distributed rate limits.
8. Crawler/archive foundation.
9. GitHub and supply-chain hardening.
10. Docs and examples cleanup.

## Milestone Checklist

### 80%: Strong Public Beta

- [ ] Complete OpenAPI response schemas.
- [ ] Contract tests for public API responses.
- [ ] Archive write auth before source resolution.
- [ ] Non-dry-run archive writes fail loudly when persistence is unavailable.
- [ ] Source health does live cached probes.
- [ ] Install plans include structured command data.
- [ ] Launch verify command exists.

### 90%: Production-Ready API Surface

- [ ] Trust Engine v3 fields implemented.
- [ ] Posted trust cannot influence server trust.
- [ ] Distributed rate limits active.
- [ ] MCP batch and body size caps active.
- [ ] Usage canary active.
- [ ] Load smoke passes.
- [ ] E2E readiness tests updated and passing.
- [ ] Scorecard and Production Monitor enforced or documented as launch gates.

### 100%: Serious Package Intelligence Layer

- [ ] Current six sources have deep inspect/enrichment.
- [ ] Broad PyPI search or indexed PyPI corpus exists.
- [ ] Archive has 100k+ refreshed public records.
- [ ] Source freshness and archive counts are accurate.
- [ ] Trust v3 includes provenance, advisory, dependency and maintainer/repo health signals.
- [ ] Release artifacts have SBOM and provenance.
- [ ] All launch gates pass from a clean checkout.

## Release Rule

Do not claim that Nipmod is a complete public package intelligence layer until the 100% checklist is complete.

Allowed current framing:

- Public API beta.
- API-first package discovery and trust layer for agents.
- Live public source resolvers.
- Durable package intelligence archive foundation.
- Safe install-plan workflow.

Avoid current framing:

- Complete npm replacement.
- Fully verified global package archive.
- Official integration with every agent platform.
- Security guarantee for external packages.
