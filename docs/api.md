# API Flow

Nipmod exposes a hosted API for package discovery and install-plan review.

## 1. Search

```bash
curl 'https://nipmod.com/api/search?q=http%20client&sources=npm,pypi,github,huggingface-model,mcp&limit=5' \
  -H 'x-nipmod-api-key: <key>'
```

Search returns candidates, source reports, partial failure state and ranking evidence.
Search is a shortlist, not approval to install.

## 2. Inspect

```bash
curl 'https://nipmod.com/api/inspect?source=npm&name=undici' \
  -H 'x-nipmod-api-key: <key>'
```

Inspect refreshes one exact source-owned record and returns source URL, license, metrics, warnings, trust factors and policy output.

## 3. Decision

```bash
curl -X POST 'https://nipmod.com/api/decision' \
  -H 'content-type: application/json' \
  -H 'x-nipmod-api-key: <key>' \
  -d '{"query":"http client","selected":{"source":"npm","name":"undici"},"sources":["npm","pypi","github"],"limit":5}'
```

Decision returns a reusable package decision with recommendation, evidence, risks, alternatives, execution boundary and receipt data.

## 4. Install Plan

```bash
curl 'https://nipmod.com/api/install-plan?source=npm&name=undici' \
  -H 'x-nipmod-api-key: <key>'
```

Install plans describe commands, risk, warnings and approval boundaries.
The hosted API never executes commands and never writes to the caller workspace.

## 5. Optional Archive Preview

```bash
curl 'https://nipmod.com/api/archive/prepare?source=npm&name=undici' \
  -H 'x-nipmod-api-key: <key>'
```

Archive prepare is preview-only for normal API users.
Durable archive writes require an authorized writer path.

