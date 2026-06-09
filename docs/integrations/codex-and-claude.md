# Nipmod for Codex and Claude Code

Nipmod can be used by agent hosts through MCP.

## Codex

Codex users should add the Nipmod repo marketplace and install the plugin:

```bash
codex plugin marketplace add nipmod/nipmod --ref main
codex plugin add nipmod@nipmod
```

Hosted MCP works read-only without a key. For higher limits or account-scoped usage, set:

```bash
export NIPMOD_API_KEY="$(curl -fsS -X POST https://nipmod.com/api/keys/beta | python3 -c 'import json,sys; print(json.load(sys.stdin)["key"])')"
```

Example prompt:

```text
@nipmod find the best package for auth in a Next.js app. Show trust, risk, alternatives and install boundary.
```

The plugin includes:

- a Codex skill that triggers before package/tool/model installs
- a hosted read-only MCP server config
- a compact decision-card response format for Codex chat

## Claude Code

Claude Code users can copy `docs/integrations/claude-code-mcp.json` into their project `.mcp.json`. Set a key only when higher limits or account-scoped usage are needed:

```bash
export NIPMOD_API_KEY="$(curl -fsS -X POST https://nipmod.com/api/keys/beta | python3 -c 'import json,sys; print(json.load(sys.stdin)["key"])')"
```

Recommended Claude prompt:

```text
Use the nipmod MCP server before choosing or installing packages. Search, inspect trust, show risk and install boundary, and wait for approval before running local package manager commands.
```

## Host boundary

Hosted Nipmod MCP is read-only:

- can search package sources
- can inspect trust evidence
- can produce package decisions
- can produce install plans
- cannot write files
- cannot run package managers
- cannot install packages

Local writes remain the user's explicit decision inside Codex or Claude Code.
