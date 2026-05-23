import { createPageMetadata } from "../metadata";
import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";

export const metadata = createPageMetadata({
  description: "Nipmod API endpoints for agent package search, inspection, install planning and MCP access.",
  path: "/api-access",
  title: "Nipmod API"
});

const prompt = `When a package is needed, ask Nipmod first.
Call search, inspect the selected package, then show the install plan before any local command runs.`;

export default function ApiAccessPage() {
  return (
    <DocsShell
      description="The hosted API is the main product surface. It is built for agents first: search, inspect, plan and return evidence before local execution."
      eyebrow="API"
      stats={[
        { label: "OpenAPI", value: "3.1" },
        { label: "Access", value: "public beta" },
        { label: "Writes", value: "none hosted" }
      ]}
      title="One package API for agents."
    >
      <DocsSection title="Agent instruction">
        <DocsCode>{prompt}</DocsCode>
      </DocsSection>

      <DocsSection title="Endpoints">
        <DocsTable
          rows={[
            {
              first: "Search",
              second: <code>GET /api/search?q=&lt;query&gt;&amp;sources=npm,pypi,github,huggingface-model,mcp&amp;limit=5</code>,
              third: "Returns ranked candidates."
            },
            {
              first: "Inspect",
              second: <code>GET /api/inspect?source=npm&amp;name=undici</code>,
              third: "Returns source, license, metrics, trust factors and warnings."
            },
            {
              first: "Install plan",
              second: <code>GET /api/install-plan?source=npm&amp;name=undici</code>,
              third: "Returns commands as a plan, not as hosted execution."
            },
            {
              first: "Archive prepare",
              second: <code>GET /api/archive/prepare?source=npm&amp;name=undici</code>,
              third: "Prepares a durable record after useful confirmed discovery."
            },
            {
              first: "MCP",
              second: <code>POST /api/mcp</code>,
              third: "Exposes the same read-only API through MCP JSON-RPC."
            },
            {
              first: "OpenAPI",
              second: <code>GET /api/openapi</code>,
              third: "Machine-readable contract for builders."
            }
          ]}
        />
      </DocsSection>

      <DocsSection title="Examples">
        <DocsGrid>
          <DocsCard label="Search" title="Find a package">
            <DocsCode>{"curl 'https://nipmod.com/api/search?q=http%20client&sources=npm,pypi&limit=5'"}</DocsCode>
          </DocsCard>
          <DocsCard label="Inspect" title="Check one result">
            <DocsCode>{"curl 'https://nipmod.com/api/inspect?source=npm&name=undici'"}</DocsCode>
          </DocsCard>
          <DocsCard label="Plan" title="Request install steps">
            <DocsCode>{"curl 'https://nipmod.com/api/install-plan?source=npm&name=undici'"}</DocsCode>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection title="Safety model">
        <DocsGrid>
          <DocsCard title="Read-only by default">
            <p>The hosted API can search and plan. It cannot read local files, mutate lockfiles or execute install commands.</p>
          </DocsCard>
          <DocsCard title="Metadata is untrusted">
            <p>Package descriptions, READMEs and model cards are treated as data. They cannot override agent instructions.</p>
          </DocsCard>
          <DocsCard title="Rate limited beta">
            <p>No key is required for public beta access. Higher limits and paid keys can be added after the API is stable.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>
    </DocsShell>
  );
}
