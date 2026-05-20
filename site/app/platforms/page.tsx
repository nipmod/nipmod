import type { Metadata } from "next";
import { PlatformMark, platformStatusClass } from "../platform-brand";
import platformConnections from "../../public/compatibility/platform-connections.json";

type PlatformConnection = (typeof platformConnections.connections)[number];

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/platforms"
  },
  description: "Public Nipmod platform connection matrix with live, MCP ready, under review and candidate statuses.",
  openGraph: {
    description: "Check which Nipmod platform paths are live, MCP ready, under review or candidates.",
    title: "Nipmod platform connections",
    url: "https://nipmod.com/platforms"
  },
  title: "Nipmod platform connections"
};

export default function PlatformsPage() {
  const live = platformConnections.connections.filter((connection) => connection.status === "Live").length;
  const mcpReady = platformConnections.connections.filter((connection) => connection.status === "MCP ready").length;
  const external = platformConnections.connections.filter((connection) => connection.externalApprovalRequired).length;

  return (
    <main className="page-shell" id="main">
      <section className="quickstart-hero" aria-labelledby="platforms-title">
        <p className="eyebrow">Platforms</p>
        <h1 id="platforms-title">Connection matrix</h1>
        <p className="lead">
          This page separates live Nipmod controlled paths from MCP ready host paths and external review work. It is a
          proof surface, not a partner approval claim.
        </p>
        <div className="actions" aria-label="Platform actions">
          <a className="button button-primary" href="/status">
            Status dashboard
          </a>
          <a className="button button-ghost" href="/mcp">
            MCP tools
          </a>
          <a className="button button-ghost" href="/setup">
            Setup agents
          </a>
        </div>
      </section>

      <section className="trust-grid" aria-label="Connection summary">
        <article className="stat-tile">
          <span>{live}</span>
          <p>Live paths</p>
        </article>
        <article className="stat-tile">
          <span>{mcpReady}</span>
          <p>MCP ready paths</p>
        </article>
        <article className="stat-tile">
          <span>{external}</span>
          <p>External approvals</p>
        </article>
      </section>

      <section className="registry-section" aria-labelledby="legend-title">
        <div className="section-head">
          <p className="eyebrow">Status labels</p>
          <h2 id="legend-title">The platform list is status scoped.</h2>
          <p>Logos show where Nipmod has a connection path. Status labels show how far that path actually goes.</p>
          <a className="data-link" href="/compatibility/platform-connections.json">
            Open connection matrix JSON
          </a>
          <a className="data-link" href="/compatibility/platform-readiness.json">
            Open readiness receipt JSON
          </a>
        </div>
        <div className="platform-grid">
          {platformConnections.statusLegend.map((item) => (
            <article className="platform-card" key={item.status}>
              <div className="platform-top">
                <div>
                  <p className="platform-label">label</p>
                  <h3>{item.status}</h3>
                </div>
                <span className={`platform-status ${platformStatusClass(item.status)}`}>{item.status}</span>
              </div>
              <p>{item.meaning}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="platform-section" aria-labelledby="connection-title">
        <div className="section-head">
          <p className="eyebrow">Proof paths</p>
          <h2 id="connection-title">Current platform connections</h2>
          <p>Each card points to a public page, a repo kit and a smoke or review path.</p>
        </div>
        <div className="platform-logo-rail platform-logo-rail-wide" aria-label="Current Nipmod platform logos">
          {platformConnections.connections.map((connection) => (
            <a className="platform-logo-tile" href={connection.url} key={connection.id}>
              <PlatformMark id={connection.id} name={connection.name} />
              <span className="platform-logo-copy">
                <strong>{connection.name}</strong>
                <span>{connection.status}</span>
              </span>
            </a>
          ))}
        </div>
        <div className="platform-proof-grid">
          {platformConnections.connections.map((connection) => (
            <ConnectionCard connection={connection} key={connection.id} />
          ))}
        </div>
        <p className="platform-note">{platformConnections.meaning}</p>
      </section>
    </main>
  );
}

function ConnectionCard({ connection }: { connection: PlatformConnection }) {
  return (
    <article className="platform-card">
      <div className="platform-top">
        <div className="platform-title-row">
          <PlatformMark id={connection.id} name={connection.name} />
          <div>
            <p className="platform-label">{connection.category}</p>
            <h3>{connection.name}</h3>
          </div>
        </div>
        <span className={`platform-status ${platformStatusClass(connection.status)}`}>{connection.status}</span>
      </div>
      <p>{connection.scope}</p>
      <dl className="platform-detail-list">
        <div>
          <dt>Proof</dt>
          <dd>{connection.proofLevel}</dd>
        </div>
        <div>
          <dt>Setup</dt>
          <dd>{connection.setupCommand ?? "No local setup command required"}</dd>
        </div>
        <div>
          <dt>Smoke</dt>
          <dd>{connection.smokeCommand}</dd>
        </div>
        <div>
          <dt>External approval</dt>
          <dd>{connection.externalApprovalRequired ? connection.externalDependency : "Not required for the current Nipmod path"}</dd>
        </div>
      </dl>
      <a href={connection.url}>Open public path</a>
    </article>
  );
}
