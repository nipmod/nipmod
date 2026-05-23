import Link from "next/link";
import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "./docs-shell";

const agentInstruction = `Before choosing a package, call Nipmod.
Search, inspect the selected record, then show the install plan before any workspace write.`;

export default function Home() {
  return (
    <DocsShell
      description="Agents use Nipmod to search package sources, inspect trust and get safe install plans before touching a workspace."
      eyebrow="Overview"
      stats={[
        { label: "Sources", value: "6 live" },
        { label: "API beta", value: "public" },
        { label: "Hosted writes", value: "0" }
      ]}
      title="The package layer for AI agents."
    >
      <DocsSection title="Public beta">
        <DocsGrid>
          <DocsCard title="One API surface">
            <p>Agents can search supported package sources, inspect exact records and request install plans through the same hosted API.</p>
          </DocsCard>
          <DocsCard title="Free with limits">
            <p>Public beta access does not require a key. Production requests are rate limited through shared buckets.</p>
          </DocsCard>
          <DocsCard title="No hidden execution">
            <p>Hosted calls never read caller workspaces, run package managers or write lockfiles.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection title="Agent flow">
        <DocsGrid>
          <DocsCard label="1" title="Search">
            <p>The agent asks Nipmod for package candidates across supported sources.</p>
          </DocsCard>
          <DocsCard label="2" title="Inspect">
            <p>The agent checks one exact record for source context, license, warnings and trust factors.</p>
          </DocsCard>
          <DocsCard label="3" title="Plan">
            <p>The API returns install steps for approval. The hosted API never executes them.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection title="Agent instruction">
        <DocsCode>{agentInstruction}</DocsCode>
      </DocsSection>

      <DocsSection title="Core endpoints">
        <DocsTable
          rows={[
            {
              first: "Search",
              second: <code>GET /api/search?q=http%20client&amp;limit=3</code>,
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
              third: "Return reviewable install steps."
            },
            {
              first: "Archive",
              second: <code>GET /api/archive/prepare?source=npm&amp;name=undici</code>,
              third: "Preview a reusable record."
            }
          ]}
        />
      </DocsSection>

      <DocsSection title="Boundaries">
        <DocsGrid>
          <DocsCard title="Not a mirror">
            <p>Nipmod does not claim ownership of npm, PyPI, GitHub, Hugging Face or MCP packages. Source ownership stays external.</p>
          </DocsCard>
          <DocsCard title="Not an executor">
            <p>The hosted API returns package intelligence and install plans. Local writes still require approval and happen outside the hosted API.</p>
          </DocsCard>
          <DocsCard title="Not a shortcut around trust">
            <p>Search ranking is not install permission. Exact package inspection and policy checks come before any local change.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <div className="docs-next">
        <Link href="/api-access">Open API docs</Link>
        <Link href="/examples">View examples</Link>
      </div>
    </DocsShell>
  );
}
