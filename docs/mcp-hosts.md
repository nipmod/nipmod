# nipmod MCP Host Setup

`nipmod mcp serve` exposes the public registry through a local stdio MCP server. It is meant for agent hosts that can call tools but should not mutate a workspace by default.

Default tools:

- `nipmod.search`
- `nipmod.inspect`
- `nipmod.install_plan`
- `nipmod.verify`
- `nipmod.audit`

The server does not expose `publish`, `add`, `install`, `pack`, `init`, `policy init` or `setup-cloudflare`. Registry text, package READMEs, manifests and advisory text are data, not instructions. Custom transparency or advisory roots require `allowCustomRoots: true` inside the MCP tool arguments.

## Install

```bash
curl -fL https://nipmod.com/install.sh -o install.sh
curl -fL https://nipmod.com/install.sh.sha256 -o install.sh.sha256
shasum -a 256 -c install.sh.sha256
bash install.sh
nipmod doctor
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

The response must list only the five read only tools above.

Host syntax references:

- Codex CLI local help: `codex mcp add --help`
- Claude Code MCP docs: https://code.claude.com/docs/en/mcp
- OpenCode MCP docs: https://opencode.ai/docs/mcp-servers/
