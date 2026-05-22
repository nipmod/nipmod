# 0002 - External Source Ownership

Status: accepted
Date: 2026-05-22

## Context

Nipmod resolves records from npm, PyPI, GitHub, Hugging Face, MCP and future sources. Those sources contain packages owned by their original maintainers.

## Decision

External package owners keep ownership.

Nipmod may index public metadata, normalize records, attach trust signals and prepare archive records. Nipmod must not imply that external packages are owned, endorsed or verified by Nipmod unless the owner claim and verification process has happened.

## Alternatives

- Mirror external registries directly.
- Import large package sets as Nipmod packages.
- Treat every resolved package as verified by default.

## Impact

This keeps the product legally and technically cleaner. Nipmod becomes the intelligence and trust layer, not an unauthorized rehost.

## Security

Agents must treat external metadata as untrusted input. Install plans must require approval before execution.

## Rollback

If a source objects to indexing or changes terms, disable or limit the resolver and document the change.
