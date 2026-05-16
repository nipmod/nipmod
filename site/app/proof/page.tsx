import type { Metadata } from "next";
import { SiteHeader } from "../site-header";
import { proofContent } from "./content";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/proof"
  },
  description: "Run the nipmod public proof loop for verified install, audit and unsafe manifest blocking.",
  openGraph: {
    description: "A public package installs cleanly, audits cleanly and unsafe manifests fail before release.",
    title: "nipmod proof",
    url: "https://nipmod.com/proof"
  },
  title: "nipmod proof"
};

export default function ProofPage() {
  return (
    <main className="page-shell">
      <SiteHeader />

      <section className="proof-hero" aria-labelledby="proof-title">
        <p className="eyebrow">Proof</p>
        <h1 id="proof-title">{proofContent.headline}</h1>
        <p className="lead">{proofContent.lead}</p>
        <div className="actions" aria-label="Proof actions">
          <a className="button button-primary" href="/install.sh">
            Install
          </a>
          <a className="button button-ghost" href="/trust">
            Trust
          </a>
          <a className="button button-ghost" href={proofContent.transcript}>
            Transcript
          </a>
        </div>
      </section>

      <section className="trust-grid" aria-label="Proof state">
        <article className="stat-tile">
          <span>{proofContent.registry.count}</span>
          <p>Verified packages</p>
        </article>
        <article className="stat-tile">
          <span>{proofContent.registry.treeSize}</span>
          <p>Transparency leaves</p>
        </article>
        <article className="stat-tile">
          <span>{proofContent.registry.trust}</span>
          <p>Registry trust</p>
        </article>
      </section>

      <section className="proof-section" aria-labelledby="safe-title">
        <div>
          <p className="eyebrow">Safe path</p>
          <h2 id="safe-title">Install one package. Verify every step.</h2>
        </div>
        <div className="proof-panel">
          <pre className="install-command">
            <code>{proofContent.safeCommands.join("\n")}</code>
          </pre>
          <dl className="proof-facts">
            <div>
              <dt>Package</dt>
              <dd>{proofContent.packageName}</dd>
            </div>
            <div>
              <dt>Expected trust</dt>
              <dd>{proofContent.registry.trust}</dd>
            </div>
            <div>
              <dt>Checkpoint</dt>
              <dd>{proofContent.registry.rootHash}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="proof-section" aria-labelledby="blocked-title">
        <div>
          <p className="eyebrow">Blocks</p>
          <h2 id="blocked-title">Unsafe manifests fail before release.</h2>
        </div>
        <div className="block-grid">
          {proofContent.blockedCases.map((item) => (
            <article className="block-card" key={item.label}>
              <h3>{item.label}</h3>
              <p>{item.expected}</p>
              <span>{item.blockedBy}</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
