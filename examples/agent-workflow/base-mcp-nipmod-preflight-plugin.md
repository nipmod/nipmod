# Base MCP plus Nipmod preflight

This is a draft pattern for Base-focused agents and skills.

It is not an official Base MCP plugin listing. It is an instruction layer that tells the assistant to inspect external tooling with Nipmod before enabling it.

## Stop condition

Before installing or enabling a Base ecosystem SDK, CLI, MCP server, repo, package or paid API client, run Nipmod preflight.

Do not install, clone, execute, enable or pay for external tooling until the user or host approves the install plan.

## Read-only preflight

Issue or load a Nipmod API key:

```text
POST https://nipmod.com/api/keys/beta
```

Search for the exact tool:

```text
GET https://nipmod.com/api/search?q=<query>&sources=npm,pypi,github,huggingface-model,huggingface-dataset,mcp&limit=5
Header: x-nipmod-api-key: <key>
```

Inspect the selected source record:

```text
GET https://nipmod.com/api/inspect?source=<source>&name=<name>
Header: x-nipmod-api-key: <key>
```

Request an install plan:

```text
GET https://nipmod.com/api/install-plan?source=<source>&name=<name>
Header: x-nipmod-api-key: <key>
```

## Continue to Base MCP

After the install plan is approved, continue with Base MCP or the protocol-specific skill.

Nipmod does not prepare unsigned calldata, call `send_calls`, sign transactions, hold wallet keys or create Base Account approval links.

## Assistant instruction

When a Base workflow requires new external tooling, search and inspect through Nipmod first. Show the user the exact source, trust decision, warnings and command boundary. Continue only after explicit approval.
