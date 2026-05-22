import { createPageMetadata } from "../metadata";
import { CommandBlock } from "../command-block";
import { mcpContent } from "./content";

export const metadata = createPageMetadata({
  description: "Use Nipmod through hosted read-only MCP or a local MCP server for controlled workspace writes.",
  path: "/mcp",
  title: "Nipmod MCP"
});

export default function McpPage() {
  return (
    <main className="page-shell" id="main">
      <section className="mcp-hero" aria-labelledby="mcp-title">
        <p className="eyebrow">MCP</p>
        <h1 id="mcp-title">{mcpContent.headline}</h1>
        <p className="lead">{mcpContent.lead}</p>
        <div className="actions" aria-label="MCP actions">
          <a className="button button-primary" href="/setup">
            {mcpContent.primaryAction}
          </a>
          <a className="button button-ghost" href="/trust">
            {mcpContent.secondaryAction}
          </a>
        </div>
      </section>

      <section className="trust-section" aria-labelledby="one-command-title">
        <div>
          <p className="eyebrow">Setup</p>
          <h2 id="one-command-title">{mcpContent.oneCommand.title}</h2>
          <p>{mcpContent.oneCommand.text}</p>
        </div>
        <CommandBlock command={mcpContent.oneCommand.command} label="Copy MCP setup command" />
      </section>

      <section className="trust-section" aria-labelledby="remote-mcp-title">
        <div>
          <p className="eyebrow">Remote</p>
          <h2 id="remote-mcp-title">{mcpContent.remote.title}</h2>
          <p>{mcpContent.remote.text}</p>
        </div>
        <div className="quickstart-grid" aria-label="Hosted read-only MCP examples">
          <article className="quickstart-card">
            <span>Endpoint</span>
            <h2>{mcpContent.remote.endpoint}</h2>
            <CommandBlock command={mcpContent.remote.endpoint} label="Copy remote MCP endpoint" />
          </article>
          <article className="quickstart-card">
            <span>List tools</span>
            <h2>JSON-RPC</h2>
            <pre className="install-command">
              <code>{mcpContent.remote.listTools}</code>
            </pre>
          </article>
          <article className="quickstart-card">
            <span>Search</span>
            <h2>JSON-RPC</h2>
            <pre className="install-command">
              <code>{mcpContent.remote.search}</code>
            </pre>
          </article>
        </div>
        <div className="package-links" aria-label="Read-only MCP tools">
          {mcpContent.remote.tools.map((tool) => (
            <span className="pill" key={tool}>
              {tool}
            </span>
          ))}
        </div>
        <p className="panel-copy">{mcpContent.remote.boundary}</p>
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
        <div className="quickstart-grid" aria-label="MCP tool call examples">
          {mcpContent.examples.map((example) => (
            <article className="quickstart-card" key={example.label}>
              <span>{example.label}</span>
              <h2>{example.label}</h2>
              <pre className="install-command">
                <code>{example.command}</code>
              </pre>
            </article>
          ))}
        </div>
      </section>

      <section className="host-section" aria-labelledby="hosts-title">
        <div className="registry-head">
          <div>
            <p className="eyebrow">Hosts</p>
            <h2 id="hosts-title">One local server. Five agent tools.</h2>
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
              <p className="panel-copy">{host.verify}</p>
              <CommandBlock command={host.prompt} label={`Copy ${host.name} prompt`} />
            </article>
          ))}
        </div>
      </section>

      <section className="trust-section" aria-labelledby="demo-title">
        <div>
          <p className="eyebrow">Demo</p>
          <h2 id="demo-title">{mcpContent.demo.headline}</h2>
          <p>{mcpContent.demo.lead}</p>
        </div>
        <div className="check-list">
          <article className="check-row">
            <span className="check-dot check-ok" aria-hidden="true" />
            <div>
              <h3>Tell the agent</h3>
              <CommandBlock command={mcpContent.demo.prompt} label="Copy demo prompt" />
            </div>
          </article>
          {mcpContent.demo.steps.map((step) => (
            <article className="check-row" key={step}>
              <span className="check-dot check-ok" aria-hidden="true" />
              <div>
                <h3>{step}</h3>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="trust-section" aria-labelledby="official-docs-title">
        <div>
          <p className="eyebrow">References</p>
          <h2 id="official-docs-title">Host docs</h2>
        </div>
        <div className="package-links">
          {mcpContent.docs.map((doc) => (
            <a aria-label={`${doc.label} opens in a new tab`} href={doc.href} key={doc.href} rel="noreferrer" target="_blank">
              {doc.label}
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
