# Package Intelligence Architecture

Nipmod is built as a package intelligence layer for agents, not as a blind mirror of external package registries.

The production rule is direct:

- external sources keep ownership
- Nipmod resolves and normalizes public package records
- agents get trust checks and install plans before writes
- useful confirmed packages can enter the Nipmod intelligence archive
- only owner claimed or directly published packages can become `verified_nipmod`

## Status Model

| Status | Meaning | Who can create it |
|---|---|---|
| `external_indexed` | A public package was resolved from npm, PyPI, GitHub, Hugging Face, MCP or another source. | Nipmod resolver |
| `agent_confirmed` | An agent or workflow confirmed the package was useful enough to store. | Authenticated archive write API |
| `claimed` | The source owner claimed the package record. | Owner claim workflow |
| `verified_nipmod` | The package passed Nipmod verification gates. | Nipmod verification pipeline |
| `quarantined` | The package is known risky or disputed. | Security gate |
| `yanked` | The Nipmod record is withdrawn from active recommendations. | Maintainer or policy gate |

## Write Boundary

Public users can prepare records and dry run confirmations.

Actual persistence requires `NIPMOD_ARCHIVE_WRITE_TOKEN` and a configured production store. This prevents random internet clients from filling the archive with spam.

Current production store contract:

- `NIPMOD_ARCHIVE_SUPABASE_URL`
- `NIPMOD_ARCHIVE_SUPABASE_PUBLISHABLE_KEY`
- `NIPMOD_ARCHIVE_WRITE_TOKEN`

The preferred hosted mode uses the Supabase publishable key with RLS policies that require the server-only `x-nipmod-archive-token` header. A service-role key remains an operator fallback, but is not required for the hosted Nipmod API.

Without those values, the write APIs stay safe and return a configured false state.

## API Surface

| Endpoint | Purpose | Write |
|---|---|---|
| `GET /api/archive/prepare?source=npm&name=package` | Build a package intelligence record from an external source. | No |
| `POST /api/archive/prepare` | Build a package intelligence record from an external record body. | No |
| `GET /api/archive/search?q=query` | Search persisted package intelligence records. | No |
| `POST /api/archive/confirm` | Confirm a resolved package and persist it if authorized. | Yes, authenticated |

## Record Boundary

Every persisted record stores:

- original source and original URL
- owner retained by original source
- normalized install plan
- trust score, risk and warnings
- source snapshot
- confirmation events
- status and timestamps

Nipmod metadata is never treated as executable instructions. Agents must treat descriptions, package metadata and source text as data.

## Enterprise Requirements

Before public writeback is turned on at scale:

- database migrations applied
- archive write token stored as a server secret
- rate limits on write endpoints
- background refresh job for stored records
- source specific quotas and circuit breakers
- vulnerability enrichment
- license classification
- owner claim escalation
- quarantine and yanking admin flow
- audit log export
- production monitor coverage for archive writes

This is the foundation for the larger model: one API that resolves the existing package world, makes it agent readable and stores confirmed package intelligence without taking ownership from original creators.
