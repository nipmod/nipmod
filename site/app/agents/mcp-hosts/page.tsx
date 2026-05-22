import { createPageMetadata } from "../../metadata";
import { CommandBlock } from "../../command-block";
import { agentHostContent } from "./content";

export const metadata = createPageMetadata({
  description: "Use Nipmod from agent hosts for package search, trust checks and safe install plans.",
  path: "/agents/mcp-hosts",
  title: "Nipmod for agent hosts"
});

export default function AgentHostsPage() {
  return (
    <main className="page-shell" id="main">
      <section className="setup-hero" aria-labelledby="agent-host-title">
        <div className="setup-hero-copy">
          <p className="eyebrow">Agent hosts</p>
          <h1 id="agent-host-title">{agentHostContent.headline}</h1>
          <p className="lead">{agentHostContent.lead}</p>
          <div className="actions" aria-label="Agent host actions">
            <a className="button button-primary" href="#setup">
              Setup
            </a>
            <a className="button button-ghost" href="/packages">
              Browse packages
            </a>
            <a className="button button-ghost" href="/mcp">
              MCP tools
            </a>
          </div>
        </div>
        <aside className="quickstart-card setup-hero-panel" aria-label="Install command">
          <span>01</span>
          <h2>Install once</h2>
          <p>One local CLI gives supported hosts the same package archive path.</p>
          <CommandBlock command={agentHostContent.installCommand} label="Copy install command" />
        </aside>
      </section>

      <section className="host-section" id="setup" aria-labelledby="host-setup-title">
        <div className="section-head">
          <p className="eyebrow">Host setup</p>
          <h2 id="host-setup-title">Pick the host you use.</h2>
          <p>Both commands register the same local Nipmod MCP server. The archive and proof do not fork per host.</p>
        </div>
        <div className="host-grid">
          {agentHostContent.hosts.map((host) => (
            <article className="host-card" key={host.name}>
              <div className="host-card-head">
                <h3>{host.name}</h3>
                <span>{host.verify}</span>
              </div>
              <CommandBlock command={host.setup} label={`Copy ${host.name} setup command`} />
              <CommandBlock command={host.prompt} label={`Copy ${host.name} prompt`} />
            </article>
          ))}
        </div>
      </section>

      <section className="trust-section" aria-labelledby="shared-prompt-title">
        <div>
          <p className="eyebrow">Agent prompt</p>
          <h2 id="shared-prompt-title">Paste this in a new chat</h2>
        </div>
        <div className="check-list">
          <article className="check-row">
            <span className="check-dot check-ok" aria-hidden="true" />
            <div>
              <h3>Shared instruction</h3>
              <CommandBlock command={agentHostContent.sharedPrompt} label="Copy shared agent prompt" />
            </div>
          </article>
        </div>
      </section>

      <section className="registry-section" aria-labelledby="agent-workflow-title">
        <div className="section-head">
          <p className="eyebrow">Workflow</p>
          <h2 id="agent-workflow-title">What the agent does after setup</h2>
        </div>
        <div className="agent-workflow-grid">
          {agentHostContent.workflow.map((item) => (
            <article className="usage-item" key={item.label}>
              <h2>{item.label}</h2>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="trust-section" aria-labelledby="boundaries-title">
        <div>
          <p className="eyebrow">Boundaries</p>
          <h2 id="boundaries-title">Same archive, controlled writes</h2>
        </div>
        <div className="check-list">
          {agentHostContent.boundaries.map((item) => (
            <article className="check-row" key={item}>
              <span className="check-dot check-ok" aria-hidden="true" />
              <div>
                <h3>{item}</h3>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
