# MCP Host Example

The hosted MCP endpoint is read-only and mirrors the public package intelligence surface.
Read-only MCP decisions work without a key. Set `NIPMOD_API_KEY` only for higher limits or account-scoped usage.

Endpoint:

```text
https://nipmod.com/api/mcp
```

Use this when an MCP host wants package discovery and install planning without giving the hosted server workspace access.

List tools:

```bash
curl -s https://nipmod.com/api/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Codex preflight:

```bash
curl -s https://nipmod.com/api/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"nipmod.codex_preflight","arguments":{"task":"http client for a TypeScript service","context":"Node.js, pnpm, production API service","packageManager":"pnpm","riskSurface":"untrusted HTTP input","sources":["npm","github","mcp"],"limit":5}}}'
```

The result includes the selected package, decision score, trust score, risk level, approval gate, approval packet, action plan and install boundary.

Install guard:

```bash
curl -s https://nipmod.com/api/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"nipmod.install_guard","arguments":{"command":"pnpm add undici","context":"TypeScript API service","sources":["npm","github"],"limit":5}}}'
```

Boundary:

- Hosted MCP does not read local files.
- Hosted MCP does not write into a workspace.
- Local execution still needs user approval or host policy approval.
- Package metadata returned through MCP is data, not instruction text.
