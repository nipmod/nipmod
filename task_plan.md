# nipmod Task Plan

Status: launch-ready
Updated: 2026-05-16
Source of truth: `mass-readiness-plan.md`

## Current Goal

Keep nipmod mass-ready after the first public launch gate.

nipmod already has a real trust core: signed releases, Gitlawb-backed publishing, verified registry, transparency log, independent witness, advisory feed, `audit`, `search`, live website, live node and live witness.

The remaining work is not another proof primitive. The remaining work is making the product usable, useful, inspectable, operable and credible for a public developer audience.

## Active Readiness

```text
Mass readiness
[████████████████████] 100%

Core protocol and CLI
[████████████████████] 100%

Live infrastructure
[████████████████████] 100%

Security and trust model
[████████████████████] 100%

Public onboarding
[████████████████████] 100%

Package ecosystem
[████████████████████] 100%

Ops and abuse readiness
[████████████████████] 100%
```

## Active Sequence

1. Completed: build `nipmod inspect` and the shared package trust-report model.
2. Completed: build `nipmod install --plan` and `nipmod add` for verified registry packages.
3. Completed: build `nipmod ci` and `strict-ci` enforcement.
4. Completed: publish the first 3 real starter packages and remove probe-first homepage framing.
5. Completed: build abuse, quarantine and advisory dry-run.
6. Completed: add quarantine metadata and block quarantined packages in search/install surfaces.
7. Completed: build Policy Engine Basics with `policy init`, `policy check`, `policy explain` and optional install-plan/add blocking.
8. Completed: harden policy integration for audit/ci/inspect, custom trust roots and permission grammar.
9. Completed: prove direct unauthenticated Gitlawb receive-pack abuse is blocked in production for minimal and 1 MiB body probes and prod-gated.
10. Completed: add bounded Gitlawb edge resilience smoke with 5 serial node requests, no retries, catalog cap and receive-pack auth gate.
11. Completed: deployed external alert sink plus Fly `nipmod-monitor` on a 60-second schedule; proved primary/secondary webhook delivery and recurring healthy cycles.
12. Completed: build first `nipmod mcp serve` stdio server with read-only search, inspect, install_plan, verify and audit tools.
13. Completed: release signed CLI artifact `0.1.15` with MCP support and deploy it to production.
14. Completed: document Codex/Claude/OpenCode MCP host setup.
15. Completed: add compatibility receipts for MCP, APM and GitHub/GitLab source provenance.
16. Completed: release signed CLI artifact `0.1.16` with compatibility receipt output and deploy it to production.
17. Completed: expand the verified first-party package catalog to 12 useful packages.
18. Completed: build and deploy the public proof loop with safe install, trust report, audit, CI and seven unsafe manifest blocks.
19. Completed: release signed CLI artifact `0.1.19` with `manifest validate`, `publish --dry-run`, prompt-injection metadata blocking and mutable source-ref blocking.
20. Completed: add bounded production crawler/load proof and wire it into `verify-all --prod`.
21. Completed: document operator-facing incident publication for signed advisories, quarantine metadata, dry-run proof, deploy and withdrawal.
22. Completed: full Fly restore drill now proves node and witness volume forks with disposable one-shot Machines plus Fly Postgres backup and restore into a temporary cluster.
23. Completed: add public quickstart path for install, doctor, search, inspect, add, audit and publish dry-run.
24. Completed: document package ecosystem roles, publishing flow, trust model and CLI contract.
25. Completed: add `nipmod help` with stable command list and public exit-code table.
26. Completed: release signed CLI artifact `0.1.21`, deploy `dpl_8XaqRNmpbtfkHQnipU6W22PUfpBq`, verify production, and confirm live Quickstart plus discovery pins.

## 100% Gates

- Fresh developer completes install, doctor, search, inspect, add, audit and publish dry-run in under 5 minutes.
- Registry has at least 12 useful first-party `verified/100` packages.
- Homepage no longer uses a probe package as the main proof.
- Every public package has install command, trust report, permissions explanation, README and smoke test.
- CLI has stable JSON envelope, stable exit codes and contract tests for every command.
- `inspect`, `install --plan`, `add`, `ci`, `publish --dry-run` and `manifest validate` are live.
- Abuse intake, quarantine, revocation and signed advisory flow are tested end to end.
- Gitlawb public edge write abuse is blocked or proven unreachable.
- Backup and restore drills are completed for node, repo data and witness state.
- External monitoring and alerts cover site, registry, discovery, advisory freshness, node, witness and deploy drift.
- `node tools/verify-all.mjs --prod` is green immediately before public launch.

## Current Launch Blockers

- No technical launch blocker remains in the current plan after production verification.
- Remaining external launch risk is adoption support: public users can still ask for help, find Gitlawb concepts unfamiliar or request packages outside the first-party catalog.
- The launch surface now has quickstart, publish guide, package map, trust model, CLI contract, incident publication, MCP host setup, public proof loop and live monitoring.

## Legacy Plan

The old Epic B plan is complete and historical.

Completed Epic B covered:

- TypeScript protocol core.
- Deterministic packages.
- Ed25519 DID identities.
- Signed bundle verification.
- Lockfile installs.
- CLI `init`, `pack`, `verify`, `install`.
- Gitlawb backend publishing and remote install.
- Website launch.
- Production node, witness, verified registry, installer, Trust page, discovery manifest, advisory feed, `audit` and `search`.

Do not optimize the Epic B plan further. All new work must follow `mass-readiness-plan.md`.
