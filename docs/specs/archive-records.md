# Archive Records Spec

Status: implemented preparation flow, durable writes gated

The Nipmod archive stores package intelligence records after useful confirmed discovery. The archive is not a blind mirror of external registries.

## Record Status

| Status | Meaning |
| --- | --- |
| `external_indexed` | Resolved from a public source and normalized by Nipmod. |
| `agent_confirmed` | A workflow confirmed the record was useful enough to save. |
| `claimed` | The original owner claimed or linked the record. |
| `verified_nipmod` | The record passed Nipmod verification gates. |
| `quarantined` | Maintainers or security checks flagged the record. |
| `yanked` | The record is withdrawn from active recommendations. |

## Persistence Rule

Public callers may prepare records.

Durable writes require server-side archive credentials and an authorized writer token. This prevents public spam and keeps the archive useful.

The Supabase production schema lives in `supabase/migrations/20260522073000_package_intelligence_archive.sql`. It enables RLS, allows public reads, stores archive write tokens only as SHA-256 hashes in `nipmod_private.archive_write_tokens`, and permits writes only when the server sends the matching `x-nipmod-archive-token` header.

## Stored Evidence

Archive records should preserve:

- original source
- original URL
- original owner when available
- normalized package id
- source metadata snapshot
- trust score and warnings
- install plan
- confirmation events
- status transitions
- timestamps

## Deletion and Quarantine

Nipmod can remove or quarantine Nipmod records from active recommendations.

Nipmod does not delete original third-party packages from npm, PyPI, GitHub, Hugging Face, MCP or any other source.

## Public Claim Rule

Only claimed or directly published packages may be described as verified Nipmod packages.

External records should be described as external package intelligence records until the owner claim and verification process is complete.
