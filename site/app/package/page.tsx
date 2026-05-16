import type { Metadata } from "next";
import { homeContent } from "../content";
import { SiteHeader } from "../site-header";
import { PackageDraftForm } from "./package-draft-form";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/package"
  },
  description: "Create a nipmod package draft from a public Gitlawb repo and claim it with a DID signature.",
  openGraph: {
    description: "Create a nipmod package draft from a public Gitlawb repo and claim it with a DID signature.",
    title: "Package a Gitlawb repo",
    url: "https://nipmod.com/package"
  },
  title: "Package a Gitlawb repo"
};

export default function PackagePage() {
  return (
    <main className="page-shell">
      <SiteHeader />

      <section className="quickstart-hero" aria-labelledby="package-title">
        <p className="eyebrow">Package</p>
        <h1 id="package-title">{homeContent.repoToPackage.headline}</h1>
        <p className="lead">{homeContent.repoToPackage.lead}</p>
        <div className="actions" aria-label="Package actions">
          <a className="button button-primary" href="/install.sh">
            Install
          </a>
          <a className="button button-ghost" href="/quickstart">
            Start
          </a>
        </div>
      </section>

      <PackageDraftForm
        inputLabel={homeContent.repoToPackage.inputLabel}
        inputPlaceholder={homeContent.repoToPackage.inputPlaceholder}
      />

      <section className="usage-strip" aria-label="Repo to package steps">
        {homeContent.repoToPackage.steps.map((step) => (
          <article className="usage-item" key={step.label}>
            <h2>{step.label}</h2>
            <p>{step.text}</p>
          </article>
        ))}
      </section>

      <section className="proof-section" aria-labelledby="boundary-title">
        <div>
          <p className="eyebrow">Boundary</p>
          <h2 id="boundary-title">Gitlawb stores it. nipmod verifies it.</h2>
        </div>
        <div className="proof-panel">
          <p className="panel-copy">
            Moving refs are not enough. A green package needs digest, DID signature, release event, transparency,
            witness and advisory evidence.
          </p>
          <pre className="install-command">
            <code>{"nipmod publish repo --dry-run --json"}</code>
          </pre>
        </div>
      </section>
    </main>
  );
}
