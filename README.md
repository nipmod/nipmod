# Nipmod

[![CI](https://github.com/nipmod/nipmod/actions/workflows/ci.yml/badge.svg)](https://github.com/nipmod/nipmod/actions/workflows/ci.yml)
[![Production monitor](https://github.com/nipmod/nipmod/actions/workflows/prod-monitor.yml/badge.svg)](https://github.com/nipmod/nipmod/actions/workflows/prod-monitor.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-white.svg)](LICENSE)

The package layer for AI agents.

Nipmod lets agents search npm, PyPI, Hugging Face, GitHub and MCP sources,
inspect package trust, and generate safe install plans before workspace writes.

Nipmod does not replace package registries.
It makes existing package ecosystems readable and safer for AI agents.

Public beta access does not require an API key.

```bash
curl 'https://nipmod.com/api/search?q=http%20client&limit=3'
curl 'https://nipmod.com/api/inspect?source=npm&name=undici'
curl 'https://nipmod.com/api/install-plan?source=npm&name=undici'
```

## Why Agents Need This

Agents can choose dependencies, write code, run commands and modify real workspaces. Package metadata was written for humans and package managers, not for autonomous agents that need structured source context before taking action.

Nipmod gives agents one preflight surface:

1. Search supported sources.
2. Inspect exact package records.
3. Generate an install plan.
4. Wait for user or host-policy approval.
5. Optionally confirm useful discovery into the package intelligence archive.

Search ranking is never install permission. A popular package can still be compromised, stale, risky or blocked by policy.

## Supported Sources

| Source | Role |
| --- | --- |
| npm | JavaScript package metadata, releases, integrity, signatures, downloads and lifecycle script risk. |
| PyPI | Python package metadata, release files, digests, provenance hints, vulnerabilities and yanked status. |
| Hugging Face | Model and dataset metadata, files, licenses, gated status, safetensors and binary weight risk. |
| GitHub | Repository metadata, source URLs, activity, manifests, security files and install command risk. |
| MCP registries | MCP server metadata, source links, endpoints, package hints and tool-registry signals. |

Nipmod does not bulk mirror these sources. Source owners keep ownership.

## API Flow

### Search

```bash
curl 'https://nipmod.com/api/search?q=http%20client&sources=npm,pypi,github,huggingface-model,mcp&limit=5'
```

Search returns candidates, source reports, partial failure state and agent-readable ranking data. Search records are ephemeral by default.

### Inspect

```bash
curl 'https://nipmod.com/api/inspect?source=npm&name=undici'
```

Inspect refreshes one exact source-owned record and returns source URL, license, metrics, warnings, trust factors and policy output.

### Install Plan

```bash
curl 'https://nipmod.com/api/install-plan?source=npm&name=undici'
```

Install plans describe commands, risk, warnings and approval boundaries. The hosted API never executes commands and never writes to the caller workspace.

### Optional Archive Confirmation

```bash
curl 'https://nipmod.com/api/archive/prepare?source=npm&name=undici'
```

Archive prepare is preview-only. Durable archive writes require explicit confirmation through an authorized writer path. Confirmed records are deduplicated by source, name, version and source evidence.

## Safety Boundary

| Boundary | Rule |
| --- | --- |
| Hosted API | Read-only package intelligence. No caller workspace reads or writes. |
| Install plan | Review data only. A user, host policy or local tool must approve execution. |
| Package metadata | README text, model cards, descriptions and MCP metadata are untrusted data, not agent instructions. |
| Search score | Ranking input only. It is not install permission and not a verification claim. |
| Archive | Stores confirmed package intelligence records, not copied package artifacts. |
| Usage logging | Stores hashed or structured fields only. No API keys, raw IPs, raw queries, package names or user-agent fingerprints. |

## Data Model

Nipmod uses explicit lifecycle language:

| State | Meaning |
| --- | --- |
| `ephemeral` | Found live during search, not stored. |
| `indexed` | Normalized and inspected, but not confirmed as useful. |
| `confirmed_use` | A user or agent confirmed the record was useful enough to remember. |
| `verified` | Version-specific evidence and owner/claim checks passed. |
| `quarantined` | Risky, disputed or under security review. |
| `blocked` | Must not be installed by policy. |

Current API wire statuses are documented in [archive records](docs/specs/archive-records.md). The public product language should use the lifecycle states above.

## Local Development

```bash
pnpm install
pnpm verify
```

Useful focused checks:

```bash
pnpm --dir site test -- package-intelligence.test.ts external-packages.test.ts
pnpm api:contract -- --base-url https://nipmod.com
pnpm install-plan:canary -- --base-url https://nipmod.com
pnpm archive:canary -- --base-url https://nipmod.com --require-durable
pnpm launch:verify -- --skip-local --require-distributed-rate-limit
```

## CLI Install

The CLI is optional for hosted API use. Install it only when a local workflow needs controlled workspace actions, audits, SBOM output or local MCP.

```bash
curl https://nipmod.com/i|bash
```

Manual checksum verification:

```bash
curl -fLO https://nipmod.com/install.sh
curl -fLO https://nipmod.com/install.sh.sha256
shasum -a 256 -c install.sh.sha256
bash install.sh
```

## Repository Map

| Path | Purpose |
| --- | --- |
| `site/` | Next.js site, hosted API routes, resolver logic and package intelligence archive routes. |
| `nipmod/` | TypeScript CLI, local package tooling and local MCP server. |
| `tools/` | Release, canary, monitor, readiness, security and archive tooling. |
| `docs/` | Product, architecture, security, API and archive documentation. |
| `examples/` | Minimal agent and HTTP workflow examples. |
| `supabase/` | Durable archive, usage logging and rate-limit migrations. |

## Key Docs

- [Architecture](ARCHITECTURE.md)
- [Product positioning](docs/product/positioning.md)
- [API: search, inspect, install plan](docs/api/search-inspect-install-plan.md)
- [Package intelligence lifecycle](docs/archive/package-intelligence-lifecycle.md)
- [Threat model](docs/security/threat-model.md)
- [Data retention](docs/security/data-retention.md)
- [Package metadata is untrusted](docs/security/package-metadata-is-untrusted.md)
- [Public API spec](docs/specs/public-api.md)
- [Source resolver spec](docs/specs/source-resolvers.md)
- [Source crawling spec](docs/specs/source-crawling.md)
- [Trust signals spec](docs/specs/trust-signals.md)
- [API beta launch kit](docs/launch/api-beta.md)
- [Agent workflow examples](examples/agent-workflow/)

## Status

| Surface | Status |
| --- | --- |
| Hosted package API | Live public beta, rate limited |
| Source resolver | Live for npm, PyPI, GitHub, Hugging Face and MCP |
| Install plan API | Live, read-only hosted boundary |
| Package intelligence archive | Durable production archive enabled |
| Public verified archive | Empty by design after seed reset; verified claims require gates |
| Distributed rate limits | Live with Supabase-backed shared buckets |
| CLI and installer | Live, release `1.2.9` |
| Hosted MCP endpoint | Live, read-only |

## Release Integrity

Release sidecars are published under `site/public/releases/`:

- `.sha256` checksums
- `.sig` signatures
- `.sbom.json` SBOM metadata
- `.provenance.json` provenance metadata

See [release process](docs/release-process.md) for the verification flow.

## Governance

- Governance: [`GOVERNANCE.md`](GOVERNANCE.md)
- Maintainer: [`@hazarxyz`](https://github.com/hazarxyz)
- Maintainer policy: [`MAINTAINERS.md`](MAINTAINERS.md)
- Roadmap: [`ROADMAP.md`](ROADMAP.md)
- Contributing: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Security: `SECURITY.md`

## Links

| Area | Link |
| --- | --- |
| Website | https://nipmod.com |
| API access | https://nipmod.com/api-access |
| Sources | https://nipmod.com/sources |
| Archive | https://nipmod.com/packages |
| Registry | https://nipmod.com/registry/packages.json |
| Agent instructions | https://nipmod.com/llms.txt |
| Machine discovery | https://nipmod.com/.well-known/nipmod.json |
| X | https://x.com/Nipmod |
| Telegram | https://t.me/nipmod |
| $NPM on Base | https://token.nipmod.com |

License: `MIT`. Trademark and affiliation notice: `TRADEMARKS.md`.
