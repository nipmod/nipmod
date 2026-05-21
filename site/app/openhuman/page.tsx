import type { Metadata } from "next";
import { PlatformMark } from "../platform-brand";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/openhuman"
  },
  description: "OpenHuman review path for the Nipmod package archive.",
  openGraph: {
    description: "OpenHuman can review a Nipmod skill install path and a draft native skill for package search, trust inspection and install plans.",
    title: "Nipmod for OpenHuman review",
    url: "https://nipmod.com/openhuman"
  },
  robots: {
    follow: false,
    index: false
  },
  title: "Nipmod for OpenHuman review"
};

export default function OpenHumanPage() {
  return (
    <main className="page-shell" id="main">
      <section className="cursor-hero" aria-labelledby="openhuman-title">
        <div className="cursor-hero-copy">
          <div className="cursor-kicker">
            <PlatformMark id="openhuman" name="OpenHuman" />
            <span>OpenHuman review</span>
          </div>
          <h1 id="openhuman-title">Nipmod for OpenHuman review.</h1>
          <p className="lead">
            OpenHuman has a safe first path through its public <code>SKILL.md</code> installer. A docs PR is open
            for review, and a native OpenHuman skill implementation is prepared in the Nipmod fork because the
            upstream skills repository is currently archived.
          </p>
          <div className="actions" aria-label="OpenHuman actions">
            <a className="button button-primary" href="https://github.com/tinyhumansai/openhuman/pull/2432" rel="noreferrer" target="_blank">
              Docs PR
            </a>
            <a className="button button-ghost" href="/integrations/openhuman/OPENHUMAN_SUBMISSION.md">
              Review files
            </a>
            <a className="button button-ghost" href="https://github.com/nipmod/openhuman-skills/tree/add-nipmod-skill" rel="noreferrer" target="_blank">
              Skill branch
            </a>
          </div>
        </div>
        <aside className="quickstart-card cursor-status-panel" aria-label="OpenHuman status">
          <span>Status</span>
          <h2>Under review</h2>
          <p>Docs PR open. Native skill prepared in a fork. Not official until Tiny Humans reviews or accepts it.</p>
        </aside>
      </section>

      <section className="safety-strip" aria-label="OpenHuman connection facts">
        <article className="usage-item">
          <h2>Skill install</h2>
          <p>OpenHuman can install public GitHub <code>SKILL.md</code> files and rewrite blob URLs to raw content.</p>
        </article>
        <article className="usage-item">
          <h2>Read-only</h2>
          <p>Nipmod is used first for package search, trust inspection and install planning.</p>
        </article>
        <article className="usage-item">
          <h2>Owner review</h2>
          <p>OpenHuman code and skill ownership stays with Tiny Humans.</p>
        </article>
      </section>

      <section className="trust-section setup-section" aria-labelledby="openhuman-config-title">
        <div>
          <p className="eyebrow">Skill</p>
          <h2 id="openhuman-config-title">Current usable path</h2>
          <p>Install the Nipmod skill instructions from GitHub, then ask OpenHuman for a package search and install plan.</p>
        </div>
        <div className="proof-panel">
          <div className="package-links">
            <a href="https://github.com/nipmod/nipmod/blob/main/skills/nipmod/SKILL.md" rel="noreferrer" target="_blank">
              Nipmod SKILL.md
            </a>
            <a href="https://github.com/tinyhumansai/openhuman/pull/2432" rel="noreferrer" target="_blank">
              OpenHuman docs PR
            </a>
            <a href="https://github.com/nipmod/openhuman-skills/tree/add-nipmod-skill" rel="noreferrer" target="_blank">
              Draft native skill
            </a>
            <a href="https://nipmod.com/api/mcp" rel="noreferrer" target="_blank">
              Read-only MCP endpoint
            </a>
          </div>
        </div>
      </section>

      <section className="host-section setup-section" aria-labelledby="openhuman-boundary-title">
        <div className="registry-head">
          <div>
            <p className="eyebrow">Claim boundary</p>
            <h2 id="openhuman-boundary-title">What is safe to say</h2>
          </div>
        </div>
        <div className="check-list">
          <article className="check-row">
            <span className="check-dot check-ok" aria-hidden="true" />
            <div>
              <h3>Accurate</h3>
              <p>OpenHuman has an open Nipmod docs PR and a prepared native skill branch for review.</p>
            </div>
          </article>
          <article className="check-row">
            <span className="check-dot check-warn" aria-hidden="true" />
            <div>
              <h3>Not claimed</h3>
              <p>No official OpenHuman support, endorsement, merged docs or OpenHuman-owned package collection is claimed yet.</p>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
