import Link from "next/link";
import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "./docs-shell";

const agentInstruction = `Before choosing a package, call Nipmod.
Search first, inspect the selected record, then present the install plan before changing the workspace.`;

export default function Home() {
  return (
    <DocsShell
      description="Nipmod gives agents one place to search package sources, read trust context and prepare install plans before changing a workspace."
      eyebrow="Overview"
      stats={[
        { label: "Sources", value: "6 live" },
        { label: "API beta", value: "public" },
        { label: "Hosted writes", value: "0" }
      ]}
      toc={[
        { href: "#public-beta", label: "Public beta" },
        { href: "#agent-flow", label: "Agent flow" },
        { href: "#agent-instruction", label: "Agent instruction" },
        { href: "#core-endpoints", label: "Core endpoints" },
        { href: "#boundaries", label: "Boundaries" }
      ]}
      title="The package layer for AI agents."
    >
      <DocsSection title="Public beta">
        <DocsGrid>
          <DocsCard title="One API">
            <p>Agents can search supported sources, inspect exact records and request install plans through the same public API.</p>
          </DocsCard>
          <DocsCard title="Free with limits">
            <p>Public beta access does not require a key. Requests are limited so the shared service remains reliable.</p>
          </DocsCard>
          <DocsCard title="No hidden execution">
            <p>Hosted calls do not read local files, run package managers or write lockfiles.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection title="Agent flow">
        <DocsGrid>
          <DocsCard label="1" title="Search">
            <p>The agent asks Nipmod for candidates across supported package sources.</p>
          </DocsCard>
          <DocsCard label="2" title="Inspect">
            <p>The agent checks one exact record for source context, license, warnings and trust factors.</p>
          </DocsCard>
          <DocsCard label="3" title="Plan">
            <p>The API returns install steps for review. Execution stays outside the hosted API.</p>
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
              third: "Find candidates across sources."
            },
            {
              first: "Inspect",
              second: <code>GET /api/inspect?source=npm&amp;name=undici</code>,
              third: "Read source context and trust factors."
            },
            {
              first: "Plan",
              second: <code>GET /api/install-plan?source=npm&amp;name=undici</code>,
              third: "Return install steps for approval."
            },
            {
              first: "Archive",
              second: <code>GET /api/archive/prepare?source=npm&amp;name=undici</code>,
              third: "Preview a reusable intelligence record."
            }
          ]}
        />
      </DocsSection>

      <DocsSection title="Boundaries">
        <DocsGrid>
          <DocsCard title="Not a mirror">
            <p>Nipmod does not claim ownership of npm, PyPI, GitHub, Hugging Face or MCP packages. Source ownership remains with the original publisher.</p>
          </DocsCard>
          <DocsCard title="Not an executor">
            <p>The hosted API returns package context and install plans. Local changes still require approval and happen outside the hosted service.</p>
          </DocsCard>
          <DocsCard title="Not a shortcut around trust">
            <p>Search ranking is not permission to install. Exact package inspection and policy checks come first.</p>
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
