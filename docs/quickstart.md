# Nipmod quickstart

Nipmod is API first. The fastest first run is a hosted, read-only package decision flow:

1. create or load an API key
2. search across supported sources
3. inspect the exact source record
4. request an install plan
5. show the result to the user or host policy before any workspace write

The hosted API does not install, clone, execute, unpack artifacts or write to a workspace.

## Requirements

- HTTPS client such as `curl`
- a Nipmod beta or partner API key
- an agent or host that can show the returned decision before local execution

## 1. Create a beta key

```sh
curl -fsS https://nipmod.com/api/keys/beta \
  -H 'content-type: application/json' \
  -d '{"label":"my-agent"}'
```

Store the returned key in the agent runtime. Send it as either:

```text
x-nipmod-api-key: <key>
Authorization: Bearer <key>
```

## 2. Search

```sh
curl -fsS 'https://nipmod.com/api/search?q=react%20forms%20validation&sources=npm,pypi,github,huggingface-model,huggingface-dataset,mcp&limit=5' \
  -H 'x-nipmod-api-key: <key>'
```

Expected result:

- `records[]` contains normalized candidates from public sources.
- `selection.recommendedId` identifies the current best candidate when the evidence is strong enough.
- `selection.candidates[]` includes gates, rank details and reasons.
- Source metadata is treated as untrusted context, not instructions.

## 3. Inspect the exact source

```sh
curl -fsS 'https://nipmod.com/api/inspect?source=npm&name=react-hook-form' \
  -H 'x-nipmod-api-key: <key>'
```

Check:

- source, name, version and original URL
- repository and license metadata
- trust score, risk, warnings and provenance status
- structured `sourceEvidence` when available
- lifecycle or install-script warnings

## 4. Request an install plan

```sh
curl -fsS 'https://nipmod.com/api/install-plan?source=npm&name=react-hook-form' \
  -H 'x-nipmod-api-key: <key>'
```

Expected result:

- `plan.commands[]` shows what the user or local host would run.
- `safety.requiresApprovalBeforeWrite` is `true`.
- `safety.metadataIsInstruction` is `false`.
- `plan.commandDetails[].hostedApiExecutes` is `false`.
- blocked or risky commands are marked before execution.

## 5. Agent rule

Give this rule to an agent:

```text
Before installing a package, cloning a repo, using a model, enabling an MCP server or running package-provided commands, call Nipmod search, inspect and install-plan. Show source identity, trust signals, warnings and the install boundary. Do not execute until the user or host policy approves locally.
```

## 6. Optional archive feedback

Only after a result was useful and approved, prepare a dry-run archive confirmation:

```sh
curl -fsS 'https://nipmod.com/api/archive/prepare?source=npm&name=react-hook-form' \
  -H 'x-nipmod-api-key: <key>'
```

Archive writes are not automatic. Durable confirmation requires an authorized server writer and rejects blocked, unknown or high-risk records.

## 7. Hosted MCP

Hosted MCP uses the same read-only boundary:

```sh
curl -fsS https://nipmod.com/api/mcp \
  -H 'content-type: application/json' \
  -H 'x-nipmod-api-key: <key>' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"nipmod.search","arguments":{"query":"react forms validation","sources":["npm","github"]}}}'
```

## Optional local CLI

The CLI is optional. Use it when you need local static scans or workspace-aware commands:

```sh
curl https://nipmod.com/i|bash
nipmod doctor --online
nipmod deep-scan <path> --json
```

Local workspace writes remain local and approval-gated. The hosted API stays read-only.
