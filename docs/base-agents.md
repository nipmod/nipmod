# Nipmod for Base agents

Status: implementation path, not an official Base listing

Base MCP gives agents a wallet and an onchain action surface. Nipmod sits before package and tool adoption. It helps agents inspect SDKs, CLIs, MCP servers, source repositories and packages before a workspace is changed.

## Current Base context

Base is pushing agents through:

- Base MCP for wallet and ecosystem actions
- Base Account approval links for user confirmation
- x402 for paid services
- agent identity and reputation standards
- skill plugins for ecosystem protocols
- Builder Codes for onchain attribution

Nipmod has registered a Base Builder Code for future attribution:

```text
bc_vu9r71xi
0x62635f76753972373178690b0080218021802180218021802180218021
```

The current hosted API does not append the code because it does not build, sign or submit transactions.

This makes package and tool trust more important. If an agent can act onchain, it also needs a clean way to decide which tooling it should install or enable before acting.

## Nipmod role

Nipmod should be positioned as package intelligence preflight:

1. agent needs tooling
2. agent searches Nipmod
3. agent inspects the exact source
4. agent gets trust signals and install plan
5. user or host approves any workspace write
6. only then should the agent continue with Base MCP, x402 or protocol work

## Non-goals

Do not claim:

- official Base approval
- native Base MCP listing
- wallet custody
- transaction signing
- live onchain transaction attribution from the hosted API
- guaranteed safe packages

## Product work

- Public page: `https://nipmod.com/base-agents`
- Machine-readable preflight: `https://nipmod.com/base-agent-preflight.json`
- Agent prompt pack: `https://nipmod.com/agent-prompts.json`
- Draft workflow: `examples/agent-workflow/base-agent-package-preflight.md`
- Plugin boundary draft: `examples/agent-workflow/base-mcp-nipmod-preflight-plugin.md`
- Builder Code runbook: `docs/base-builder-code-runbook.md`
- Discovery manifest: include the Base agent preflight page for agent crawlers
- Public copy: keep the claim at "building for Base agents" until Base confirms a listing or integration

## Public copy line

Base MCP helps agents act onchain. Nipmod helps agents decide which tools to trust before they install or enable them.
