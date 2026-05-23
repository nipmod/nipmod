import Link from "next/link";
import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "./docs-shell";

const agentInstruction = `Use Nipmod before choosing packages.
Search candidates, inspect trust factors and return the install plan before running anything locally.`;

export default function Home() {
  return (
    <DocsShell
      description="One hosted API for agents to search package sources, inspect trust signals and request safe install plans before code touches a workspace."
      eyebrow="Overview"
      stats={[
        { label: "Sources", value: "6 live" },
        { label: "Hosted API", value: "read-only" },
        { label: "Beta", value: "free, rate limited" }
      ]}
      title="The package layer for AI agents."
    >
      <DocsSection title="How it works">
        <DocsGrid>
          <DocsCard label="1" title="Agent asks">
            <p>A user tells an agent what they need. The agent calls Nipmod instead of guessing a dependency from memory.</p>
          </DocsCard>
          <DocsCard label="2" title="Nipmod resolves">
            <p>Nipmod searches supported public sources and normalizes the result into one agent-readable package record.</p>
          </DocsCard>
          <DocsCard label="3" title="Agent plans">
            <p>The API returns source context, trust signals and an install plan. Hosted calls never write to the workspace.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection title="Use it from any agent">
        <DocsCode>{agentInstruction}</DocsCode>
        <p className="docs-note">
          Any agent that can make HTTPS requests can use the public API. Native platform integrations are not required for the core flow.
        </p>
      </DocsSection>

      <DocsSection title="Core endpoints">
        <DocsTable
          rows={[
            {
              first: "Search",
              second: <code>GET /api/search?q=react&amp;sources=npm,pypi,github&amp;limit=5</code>,
              third: "Find candidates."
            },
            {
              first: "Inspect",
              second: <code>GET /api/inspect?source=npm&amp;name=undici</code>,
              third: "Read trust factors."
            },
            {
              first: "Plan",
              second: <code>GET /api/install-plan?source=npm&amp;name=undici</code>,
              third: "Return install steps for approval."
            },
            {
              first: "MCP",
              second: <code>POST /api/mcp</code>,
              third: "Use the same read-only surface through MCP."
            }
          ]}
        />
      </DocsSection>

      <DocsSection title="Current boundaries">
        <DocsGrid>
          <DocsCard title="Not a mirror">
            <p>Nipmod does not claim ownership of npm, PyPI, GitHub, Hugging Face or MCP packages. Source ownership stays external.</p>
          </DocsCard>
          <DocsCard title="Not an executor">
            <p>The hosted API returns package intelligence and install plans. Local writes still require approval and happen outside the hosted API.</p>
          </DocsCard>
          <DocsCard title="Not paid yet">
            <p>The public beta is free with rate limits. API keys and paid access can come later without changing the core safety model.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <div className="docs-next">
        <Link href="/api-access">Open API docs</Link>
        <Link href="/sources">View sources</Link>
      </div>
    </DocsShell>
  );
}
