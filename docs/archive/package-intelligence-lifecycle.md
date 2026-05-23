# Package Intelligence Lifecycle

Nipmod builds a package intelligence archive through confirmed use, not through bulk mirroring.

## Public Lifecycle States

| State | Meaning | Durable by Default |
| --- | --- | --- |
| `ephemeral` | Live result from search or source resolution. | No |
| `indexed` | Normalized and inspected by Nipmod, but not confirmed as useful. | No |
| `confirmed_use` | A user or agent confirmed the package record was useful enough to remember. | Yes, when writer is authorized |
| `verified` | Version-specific evidence and owner/claim checks passed. | Yes |
| `quarantined` | Risky, disputed or under security review. | Yes |
| `blocked` | Policy says the package must not be installed. | Optional audit record only |

## Current Wire Status Mapping

The current API preserves older wire status names for compatibility:

| Public Lifecycle | Current Wire Status |
| --- | --- |
| `ephemeral` | `archive.persistence: "ephemeral"` |
| `indexed` | `archive.status: "external_indexed"` |
| `confirmed_use` | `archive.status: "agent_confirmed"` |
| `verified` | `archive.status: "verified_nipmod"` |
| `quarantined` | `archive.status: "quarantined"` |
| `blocked` | validation errors or blocked install plan |

New docs and product copy should use the public lifecycle language. Existing API clients should keep accepting the wire status names.

## Persistence Rules

- Search does not persist durable verified records.
- Inspect does not persist durable verified records.
- Install Plan does not execute and does not persist by itself.
- Prepare creates a server-generated preview only.
- Confirm dry run validates without storing.
- Confirm write stores only when the archive writer token and archive store are configured.

## Dedupe Rule

Confirm deduplicates by stable source evidence:

- source
- name or id
- version
- original source URL
- digest or integrity evidence when available

Repeated confirmations increment confirmation history instead of creating duplicate records.

## Verification Rule

`verified` requires stronger gates than search:

- exact source and version
- strong source evidence
- owner or claim workflow when required
- non-blocked install plan
- no high-risk lifecycle behavior
- no agent-targeted prompt injection in metadata
- evidence digests for source record, source snapshot, trust object and install plan

Popularity alone can never create `verified`.
