import type { Metadata } from "next";
import { CommandBlock } from "../command-block";
import { PlatformMark } from "../platform-brand";

const config = `[mcp_client]
enabled = true

[[mcp_client.servers]]
name = "nipmod"
endpoint = "https://nipmod.com/api/mcp"
description = "Nipmod shared package archive for agents. Search packages, inspect trust and create install plans before workspace writes."
enabled = true
allowed_tools = [
  "nipmod.search",
  "nipmod.view",
  "nipmod.inspect",
  "nipmod.install_plan",
  "nipmod.demo"
]
timeout_secs = 30`;

const smokePrompt =
  "Use the registered nipmod MCP server. Run mcp_list_servers, mcp_list_tools for nipmod, then search for gitlawb-repo-reader, inspect trust and return an install plan. Do not install packages or write files.";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/openhuman"
  },
  description: "Review-ready Nipmod MCP connection packet for OpenHuman.",
  openGraph: {
    description: "OpenHuman can review a hosted read-only Nipmod MCP path for package search, trust inspection and install plans.",
    title: "Nipmod for OpenHuman review",
    url: "https://nipmod.com/openhuman"
  },
  title: "Nipmod for OpenHuman review"
};

export default function OpenHumanPage() {
  return (
    <main className="page-shell" id="main">
      <section className="cursor-hero" aria-labelledby="openhuman-title">
        <div className="cursor-hero-copy">
          <div className="cursor-kicker">
            <PlatformMark id="openhuman" name="OpenHuman" />
            <span>OpenHuman review</span>
          </div>
          <h1 id="openhuman-title">Nipmod for OpenHuman review.</h1>
          <p className="lead">
            OpenHuman already has a remote MCP client path. This packet connects that path to Nipmod hosted
            read-only MCP so OpenHuman agents can search packages, inspect trust and create install plans before
            any workspace write.
          </p>
          <div className="actions" aria-label="OpenHuman actions">
            <a className="button button-primary" href="/integrations/openhuman/openhuman.mcp-client.toml">
              Config
            </a>
            <a className="button button-ghost" href="/integrations/openhuman/OPENHUMAN_SUBMISSION.md">
              Review packet
            </a>
            <a className="button button-ghost" href="https://github.com/tinyhumansai/openhuman" rel="noreferrer" target="_blank">
              OpenHuman repo
            </a>
          </div>
        </div>
        <aside className="quickstart-card cursor-status-panel" aria-label="OpenHuman status">
          <span>Status</span>
          <h2>Candidate</h2>
          <p>Review packet prepared. Not official until Tiny Humans reviews or accepts it.</p>
        </aside>
      </section>

      <section className="safety-strip" aria-label="OpenHuman connection facts">
        <article className="usage-item">
          <h2>Remote MCP</h2>
          <p>OpenHuman can register named remote MCP servers through <code>mcp_client.servers</code>.</p>
        </article>
        <article className="usage-item">
          <h2>Read-only</h2>
          <p>Nipmod hosted MCP exposes search, view, inspect, install_plan and demo.</p>
        </article>
        <article className="usage-item">
          <h2>No fork needed</h2>
          <p>The first pass is a config and review packet. OpenHuman code ownership stays with Tiny Humans.</p>
        </article>
      </section>

      <section className="trust-section setup-section" aria-labelledby="openhuman-config-title">
        <div>
          <p className="eyebrow">Config</p>
          <h2 id="openhuman-config-title">OpenHuman MCP client</h2>
          <p>Add the Nipmod server to OpenHuman <code>config.toml</code> for review.</p>
        </div>
        <CommandBlock command={config} label="Copy OpenHuman MCP config" />
      </section>

      <section className="trust-section setup-section" aria-labelledby="openhuman-smoke-title">
        <div>
          <p className="eyebrow">Smoke</p>
          <h2 id="openhuman-smoke-title">Agent review prompt</h2>
          <p>This checks the connection without installing packages or writing files.</p>
        </div>
        <CommandBlock command={smokePrompt} label="Copy OpenHuman review prompt" />
      </section>

      <section className="host-section setup-section" aria-labelledby="openhuman-boundary-title">
        <div className="registry-head">
          <div>
            <p className="eyebrow">Claim boundary</p>
            <h2 id="openhuman-boundary-title">What is safe to say</h2>
          </div>
        </div>
        <div className="check-list">
          <article className="check-row">
            <span className="check-dot check-ok" aria-hidden="true" />
            <div>
              <h3>Accurate</h3>
              <p>OpenHuman has a review-ready Nipmod MCP connection packet.</p>
            </div>
          </article>
          <article className="check-row">
            <span className="check-dot check-warn" aria-hidden="true" />
            <div>
              <h3>Not claimed</h3>
              <p>No official OpenHuman support, endorsement or OpenHuman-owned package collection is claimed yet.</p>
            </div>
          </article>
        </div>
        <div className="package-links">
          <a href="/integrations/openhuman/proof.json">Proof JSON</a>
          <a className="data-link" href="/compatibility/platform-connections.json">Connection matrix</a>
          <a href="/api/mcp">Hosted MCP</a>
        </div>
      </section>
    </main>
  );
}
