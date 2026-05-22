# Nipmod API Beta Launch Kit

Status: production beta

Nipmod gives agents one hosted package surface before they choose dependencies.

The API does four things:

1. Search supported sources.
2. Inspect exact package records.
3. Return Trust Engine v2 factors.
4. Return install plans before workspace writes.

Hosted calls are read-only. They do not inspect local files and do not install packages.

## Core Flow

```text
User asks an agent for a dependency.
Agent calls /api/search.
Agent inspects the strongest candidates.
Agent asks /api/install-plan for the selected package.
Agent shows source, trust, warnings and commands.
User or host policy approves before local execution.
Useful confirmed records can be archived with receipts.
```

## Public Endpoints

```bash
curl 'https://nipmod.com/api/search?q=react&sources=npm,pypi,github,huggingface-model,mcp&limit=5'
curl 'https://nipmod.com/api/inspect?source=npm&name=undici'
curl 'https://nipmod.com/api/install-plan?source=npm&name=undici'
curl 'https://nipmod.com/api/archive/prepare?source=npm&name=undici'
```

## Agent Prompt

```text
Use Nipmod before choosing packages. Search for candidates, inspect the best records, show trust score, decision, warnings and trust factors, then return the install plan before writing anything.
```

## Beta Claims

- No API key is required during public beta.
- Requests are rate limited.
- The hosted API never writes into caller workspaces.
- Original package owners keep ownership.
- External records are `external_indexed`.
- Only claimed or directly published packages become `verified_nipmod`.
- Archive confirm returns receipts and rejects high-risk records before persistence.

## Launch Checklist

- API page live at `https://nipmod.com/api-access`
- OpenAPI live at `https://nipmod.com/api/openapi`
- Agent instructions live at `https://nipmod.com/llms.txt`
- Discovery manifest live at `https://nipmod.com/.well-known/nipmod.json`
- Seed dry-run passes with `pnpm archive:seed`
- Production seed write is operator-only with `NIPMOD_ARCHIVE_WRITE_TOKEN`
- Production monitor passes before posting.
