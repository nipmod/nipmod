# Governance

Nipmod is run as an open source product with a small maintainer core and a strict public-change trail.

## Project Roles

| Role | Responsibility |
| --- | --- |
| Maintainer | Owns repository direction, release approvals, security decisions and public product claims. |
| Reviewer | Reviews scoped pull requests, test evidence, API compatibility and security boundaries. |
| Contributor | Proposes changes through issues, discussions or pull requests. |
| Security reporter | Reports active vulnerabilities through `SECURITY.md`, not public issues. |

## Decision Rules

Nipmod uses decision records for changes that affect public API shape, source policy, trust scoring, archive semantics, monetization boundaries or maintainer governance.

Accepted decisions live in `docs/decisions/`.

Every material decision should include:

- context
- decision
- alternatives considered
- user and agent impact
- security impact
- rollback path

## Maintainer Rules

- Public claims must be backed by shipped code, signed records, merged pull requests, owner approval or linked documentation.
- Source integrations must keep original ownership clear.
- Hosted API calls must not read or write caller workspaces.
- Any workspace write must require a local tool, explicit user approval and a durable receipt.
- Active vulnerability details stay out of public issues and public chats.
- Commit subjects must stay product-grade and avoid internal tooling notes.

## Release Rules

See `docs/release-process.md`.

## Conflict Resolution

Security boundaries win over launch speed. API compatibility wins over cosmetic changes. User trust wins over marketing language.

When two directions conflict, maintainers publish the reasoning in a decision record before shipping the public-facing change.
