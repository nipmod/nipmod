# Nipmod Package Decision Engine

Status: production masterplan, first slice in implementation.

Nipmod should become the decision layer an agent calls before it turns an external package, model, repository or MCP server into execution. The core product is not a chat box and not another registry mirror. The core product is a package decision engine: resolve the right upstream object, collect evidence, expose risk, return alternatives, mark what should be avoided, and produce an install receipt that keeps the hosted API read-only.

## Product Definition

Nipmod answers one question:

> Before an agent touches a workspace, what is the strongest package decision it can make from public source evidence?

The answer must be structured enough for an agent, readable enough for a human and conservative enough for security review.

## Non-Negotiable Boundaries

- Hosted Nipmod stays read-only.
- Hosted Nipmod does not execute install commands.
- Hosted Nipmod does not write to user workspaces.
- Hosted Nipmod does not clone repositories for normal API requests.
- Hosted Nipmod does not unpack package artifacts in the request path.
- Package metadata, READMEs, model cards and registry descriptions are untrusted data.
- A strong decision is not a safety guarantee.

## Decision Contract

Every package decision should converge on the same object:

```json
{
  "type": "dev.nipmod.package-decision.v1",
  "query": "best package for forms in React",
  "plan": {
    "intent": "find-package",
    "ecosystems": ["npm"],
    "criteria": ["task-fit", "source-identity", "security", "install-boundary"]
  },
  "recommended": {},
  "alternatives": [],
  "avoid": [],
  "receipt": {},
  "confidence": {},
  "evidence": {}
}
```

The object must be additive. Existing public APIs can keep their current shape while new clients consume `decision` when present.

## Query Planner

The planner turns messy human or agent requests into a bounded package task.

Inputs:

- raw user message
- conversation language
- source hints
- package names or use-case words
- risk words such as malware, postinstall, wallet, token, SSH, CVE

Outputs:

- intent
- source candidates
- normalized search query
- decision criteria
- clarification need
- constraints

The planner should know when not to search. Greetings, thanks and small talk stay conversation only.

## Ranking Model

The first production ranking is still rule-based. It should become increasingly evidence-led, not popularity-led.

Decision dimensions:

| Dimension | Purpose |
|---|---|
| task fit | Does this actually solve the user task? |
| source identity | Does the name, URL, owner and version resolve cleanly? |
| source depth | Did the source return enough useful metadata? |
| security | Are there warnings, risky scripts, weak provenance or advisories? |
| install boundary | What would run after approval? |
| maintenance | Is there activity, freshness and useful release context? |
| adoption | Is there usage signal, treated only as a tie-breaker? |
| license | Is license metadata visible before reuse? |
| alternatives | Are there reasonable substitutes? |
| avoid list | Which candidates should not be installed from this result? |

Popularity must never override a serious security or install-boundary warning.

## Receipt

A decision is incomplete without a receipt.

The receipt records:

- selected source
- name and version
- original URL
- install command
- hosted execution state: always false
- workspace write state: always false for hosted API
- approval requirement
- blocking status
- warnings
- alternatives considered
- review steps

This is the piece agents can store, show to users or attach to later workspace activity.

## Archive Loop

The archive should store confirmed useful package intelligence, not every search result.

Archive candidates:

- a package decision was inspected
- an install plan was produced
- user, host or agent later confirms usefulness
- the package did not violate block gates
- the stored record keeps source ownership and original links

Future archive records should include:

- decision receipt
- source evidence snapshot
- confirmation source
- freshness timestamp
- refresh status
- negative decision references where useful

## Security Roadmap

The hosted API can keep getting smarter without becoming dangerous.

Next layers:

- stronger artifact metadata without download execution
- sandbox worker for optional deep scans outside the normal request path
- malware pattern corpus for package names, scripts and metadata
- maintainer and owner identity graph
- advisory correlation across OSV, registry advisories and source-specific feeds
- MCP permission and credential-scope review
- Hugging Face model and dataset file-shape risk profiles
- prompt-injection boundary checks for package text and tool metadata

## Evaluation System

Nipmod needs internal evals before claims.

Evals should measure:

- source resolution accuracy
- correct refusal or uncertainty when the query is vague
- known vulnerable package handling
- typo and confusion package handling
- install-plan blocking for high-risk commands
- German and English answer quality
- no tool use for small talk
- latency and cost per decision
- archive write boundaries

The benchmark can be public only when the scope is explicit and the raw data is available.

## Platform Strategy

Nipmod should be easy to integrate in three forms:

- API: direct agent and product integration
- Chat: human use of the same intelligence layer
- Receipts: portable decision records for agent hosts, wallets and workflow tools

Later SDKs can wrap the API, but the API contract should remain the source of truth.

## First Production Slice

The first slice adds:

- `PackageDecisionQueryPlan`
- `PackageDecision`
- `PackageDecisionReceipt`
- `PackageDecisionCandidate`
- `PackageDecisionAvoid`
- LLM tool output with structured decision data
- account chat API response with optional `decision`
- UI display for confidence, alternatives and avoid candidates
- tests for planner, receipt and formatting

This does not replace `/api/search`, `/api/inspect` or `/api/install-plan`. It connects them into a higher-level decision object.

## Acceptance Criteria

- existing API keys keep working
- public API remains backward compatible
- hosted API remains read-only
- chat can answer small talk without package search
- package questions return a structured decision when tools are used
- fallback path can still answer without LLM
- tests and typecheck pass
- production deploy succeeds

## Long-Term Target

The mature system should feel like this:

1. User or agent asks for a capability.
2. Nipmod turns that into a package task.
3. Nipmod searches across sources.
4. Nipmod inspects the strongest candidates.
5. Nipmod explains the recommendation and the risk.
6. Nipmod returns alternatives and avoid candidates.
7. Nipmod produces a receipt before any execution.
8. The host or user decides whether execution is allowed.
9. Confirmed useful decisions can strengthen the archive.

That is the moat: not a prettier package search, but a reusable pre-execution decision record for agents.
