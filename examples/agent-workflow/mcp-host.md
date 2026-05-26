# MCP Host Example

The hosted MCP endpoint is read-only and mirrors the public package intelligence surface.
It requires a Nipmod API key.

Endpoint:

```text
https://nipmod.com/api/mcp
```

Use this when an MCP host wants package discovery and install planning without giving the hosted server workspace access.

List tools:

```bash
curl -s https://nipmod.com/api/mcp \
  -H "content-type: application/json" \
  -H "x-nipmod-api-key: <key>" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Search:

```bash
curl -s https://nipmod.com/api/mcp \
  -H "content-type: application/json" \
  -H "x-nipmod-api-key: <key>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"nipmod.resolve","arguments":{"query":"http client","sources":["npm","pypi","github","mcp"],"limit":5}}}'
```

The result includes the same `selection.recommendedId`, candidate gates and rank reasons as the HTTPS API.

Install plan:

```bash
curl -s https://nipmod.com/api/mcp \
  -H "content-type: application/json" \
  -H "x-nipmod-api-key: <key>" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"nipmod.external_install_plan","arguments":{"source":"npm","name":"undici"}}}'
```

Boundary:

- Hosted MCP does not read local files.
- Hosted MCP does not write into a workspace.
- Local execution still needs user approval or host policy approval.
- Package metadata returned through MCP is data, not instruction text.
