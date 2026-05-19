import type { Metadata } from "next";
import platformReadiness from "../../public/compatibility/platform-readiness.json";
import systemReadiness from "../../public/compatibility/system-readiness.json";
import registryData from "../registry-data.json";
import type { RegistryIndex } from "../../lib/registry";

const registry = registryData as RegistryIndex;

type Readiness = {
  cliCommands?: string[];
  mcpTools?: string[];
  platforms?: Array<{ id: string; productReadiness: number }>;
  sharedArchive?: { packageCount: number };
};

const system = systemReadiness as Readiness;
const platform = platformReadiness as Readiness;

const platformNames = ["GitHub", "Gitlawb", "Codex", "Claude Code", "OpenCode", "Bankr workflows"];

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/status"
  },
  description: "Public Nipmod proof dashboard for archive, platform and agent readiness.",
  openGraph: {
    description: "Public proof dashboard for the shared Nipmod agent package archive.",
    title: "Nipmod status",
    url: "https://nipmod.com/status"
  },
  title: "Nipmod status"
};

export default function StatusPage() {
  return (
    <main className="page-shell" id="main">
      <section className="quickstart-hero" aria-labelledby="status-title">
        <p className="eyebrow">Status</p>
        <h1 id="status-title">Public proof dashboard</h1>
        <p className="lead">
          The dashboard points to committed readiness receipts for the shared archive, agent hosts and integration paths.
        </p>
        <div className="actions" aria-label="Status actions">
          <a className="button button-primary" href="/proof">
            Run proof
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
          <p>Platform paths</p>
        </article>
      </section>

      <section className="registry-section" aria-labelledby="platform-proof-title">
        <div className="section-head">
          <p className="eyebrow">Platforms</p>
          <h2 id="platform-proof-title">Connected proof paths</h2>
          <p>These are Nipmod integration and workflow checks. They are not partner endorsement claims.</p>
        </div>
        <div className="platform-grid">
          {platformNames.map((name) => (
            <article className="platform-card" key={name}>
              <div className="platform-top">
                <div>
                  <p className="platform-label">ready path</p>
                  <h3>{name}</h3>
                </div>
                <span className="platform-status platform-status-live">checked</span>
              </div>
              <p>Uses the same package archive, proof documents or MCP server path where supported.</p>
            </article>
          ))}
        </div>
      </section>

      <section className="proof-section" aria-labelledby="receipts-title">
        <div>
          <p className="eyebrow">Receipts</p>
          <h2 id="receipts-title">Machine readable proof</h2>
          <p>Agents can read these directly before trusting claims from a post.</p>
        </div>
        <div className="check-list">
          <article className="check-row">
            <span className="check-dot check-ok" aria-hidden="true" />
            <div>
              <h3>System readiness</h3>
              <p>Archive, CLI, MCP, one-command setup, install receipts, source sync and parallel access proof.</p>
              <a className="data-link" href="/compatibility/system-readiness.json">
                Open JSON receipt
              </a>
            </div>
          </article>
          <article className="check-row">
            <span className="check-dot check-ok" aria-hidden="true" />
            <div>
              <h3>Platform readiness</h3>
              <p>Codex, Claude Code, OpenCode, Bankr workflow proof and source mirror readiness.</p>
              <a className="data-link" href="/compatibility/platform-readiness.json">
                Open JSON receipt
              </a>
            </div>
          </article>
          <article className="check-row">
            <span className="check-dot check-ok" aria-hidden="true" />
            <div>
              <h3>Registry archive</h3>
              <p>Public packages, source metadata, transparency and package documents come from the same archive.</p>
              <a className="data-link" href="/registry/packages.json">
                Open registry JSON
              </a>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
