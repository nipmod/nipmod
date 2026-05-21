# Nipmod

[![CI](https://github.com/nipmod/nipmod/actions/workflows/ci.yml/badge.svg)](https://github.com/nipmod/nipmod/actions/workflows/ci.yml)
[![Production monitor](https://github.com/nipmod/nipmod/actions/workflows/prod-monitor.yml/badge.svg)](https://github.com/nipmod/nipmod/actions/workflows/prod-monitor.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-white.svg)](LICENSE)

Nipmod is one package API for agents.

Agents ask once. Nipmod searches package sources, normalizes the result, adds trust context and returns a safe install plan before anything enters a workspace.

```bash
curl 'https://nipmod.com/api/search?q=telegram%20bot&limit=3'
```

## Status

| Surface | Status |
| --- | --- |
| Hosted package API | Live public beta with rate limits |
| Source resolver | Live for npm, PyPI, GitHub, Hugging Face and MCP |
| Package intelligence archive | Resolver safe mode until durable archive env vars are configured |
| Verified Nipmod archive | Empty after seed reset; new entries must pass verification gates |
| CLI and installer | Live, release `1.2.5` |
| Local MCP server | Live for controlled workspace installs |
| Hosted MCP endpoint | Live, read-only |

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
| GitHub | https://github.com/nipmod/nipmod |
| GitHub mirror | https://github.com/nipmod/nipmod |
| Gitlawb source | https://gitlawb.com/node/repos/z6Mkwbud/nipmod |
| X | https://x.com/Nipmod |
| Telegram | https://t.me/nipmod |

Canonical source: `gitlawb://did:key:z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R/nipmod`

## API

Public beta access does not require an API key.

```bash
curl 'https://nipmod.com/api/search?q=telegram%20bot&sources=npm,pypi,github,huggingface-model,mcp&limit=5'
curl 'https://nipmod.com/api/inspect?source=npm&name=node-telegram-bot-api'
curl 'https://nipmod.com/api/install-plan?source=npm&name=node-telegram-bot-api'
curl 'https://nipmod.com/api/archive/prepare?source=npm&name=node-telegram-bot-api'
```

Hosted API calls never read or write a caller workspace. They return package records, trust signals and install plans. Local CLI or MCP setup is only needed when a user wants controlled workspace writes.

## Install

The CLI is optional for API use. Install it only when a workflow needs local package writes, audits, SBOM output or publish preparation.

Requirements: Node.js 22 or newer, npm, Git, curl and tar.

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

## Local Workspace Flow

```bash
nipmod doctor --online
nipmod search <query> --online
nipmod inspect <package-specifier> --json
nipmod install --plan <package-specifier> --json
nipmod install <package-specifier>
nipmod audit --online
nipmod sbom --json
```

## MCP

Nipmod exposes a hosted read-only MCP endpoint and a local stdio MCP server.

Hosted read-only MCP:

```text
https://nipmod.com/api/mcp
```

Local MCP server:

```bash
nipmod mcp serve
```

The hosted endpoint exposes search, resolve, inspect, view, install plan and demo tools. It does not expose workspace writes, local file reads, audit, SBOM, claim or publish tools.

## Publish

Use publish flows only for repos you own or maintain.

```bash
nipmod setup gitlawb
nipmod init --name demo-package --dir demo-package
cd demo-package
nipmod manifest validate --dir . --json
nipmod publish . --dry-run --json
```

For Gitlawb source packages:

```bash
nipmod package doctor gitlawb://did:key:z6Mk.../your-repo --json
nipmod package pr gitlawb://did:key:z6Mk.../your-repo --dir your-repo-pr
nipmod claim verify gitlawb://did:key:z6Mk.../your-repo --json
```

## Repository Map

- `nipmod/` - TypeScript CLI, package installer, registry client, resolver and MCP server.
- `site/` - Next.js website, API routes, registry surfaces and public machine files.
- `packages/first-party/` - First-party package fixtures used for verified archive gates.
- `docs/` - Operator docs, trust model, package publishing and architecture notes.
- `tools/` - Release, readiness, registry, monitor and security tooling.

## Verify

```bash
pnpm --dir nipmod test
pnpm --dir nipmod typecheck
pnpm --dir nipmod build
pnpm --dir site test
pnpm --dir site typecheck
pnpm --dir site build
pnpm --dir site security:secrets
node tools/open-source-readiness-check.mjs
node tools/supply-chain-check.mjs
```

License: `MIT`. Security: `SECURITY.md`. Trademark and affiliation notice: `TRADEMARKS.md`.
