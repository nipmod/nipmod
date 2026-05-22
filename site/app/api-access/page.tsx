import type { Metadata } from "next";
import { withPreviewImage } from "../metadata";

export const metadata: Metadata = {
  alternates: { canonical: "https://nipmod.com/api-access" },
  description: "Give agents one API for package search, trust checks and safe install plans.",
  openGraph: withPreviewImage({
    description: "One hosted package API agents can call before choosing dependencies.",
    title: "Nipmod API",
    url: "https://nipmod.com/api-access"
  }),
  title: "Nipmod"
};

const endpoints = [
  {
    method: "GET",
    path: "/api/resolve?q=<query>",
    text: "Find package candidates across npm, PyPI, GitHub, Hugging Face and MCP."
  },
  {
    method: "GET",
    path: "/api/inspect?source=npm&name=<package>",
    text: "Read exact source, license, repo and trust metadata for one result."
  },
  {
    method: "GET",
    path: "/api/install-plan?source=npm&name=<package>",
    text: "Return the install command, warnings and approval boundary."
  },
  {
    method: "POST",
    path: "/api/mcp",
    text: "Use the same read-only surface from MCP capable agents."
  }
] as const;

const examples = [
  {
    label: "Tell your agent",
    command:
      "Use Nipmod before choosing packages. Search for packages for this task, inspect the best candidates, then show me the install plan before writing anything."
  }
] as const;

export default function ApiAccessPage() {
  return (
    <main className="page-shell api-page-shell" id="main">
      <section className="quickstart-hero api-hero" aria-labelledby="api-title">
        <div>
          <p className="eyebrow">Nipmod API</p>
          <h1 id="api-title">Package search for agents.</h1>
          <p className="lead">
            Tell your agent what you need. The agent calls Nipmod, gets package options, checks trust and returns a safe
            install plan before anything is installed.
          </p>
        </div>
        <div className="api-status-panel" aria-label="API access status">
          <span>Public beta</span>
          <strong>Free</strong>
          <p>No key during beta. Rate limited. Hosted calls are read-only.</p>
        </div>
      </section>

      <section className="api-flow" aria-label="API flow">
        <div className="api-flow-step">
          <span>1</span>
          <h2>User</h2>
          <p>Ask your agent for the package or workflow you need.</p>
        </div>
        <div className="api-flow-step">
          <span>2</span>
          <h2>Agent</h2>
          <p>The agent calls Nipmod instead of guessing from package text.</p>
        </div>
        <div className="api-flow-step">
          <span>3</span>
          <h2>Plan</h2>
          <p>Nipmod returns candidates, trust context and a safe install plan.</p>
        </div>
      </section>

      <section className="api-section" aria-labelledby="endpoints-title">
        <div className="archive-section-head">
          <div>
            <p className="eyebrow">Endpoints</p>
            <h2 id="endpoints-title">Core calls</h2>
          </div>
          <span>HTTPS or MCP</span>
        </div>
        <div className="endpoint-list">
          {endpoints.map((endpoint) => (
            <article className="endpoint-row" key={`${endpoint.method} ${endpoint.path}`}>
              <div>
                <span>{endpoint.method}</span>
                <code>{endpoint.path}</code>
              </div>
              <p>{endpoint.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="api-section" aria-labelledby="examples-title">
        <div className="archive-section-head">
          <div>
            <p className="eyebrow">Usage</p>
            <h2 id="examples-title">One sentence</h2>
          </div>
          <span>For any HTTPS or MCP capable agent</span>
        </div>
        <div className="api-command-grid">
          {examples.map((example) => (
            <article className="api-command-card" key={example.label}>
              <span>{example.label}</span>
              <pre>
                <code>{example.command}</code>
              </pre>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
