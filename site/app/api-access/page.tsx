import { createPageMetadata } from "../metadata";
import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";

export const metadata = createPageMetadata({
  description: "Nipmod API endpoints for agent package search, inspection, install planning and MCP access.",
  path: "/api-access",
  title: "Nipmod API"
});

const prompt = `Before adding a dependency, use Nipmod.
Call search, inspect the selected record and return the install plan before changing the workspace.`;

const coreCalls = `curl 'https://nipmod.com/api/search?q=http%20client&limit=3'
curl 'https://nipmod.com/api/inspect?source=npm&name=undici'
curl 'https://nipmod.com/api/install-plan?source=npm&name=undici'`;

export default function ApiAccessPage() {
  return (
    <DocsShell
      description="The hosted API is the main product surface. Agents call it before dependency selection, package installation or model/tool setup."
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

      <DocsSection title="Three calls">
        <DocsCode>{coreCalls}</DocsCode>
      </DocsSection>

      <DocsSection title="Endpoints">
        <DocsTable
          rows={[
            {
              first: "Search",
              second: <code>GET /api/search?q=&lt;query&gt;&amp;sources=&lt;sources&gt;&amp;limit=5</code>,
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
              third: "Previews a reusable record after useful discovery."
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
          <DocsCard label="npm" title="HTTP client">
            <DocsCode>{"curl 'https://nipmod.com/api/search?q=http%20client&sources=npm,pypi&limit=3'\ncurl 'https://nipmod.com/api/inspect?source=npm&name=undici'\ncurl 'https://nipmod.com/api/install-plan?source=npm&name=undici'"}</DocsCode>
          </DocsCard>
          <DocsCard label="PyPI" title="Python requests">
            <DocsCode>{"curl 'https://nipmod.com/api/inspect?source=pypi&name=requests'\ncurl 'https://nipmod.com/api/install-plan?source=pypi&name=requests'"}</DocsCode>
          </DocsCard>
          <DocsCard label="model" title="Hugging Face">
            <DocsCode>{"curl 'https://nipmod.com/api/inspect?source=huggingface-model&name=google-bert/bert-base-uncased'\ncurl 'https://nipmod.com/api/install-plan?source=huggingface-model&name=google-bert/bert-base-uncased'"}</DocsCode>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection title="Safety boundary">
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
