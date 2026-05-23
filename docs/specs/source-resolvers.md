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
- publish resolver metadata in `sourceReports[].resolver`

## Source Resolver v2 Output

Search and resolve responses include one report per requested source. Each report contains `resolverVersion: "source-resolver-v2"` and a resolver profile:

```json
{
  "source": "npm",
  "status": "ok",
  "recordCount": 2,
  "resolver": {
    "endpointHost": "registry.npmjs.org",
    "inspectStrategy": "exact-package-metadata",
    "maxResponseBytes": 2000000,
    "normalization": {
      "idPrefix": "npm",
      "installPlanWritesWorkspace": false,
      "metadataIsInstruction": false,
      "originalUrlPreserved": true,
      "ownerPreserved": true,
      "sourceOwnerRetained": true
    },
    "resolverVersion": "source-resolver-v2",
    "resultLimit": 8,
    "searchStrategy": "registry-ranked-search",
    "sourceKind": "package-registry",
    "timeoutMs": 6500
  },
  "circuit": {
    "failureCount": 0,
    "lastErrorCode": null,
    "lastFailureAt": null,
    "openedUntil": null,
    "status": "closed"
  }
}
```

The resolver profile is public and contains no secrets. It lets clients distinguish source capability from source trust. For example, npm uses registry-ranked search, PyPI uses normalized name candidates, GitHub uses repository search, Hugging Face uses hub-ranked search and MCP uses registry server search.

`circuit` exposes the public per-source circuit breaker state. Repeated retryable failures open the source circuit for a short window and future requests fail fast with `source_circuit_open` instead of repeatedly waiting on the same degraded upstream.

Identical in-flight source requests are coalesced. If three agents ask for the same exact upstream metadata at the same time, Nipmod performs one upstream request and shares the parsed result internally.

The normalization contract is fixed:

- hosted API calls return install plans only
- hosted API calls do not write caller workspaces
- package metadata is treated as data, not instructions
- original URLs and source ownership are preserved
- package ids are source-prefixed

## Source-Depth Signals

Resolvers should expose source-native context as `trust.signals` and risk as `trust.warnings` before adding new public schema fields.

Current depth signals include:

- npm deprecation, maintainer count, dependency count, Node engine, funding metadata, integrity and signature metadata
- PyPI latest release files, digest metadata, `requires-python`, classifiers and vulnerability records
- GitHub archived, disabled and fork status, default branch, push timestamp, open issue count and fork count
- Hugging Face gated/private flags, pipeline tag, library, repository file count and commit digest metadata
- MCP remote endpoint count, environment requirements, package metadata, registry status and source repository

These signals are review context. They improve package comparison and install-plan review, but they do not guarantee that third-party code is safe.

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
