import type { Metadata } from "next";
import { CommandBlock } from "../command-block";
import { homeContent } from "../content";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/quickstart"
  },
  description: "Nipmod docs for install, package search, workspace install, publishing, MCP, trust and security.",
  openGraph: {
    description: "Nipmod docs for install, package search, workspace install, publishing, MCP, trust and security.",
    title: "Nipmod docs",
    url: "https://nipmod.com/quickstart"
  },
  title: "Nipmod docs"
};

const docSections = [
  {
    href: "#install",
    label: "Install",
    text: "Set up the CLI and verify the installer."
  },
  {
    href: "#find",
    label: "Find",
    text: "Search the package registry without an account."
  },
  {
    href: "#inspect",
    label: "Inspect",
    text: "Check signer, source, digest and permissions before install."
  },
  {
    href: "#publish",
    label: "Publish",
    text: "Run the safe author preflight before any public write."
  },
  {
    href: "#agents",
    label: "Agents",
    text: "Give agent hosts one machine runbook."
  },
  {
    href: "/mcp",
    label: "MCP",
    text: "Connect Nipmod to agent hosts."
  },
  {
    href: "/trust",
    label: "Trust",
    text: "Read the public registry roots and witness path."
  }
] as const;

const stepIds: Record<string, string> = {
  "Add package": "add-package",
  Audit: "audit",
  Check: "doctor",
  Explain: "explain",
  Find: "find",
  Inspect: "inspect",
  "Install CLI": "install",
  "Install package": "install-package",
  Publish: "publish",
  Restore: "restore",
  SBOM: "sbom",
  Update: "update",
  Verify: "verify"
};

export default function QuickstartPage() {
  return (
    <main className="page-shell" id="main">
      <section className="quickstart-hero" id="docs" aria-labelledby="docs-title">
        <p className="eyebrow">Docs</p>
        <h1 id="docs-title">Docs</h1>
        <p className="lead">Install, search, inspect, publish and connect agent hosts from one clean path.</p>
        <div className="actions" aria-label="Quickstart actions">
          <a className="button button-primary" href="#install">
            Install CLI
          </a>
          <a className="button button-ghost" href="/packages">
            Packages
          </a>
          <a className="button button-ghost" href="/package">
            Create package
          </a>
        </div>
      </section>

      <section className="ecosystem-section" aria-labelledby="docs-overview-title">
        <div className="section-head">
          <p className="eyebrow">Guide</p>
          <h2 id="docs-overview-title">Choose the right path.</h2>
        </div>
        <nav className="filter-row" aria-label="Docs sections">
          {docSections.map((section) => (
            <a className="filter-pill" href={section.href} key={section.label}>
              {section.label}
            </a>
          ))}
        </nav>
        <div className="usage-strip">
          {docSections.slice(0, 3).map((section) => (
            <article className="usage-item" key={section.label}>
              <h2>{section.label === "Install" ? "Install the CLI" : section.label}</h2>
              <p>{section.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="proof-section" aria-labelledby="flow-title">
        <div>
          <p className="eyebrow">Flow</p>
          <h2 id="flow-title">Short command first. Verification when needed.</h2>
        </div>
        <div className="proof-panel">
          <p className="panel-copy">Use the short installer for normal setup. Use the checksum path when reviewing security.</p>
          <pre className="install-command">
            <code>{"curl -fsSLO https://nipmod.com/install.sh && bash install.sh"}</code>
          </pre>
        </div>
      </section>

      <section className="proof-section" id="agents" aria-labelledby="agents-title">
        <div>
          <p className="eyebrow">Agents</p>
          <h2 id="agents-title">Give agents one link.</h2>
        </div>
        <div className="proof-panel">
          <p className="panel-copy">
            Agents should fetch the text runbook, then the JSON manifest for exact endpoints, commands, trust roots and MCP tools.
          </p>
          <pre className="install-command">
            <code>{"curl -fsSL https://nipmod.com/llms.txt\ncurl -fsSL https://nipmod.com/.well-known/nipmod.json\nnipmod mcp serve"}</code>
          </pre>
          <div className="actions">
            <a className="button button-primary" href="/mcp">
              MCP
            </a>
            <a className="button button-ghost" href="/trust">
              Trust
            </a>
          </div>
        </div>
      </section>

      <section className="quickstart-grid" aria-label="Quickstart steps">
        {homeContent.quickstartSteps.map((step, index) => (
          <article className="quickstart-card" id={stepIds[step.label]} key={step.label}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h2>{step.label}</h2>
            <p>{step.text}</p>
            <CommandBlock command={step.command} label={`Copy ${step.label} command`} />
          </article>
        ))}
      </section>

      <section className="ecosystem-section" aria-labelledby="ops-title">
        <div className="section-head">
          <p className="eyebrow">Ops</p>
          <h2 id="ops-title">What is already watched.</h2>
        </div>
        <div className="usage-strip">
          {homeContent.operatorChecks.map((item) => (
            <article className="usage-item" key={item.label}>
              <h2>{item.label}</h2>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
