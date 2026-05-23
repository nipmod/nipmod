# Architecture

Nipmod is the package layer for AI agents.

It sits above existing package ecosystems and turns source-owned package metadata into agent-readable package intelligence. Nipmod does not replace npm, PyPI, Hugging Face, GitHub or MCP registries.

## System Flow

```text
agent request
  -> source resolver
  -> normalizer
  -> trust engine
  -> policy engine
  -> install plan
  -> user or host approval
  -> optional archive confirmation
```

## Layers

| Layer | Responsibility | Boundary |
| --- | --- | --- |
| Resolver | Query a supported external source through official or allowed public APIs. | Never claims ownership of source data. |
| Normalizer | Convert source-specific data into one external package record shape. | Package metadata remains untrusted. |
| Trust Engine | Score evidence, warnings, provenance, source depth and install risk. | Trust score is review context, not permission to execute. |
| Policy Engine | Decide `recommended`, `usable_with_warning`, `unknown` or `avoid`; block high-risk plans. | Popularity cannot upgrade security permission. |
| Install Plan | Return commands, warnings, risk and approval boundary. | Hosted API never runs commands. |
| Archive | Persist useful confirmed package intelligence records. | Search alone does not create durable verified records. |

## Supported Source Families

| Source | Resolver Evidence |
| --- | --- |
| npm | Registry metadata, latest release, tarball integrity, signatures, downloads, maintainers, dependencies, engines and install-time lifecycle scripts. |
| PyPI | JSON API, release files, digests, yanked status, Simple API metadata, provenance links, vulnerabilities and Python version bounds. |
| Hugging Face | Model and dataset metadata, repository files, model cards, license tags, gated status, safetensors and binary weight risk. |
| GitHub | Repository metadata, source URL, license, activity, package manifests, security files, lockfiles and lifecycle scripts. |
| MCP registries | Server metadata, source links, remote endpoints, package hints and registry activity status. |

## Search Is Not Install Permission

Search returns candidates and ranking. Ranking may use popularity, text match and source reliability. It does not mean the package is safe.

Agents must inspect exact candidates and request an install plan before any local action. Install decisions are version-specific and policy-based.

## Hosted API Boundary

Hosted API routes are read-only for caller workspaces:

- no local file reads
- no local file writes
- no command execution
- no package manager execution
- no workspace mutation

Local workspace writes belong to the user's package manager, local MCP server or CLI after explicit approval.

## Archive Boundary

The package intelligence archive is not a registry mirror.

Records enter the durable archive only after a useful discovery is confirmed. Confirm uses server-side reinspection and gates the record through trust, install plan and metadata checks. Confirm deduplicates by stable source evidence instead of allowing public spam.

## Operational Gates

Production readiness is checked through:

- OpenAPI contract canary
- source depth canary
- install plan canary
- archive depth canary
- rate-limit canary
- production synthetic monitor
- production load smoke
- node edge resilience smoke

The launch gate blocks hard failures and reports retryable external source degradation separately.
