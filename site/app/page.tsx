import Link from "next/link";
import { ArchitectureDiagram, DocsCode, DocsProse, DocsSection, DocsSequence, DocsShell, DocsTable } from "./docs-shell";

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
        { label: "API beta", value: "no key" },
        { label: "Hosted writes", value: "0" }
      ]}
      title="The package layer for AI agents."
    >
      <DocsSection id="principle" title="Why Nipmod exists">
        <DocsProse>
          <p>
            Agents are starting to choose dependencies, models and tools on their own. Nipmod gives that decision a readable
            layer before anything is installed: source context, trust signals, warnings and a plan the user can approve.
          </p>
          <p>
            The goal is not to replace package ecosystems. The goal is to make them safer and easier for agents to reason
            about while the original sources keep ownership.
          </p>
        </DocsProse>
      </DocsSection>

      <DocsSection title="Public beta is open">
        <DocsProse>
          <p>
            Nipmod is live as a public beta. An agent can call the hosted API, search supported sources, inspect one exact
            package record and request an install plan before changing a workspace.
          </p>
          <p>
            Access is free and rate limited during the beta. We use this phase to improve resolver quality, watch real
            package demand and turn confirmed useful discoveries into better package intelligence. The hosted API does not
            read local files, run package managers or write lockfiles.
          </p>
          <p>
            Agents can read <code>/llms.txt</code>, the discovery manifest and the OpenAPI contract before making calls. The
            human page and the machine-readable surfaces describe the same boundary.
          </p>
        </DocsProse>
      </DocsSection>

      <DocsSection title="How it works">
        <DocsSequence
          items={[
            {
              body: "The agent asks Nipmod for candidates across supported package sources.",
              label: "1",
              title: "Search"
            },
            {
              body: "The agent checks one exact record for source context, license, warnings and trust factors.",
              label: "2",
              title: "Inspect"
            },
            {
              body: "The API returns install steps for review. Execution stays outside the hosted API.",
              label: "3",
              title: "Plan"
            },
            {
              body: "The user or local host decides whether the command is allowed to run.",
              label: "4",
              title: "Approve"
            },
            {
              body: "Useful confirmed discoveries can become reusable Nipmod archive records.",
              label: "5",
              title: "Archive"
            }
          ]}
        />
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
        <DocsProse>
          <p>
            Nipmod does not mirror or take ownership of npm, PyPI, GitHub, Hugging Face or MCP packages. The original
            publisher remains the source owner. Nipmod adds context, trust checks and install plans around those records.
          </p>
          <p>
            The hosted API is not an executor. It returns package context and commands as review data, while local changes
            still require approval and happen inside the user&apos;s own host or workspace.
          </p>
          <p>
            Search ranking is never permission to install. Exact package inspection, policy checks and user approval remain
            the safe path.
          </p>
        </DocsProse>
      </DocsSection>

      <DocsSection title="Ecosystem phase">
        <DocsProse>
          <p>
            We are starting collaboration work around the Base ecosystem because the early community, token and builder
            attention are already there. That gives the beta a practical first market instead of a vague launch surface.
          </p>
          <p>
            Once the API, trust model and archive loop are stable, the same package layer can move outward to agent builders,
            tooling teams and package-heavy workflows outside crypto.
          </p>
        </DocsProse>
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
