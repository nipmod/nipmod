import type { Metadata } from "next";
import { withPreviewImage } from "../metadata";
import platformConnections from "../../public/compatibility/platform-connections.json";
import platformReadiness from "../../public/compatibility/platform-readiness.json";
import systemReadiness from "../../public/compatibility/system-readiness.json";
import registryData from "../registry-data.json";
import type { RegistryIndex } from "../../lib/registry";

const registry = registryData as RegistryIndex;

type Readiness = {
  cliCommands?: string[];
  mcpTools?: string[];
  platforms?: Array<{ id: string; name: string; productReadiness: number }>;
  sharedArchive?: { packageCount: number };
};

const system = systemReadiness as Readiness;
const platform = platformReadiness as Readiness;
const connections = platformConnections.connections.filter(
  (connection) => connection.status === "Live" || connection.status === "MCP ready"
);

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/status"
  },
  description: "Public Nipmod proof dashboard for API, archive and source readiness.",
  openGraph: withPreviewImage({
    description: "Public proof dashboard for the Nipmod API and package archive.",
    title: "Nipmod status",
    url: "https://nipmod.com/status"
  }),
  title: "Nipmod status"
};

export default function StatusPage() {
  return (
    <main className="page-shell" id="main">
      <section className="quickstart-hero" aria-labelledby="status-title">
        <p className="eyebrow">Status</p>
        <h1 id="status-title">Public proof dashboard</h1>
        <p className="lead">
          The dashboard points to committed readiness receipts for the API, source resolver, archive and MCP boundaries.
        </p>
        <div className="actions" aria-label="Status actions">
          <a className="button button-primary" href="/proof">
            Run proof
          </a>
          <a className="button button-ghost" href="/platforms">
            Platforms
          </a>
          <a className="button button-ghost" href="/demo">
            Demo
          </a>
          <a className="button button-ghost" href="/trust">
            Trust model
          </a>
        </div>
      </section>

      <section className="trust-grid" aria-label="Readiness summary">
        <article className="stat-tile">
          <span>{system.sharedArchive?.packageCount ?? registry.packages.length}</span>
          <p>Packages in archive</p>
        </article>
        <article className="stat-tile">
          <span>{system.cliCommands?.length ?? 0}/{system.mcpTools?.length ?? 0}</span>
          <p>CLI commands and MCP tools</p>
        </article>
        <article className="stat-tile">
          <span>{platform.platforms?.length ?? 0}</span>
          <p>Source and access paths</p>
        </article>
      </section>

      <section className="registry-section" aria-labelledby="platform-proof-title">
        <div className="section-head">
          <p className="eyebrow">API first</p>
          <h2 id="platform-proof-title">Connected proof paths</h2>
          <p>Only current source and access paths are shown here. Draft integrations stay out of the status grid.</p>
        </div>
        <div className="platform-grid">
          {connections.map((connection) => (
            <article className="platform-card" key={connection.id}>
              <div className="platform-top">
                <div>
                  <p className="platform-label">{connection.category}</p>
                  <h3>{connection.name}</h3>
                </div>
                <span className={`platform-status ${platformStatusClass(connection.status)}`}>{connection.status}</span>
              </div>
              <p>{connection.scope}</p>
              <a href={connection.url}>Open proof</a>
            </article>
          ))}
        </div>
      </section>

      <section className="proof-section" aria-labelledby="receipts-title">
        <div>
          <p className="eyebrow">Receipts</p>
          <h2 id="receipts-title">Readiness checks</h2>
          <p>Public checks are kept behind the product so the website stays readable for humans.</p>
        </div>
        <div className="check-list">
          <article className="check-row">
            <span className="check-dot check-ok" aria-hidden="true" />
            <div>
              <h3>System readiness</h3>
              <p>Archive, CLI, MCP, one-command setup, install receipts, source sync and parallel access proof.</p>
            </div>
          </article>
          <article className="check-row">
            <span className="check-dot check-ok" aria-hidden="true" />
            <div>
              <h3>Platform readiness</h3>
              <p>Hosted API, source resolver, archive mode, MCP boundary and source mirror readiness.</p>
            </div>
          </article>
          <article className="check-row">
            <span className="check-dot check-ok" aria-hidden="true" />
            <div>
              <h3>Registry archive</h3>
              <p>Public packages, source metadata, transparency and package documents come from the same archive.</p>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}

function platformStatusClass(status: string): string {
  if (status === "Live") {
    return "platform-status-live";
  }

  if (status === "Under review" || status === "Safe mode") {
    return "platform-status-review";
  }

  if (status === "MCP ready") {
    return "platform-status-mcp";
  }

  if (status === "Candidate") {
    return "platform-status-candidate";
  }

  return "platform-status-planned";
}
