# Package Intelligence Seed v1

Status: operator-controlled API beta seed.

The seed is a small set of public package intelligence records used to prove that the archive flow works across the supported source families. It is not a bulk mirror and it is not a verified ownership claim.

Seed records are selected because they exercise important resolver paths:

| Category | Source Examples | Purpose |
| --- | --- | --- |
| API examples | `npm:undici`, `pypi:requests` | Public Search, Inspect and Install Plan examples. |
| Agent runtime | `npm:zod`, `pypi:pydantic`, `npm:playwright` | Common agent dependency, validation and automation packages. |
| Source context | GitHub repositories | Repository metadata, manifest and source-context inspection. |
| Model workflow | Hugging Face models and datasets | Model card, file list, gated status and binary weight risk checks. |
| Tool registry | MCP server records | MCP source links, remote endpoint and environment requirement checks. |

## Rules

- Search alone does not store a durable record.
- Archive prepare is preview-only.
- Archive confirm is operator-only and re-inspects the source server-side.
- Confirmed records are deduplicated by source identity, version and evidence.
- External records remain `external_indexed` unless a verified claim or direct publish flow passes.
- Popularity is never enough to mark a package verified.

## Operator Command

Dry run:

```bash
pnpm archive:seed
```

Production write:

```bash
pnpm archive:seed -- --write --env-file-path site/.env.production.local
```

The write path requires `NIPMOD_ARCHIVE_WRITE_TOKEN`. Do not print that token in logs, docs or pull requests.
