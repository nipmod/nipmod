import { createPageMetadata } from "../metadata";
import { PlatformMark, platformStatusClass } from "../platform-brand";
import platformConnections from "../../public/compatibility/platform-connections.json";

type PlatformConnection = (typeof platformConnections.connections)[number];

export const metadata = createPageMetadata({
  description: "See the public source and access paths behind the Nipmod package API for agents.",
  path: "/platforms",
  title: "Nipmod source and access"
});

export default function PlatformsPage() {
  const visibleConnections = platformConnections.connections;
  const visibleLegend = platformConnections.statusLegend;
  const live = visibleConnections.filter((connection) => connection.status === "Live").length;
  const safeMode = visibleConnections.filter((connection) => connection.status === "Safe mode").length;

  return (
    <main className="page-shell" id="main">
      <section className="quickstart-hero" aria-labelledby="platforms-title">
        <p className="eyebrow">API first</p>
        <h1 id="platforms-title">Source and access</h1>
        <p className="lead">
          These are the paths behind the hosted Nipmod API. Native third party integrations are not required for use.
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
          <span>{safeMode}</span>
          <p>Safe mode paths</p>
        </article>
        <article className="stat-tile">
          <span>{visibleConnections.length}</span>
          <p>Total paths</p>
        </article>
      </section>

      <section className="registry-section" aria-labelledby="legend-title">
        <div className="section-head">
          <p className="eyebrow">Status labels</p>
          <h2 id="legend-title">Only current paths are shown.</h2>
          <p>Review tracks and draft integrations stay out of the public matrix.</p>
        </div>
        <div className="platform-grid">
          {visibleLegend.map((item) => (
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
          <h2 id="connection-title">Current API surface</h2>
          <p>Each card points to a public page or endpoint and a smoke path.</p>
        </div>
        <div className="platform-logo-rail platform-logo-rail-wide" aria-label="Current Nipmod platform logos">
          {visibleConnections.map((connection) => (
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
          {visibleConnections.map((connection) => (
            <ConnectionCard connection={connection} key={connection.id} />
          ))}
        </div>
        <p className="platform-note">Draft integrations stay out of the product UI until they are real user paths.</p>
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
