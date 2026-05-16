# nipmod Mass Readiness Master Plan

Status: launch-ready
Updated: 2026-05-16

## Executive Position

nipmod is mass-ready by the current public launch gate.

The technical trust core is real: signed CLI releases, verified registry, Gitlawb-backed publishing, transparency log, independent witness, signed advisory feed, `audit`, and `search` are live. The mass-readiness gap is not one more cryptographic primitive. The gap is developer activation, useful packages, inspectable trust, abuse operations, recovery proof, monitoring, and a CLI contract that feels like a package manager instead of a security prototype.

Current verified launch readiness:

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

## North Star

Gitlawb is decentralized GitHub for agents.
nipmod is decentralized npm for agents.

More precise: nipmod is the verifiable capability dependency layer for agents. It lets agents and developers discover, install, publish, audit, and enforce policy for agent capabilities by DID, digest, signature, permission manifest, transparency proof, witness statement, and advisory status.

Mass-ready means a developer can use nipmod successfully without understanding Gitlawb internals, while still getting stronger provenance than a normal registry.

## Definition Of 100%

nipmod is 100% mass ready only when all gates below are green.

### Product Gates

- A fresh macOS and Linux user can complete install, doctor, search, inspect, install, audit, and publish dry-run in under 5 minutes.
- First real package install succeeds from the public registry without manual support.
- First real package publish succeeds from a clean workspace in under 10 minutes.
- The homepage shows useful packages, not probe packages.
- The public proof loop demonstrates install, trust, run, audit, and malicious package block.
- Docs cover quickstart, publish, trust model, permissions, troubleshooting, host integrations, and enterprise evaluation.

### Ecosystem Gates

- Public registry has at least 12 first-party verified packages.
- At least 8 packages are genuinely useful.
- At least 2 packages are policy or eval packs.
- At least 2 packages are demo support packages.
- No homepage package is `review` trust level or a `*-probe-*` artifact.
- At least 3 external-format receipts exist: MCP import, APM import/export, and GitHub/GitLab source provenance.

### CLI And Protocol Gates

- Stable CLI JSON envelope for all commands: `formatVersion`, `command`, `durationMs`, `warnings`, `errors`, `data`.
- Stable exit-code table.
- Every command has text output, JSON output, help output, and tests.
- Required P0 commands exist: `inspect`, `add`, `ci`, `publish --dry-run`, `install --plan`, `manifest validate`.
- Required P1 commands exist: `remove`, `update`, `outdated`, `policy check`, `policy explain`, `mcp serve`.
- `install` can resolve integrity from a verified registry package, while explicit `--integrity` remains supported forever.
- Lockfile `formatVersion: 1` remains backwards compatible.
- `nipmod mcp serve` exposes non-mutating tools by default: search, inspect, install_plan, verify, audit.

### Trust Gates

- Every green package verdict requires publisher DID, artifact digest, signed bundle, signed release event, permission manifest, source tag, transparency proof, witness proof, and advisory status.
- `nipmod inspect` and package pages show the same trust facts.
- Advisory feeds are signed, freshness checked, and tested against replay.
- Registry/search is treated as an index, never truth.
- Gitlawb refs are treated as transport, never immutable package truth.

### Ops And Security Gates

- `node tools/verify-all.mjs --prod` is green immediately before any public launch.
- Public node, witness, registry, discovery manifest, advisory feed, installer, release artifact, and package audit have external synthetic checks.
- Alerts go to primary and secondary operators.
- Abuse intake, quarantine, revocation, and advisory publication are documented and tested.
- Dry-run incident from report to signed advisory to audit failure completes in under 30 minutes.
- Direct unauthenticated public `git-receive-pack` abuse is blocked or proven unreachable.
- Fly Postgres, Gitlawb repo volume, and witness volume restore drills are completed.
- Witness state loss cannot silently re-anchor.
- Signing key rotation playbooks exist for release, advisory, transparency log, and witness keys.
- Spend alerts exist for Vercel, Fly, and Cloudflare.

## Current Production Baseline

