import { createPageMetadata } from "../metadata";
import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";

export const metadata = createPageMetadata({
  description: "Nipmod API endpoints for agent package search, inspection, install planning and MCP access.",
  path: "/api-access",
  title: "Nipmod API"
});

const prompt = `When choosing a package, use Nipmod first.
Search, inspect the selected record, request the install plan and show it before changing the workspace.`;

const coreCalls = `curl 'https://nipmod.com/api/search?q=http%20client&limit=3'
curl 'https://nipmod.com/api/inspect?source=npm&name=undici'
curl 'https://nipmod.com/api/install-plan?source=npm&name=undici'`;

const clientExamples = `node --experimental-strip-types examples/http-api/agent-flow.ts "http client"
python3 examples/http-api/agent_flow.py "http client"
curl 'https://nipmod.com/api/openapi'`;

const mcpCall = `curl -s https://nipmod.com/api/mcp \\
  -H 'content-type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;

export default function ApiAccessPage() {
  return (
    <DocsShell
      description="Agents call Nipmod before they choose dependencies, install packages, select models or add MCP tools."
      eyebrow="API"
      stats={[
        { label: "OpenAPI", value: "3.1" },
        { label: "Beta", value: "free, rate limited" },
        { label: "Hosted writes", value: "0" }
      ]}
      toc={[
        { href: "#beta-contract", label: "Beta contract" },
        { href: "#use-from-any-agent", label: "Use from any agent" },
        { href: "#three-calls", label: "Three calls" },
        { href: "#endpoints", label: "Endpoints" },
        { href: "#safety-boundary", label: "Safety boundary" }
      ]}
      title="One package API for agents."
    >
      <DocsSection title="Beta contract">
        <DocsGrid>
          <DocsCard title="Public access">
            <p>No API key is required during public beta. Requests are limited to keep the public service reliable.</p>
          </DocsCard>
          <DocsCard title="Public contract">
            <p>Search, Inspect, Install Plan and OpenAPI are the calls agents should build against first.</p>
          </DocsCard>
          <DocsCard title="Archive boundary">
            <p>Archive prepare is a preview. Durable confirmation is limited to authorized server writers and checks source data again.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection title="Use from any agent">
        <DocsGrid>
          <DocsCard label="1" title="Search">
            <p>Find candidates across npm, PyPI, GitHub, Hugging Face and MCP.</p>
          </DocsCard>
          <DocsCard label="2" title="Inspect">
            <p>Read one exact record with source context, license, warnings and trust factors.</p>
          </DocsCard>
          <DocsCard label="3" title="Plan">
            <p>Return commands for review. The hosted API never executes them.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection title="Agent instruction">
        <DocsCode>{prompt}</DocsCode>
      </DocsSection>

      <DocsSection title="Three calls">
        <DocsCode>{coreCalls}</DocsCode>
      </DocsSection>

      <DocsSection title="Client examples">
        <DocsGrid>
          <DocsCard label="TS" title="TypeScript agent flow">
            <p>Runs search, inspect and install-plan against the public API with no local workspace writes.</p>
          </DocsCard>
          <DocsCard label="PY" title="Python agent flow">
            <p>Same contract for Python-based agents or automation hosts.</p>
          </DocsCard>
          <DocsCard label="API" title="OpenAPI contract">
            <p>Use the live contract for generated clients, tool schemas and host-side validation.</p>
          </DocsCard>
        </DocsGrid>
        <DocsCode>{clientExamples}</DocsCode>
      </DocsSection>

      <DocsSection title="Endpoints">
        <DocsTable
          rows={[
            {
              first: "Search",
              second: <code>GET /api/search?q=&lt;query&gt;&amp;sources=&lt;sources&gt;&amp;limit=5</code>,
              third: "Returns ranked candidates from supported sources."
            },
            {
              first: "Inspect",
              second: <code>GET /api/inspect?source=npm&amp;name=undici</code>,
              third: "Returns source context, license, metrics, trust factors and warnings."
            },
            {
              first: "Install plan",
              second: <code>GET /api/install-plan?source=npm&amp;name=undici</code>,
              third: "Returns commands for approval, not hosted execution."
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
              third: "API contract for builders and agent hosts."
            }
          ]}
        />
      </DocsSection>

      <DocsSection title="What the agent should show">
        <DocsTable
          rows={[
            {
              first: "Selection",
              second: "Recommended candidate, gate status and rank reasons.",
              third: "Search is a shortlist, not approval to install."
            },
            {
              first: "Trust",
              second: "Score, decision, risk, security confidence, warnings and top factors.",
              third: "Popularity is separated from security evidence."
            },
            {
              first: "Install plan",
              second: "Command, source, package/version, risk and approval boundary.",
              third: "Commands are shown for review only."
            },
            {
              first: "Archive",
              second: "Preview a reusable record after useful discovery.",
              third: "Durable writes require an authorized server path."
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
          <DocsCard label="MCP" title="Hosted read-only MCP">
            <DocsCode>{mcpCall}</DocsCode>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection title="Safety boundary">
        <DocsGrid>
          <DocsCard title="Read only by default">
            <p>The hosted API can search and plan. It cannot read local files, change lockfiles or execute install commands.</p>
          </DocsCard>
          <DocsCard title="Metadata is untrusted">
            <p>Package descriptions, READMEs and model cards are treated as data. They cannot override agent instructions.</p>
          </DocsCard>
          <DocsCard title="Rate limited beta">
            <p>No key is required for public beta access. Higher limits and paid keys can be added after the API is stable.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection title="Builder links">
        <DocsTable
          rows={[
            {
              first: "OpenAPI",
              second: <code>https://nipmod.com/api/openapi</code>,
              third: "Use this for generated clients and agent tool schemas."
            },
            {
              first: "Source health",
              second: <code>https://nipmod.com/api/sources/health</code>,
              third: "Check source, archive and rate-limit status."
            },
            {
              first: "Examples",
              second: <code>https://github.com/nipmod/nipmod/tree/main/examples/http-api</code>,
              third: "Copyable HTTPS examples for any agent host."
            },
            {
              first: "Agent prompts",
              second: <code>https://github.com/nipmod/nipmod/tree/main/examples/agent-workflow</code>,
              third: "Short host prompts that tell agents to use Search, Inspect and Install Plan."
            },
            {
              first: "Trust scoring",
              second: <code>https://github.com/nipmod/nipmod/blob/main/docs/api/trust-scoring.md</code>,
              third: "Public explanation of scores, thresholds and policy gates."
            }
          ]}
        />
      </DocsSection>
    </DocsShell>
  );
}
