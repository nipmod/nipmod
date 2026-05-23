# Data Retention

Nipmod stores the minimum data needed to operate the public API, enforce rate limits and build useful confirmed package intelligence.

## Usage Events

Usage logging stores structured or hashed operational fields:

- route
- method
- status
- request id
- access tier
- key id hash
- source list
- result count
- error code
- timing

Usage logging must not store:

- raw API keys
- raw IP addresses
- raw user agents
- raw search queries
- raw package names
- private prompts
- workspace file paths
- source response bodies

## Rate Limits

Distributed rate limits use hashed client identifiers. The shared bucket is for abuse control, not user profiling.

## Archive Records

Archive records may store:

- source
- normalized package id
- package name
- version
- original URL
- owner when available
- source metadata snapshot
- trust score, decision, warnings and factors
- install plan review data
- evidence digests
- confirmation receipts
- lifecycle events

Archive records must not store:

- API keys
- private tokens
- raw IP addresses
- raw user agents
- unnecessary raw queries
- copied package artifacts
- unverified ownership claims
- package metadata as trusted agent instructions

## Confirmation Rule

Search is ephemeral. It does not create durable verified records.

Durable persistence happens only after an explicit confirm step through an authorized archive writer path. The server reinspects the original source before storing the record.

## Deletion and Quarantine

Nipmod can quarantine, hide or remove Nipmod archive records from active recommendations. It cannot delete upstream packages from npm, PyPI, GitHub, Hugging Face or MCP registries.
