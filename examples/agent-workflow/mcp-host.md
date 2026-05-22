# MCP Host Example

The hosted MCP endpoint is read-only and mirrors the public package intelligence surface.

Endpoint:

```text
https://nipmod.com/api/mcp
```

List tools:

```bash
curl -s https://nipmod.com/api/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Search:

```bash
curl -s https://nipmod.com/api/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"nipmod.resolve","arguments":{"query":"react","sources":["npm","pypi","github","mcp"],"limit":5}}}'
```

Install plan:

```bash
curl -s https://nipmod.com/api/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"nipmod.external_install_plan","arguments":{"source":"npm","name":"undici"}}}'
```

Boundary:

- Hosted MCP does not read local files.
- Hosted MCP does not write into a workspace.
- Local execution still needs user approval or host policy approval.
