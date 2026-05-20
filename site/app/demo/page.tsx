import type { Metadata } from "next";
import { CommandBlock } from "../command-block";
import registryData from "../registry-data.json";
import type { RegistryIndex } from "../../lib/registry";

const registry = registryData as RegistryIndex;
const demoPackage = registry.packages.find((pkg) => pkg.name === "gitlawb-repo-reader") ?? registry.packages[0];
const packageSpecifier = demoPackage ? `${demoPackage.canonical}@${demoPackage.version}` : "gitlawb-repo-reader";

const demoSteps = [
  {
    label: "Search",
    text: "Find a package from the same public archive an agent reads.",
    command: "nipmod search gitlawb-repo-reader --online --json"
  },
  {
    label: "View",
    text: "Read package metadata, source and suggested next actions.",
    command: "nipmod view gitlawb-repo-reader --json"
  },
  {
    label: "Inspect",
    text: "Check digest, signer, source, transparency and permissions.",
    command: `nipmod inspect ${packageSpecifier} --json`
  },
  {
    label: "Plan",
    text: "Create the install plan before the lockfile changes.",
    command: `nipmod install --plan ${packageSpecifier} --json`
  },
  {
    label: "Install",
    text: "Install only after review. Nipmod writes a local install receipt.",
    command: "mkdir -p nipmod-demo\ncd nipmod-demo\nnipmod install gitlawb-repo-reader\nls .nipmod/receipts"
  },
  {
    label: "Audit",
    text: "Check the workspace against current trust and advisory data.",
    command: "nipmod audit --online\nnipmod sbom --json"
  }
];

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/demo"
  },
  description: "Run the Nipmod package search, trust inspect, install plan and receipt demo.",
  openGraph: {
    description: "A short demo path for agents and humans using the same Nipmod package archive.",
    title: "Nipmod demo",
    url: "https://nipmod.com/demo"
  },
  title: "Nipmod demo"
};

export default function DemoPage() {
  return (
    <main className="page-shell" id="main">
      <section className="quickstart-hero" aria-labelledby="demo-title">
        <p className="eyebrow">Demo</p>
        <h1 id="demo-title">Search, inspect, plan, receipt.</h1>
        <p className="lead">
          One package path shows how humans and agents use the same archive without trusting package text first.
        </p>
        <div className="actions" aria-label="Demo actions">
          <a className="button button-primary" href="/setup">
            Setup agent
          </a>
          <a className="button button-ghost" href="/status">
            System status
          </a>
          <a className="button button-ghost" href="/packages">
            Browse packages
          </a>
        </div>
      </section>

      <section className="trust-grid" aria-label="Demo package state">
        <article className="stat-tile">
          <span>{registry.packages.length}</span>
          <p>Archive packages</p>
        </article>
        <article className="stat-tile">
          <span>{demoPackage?.trust.level ?? "verified"}</span>
          <p>Demo trust level</p>
        </article>
        <article className="stat-tile">
          <span>{demoPackage?.trust.score ?? 100}</span>
          <p>Demo trust score</p>
        </article>
      </section>

      <section className="registry-section" aria-labelledby="demo-path-title">
        <div className="section-head">
          <p className="eyebrow">Path</p>
          <h2 id="demo-path-title">Run it from any workspace</h2>
          <p>Every step has a CLI form and the same flow is exposed through MCP for Codex, Claude Code, OpenCode and Hermes.</p>
        </div>
        <div className="quickstart-grid">
          {demoSteps.map((step) => (
            <article className="quickstart-card" key={step.label}>
              <span>{step.label}</span>
              <h2>{step.label}</h2>
              <p>{step.text}</p>
              <CommandBlock command={step.command} label={`Copy ${step.label} command`} />
            </article>
          ))}
        </div>
      </section>

      <section className="proof-section" aria-labelledby="agent-demo-title">
        <div>
          <p className="eyebrow">Agent</p>
          <h2 id="agent-demo-title">Ask through MCP</h2>
          <p>Use this after `nipmod setup codex` or `nipmod setup claude`.</p>
        </div>
        <div className="proof-panel">
          <CommandBlock
            command={
              'Use Nipmod to find gitlawb-repo-reader, inspect it, create an install plan, and install only after I approve the lockfile write.'
            }
            label="Copy agent demo prompt"
          />
        </div>
      </section>
    </main>
  );
}
