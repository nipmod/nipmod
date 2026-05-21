import type { Metadata } from "next";
import aeonCollection from "../../public/integrations/aeon/aeon.collection.json";
import { CommandBlock } from "../command-block";
import { PlatformMark } from "../platform-brand";

const installCommand = "./add-skill nipmod/nipmod nipmod";
const smokePrompt =
  "Use the nipmod skill. Search for gitlawb-repo-reader, inspect trust and return an install plan only. Do not install packages or write files.";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/aeon"
  },
  description: "Review-ready two-way Nipmod bridge draft for Aeon skills and Aeon agents.",
  openGraph: {
    description: "Aeon can review a small skill collection inside Nipmod and a Nipmod skill for Aeon agents.",
    title: "Nipmod for Aeon review",
    url: "https://nipmod.com/aeon"
  },
  title: "Nipmod for Aeon review"
};

export default function AeonPage() {
  const skills = aeonCollection.skills.slice(0, 10);

  return (
    <main className="page-shell" id="main">
      <section className="cursor-hero" aria-labelledby="aeon-title">
        <div className="cursor-hero-copy">
          <div className="cursor-kicker">
            <PlatformMark id="aeon" name="Aeon" />
            <span>Aeon review</span>
          </div>
          <h1 id="aeon-title">Nipmod for Aeon review.</h1>
          <p className="lead">
            Aeon has a large real skill library. This draft covers both directions: a small Aeon collection
            inside Nipmod, and a Nipmod skill that Aeon agents can use before package installs.
          </p>
          <div className="actions" aria-label="Aeon actions">
            <a className="button button-ghost" href="/integrations/aeon/AEON_SUBMISSION.md">
              Review files
            </a>
            <a className="button button-ghost" href="https://github.com/aaronjmars/aeon" rel="noreferrer" target="_blank">
              Aeon repo
            </a>
            <a className="button button-ghost" href="https://github.com/aaronjmars/aeon/pull/199" rel="noreferrer" target="_blank">
              Review PR
            </a>
          </div>
        </div>
        <aside className="quickstart-card cursor-status-panel" aria-label="Aeon status">
          <span>Status</span>
          <h2>Under review</h2>
          <p>Aaron agreed to review the direction. Exact package scope and native workflow still need owner review.</p>
        </aside>
      </section>

      <section className="safety-strip" aria-label="Aeon bridge facts">
        <article className="usage-item">
          <h2>Aeon in Nipmod</h2>
          <p>A first collection draft maps selected Aeon skills to source links, metadata and install plans.</p>
        </article>
        <article className="usage-item">
          <h2>Nipmod in Aeon</h2>
          <p>An Aeon-compatible Nipmod skill lets agents search packages and inspect trust before use.</p>
        </article>
        <article className="usage-item">
          <h2>Owner review</h2>
          <p>No official support or live Aeon package publication is claimed until Aeon accepts the exact scope.</p>
        </article>
      </section>

      <section className="host-section setup-section" aria-labelledby="aeon-collection-title">
        <div className="registry-head">
          <div>
            <p className="eyebrow">Collection draft</p>
            <h2 id="aeon-collection-title">First 10 Aeon skills</h2>
          </div>
        </div>
        <div className="package-grid">
          {skills.map((skill) => (
            <article className="package-card" key={skill.slug}>
              <div className="package-card-top">
                <div>
                  <h3>{skill.name}</h3>
                  <p>{skill.description}</p>
                </div>
                <span className="trust-badge trust-review">draft</span>
              </div>
              <dl className="package-meta">
                <div>
                  <dt>Category</dt>
                  <dd>{skill.category}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{skill.updated}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{skill.sourceSha}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="trust-section setup-section" aria-labelledby="aeon-skill-title">
        <div>
          <p className="eyebrow">Aeon skill</p>
          <h2 id="aeon-skill-title">Nipmod inside Aeon</h2>
          <p>
            After review, Aeon can install the Nipmod skill from this repo. The skill is read-only by default and
            returns package source, trust state and install plans.
          </p>
        </div>
        <CommandBlock command={installCommand} label="Copy Aeon install command" />
      </section>

      <section className="trust-section setup-section" aria-labelledby="aeon-smoke-title">
        <div>
          <p className="eyebrow">Smoke</p>
          <h2 id="aeon-smoke-title">Agent review prompt</h2>
          <p>This checks the workflow without installing packages or writing files.</p>
        </div>
        <CommandBlock command={smokePrompt} label="Copy Aeon review prompt" />
      </section>

      <section className="host-section setup-section" aria-labelledby="aeon-boundary-title">
        <div className="registry-head">
          <div>
            <p className="eyebrow">Claim boundary</p>
            <h2 id="aeon-boundary-title">What is safe to say</h2>
          </div>
        </div>
        <div className="check-list">
          <article className="check-row">
            <span className="check-dot check-ok" aria-hidden="true" />
            <div>
              <h3>Accurate</h3>
              <p>Aeon and Nipmod are drafting a two-way package and skill bridge for review.</p>
            </div>
          </article>
          <article className="check-row">
            <span className="check-dot check-warn" aria-hidden="true" />
            <div>
              <h3>Not claimed</h3>
              <p>Aeon has not approved this exact collection, and Aeon skills are not live Nipmod packages yet.</p>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
