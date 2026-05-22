# Source Resolver Spec

Status: implemented public beta for the listed sources

Nipmod resolves public package records from external sources. It does not claim ownership of those packages and does not rehost third-party code.

## Resolver Responsibilities

Each resolver must:

- use public APIs or publicly accessible metadata
- set a source-specific package id
- preserve the original URL
- preserve original owner or publisher information when available
- return a source-native install command or retrieval command
- return license metadata when available
- return metrics when available
- return warnings when source metadata indicates risk
- fail closed on invalid input
- time out rather than block the API

## Current Resolvers

| Resolver | Status | Main Limit |
| --- | --- | --- |
| npm | Live | Search quality depends on npm search API ranking. |
| PyPI | Live | Search uses exact and normalized name candidates. |
| GitHub | Live | Search is repository-level, not package-manager aware yet. |
| Hugging Face models | Live | Gated/private repos require the user access outside Nipmod. |
| Hugging Face datasets | Live | Gated/private datasets require the user access outside Nipmod. |
| MCP Registry | Live | Install commands vary by host and require original server docs. |

## Source Ownership

External package owners keep ownership.

Nipmod adds:

- normalized package records
- source context
- trust signals
- safe install plans
- archive records after confirmed useful discovery

Nipmod does not add:

- third-party endorsement
- ownership transfer
- permission to bypass source terms
- permission to install without user approval

## Resolver Admission

A new source resolver needs:

1. Public source API or explicit access.
2. Terms check for metadata indexing.
3. Stable source id.
4. Search and inspect behavior.
5. Timeout and partial-failure handling.
6. Tests with source fixtures.
7. Public docs update.
8. Monitor coverage before marketing claims.
