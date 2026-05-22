# Product Master Plan

This plan turns the strategy into execution. It is intentionally API-first.

## North Star

Nipmod becomes the default package intelligence API agents call before selecting or installing packages.

## Product Promise

When an agent needs a package, Nipmod should answer:

1. What are the best candidates?
2. Where did each candidate come from?
3. What trust and risk signals matter?
4. What should be installed, if anything?
5. What should be avoided or reviewed?
6. What record should be remembered for future agents?

## Workstream A: Public Surface Cleanup

Goal:
Every public surface says the same thing.

Actions:

- Make website copy API-first.
- Keep design stable.
- Remove "Gitlawb first" and "canonical Gitlawb source" as public positioning.
- Keep Gitlawb as a source where needed.
- Make setup, agents, package creation and platform pages secondary.
- Keep token links restrained and non-promissory.
- Move historical launch docs into legacy context.

Acceptance gate:

- A new visitor can understand Nipmod in 10 seconds: one API for agent package decisions.
- No public page implies official platform integration without proof.
- No public page implies Gitlawb is the company foundation.

## Workstream B: Resolver Depth

Goal:
Nipmod should resolve useful package candidates across the sources agents actually need.

Priority sources:

1. npm
2. PyPI
3. GitHub
4. Hugging Face models
5. Hugging Face datasets
6. MCP registry
7. Gitlawb as supported source

Capabilities:

- source-specific search
- exact inspect
- normalized record shape
- canonical URL and source URL
- license extraction
- release/version information
- repository link
- popularity signals where available
- freshness and activity signals
- source error reporting and partial failure handling
- source rate limit protection

Acceptance gate:

- Each source has deterministic tests.
- Source failures do not poison successful results.
- Search results explain which sources were queried and which failed.

## Workstream C: Trust Engine

Goal:
Nipmod should make better package decisions than a generic agent search.

Signals:

- source reputation
- package age and release freshness
- maintainer/project continuity
- repository health
- license clarity
- known warnings
- install command risk
- dependency footprint
- suspicious naming or typosquat risk
- popularity versus quality mismatch
- documentation quality
- package fit for the user's task
- historical Nipmod confirmations

Outputs:

- score
- risk level
- decision label
- warnings
- install plan
- explanation
- confidence level

Acceptance gate:

- Every recommendation has a human-readable reason.
- Agents can show a package decision without trusting package marketing text.
- Risky packages can be ranked lower even when popular.

## Workstream D: Archive Confirmation Flow

Goal:
Build a durable archive of useful confirmed package records without filling it with spam.

Rules:

- Resolution is ephemeral by default.
- Archive write requires confirmation or clear qualification.
- Archive write requires an authenticated server path.
- Records preserve original ownership.
- Owner claims can upgrade status.
- Quarantine and yanking remain possible.

Acceptance gate:

- Archive records are useful, explainable and reversible.
- Random public clients cannot spam the archive.
- Confirmed records improve future ranking.

## Workstream E: Agent Access

Goal:
Any agent with HTTPS or MCP can use Nipmod without a native platform deal.

Surfaces:

- REST API
- OpenAPI spec
- hosted read-only MCP
- local MCP for controlled workspace writes
- `llms.txt`
- `.well-known/nipmod.json`

Acceptance gate:

- Agent instructions are short and accurate.
- Hosted calls never write to a workspace.
- Local writes require explicit user approval.

## Workstream F: Business Model

Goal:
Keep beta access free while designing usage-based monetization that does not weaken developer trust.

Future options:

- higher API limits
- team keys
- enterprise policy controls
- private source connectors
- premium package/workflow access
- x402-style payment access
- audit exports
- security review feeds

Acceptance gate:

- Free beta stays useful.
- Paid features are tied to real usage and operational cost.
- Token language does not replace product utility.

## Execution Order

1. Strategic cleanup of website, README, docs and installer.
2. Resolver depth per source.
3. Trust scoring model v1.
4. Archive confirm flow hardening.
5. Agent access docs and examples.
6. Monitoring and rate limit expansion.
7. Premium access design after usage is real.

## Metrics

Product metrics:

- API search volume
- inspect to install-plan conversion
- source coverage
- resolver success rate
- partial failure rate
- archive confirmation rate
- repeat package lookup rate
- risky package avoidance rate

Market metrics:

- GitHub stars and forks
- external mentions
- API users
- agent tool usage
- package owner claims
- security reviewer feedback
- inbound integration requests

Quality metrics:

- CI pass rate
- production monitor pass rate
- source latency
- rate limit hit rate
- false positive trust warnings
- false negative risky recommendations