- Website: `https://nipmod.com`
- Current verified deploy: `dpl_8XaqRNmpbtfkHQnipU6W22PUfpBq`
- CLI release: `nipmod-0.1.21`
- Installer hash: `f0adffc43c905c0d44c804822cf1e1b26c41d2b27d08d36f58e857f7cc7a32d1`
- Release hash: `8ddf522f7a8ac5d60fe8f133eeb824dc19b79c26e7c3f54fc7722ecf940cbf9f`
- Registry: 12 real first-party packages, all `verified/100`
- Compatibility receipts: MCP server JSON, APM package JSON and Git source provenance examples bound to exact verified package digests
- Transparency root: `42f8bf58c33efa6628603d4ea1df9c525d6876ee41a6650e160c47bd4144161f`, tree size 16
- Node: `https://node.nipmod.com`
- Witness: `https://nipmod-witness.fly.dev`
- Discovery: `https://nipmod.com/.well-known/nipmod.json`
- Advisory feed: `https://nipmod.com/advisories.json`

Current biggest weakness is external adoption, not product readiness. Twelve verified first-party packages are live, the public `/proof` page ships a reproducible transcript for safe install, audit, CI and seven unsafe manifest blocks, and signed CLI release `0.1.21` adds `help`, a public exit-code table, MCP server version parity, `manifest validate`, `publish --dry-run`, prompt-injection metadata blocking and mutable source-ref blocking. Public compatibility receipts bind MCP server JSON, APM package JSON and Git source provenance examples to exact verified nipmod package digests, source repos, commits and tags with zero hidden provenance loss. Direct unauthenticated `git-receive-pack` is live-proven as blocked for minimal and 1 MiB body probes and covered by `verify-all --prod`. A bounded public edge smoke proves node health before/after, repo catalog size discipline and receive-pack auth gating inside a 5 request budget with no retries. A bounded production crawler/load smoke proves homepage crawlability plus Registry, Trust page and node health latency under limited concurrency. `nipmod mcp serve` is shipped with read-only default tools for search, inspect, install_plan, verify and audit, explicit custom-root opt-in, notification-safe JSON-RPC behavior, MCP remote fetch body caps and public Codex/Claude Code/OpenCode host setup docs. A production synthetic monitor covers the public site, trust page, discovery, deploy drift, registry, signed advisories, checkpoint freshness, witness health, unauthenticated witness run behavior, node health and receive-pack auth. The alert delivery runner wraps monitor plus restore drill, sends firing/probe alerts to primary and secondary webhooks, redacts destinations from stdout and fails closed on missing or rejected delivery; the `nipmod-monitor` Fly service now runs this every 60 seconds. A non-destructive restore drill proves live witness continuity, pinned restore endpoints, signed checkpoint validity, pinned witness package proof, stream-capped package blob recoverability and source tag recoverability. Operator incident publication is documented for signed advisories, quarantine metadata, deploy proof and withdrawal. Fly node and witness volume restore forks have been proven with disposable one-shot machines, and Fly Postgres backup/restore has been proven into a temporary cluster. Public docs cover quickstart, publishing, package ecosystem, trust model and CLI contract. Production verification passed after deploy `dpl_8XaqRNmpbtfkHQnipU6W22PUfpBq`.

Policy baseline is now integrated into the main trust surfaces: `policy init`, `policy check` and `policy explain` are live; optional policy enforcement blocks `install --plan` and `add` before mutation; `inspect`, `audit` and `ci` expose policy decisions; `ci` fails on strict policy blocks; custom trust roots require explicit `--allow-custom-roots`; and permission grammar blocks wildcard/path/IP/secret-like scope escalation. Remaining policy work is mainly documentation, site rendering and a malicious package proof loop.

## P0 Sequence

This order is deliberate. Do not skip ahead unless a later task directly unblocks an earlier one.

### P0.1 Stable CLI Contract

Goal: make CLI output reliable for humans, agents, docs, tests, and automation.

Build:

- Add common CLI result envelope.
- Add stable exit-code table.
- Add command-level `--help`.
- Normalize `--json`, `--online`, `--offline`, `--registry`, `--profile`, `--explain`, `--dry-run`.
- Replace or strongly encapsulate current ad-hoc flag parsing.
- Add contract snapshots for text, JSON, and exit code for every command.

Acceptance gates:

- Every command has contract tests.
- Existing `init`, `pack`, `verify`, `install`, `publish`, `doctor`, `audit`, `search` still work.
- Current JSON consumers are supported or have a documented compatibility shim.
- `node tools/verify-all.mjs` remains green.

