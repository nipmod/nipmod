import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";
import { createPageMetadata } from "../metadata";

export const metadata = createPageMetadata({
  description: "Use Nipmod through hosted read only MCP or a local MCP server for controlled workspace writes.",
  path: "/mcp",
  title: "Nipmod MCP"
});

export default function McpPage() {
  return (
    <DocsShell
      description="The hosted MCP endpoint exposes the same package intelligence as the HTTP API. It is read only and does not touch the caller workspace."
      eyebrow="MCP"
      stats={[
        { label: "Endpoint", value: "/api/mcp" },
        { label: "Mode", value: "read only" },
        { label: "Hosted writes", value: "none" }
      ]}
      title="MCP access."
    >
      <DocsSection eyebrow="Endpoint" title="Hosted read only MCP">
        <DocsCode>{"POST https://nipmod.com/api/mcp with x-nipmod-api-key"}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Tools" title="Public tools">
        <DocsTable
          rows={[
            ["nipmod.search", "Search public package sources."],
            ["nipmod.resolve", "Resolve candidates with normalized metadata."],
            ["nipmod.inspect", "Inspect one exact package record."],
            ["nipmod.external_install_plan", "Return a reviewable install plan without writing."],
            ["nipmod.demo", "Run a small read only demo response."]
          ]}
        />
      </DocsSection>

      <DocsSection eyebrow="Examples" title="JSON RPC calls">
        <DocsGrid>
          <DocsCard label="tools/list" title="List tools">
            <DocsCode>{'curl -fsS https://nipmod.com/api/mcp -H "content-type: application/json" -H "x-nipmod-api-key: <key>" -d \'{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}\''}</DocsCode>
          </DocsCard>
          <DocsCard label="tools/call" title="Search">
            <DocsCode>{'curl -fsS https://nipmod.com/api/mcp -H "content-type: application/json" -H "x-nipmod-api-key: <key>" -d \'{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"nipmod.search","arguments":{"query":"http client","limit":3}}}\''}</DocsCode>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection eyebrow="Local" title="Use local MCP only for workspace actions">
        <DocsCode>{"curl https://nipmod.com/i|bash\nnipmod mcp serve"}</DocsCode>
      </DocsSection>
    </DocsShell>
  );
}
