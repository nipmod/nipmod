import type { Metadata } from "next";
import { CommandBlock } from "../command-block";
import { setupContent } from "./content";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/setup"
  },
  description: "Set up Nipmod for Codex, Claude Code and OpenCode.",
  openGraph: {
    description: "Install Nipmod once, connect your agent and use the package archive from agent chat.",
    title: "Nipmod setup",
    url: "https://nipmod.com/setup"
  },
  title: "Setup Nipmod"
};

export default function SetupPage() {
  return (
    <main className="page-shell" id="main">
      <section className="setup-hero" aria-labelledby="setup-title">
        <div className="setup-hero-copy">
          <p className="eyebrow">Setup</p>
          <h1 id="setup-title">{setupContent.headline}</h1>
          <p className="lead">{setupContent.lead}</p>
          <div className="actions" aria-label="Setup actions">
            <a className="button button-primary" href="#install">
              Install once
            </a>
            <a className="button button-ghost" href="#agent">
              Choose agent
            </a>
            <a className="button button-ghost" href="/mcp">
              MCP details
            </a>
            <a className="button button-ghost" href="/agents/codex-claude">
              Codex and Claude
            </a>
          </div>
        </div>
        <aside className="quickstart-card setup-hero-panel" aria-label="First setup command">
          <span>01</span>
          <h2>Copy into Terminal</h2>
          <p>This is the only command needed before connecting Codex, Claude Code or OpenCode.</p>
          <CommandBlock command={setupContent.installCommand} label="Copy first Nipmod install command" />
        </aside>
      </section>

      <section className="trust-section setup-section" id="install" aria-labelledby="install-once-title">
        <div>
          <p className="eyebrow">Step 1</p>
          <h2 id="install-once-title">Install Nipmod once</h2>
          <p>Paste this in Terminal. After it finishes, run the check command below it.</p>
        </div>
        <div className="setup-command-stack">
          <CommandBlock command={setupContent.installCommand} label="Copy Nipmod install command" />
          <CommandBlock command={setupContent.checkCommand} label="Copy Nipmod check command" />
          <CommandBlock command={setupContent.allAgentsCommand} label="Copy all agents setup command" />
        </div>
      </section>

      <section className="setup-path" aria-label="Nipmod setup path">
        {setupContent.steps.map((step, index) => (
          <article className="quickstart-card setup-step-card" key={step.label}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h2>{step.label}</h2>
            <p>{step.text}</p>
          </article>
        ))}
      </section>

      <section className="host-section setup-section" id="agent" aria-labelledby="agent-setup-title">
        <div className="registry-head">
          <div>
            <p className="eyebrow">Step 2</p>
            <h2 id="agent-setup-title">Choose your agent</h2>
            <p>Paste one matching command. This gives the agent direct Nipmod tools for package search, trust checks and install plans.</p>
          </div>
        </div>

        <div className="host-grid">
          {setupContent.hosts.map((host) => (
            <article className="host-card" key={host.name}>
              <div className="host-card-head">
                <h3>{host.name}</h3>
                <span>{host.label}</span>
              </div>
              <p className="panel-copy">{host.text}</p>
              <CommandBlock command={host.command} label={`Copy ${host.name} setup command`} />
              <div>
                <p className="eyebrow">Check</p>
                <CommandBlock command={host.verify} label={`Copy ${host.name} check command`} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="trust-section setup-section" id="prompt" aria-labelledby="agent-prompt-title">
        <div>
          <p className="eyebrow">Step 3</p>
          <h2 id="agent-prompt-title">Tell the agent</h2>
          <p>Start a new chat after setup and paste this once.</p>
        </div>
        <div className="check-list">
          <article className="check-row">
            <span className="check-dot check-ok" aria-hidden="true" />
            <div>
              <h3>Use Nipmod before package installs.</h3>
              <CommandBlock command={setupContent.agentPrompt} label="Copy agent setup prompt" />
            </div>
          </article>
        </div>
      </section>

      <section className="safety-strip setup-section" aria-label="What agents can do with Nipmod">
        {setupContent.capabilities.map((item) => (
          <article className="usage-item" key={item.label}>
            <h2>{item.label}</h2>
            <p>{item.text}</p>
          </article>
        ))}
      </section>

      <section className="trust-section setup-section" aria-labelledby="setup-checks-title">
        <div>
          <p className="eyebrow">Result</p>
          <h2 id="setup-checks-title">What changes after setup</h2>
        </div>
        <div className="check-list">
          {setupContent.checks.map((item) => (
            <article className="check-row" key={item.label}>
              <span className="check-dot check-ok" aria-hidden="true" />
              <div>
                <h3>{item.label}</h3>
                <p>{item.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