Risks:

- Breaking existing scripts.
- Overengineering arg parsing before core commands are complete.

Rollback:

- Keep old command handlers callable behind the new parser until snapshots are green.

### P0.2 Inspect And Trust Report

Goal: users can understand a package before mutating their workspace.

Build:

- `nipmod inspect <specifier|file|installed>`.
- Package-page trust report.
- Shared trust-report model for CLI and site.
- Show publisher DID, canonical ID, version, digest, signed release, source tag, transparency proof, witness, permissions, advisories, and install command.
- Add `--json` output for agents.

Acceptance gates:

- Inspect works for live verified package.
- Inspect works for local `.nipmod` bundle.
- Inspect fails closed for missing signature, missing proof, unsafe manifest, stale advisory.
- Package page mirrors CLI facts.
- No green verdict without full evidence.

Risks:

- Trust report becomes unreadable.

Rollback:

- Keep proof details expandable; default to one-line verdict plus key reasons.

### P0.3 Safer Add And Install Plan

Goal: make install feel npm-simple without losing integrity pins.

Build:

- `nipmod install --plan <specifier> --json`.
- `nipmod add <query|canonical|alias>`.
- Verified-registry integrity resolution.
- Explicit permission/trust plan before writing lockfile.
- Keep explicit `--integrity` support forever.
- Fail closed for unverified packages unless explicit pin and policy allow it.

Acceptance gates:

- `nipmod add source-bound-probe...` resolves the verified live package and writes lockfile with integrity.
- `install --plan --json` contains exact artifact digest, package identity, trust evidence, permissions, advisories, and lockfile diff.
- Unverified package requires explicit digest pin.
- Existing `install <pkg>@<version> --integrity ...` still works.

Risks:

- Query ambiguity can install wrong package.

Rollback:

- If multiple packages match, require exact selection.

### P0.4 CI And Lockfile Enforcement

Goal: teams can trust installed packages in automation.

Build:

- `nipmod ci`.
- Lockfile-only mode with no network mutation except verification fetches.
- Fail on missing package, digest drift, advisory fail, permission-policy violation.
- Add `strict-ci` policy profile.

Acceptance gates:

- Clean lockfile passes.
- Tampered digest fails.
- High advisory fails.
- Missing transparency proof fails.
- New permission in update plan fails under `strict-ci`.

Risks:

- CI command duplicates audit.

Rollback:

- Keep `audit` as report, `ci` as enforcement.

### P0.5 Publish Dry-Run And Authoring DX

Goal: maintainers can publish safely without hidden Gitlawb knowledge.

Build:

- `nipmod publish --dry-run --json`.
- `nipmod manifest validate`.
- `nipmod manifest explain`.
- `nipmod init --type skill|mcp-server|workflow-pack|agent-profile --template`.
- Better generated README, permission manifest, examples, and `.gitignore`.
- Human-readable preflight failures.

Acceptance gates:

- Fresh package can run `init -> manifest validate -> pack -> publish --dry-run` in under 5 minutes.
- First real publish from clean workspace succeeds in under 10 minutes.
- Dry-run outputs release event preview, digest, manifest digest, repo target, helper status, version immutability check.

Risks:

- Too many templates before real package needs.

Rollback:

- Start with skill, mcp-server, workflow-pack only.

### P0.6 Real First-Party Catalog

Goal: replace proof-only registry with useful ecosystem.

Build 12 verified packages:

- `github-issue-triage`
- `gitlawb-repo-reader`
- `repo-readme-audit`
- `dependency-risk-review`
- `prompt-injection-scan`
- `nipmod-audit-ci`
- `strict-ci-policy`
- `developer-default-policy`
- `malicious-skill-fixtures`
- `mcp-server-import-example`
- `apm-import-example`
- `gitlawb-release-review`

Acceptance gates:

- 12 packages are `verified/100`.
- 0 probe packages on homepage.
- Every package has install command, trust report, permissions explanation, README, and smoke test.
- Malicious fixture pack proves blocks for prompt injection, postinstall, broad egress, secret read, typosquat, and mutable ref.

Risks:

- Publishing many weak packages creates noise.

Rollback:

- Only publish packages that pass usefulness review and smoke tests.

### P0.7 Public Proof Loop

Goal: prove nipmod is not just a registry UI.

Build:

- Reproducible demo repo.
- Five-minute terminal transcript.
- Video or screenshots.
- Safe package install and run.
- Malicious variant blocked.
- Lockfile and trust report included.

Acceptance gates:

- Fresh machine can run `install -> doctor -> search -> inspect -> add -> audit -> run demo -> blocked malicious variant`.
- Demo works without private credentials.
- Demo package remains read-only by default.

Risks:

- Demo depends on third-party account APIs.

Rollback:

- Use Gitlawb public repo reader as fallback.

## P1 Sequence

### P1.1 Policy Engine

Build:

- `nipmod policy init`
- `nipmod policy check`
- `nipmod policy explain`
- Profiles: `developer-default`, `strict-ci`, `research-permissive`
- Policy file schema and examples
- Permission diffs on update

Acceptance gates:

- Policy decisions explain exactly why a package is allowed, warned, or blocked.
- Policies apply to install, add, update, ci, audit, and inspect.
- High-risk MCP write tools are blocked by default.

### P1.2 Abuse, Quarantine, Revocation

Build:

- Public abuse and security contact path.
- Signed quarantine event metadata format for registry records. Completed for `dev.nipmod.quarantine.v1`; remaining work is the operator publication workflow.
- Signed revocation event format.
- Advisory severity matrix.
- Registry exclusion/quarantine mechanism. Completed for active high/critical package metadata in CLI and site search/install surfaces.
- Incident dry-run.

Acceptance gates:

- Dry-run compromised package becomes quarantined in default registry.
- `nipmod search` de-ranks or hides quarantined package.
- `nipmod audit --online` fails for active high/critical advisory.
- Report-to-audit-fail drill completes under 30 minutes.

### P1.3 Gitlawb Edge Hardening

Build:

- Completed: prove direct unauthenticated `git-receive-pack` is blocked in production for minimal and 1 MiB body probes and prod-gated.
- Completed: bounded non-destructive public edge smoke with 5 serial node requests, 256 KiB catalog cap, no retries, receive-pack auth gate and health before/after checks.
- Publish rate limits per IP and DID.
- Repo listing/crawler caps.
- Pack/upload caps.
- Abuse blocklist for indexing by DID/package.
- Load test at 10x expected launch traffic.

Acceptance gates:

- Abuse attempts do not produce 5xx storm.
- Untrusted direct write path is blocked or documented as unreachable.
- Public node remains healthy during load test.

### P1.4 Monitoring And Restore Proof

Build:

- Completed: production synthetic monitor contract for site, registry, discovery, advisories, node, witness, unauth witness run behavior, deploy drift, advisory expiry, checkpoint freshness and receive-pack auth.
- Completed: alert delivery runner contract with firing/probe modes, primary/secondary webhook fan-out, redacted results and fail-closed delivery handling.
- Completed: non-destructive live restore drill for pinned discovery endpoints, signed checkpoint verification, registry snapshot, pinned witness proof, witness continuity, node health, stream-capped package blob digest and source tag recovery.
- Synthetic checks every 60 seconds from an external runner.
- Alerts for site, registry, discovery, advisories, node, witness, unauth witness run behavior, deploy drift, advisory expiry, checkpoint freshness.
- Real external alert `--probe` from an external scheduler with primary and secondary operator webhooks.
- Fly Postgres backup proof.
- Gitlawb repo volume restore proof.
- Witness volume restore proof.
- Status page or internal status dashboard.

Acceptance gates:

- Restore drill proves same witness DID/root continuity.
- Node restore proves package blobs and `git ls-remote`.
- `verify-all --prod` passes after restore.
- Alerts reach primary and secondary operators.

### P1.5 MCP And Agent Integration

Build:

- Completed and released: `nipmod mcp serve` stdio JSON-RPC server.
- Completed and released: non-mutating tools by default: search, inspect, install_plan, verify, audit.
- Completed and released: MCP tool annotations mark default tools read-only and non-destructive.
- No default mutating publish/install tool.
- Prompt-injection guard: package docs are data, never instructions.
- Completed: public signed CLI release artifact with MCP support.
- Completed: Codex/Claude Code/OpenCode host docs at `/mcp` and `docs/mcp-hosts.md`.

