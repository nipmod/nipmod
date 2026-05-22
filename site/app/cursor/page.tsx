import { createPageMetadata } from "../metadata";
import { CommandBlock } from "../command-block";
import { PlatformMark } from "../platform-brand";
import { cursorContent, cursorInstallLink, cursorMcpJson } from "./content";

export const metadata = createPageMetadata({
  description: "Use Nipmod in Cursor for package search, trust checks and install plans through MCP.",
  path: "/cursor",
  title: "Nipmod for Cursor"
});

export default function CursorPage() {
  return (
    <main className="page-shell" id="main">
      <section className="cursor-hero" aria-labelledby="cursor-title">
        <div className="cursor-hero-copy">
          <div className="cursor-kicker">
            <PlatformMark id="cursor" name="Cursor" />
            <span>Cursor MCP</span>
          </div>
          <h1 id="cursor-title">{cursorContent.headline}</h1>
          <p className="lead">{cursorContent.lead}</p>
          <div className="actions" aria-label="Cursor actions">
            <a className="button button-primary button-with-icon" href={cursorInstallLink}>
              <PlatformMark id="cursor" name="Cursor" />
              Add to Cursor
            </a>
            <a className="button button-ghost" href="#manual">
              Manual setup
            </a>
            <a className="button button-ghost" href="#review">
              Review files
            </a>
          </div>
        </div>
        <aside className="quickstart-card cursor-status-panel" aria-label="Cursor status">
          <span>Status</span>
          <h2>MCP ready</h2>
          <p>Usable now through Cursor MCP. Official marketplace wording waits for Cursor review.</p>
        </aside>
      </section>

      <section className="safety-strip" aria-label="Cursor readiness">
        {cursorContent.status.map((item) => (
          <article className="usage-item" key={item.label}>
            <h2>{item.label}</h2>
            <p>{item.text}</p>
          </article>
        ))}
      </section>

      <section className="trust-section setup-section" id="manual" aria-labelledby="cursor-setup-title">
        <div>
          <p className="eyebrow">Setup</p>
          <h2 id="cursor-setup-title">Two clean paths</h2>
          <p>Install the CLI once, then use the Cursor button or write the project config from the CLI.</p>
        </div>
        <div className="setup-command-stack">
          <CommandBlock command={cursorContent.installCommand} label="Copy Nipmod install command" />
          <CommandBlock command={cursorContent.setupCommand} label="Copy Cursor setup command" />
          <CommandBlock command={cursorContent.verifyCommand} label="Copy Cursor verify command" />
        </div>
      </section>

      <section className="trust-section setup-section" aria-labelledby="cursor-config-title">
        <div>
          <p className="eyebrow">Config</p>
          <h2 id="cursor-config-title">Project MCP config</h2>
          <p>Nipmod writes this to <code>.cursor/mcp.json</code> and keeps existing Cursor MCP servers.</p>
        </div>
        <CommandBlock command={cursorMcpJson} label="Copy Cursor MCP JSON" />
      </section>

      <section className="host-section setup-section" aria-labelledby="cursor-tools-title">
        <div className="registry-head">
          <div>
            <p className="eyebrow">Tools</p>
            <h2 id="cursor-tools-title">What Cursor gets</h2>
            <p>Cursor receives the same package tools as the local Nipmod MCP server.</p>
          </div>
        </div>
        <div className="package-links" aria-label="Cursor Nipmod tools">
          {cursorContent.tools.map((tool) => (
            <span className="pill" key={tool}>
              {tool}
            </span>
          ))}
        </div>
        <div className="check-list">
          <article className="check-row">
            <span className="check-dot check-ok" aria-hidden="true" />
            <div>
              <h3>Tell Cursor</h3>
              <CommandBlock command={cursorContent.prompt} label="Copy Cursor prompt" />
            </div>
          </article>
        </div>
      </section>

      <section className="trust-section setup-section" id="review" aria-labelledby="cursor-review-title">
        <div>
          <p className="eyebrow">Submission</p>
          <h2 id="cursor-review-title">Ready for Cursor review</h2>
          <p>This is the package we can send to Cursor when you submit or DM them.</p>
        </div>
        <div className="check-list">
          <article className="check-row">
            <span className="check-dot check-ok" aria-hidden="true" />
            <div>
              <h3>Accurate public line</h3>
              <p>{cursorContent.accuratePost}</p>
            </div>
          </article>
          <article className="check-row">
            <span className="check-dot check-warn" aria-hidden="true" />
            <div>
              <h3>Claim boundary</h3>
              <p>{cursorContent.notYet}</p>
            </div>
          </article>
        </div>
        <div className="package-links">
          {cursorContent.reviewLinks.map((link) => (
            <a href={link.href} key={link.href}>
              {link.label}
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
