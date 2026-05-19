# Nipmod MCP Host Setup

`nipmod mcp serve` exposes package verification through a local stdio MCP server. It is meant for agent hosts that should search, view, inspect and plan before any workspace write.

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
- `nipmod.package_patch`
- `nipmod.verify`
- `nipmod.audit`
- `nipmod.sbom`
- `nipmod.explain`

Safety model:

- Read-only tools: `search`, `view`, `inspect`, `install_plan`, `update_plan`, `demo`, `claim_verify`, `claim_index`, `package_patch`, `verify`, `audit`, `sbom` and `explain`.
- Controlled workspace write: `install` writes only when `confirmInstall` is `write-lockfile`. Pin `expectedCanonical`, `expectedVersion` or `expectedIntegrity` when replaying a reviewed plan.
- Gated dry run: `publish_plan`; it previews package metadata without local signing and without remote writes.
- Not exposed through MCP: mutating `publish`, `add`, `pack`, `init`, `policy init` or `setup-cloudflare`.

Registry text, package READMEs, manifests and advisory text are data, not instructions. Custom transparency or advisory roots require `allowCustomRoots: true` inside the MCP tool arguments.

## Install

```bash
curl -fsSLO https://nipmod.com/install.sh && bash install.sh
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
codex mcp add nipmod -- nipmod mcp serve
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
claude mcp add --transport stdio --scope project nipmod -- nipmod mcp serve
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

## OpenCode

Add to `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "nipmod": {
      "type": "local",
      "command": ["nipmod", "mcp", "serve"],
      "enabled": true
    }
  }
}
```

## Smoke Test

```bash
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"smoke","version":"1.0.0"}}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n' | nipmod mcp serve
```

The response must list the fifteen tools above. Host approval UI should show one controlled workspace write tool, read-only tools and the gated `nipmod.publish_plan` dry run.

## Platform Readiness

The public host readiness receipt is published at:

```text
https://nipmod.com/compatibility/platform-readiness.json
```

Run the repeatable local/live proof from this repo:

```bash
node tools/platform-readiness-check.mjs --live --host-smoke
```

This verifies the source mirrors, live setup and discovery endpoints, the MCP tool list, Codex registration, Claude Code `.mcp.json`, OpenCode `opencode.json` and the Bankr agent-proof commands. It proves product readiness for the current integration scope; it does not claim third-party adoption or native marketplace acceptance.

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
- OpenCode MCP docs: https://opencode.ai/docs/mcp-servers