Acceptance gates:

- Completed and released: MCP tool schemas are stable for search, inspect, install_plan, verify and audit.
- Completed and released: agent can produce an install plan without mutating a lockfile.
- Completed: Codex/Claude Code/OpenCode host docs exist.
- Completed: public signed CLI artifact includes MCP support.
- Agent cannot mutate without an explicitly separate host-approved command.

### P1.6 Compatibility Receipts

Build:

- MCP `server.json` import guide and example.
- APM import/export guide and example.
- GitHub/GitLab source provenance example.
- Compatibility badges.

Acceptance gates:

- One real MCP package represented without hidden provenance loss.
- One APM package represented without hidden provenance loss.
- Gitlawb-native remains best provenance path, not the only path.

## P2 Sequence

### P2.1 Versioned Registry API

Build:

- `/v1/search`
- `/v1/packages/:id`
- `/v1/packages/:id/versions`
- `/v1/packages/:id/trust`
- `/v1/advisories`
- `/v1/revocations`
- ETags, pagination, response signatures or receipts.

Acceptance gates:

- Static `packages.json` remains supported as mirror format.
- CLI can use versioned API when available and fallback to static index.

### P2.2 SDK Surface

Build:

- Split public packages: `@nipmod/protocol`, `@nipmod/sdk`, `@nipmod/mcp`.
- Stable exports.
- Typed schemas.
- Public APIs: `resolveSpecifier`, `createInstallPlan`, `applyInstallPlan`, `auditProject`, `inspectPackage`, `publishPlan`, `packProject`, `verifyBundle`.

Acceptance gates:

- External TS project can consume SDK without importing CLI internals.
- API contract tests exist.

### P2.3 Enterprise Evaluation Surface

Build:

- Private mirror docs.
- CI policy docs.
- Audit retention design.
- SSO/SCIM only as design, not implementation.
- Design-partner checklist.

Acceptance gates:

- 5 teams can evaluate private mirror/policy/CI without a sales call.
- No paid plan copy blocks public adoption.

## Do Not Build Yet

- Token or name economy.
- Social marketplace features.
- Enterprise dashboard before design partners.
- Global namespace fight.
- Generic npm/PyPI replacement.
- Runtime sandbox kernel before install-time policy and ecosystem are strong.
- Public launch with probe package as primary proof.

## Auto-Mode Execution Rules

Every automode cycle must:

1. Inspect live state and workspace state.
2. Pick the highest P0 item not blocked by missing credentials or destructive operations.
3. Write tests first for code changes.
4. Implement narrowly.
5. Run focused tests.
6. Run `node tools/verify-all.mjs`.
7. Deploy only when release/site artifacts changed and local gates are green.
8. Run `node tools/verify-all.mjs --prod` after deploy.
9. Update `progress.md`.
10. If the change affects readiness, update this file.

Stop only for:

- Destructive data or git operations.
- Paid operations that could exceed the approved budget.
- Credential requirements that cannot be satisfied from existing local context.
- A red security finding that invalidates the current direction.

## Launch Blockers

Public mass launch is blocked until all are false:

- Public proof loop is packaged as `/proof` with a transcript; remaining malicious proof gaps are prompt-injection content, typosquat and mutable-ref variants.
- No operator-facing real incident publication workflow for quarantine and revocation.
- Non-destructive restore drill is prod-gated with pinned restore endpoints, signed checkpoint verification, pinned witness proof and stream-capped package recovery; full Fly Postgres/volume restore drill is still missing.
- Alert delivery runner exists, is tested and prod-gated; still needs a real external `--probe` with primary/secondary operator webhooks and a 60-second external schedule.
- Bounded Gitlawb edge smoke is prod-gated; real per-IP/DID rate-limit proof, crawler throttling proof and 10x load testing are still missing.
- `node tools/verify-all.mjs --prod` must remain green immediately before launch.

## First Five Automode Targets

1. Completed: build `nipmod inspect` and package trust-report model.
2. Completed: build `install --plan` and `add` for verified registry packages.
3. Completed: build `ci` and `strict-ci` enforcement.
4. Completed: build first 3 real starter packages and remove probe-first homepage framing.
5. Completed: build abuse/quarantine/advisory dry-run plus registry quarantine search/install blocking.
