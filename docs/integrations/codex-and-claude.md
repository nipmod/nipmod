# Nipmod for Codex and Claude Code

Nipmod can be used by agent hosts through MCP.

## Codex

Codex users should add the Nipmod repo marketplace and install the plugin:

```bash
codex plugin marketplace add nipmod/nipmod --ref main
codex plugin add nipmod@nipmod
codex mcp get nipmod --json
```

Start a new Codex session after installing so the MCP tool list is loaded. Hosted MCP works read-only without a key. REST API calls and higher limits require `NIPMOD_API_KEY`.

```bash
export NIPMOD_API_KEY="$(curl -fsS -X POST https://nipmod.com/api/keys/beta | python3 -c 'import json,sys; print(json.load(sys.stdin)["key"])')"
```

Smoke test:

```bash
codex mcp get nipmod --json
```

Expected:

- transport is `streamable_http`
- URL is `https://nipmod.com/api/mcp`
- `nipmod.codex_preflight`, `nipmod.install_guard` and `nipmod.package_decision` are enabled
- `bearer_token_env_var` is absent by default so the plugin works without `NIPMOD_API_KEY`
- `NIPMOD_API_KEY` is used only for direct REST calls or manually configured higher-limit MCP setups where the environment variable is definitely present

Codex behavior:

- trigger before package, SDK, CLI, repository, model, dataset, container, extension or MCP-server choices
- read safe local manifest context first
- send only stack/runtime/package-manager/risk summaries to hosted Nipmod
- show a compact decision card before raw evidence
- read `approvalGate`, `approvalPacket`, `actionPlan` and `agentHandoff` before continuing
- require explicit approval before dependency writes
- use pinned install commands when the decision provides them

Demo prompt:

```text
Find the best auth package for this Next.js repo and show the Nipmod install boundary before changing anything.
```

Install-guard prompt:

```text
Before installing anything, use Nipmod to choose a safe PDF parser for this Python backend.
```

Concrete command guard:

```text
Before running npm install zod, use Nipmod install guard and show the approval packet.
```

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
