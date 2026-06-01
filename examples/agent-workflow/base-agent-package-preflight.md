# Nipmod package preflight for Base agents

Status: draft integration path, not an official Base listing

Use this when an agent building around Base MCP, x402, Base Account or Base ecosystem tooling is about to install or enable a package, SDK, CLI, MCP server or source repository.

## Purpose

Base MCP gives agents a wallet and onchain action surface.

Nipmod gives agents a package intelligence preflight before they add the tooling used to reach those actions.

## Boundary

Nipmod does not:

- replace Base MCP
- hold wallet keys
- authenticate Base Account
- create wallet approval links
- sign transactions
- execute installs from the hosted API

Nipmod does:

- search package sources
- inspect source-owned package records
- return trust signals and warnings
- return install plans as review data
- keep hosted API calls read-only

## Agent instruction

```text
Before installing or enabling Base ecosystem tooling, use Nipmod.

Search for the package, SDK, CLI, MCP server or repo.
Inspect the exact record from the source.
Request an install plan.
Show the source, version, license, trust decision, warnings and command.
Do not write files, install dependencies or enable tools until the user approves.
After approval, continue with the Base MCP, x402 or protocol-specific workflow.
```

## HTTP flow

```bash
curl -fsS 'https://nipmod.com/api/search?q=base%20agent%20sdk&sources=npm,pypi,github,mcp&limit=5' \
  -H 'x-nipmod-api-key: <key>'

curl -fsS 'https://nipmod.com/api/inspect?source=npm&name=<package-name>' \
  -H 'x-nipmod-api-key: <key>'

curl -fsS 'https://nipmod.com/api/install-plan?source=npm&name=<package-name>' \
  -H 'x-nipmod-api-key: <key>'
```

## Decision handling

| Nipmod result | Agent behavior |
| --- | --- |
| `recommended` | Show the plan and wait for approval before install. |
| `usable_with_warning` | Show warnings clearly and require explicit approval. |
| `avoid` | Do not install. Ask for another candidate. |
| blocked install plan | Stop the package workflow. Do not continue to Base actions with that tool. |

## Public wording

Safe wording:

- Nipmod is building a package intelligence preflight for Base agents.
- Nipmod can help agents inspect SDKs, CLIs, MCP servers and packages before install.
- Nipmod is read-only when hosted and does not touch user workspaces.

Avoid wording:

- official Base integration
- Base approved
- Base listed
- Base MCP native plugin
- wallet security guarantee

