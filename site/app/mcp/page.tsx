import type { Metadata } from "next";
import { mcpContent } from "./content";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/mcp"
  },
  description: "Connect Nipmod to Codex, Claude Code and OpenCode.",
  openGraph: {
    description: "Use Nipmod as a local MCP server for package search, exact metadata, inspect, plans, verify and audit.",
    title: "Nipmod MCP",
    url: "https://nipmod.com/mcp"
  },
  title: "Nipmod MCP"
};

export default function McpPage() {
  return (
    <main className="page-shell" id="main">
      <section className="mcp-hero" aria-labelledby="mcp-title">
        <p className="eyebrow">MCP</p>
        <h1 id="mcp-title">{mcpContent.headline}</h1>
        <p className="lead">{mcpContent.lead}</p>
        <div className="actions" aria-label="MCP actions">
          <a className="button button-primary" href="/quickstart#install">
            {mcpContent.primaryAction}
          </a>
          <a className="button button-ghost" href="/trust">
            {mcpContent.secondaryAction}
          </a>
        </div>
      </section>

      <section className="safety-strip" aria-label="MCP safety model">
        {mcpContent.safety.map((item) => (
          <article className="usage-item" key={item.label}>
            <h2>{item.label}</h2>
            <p>{item.text}</p>
          </article>
        ))}
      </section>

      <section className="trust-section" aria-labelledby="tools-title">
        <div>
          <p className="eyebrow">Tools</p>
          <h2 id="tools-title">Exact tool contract</h2>
        </div>
        <div className="check-list">
          {mcpContent.tools.map((tool) => (
            <article className="check-row" key={tool.name}>
              <span className="check-dot check-ok" aria-hidden="true" />
              <div>
                <h3>{tool.name}</h3>
                <p>{tool.safety}</p>
              </div>
            </article>
          ))}
        </div>
        <pre className="install-command">
          <code>{mcpContent.verifyCommand}</code>
        </pre>
      </section>

      <section className="host-section" aria-labelledby="hosts-title">
        <div className="registry-head">
          <div>
            <p className="eyebrow">Hosts</p>
            <h2 id="hosts-title">One local server. Three agent tools.</h2>
          </div>
        </div>

        <div className="host-grid">
          {mcpContent.hosts.map((host) => (
            <article className="host-card" key={host.name}>
              <div className="host-card-head">
                <h3>{host.name}</h3>
                <span>{host.configName}</span>
              </div>
              <pre className="install-command">
                <code>{host.command}</code>
              </pre>
              <pre className="host-config">
                <code>{host.config}</code>
              </pre>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
