# Search, Inspect, Install Plan

The public API has three core calls.

```text
Search -> Inspect -> Install Plan -> Approval
```

## Search

```bash
curl 'https://nipmod.com/api/search?q=http%20client&limit=3'
```

Search returns package candidates across supported sources. It includes source reports, partial failure state, ranking reasons and a recommended candidate hint.

Search does not persist a verified record.

Search output is useful for shortlisting. It is not permission to install.

## Inspect

```bash
curl 'https://nipmod.com/api/inspect?source=npm&name=undici'
```

Inspect refreshes one exact package record from its source.

Inspect returns:

- source
- original URL
- owner when available
- package/version
- license
- source metrics
- warnings
- trust score
- trust decision
- trust factors
- source-specific evidence

## Install Plan

```bash
curl 'https://nipmod.com/api/install-plan?source=npm&name=undici'
```

Install Plan returns review data only.

It includes:

- command
- source
- package/version
- risk
- warnings
- trust factors
- approval boundary
- whether a workspace write would happen if approved locally

The hosted API never executes the command.

## Approval

The agent must show the install plan to the user or host policy before execution.

Execution belongs to:

- the user's package manager
- the local CLI
- a controlled local MCP server
- another explicitly approved local tool

## Optional Archive Confirmation

```bash
curl 'https://nipmod.com/api/archive/prepare?source=npm&name=undici'
```

Archive prepare previews a package intelligence record. Durable writes require explicit confirmation through an authorized archive writer token.

Search alone does not create durable verified records.
