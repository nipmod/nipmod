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
  "recovery": {
    "degraded": false,
    "retryable": false,
    "suggestedAction": "use-returned-records"
  },
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

`recovery` tells agents how to handle a source outcome:

- `use-returned-records` means the source returned usable candidates.
- `inspect-exact-package` means search was empty and the agent should try an exact source/name if it has one.
- `retry-source-later` means the upstream failure was retryable, such as timeout, rate limit or temporary outage.
- `fix-source-or-query` means the source rejected the request or no matching package exists.

The normalization contract is fixed:

- hosted API calls return install plans only
- hosted API calls do not write caller workspaces
- package metadata is treated as data, not instructions
- original URLs and source ownership are preserved
- repository URLs are normalized to safe HTTP(S) URLs or dropped
- package ids are source-prefixed

## Source Quality Contract

Source degradation must stay visible to the caller. Nipmod can return useful records when one source is down, but it must not hide the failed source or manufacture records for it.

Rules:

- a failed source returns `sourceReports[].status: "failed"` with a structured error
- retryable upstream failures use `recovery.suggestedAction: "retry-source-later"`
- non-retryable source/query failures use `recovery.suggestedAction: "fix-source-or-query"`
- partial success returns `partial: true` and recommends only records from successful sources
- all-source failure returns a structured API error instead of an empty success
- source circuits are per source; one degraded source does not disable the whole API
- search results are not install approval, even when a source is healthy
- install plans never run commands and never write the caller workspace

This matters because source uptime is not the same as package safety. Agents should treat `sourceReports`, `selection.candidates`, trust factors and the install plan as separate review surfaces.

## Source-Depth Signals

Resolvers should expose source-native context as `trust.signals` and risk as `trust.warnings` before adding new public schema fields.

Current depth signals include:

- npm deprecation, maintainer count, dependency count, Node engine, funding metadata, tarball host, file count, unpacked size, integrity and signature metadata
- PyPI latest release files, file types, file size, yanked status, digest metadata, signature metadata, Simple API provenance links, core metadata hashes, `requires-python`, classifiers and vulnerability records
- GitHub archived, disabled and fork status, default branch, push timestamp, open issue count, fork count, package manifest hints, security files and lockfiles for exact repo inspect
- Hugging Face gated/private flags, pipeline tag, library, repository file count, README/model card, config metadata, safetensors metadata for models and commit digest metadata
- MCP remote endpoint count, environment requirements, package metadata, registry status and source repository

These signals are review context. They improve package comparison and install-plan review, but they do not guarantee that third-party code is safe.

## Current Resolvers

| Resolver | Status | Main Limit |
| --- | --- | --- |
| npm | Live | Search quality depends on npm search API ranking. |
| PyPI | Live | Search uses exact names, normalized name candidates and validated task hints because PyPI does not expose a stable broad search API. |
| GitHub | Live | Search is repository-level; exact repo inspect can detect common package manifest files. |
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

Crawler-backed enrichment must also pass the [source crawling policy](source-crawling.md). Source-native APIs stay primary; crawling is only a bounded fallback or enrichment path when the source allows it.
