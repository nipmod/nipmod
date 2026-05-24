import Link from "next/link";
import { ArchitectureDiagram, DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "./docs-shell";

const agentInstruction = `Use Nipmod before choosing a package.
Search sources, inspect the selected record and show the install plan.
Do not install or edit files until I approve.`;

export default function Home() {
  return (
    <DocsShell
      description="Nipmod makes existing package ecosystems readable for agents. It searches sources, explains trust and returns install plans before anything touches a workspace."
      eyebrow="Home"
      stats={[
        { label: "Public sources", value: "5 live" },
        { label: "API beta", value: "public" },
        { label: "Hosted writes", value: "0" }
      ]}
      title="The package layer for AI agents."
    >
      <DocsSection title="Public beta is open">
        <DocsGrid>
          <DocsCard title="Use it now">
            <p>Agents can search supported sources, inspect exact records and request install plans through the same public API.</p>
          </DocsCard>
          <DocsCard title="Free with limits">
            <p>Public beta access does not require a key. Requests are rate limited while we improve resolver quality and collect real usage.</p>
          </DocsCard>
          <DocsCard title="No hidden execution">
            <p>Hosted calls do not read local files, run package managers or write lockfiles.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection title="How it works">
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
          <DocsCard label="4" title="Approve">
            <p>The user or local host decides whether the command is allowed to run.</p>
          </DocsCard>
          <DocsCard label="5" title="Archive">
            <p>Useful confirmed discoveries can become reusable Nipmod archive records.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection title="Current architecture">
        <ArchitectureDiagram />
      </DocsSection>

      <DocsSection title="What to tell your agent">
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

      <DocsSection title="Ecosystem phase">
        <DocsGrid>
          <DocsCard title="Base first">
            <p>We are starting collaboration work around the Base ecosystem because early community, token and builder attention are already there.</p>
          </DocsCard>
          <DocsCard title="Broader after the beta">
            <p>Once the API, trust model and archive loops are stable, the same package layer can be taken to agent builders outside crypto.</p>
          </DocsCard>
          <DocsCard title="Public links">
            <p>GitHub, X, Telegram and the $NPM token link stay visible from the header so builders can review the project quickly.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection title="Official links">
        <DocsTable
          rows={[
            ["GitHub", <a className="data-link" href="https://github.com/nipmod/nipmod" key="github" rel="noreferrer" target="_blank">github.com/nipmod/nipmod</a>],
            ["X", <a className="data-link" href="https://x.com/Nipmod" key="x" rel="noreferrer" target="_blank">x.com/Nipmod</a>],
            ["Telegram", <a className="data-link" href="https://t.me/nipmod" key="telegram" rel="noreferrer" target="_blank">t.me/nipmod</a>],
            ["$NPM on Base", <a className="data-link" href="https://token.nipmod.com" key="token" rel="noreferrer" target="_blank">token.nipmod.com</a>]
          ]}
        />
      </DocsSection>

      <div className="docs-next">
        <Link href="/quickstart">Start quickstart</Link>
        <Link href="/api-access">Open API docs</Link>
        <Link href="/architecture">Read architecture</Link>
      </div>
    </DocsShell>
  );
}
