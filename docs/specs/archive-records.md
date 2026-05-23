# Archive Records Spec

Status: implemented preparation flow, durable writes gated

The Nipmod archive stores package intelligence records after useful confirmed discovery. The archive is not a blind mirror of external registries.

## Public Lifecycle States

Use these states in product copy and docs:

| State | Meaning |
| --- | --- |
| `ephemeral` | Live source result, not stored. |
| `indexed` | Normalized and inspected, but not confirmed as useful. |
| `confirmed_use` | Confirmed useful by an agent or user workflow. |
| `verified` | Exact version has strong evidence and owner or claim gates. |
| `quarantined` | Risky, disputed or under security review. |
| `blocked` | Policy says the package must not be installed. |

## Current Wire Status

The API keeps older status names for compatibility.

| Status | Meaning |
| --- | --- |
| `external_indexed` | Resolved from a public source and normalized by Nipmod. |
| `agent_confirmed` | A workflow confirmed the record was useful enough to save. |
| `claimed` | The original owner claimed or linked the record. |
| `verified_nipmod` | The record passed Nipmod verification gates. |
| `quarantined` | Maintainers or security checks flagged the record. |
| `yanked` | The record is withdrawn from active recommendations. |

Mapping:

| Public Lifecycle | Current Wire Shape |
| --- | --- |
| `ephemeral` | external record `archive.persistence: "ephemeral"` |
| `indexed` | archive record `archive.status: "external_indexed"` |
| `confirmed_use` | archive record `archive.status: "agent_confirmed"` |
| `verified` | archive record `archive.status: "verified_nipmod"` |
| `quarantined` | archive record `archive.status: "quarantined"` |
| `blocked` | blocked install plan or failed archive validation |

## Persistence Rule

Public callers may prepare records.

Durable writes require server-side archive credentials and an authorized writer token. This prevents public spam and keeps the archive useful.

Search alone stores nothing durable as verified. Archive prepare stores nothing durable. Durable persistence starts only at confirm write after server-side reinspection and archive gates.

The Supabase production schema lives in `supabase/migrations/20260522073000_package_intelligence_archive.sql`. It enables RLS, allows public reads, stores archive write tokens only as SHA-256 hashes in `nipmod_private.archive_write_tokens`, and permits writes only when the server sends the matching `x-nipmod-archive-token` header.

Submitted records are treated as hints, not authority. Before prepare or confirm returns an archive record, Nipmod inspects the original source again and uses server-generated source metadata, trust factors, warnings and install plans. Client-supplied `trust.score`, `trust.decision`, `trust.factors` and warnings are not allowed to upgrade the durable archive record.

If a submitted record points to a different source/name than the inspected source returns, the request fails. If the submitted version is stale against the current exact source inspection, archive confirmation fails with `stale_record`.

## Archive Gating Pipeline

Nipmod uses the archive as a confirmed package intelligence layer, not as a registry mirror.

| Stage | Input | Output | Durable Write |
| --- | --- | --- | --- |
| Resolve | User or agent query | External candidates with source reports | No |
| Inspect | Exact `source` and `name` | Refreshed source-owned package record | No |
| Plan | Exact package record | Reviewable install plan and safety boundary | No |
| Prepare | Exact source/name or untrusted posted record | Server-generated archive preview and receipt preview | No |
| Confirm dry run | Prepared record without writer token | Validation result and receipt shape | No |
| Confirm write | Prepared record with authorized archive writer token | `agent_confirmed` archive record and receipt | Yes |

Prepare and confirm never trust caller-supplied scores. The server re-inspects the upstream source and rebuilds trust, warnings and install-plan data before it returns the archive record.

Archive confirmation is allowed only when:

- the inspected source still matches the submitted source and name
- the submitted version is not stale against current source metadata
- `trust.decision` is `recommended` or `usable_with_warning`
- `trust.score` meets the current `usableWithWarning` policy threshold
- `trust.decision` is not `avoid`
- `trust.risk` is not `high`
- `trust.risk` is not `unknown`
- the generated install plan is not blocked
- install command risk is not `high`
- source metadata does not contain high-risk lifecycle script behavior
- package metadata does not contain agent-targeted instructions
- the request uses the archive writer token for durable writes

Search score is not part of this gate as standalone permission. The gate uses exact source inspection, trust decision, version freshness, install-plan safety and policy errors.

## Stored Evidence

Archive records should preserve:

- original source
- original URL
- original owner when available
- normalized package id
- source metadata snapshot
- trust score and warnings
- install plan
- deterministic evidence digests for the source record, source snapshot, trust object and install plan
- confirmation events
- status transitions
- timestamps

Archive records should not store:

- raw API keys
- raw queries
- IP addresses
- user agent strings
- copied third-party package artifacts
- package README text as executable instructions
- ownership claims that were not verified by the source owner

Prepare and confirm responses also return receipts of type:

```text
dev.nipmod.package-intelligence-receipt.v1
```

Receipts include the record id, source, package name, trust score, trust decision, archive status, confirmation count, stored flag, evidence digest and a digest of the stable key. They do not include API keys, raw queries, IP addresses or user agent strings.

Record evidence uses:

```json
{
  "archivePolicy": "agent-confirmed-source-owned-v1",
  "generatedFrom": "server-reinspected-source",
  "installPlanDigest": "<sha256>",
  "sourceRecordDigest": "<sha256>",
  "sourceSnapshotDigest": "<sha256>",
  "trustDigest": "<sha256>"
}
```

This lets agents and operators see that the archive preview was rebuilt from server-side source inspection instead of caller-supplied scores.

## Confirmation Gate

Confirmed archive records are meant to capture useful package intelligence, not unsafe recommendations.

The confirm endpoint rejects records when:

- `trust.decision` is `avoid`
- `trust.decision` is `unknown`
- `trust.risk` is `high`
- `trust.risk` is `unknown`
- `trust.score` is below the policy threshold for `usable_with_warning`
- the generated install plan is blocked
- install command risk is `high`
- source metadata declares high-risk lifecycle script behavior
- package metadata contains agent-targeted prompt instructions

Those records can still be inspected by an agent, but they are not persisted as confirmed archive records.

Prepare and confirm responses include a `dev.nipmod.package-intelligence-eligibility.v1` object. It exposes the current minimum trust score, archive eligibility warnings and archive-blocking errors without exposing API keys, raw client identifiers or upstream response bodies.

## Verification Language

Use precise status language:

| Allowed Phrase | Meaning |
| --- | --- |
| `external package intelligence record` | Source-owned package normalized by Nipmod. |
| `agent_confirmed` | A workflow confirmed the package was useful enough to store. |
| `claimed` | Original owner linked or claimed the record. |
| `verified_nipmod` | Nipmod verification gates passed. |

Do not call external records verified packages until owner claim and verification are complete.

## Deletion and Quarantine

Nipmod can remove or quarantine Nipmod records from active recommendations.

Nipmod does not delete original third-party packages from npm, PyPI, GitHub, Hugging Face, MCP or any other source.

## Public Claim Rule

Only claimed or directly published packages may be described as verified Nipmod packages.

External records should be described as external package intelligence records until the owner claim and verification process is complete.
