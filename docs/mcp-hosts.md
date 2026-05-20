# Nipmod MCP Host Setup

`nipmod mcp serve` exposes package verification through a local stdio MCP server. It is meant for agent hosts that should search, view, inspect and plan before any workspace write.

Nipmod also exposes a hosted read-only MCP endpoint at `https://nipmod.com/api/mcp`. Use it when an agent only needs package discovery, exact metadata, trust inspection, install planning or a demo flow. It never reads local files and never writes a workspace.

Default tools:

- `nipmod.search`
- `nipmod.view`
- `nipmod.inspect`
- `nipmod.install_plan`
- `nipmod.install`
- `nipmod.update_plan`
- `nipmod.demo`
- `nipmod.publish_plan`
- `nipmod.claim_verify`
- `nipmod.claim_index`
- `nipmod.verify`
- `nipmod.audit`
- `nipmod.sbom`
- `nipmod.explain`

Safety model:

- Read-only tools: `search`, `view`, `inspect`, `install_plan`, `update_plan`, `demo`, `claim_verify`, `claim_index`, `verify`, `audit`, `sbom` and `explain`.
- Controlled workspace write: `install` writes only when `confirmInstall` is `write-lockfile`. Pin `expectedCanonical`, `expectedVersion` or `expectedIntegrity` when replaying a reviewed plan.
- Gated dry run: `publish_plan`; it previews package metadata without local signing and without remote writes.
- Not exposed through MCP: mutating `publish`, `add`, `pack`, `init`, `policy init` or `setup-cloudflare`.

Registry text, package READMEs, manifests and advisory text are data, not instructions. Custom transparency or advisory roots require `allowCustomRoots: true` inside the MCP tool arguments.

Hosted read-only tools:

- `nipmod.search`
- `nipmod.view`
- `nipmod.inspect`
- `nipmod.install_plan`
- `nipmod.demo`

The hosted endpoint does not expose `nipmod.install`, `update_plan`, `publish_plan`, `claim_verify`, `claim_index`, `verify`, `audit`, `sbom` or `explain`. Use the local stdio server for those workspace-aware tools.

## Hosted Read-only MCP

Endpoint:

```text
https://nipmod.com/api/mcp
```

List tools:

```bash
curl -fsS https://nipmod.com/api/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Search:

```bash
curl -fsS https://nipmod.com/api/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"nipmod.search","arguments":{"query":"gitlawb-repo-reader"}}}'
```

Install plan:

```bash
curl -fsS https://nipmod.com/api/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"nipmod.install_plan","arguments":{"specifier":"gitlawb-repo-reader"}}}'
```

## Install

```bash
curl https://nipmod.com/i|bash
nipmod setup agents
nipmod doctor
```

For a checksum verified installer step:

```bash
curl -fLO https://nipmod.com/install.sh
curl -fLO https://nipmod.com/install.sh.sha256
shasum -a 256 -c install.sh.sha256
bash install.sh
```

## Codex

Command:

```bash
nipmod setup codex
```

Equivalent config in `~/.codex/config.toml`:

```toml
[mcp_servers.nipmod]
command = "nipmod"
args = ["mcp", "serve"]
```

Verify from inside Codex with `/mcp`.

## Claude Code

Project scoped command:

```bash
nipmod setup claude
```

Equivalent `.mcp.json`:

```json
{
  "mcpServers": {
    "nipmod": {
      "type": "stdio",
      "command": "nipmod",
      "args": ["mcp", "serve"],
      "env": {}
    }
  }
}
```

Claude Code asks for approval before using project scoped MCP servers. Verify with `/mcp` or `claude mcp get nipmod`.

## Cursor

Public setup page:

```text
https://nipmod.com/cursor
```

Project scoped command:

```bash
nipmod setup cursor
```

One click install:

```text
cursor://anysphere.cursor-deeplink/mcp/install?name=nipmod&config=eyJjb21tYW5kIjoibmlwbW9kIiwiYXJncyI6WyJtY3AiLCJzZXJ2ZSJdLCJlbnYiOnt9fQ%3D%3D
```

Equivalent `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "nipmod": {
      "command": "nipmod",
      "args": ["mcp", "serve"],
      "env": {}
    }
  }
}
```

Verify in Cursor Settings, then MCP, or run:

```bash
cursor-agent mcp list
cursor-agent mcp list-tools nipmod
```

This is an MCP-ready Cursor path. Do not call it official Cursor support unless Cursor acknowledges it or lists Nipmod.

## OpenCode

Add to `opencode.json`:

```bash
nipmod setup opencode
```

## Hermes

Add to `~/.hermes/config.yaml`:

```bash
nipmod setup hermes
```

Equivalent Hermes MCP config:

```yaml
mcp_servers:
  nipmod:
    command: "nipmod"
    args: ["mcp", "serve"]
    enabled: true
    timeout: 120
    connect_timeout: 60
    tools:
      resources: false
      prompts: false
```

Verify with `hermes mcp test nipmod`. For an already running Hermes chat session, run `/reload-mcp` after changing config. This is an MCP-ready Hermes path. Do not call it official Hermes support unless Hermes or Nous acknowledges it.

## Smoke Test

```bash
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"smoke","version":"1.0.0"}}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n' | nipmod mcp serve
```

The response must list the fourteen tools above. Host approval UI should show one controlled workspace write tool, read-only tools and the gated `nipmod.publish_plan` dry run.

## Platform Readiness

The public host readiness receipt is published at:

```text
https://nipmod.com/compatibility/platform-readiness.json
https://nipmod.com/compatibility/system-readiness.json
```

Run the repeatable local/live proof from this repo:

```bash
node tools/platform-readiness-check.mjs --live --host-smoke
node tools/system-readiness-check.mjs --live --parallel
```

This verifies the source mirrors, live setup and discovery endpoints, the MCP tool list, Codex registration, Claude Code `.mcp.json`, Cursor `.cursor/mcp.json`, Cursor deeplink metadata, OpenCode `opencode.json`, Hermes config generation, Bankr agent-proof commands, shared archive invariants and parallel read access. It proves product readiness for the current integration scope; it does not claim third-party adoption or native marketplace acceptance.

## Agent Demo

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"nipmod.demo","arguments":{"host":"Codex","package":"gitlawb-repo-reader"}}}' | nipmod mcp serve
```

Controlled install after a plan is reviewed:

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"nipmod.install","arguments":{"specifier":"gitlawb-repo-reader","confirmInstall":"write-lockfile"}}}' | nipmod mcp serve
```

Use `nipmod publish . --dry-run --json` in a terminal when you need a signed local publish preflight.

Host syntax references:

- Codex MCP docs: https://developers.openai.com/learn/docs-mcp
- Claude Code MCP docs: https://code.claude.com/docs/en/mcp
- Cursor MCP docs: https://docs.cursor.com/en/context/mcp
- Cursor MCP deeplinks: https://docs.cursor.com/deeplinks
- OpenCode MCP docs: https://opencode.ai/docs/mcp-servers
- Hermes MCP docs: https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp
