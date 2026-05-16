import type { Metadata } from "next";
import { SiteHeader } from "../site-header";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/launch"
  },
  description: "Launch, adoption, review, publishing and multi source registry readiness for nipmod.",
  openGraph: {
    description: "The public paths for using, reviewing and publishing nipmod packages.",
    title: "nipmod launch",
    url: "https://nipmod.com/launch"
  },
  title: "nipmod launch"
};

const tracks = [
  {
    label: "Use",
    title: "First install loop",
    text: "Install, run doctor, search, inspect, add and audit a verified package.",
    command:
      "curl -fL https://nipmod.com/install.sh -o install.sh\ncurl -fL https://nipmod.com/install.sh.sha256 -o install.sh.sha256\nshasum -a 256 -c install.sh.sha256\nbash install.sh\nnipmod doctor\nnipmod add gitlawb-release-review --online"
  },
  {
    label: "Publish",
    title: "Self service package candidate",
    text: "Create a Gitlawb package draft and produce the registry candidate before any public index decision.",
    command:
      "nipmod package gitlawb://did:key:z6Mk.../repo --dir repo\nnipmod manifest validate --dir repo\nnipmod publish repo --dry-run --json"
  },
  {
    label: "Review",
    title: "Independent review packet",
    text: "Review the source, production gates, load smoke, supply chain check and known limitations.",
    command:
      "node tools/verify-all.mjs --prod\nnode tools/prod-load-smoke.mjs --profile launch\nnode tools/supply-chain-check.mjs"
  },
  {
    label: "Mirror",
    title: "Multi source search",
    text: "Search multiple registry indexes while failing closed on conflicting package digests.",
    command:
      "nipmod search policy --registries https://nipmod.com/registry/packages.json,https://mirror.example/packages.json"
  }
] as const;

export default function LaunchPage() {
  return (
    <main className="page-shell">
      <SiteHeader />

      <section className="quickstart-hero" aria-labelledby="launch-title">
        <p className="eyebrow">Launch</p>
        <h1 id="launch-title">Use it. Publish into it. Review it.</h1>
        <p className="lead">
          nipmod is technically live. Real ecosystem maturity comes from external users, external package authors and
          independent reviewers running the same proof paths.
        </p>
        <div className="actions" aria-label="Launch actions">
          <a className="button button-primary" href="/install.sh">
            Install
          </a>
          <a className="button button-ghost" href="/package">
            Publish
          </a>
          <a className="button button-ghost" href="/security">
            Review
          </a>
        </div>
      </section>

      <section className="quickstart-grid" aria-label="Launch tracks">
        {tracks.map((track) => (
          <article className="quickstart-card" key={track.label}>
            <span>{track.label}</span>
            <h2>{track.title}</h2>
            <p>{track.text}</p>
            <pre className="install-command">
              <code>{track.command}</code>
            </pre>
          </article>
        ))}
      </section>

      <section className="trust-section" aria-labelledby="truth-title">
        <div>
          <p className="eyebrow">Truth</p>
          <h2 id="truth-title">What becomes 100 only externally</h2>
        </div>
        <div className="check-list">
          {[
            "100 unique external install loops",
            "10 external publish dry run candidates",
            "3 external packages passing verified registry review",
            "1 signed independent review packet",
            "2 alert destinations outside Vercel and Fly"
          ].map((item) => (
            <article className="check-row" key={item}>
              <span className="check-dot check-warn" aria-hidden="true" />
              <div>
                <h3>{item}</h3>
                <p>Technical readiness is live; this needs external people or accounts.</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
