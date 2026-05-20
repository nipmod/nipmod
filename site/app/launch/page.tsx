import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/launch"
  },
  description: "Launch, adoption, review, publishing and multi source registry readiness for Nipmod.",
  openGraph: {
    description: "The public paths for using, reviewing and publishing Nipmod packages.",
    title: "Nipmod launch",
    url: "https://nipmod.com/launch"
  },
  title: "Nipmod launch"
};

const tracks = [
  {
    label: "Use",
    title: "First install loop",
    text: "Install, run doctor, search, inspect, install into a workspace and audit a verified package.",
    command:
      "curl https://nipmod.com/i|bash\nnipmod doctor --online\nnipmod search gitlawb --online\nmkdir -p nipmod-demo && cd nipmod-demo\nnipmod inspect pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0\nnipmod install pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0\nnipmod install\nnipmod outdated\nnipmod audit --online"
  },
  {
    label: "Verify",
    title: "Checksum installer path",
    text: "Use this when a reviewer wants to verify the installer before execution.",
    command:
      "curl -fLO https://nipmod.com/install.sh\ncurl -fLO https://nipmod.com/install.sh.sha256\nshasum -a 256 -c install.sh.sha256\nbash install.sh"
  },
  {
    label: "Publish",
    title: "Self service package candidate",
    text: "Prepare a package from a repo you own and produce the registry candidate before any public index decision.",
    command:
      "nipmod init --name gitlawb-demo-package --dir gitlawb-demo-package\ncd gitlawb-demo-package\nnipmod manifest validate --dir .\nnipmod publish . --dry-run --json"
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

const readiness = [
  {
    label: "Catalog type coverage",
    value: "100",
    text: "Every launch manifest type has a verified package path: skill, MCP server, tool bundle, agent profile, workflow pack, eval pack, policy pack and adapter."
  },
  {
    label: "Audit reproduction path",
    value: "100",
    text: "Trust model, catalog matrix, production gates, restore drill, proof transcript, review packet generator and known risks are reproducible."
  },
  {
    label: "Adoption workflow prepared",
    value: "100",
    text: "First user, package author, repo owner, reviewer and agent host paths are ready. Real adoption evidence is tracked separately."
  }
] as const;

const externalProofTracks = [
  {
    label: "Gitlawb review signal",
    state: "Prepared",
    ready: "Public source, launch demo, founder post, founder DM and non endorsement language are ready.",
    blockedOn: "Needs a Gitlawb founder or maintainer response."
  },
  {
    label: "External human audit",
    state: "Prepared",
    ready: "Review packet, gates, proof loop, threat model and sign off template are ready.",
    blockedOn: "Needs an independent reviewer signature or published findings."
  },
  {
    label: "Real user adoption",
    state: "Waiting",
    ready: "First user loop, author dry run, repo package patch preview and receipt template are ready.",
    blockedOn: "Needs external redacted user receipts. Current ledger count is zero."
  },
  {
    label: "Ecosystem depth",
    state: "First party ready",
    ready: "Verified first party packages cover every launch manifest type.",
    blockedOn: "Needs external package authors accepted into the registry."
  }
] as const;

const founderCopy = {
  post:
    "Gitlawb gives agents decentralized source.\n\nNipmod is the package layer: signed bundles, DID publisher identity, pinned installs, public advisories and witness backed audit.\n\nIndependent project asking for Gitlawb review, not claiming endorsement.\n\nRun the demo and send the strongest objection.\nPublic demo: https://nipmod.com/launch\nSource: https://gitlawb.com/node/repos/z6Mkwbud/nipmod",
  dm:
    "We built Nipmod as an independent package layer for Gitlawb agents. It keeps Gitlawb as decentralized source and adds verification around install: signed bundles, DID publisher identity, pinned lockfiles, public advisories and witness backed audit.\n\nCould you sanity check whether this model fits Gitlawb, should stay independent, or should become a smaller primitive Gitlawb exposes directly?"
} as const;

export default function LaunchPage() {
  return (
    <main className="page-shell" id="main">
      <section className="quickstart-hero" aria-labelledby="launch-title">
        <p className="eyebrow">Launch</p>
        <h1 id="launch-title">Use it. Publish into it. Review it.</h1>
        <p className="lead">
          Nipmod is technically live. The public paths are ready; ecosystem maturity is earned from external users,
          external package authors and independent reviewers running the same proof paths.
        </p>
        <div className="actions" aria-label="Launch actions">
          <a className="button button-primary" href="/quickstart#install">
            Install
          </a>
          <a className="button button-ghost" href="/package">
            Publish
          </a>
          <a className="button button-ghost" href="#external-proof">
            Review
          </a>
        </div>
      </section>

      <section className="ecosystem-section" aria-labelledby="readiness-title">
        <div className="section-head">
          <p className="eyebrow">Readiness</p>
          <h2 id="readiness-title">Launch paths are reproducible.</h2>
        </div>
        <div className="block-grid">
          {readiness.map((item) => (
            <article className="block-card" key={item.label}>
              <span>{item.label}</span>
              <h3>{item.value}%</h3>
              <div
                className="progress-track"
                aria-label={`${item.label} ${item.value} percent`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={Number(item.value)}
                role="progressbar"
              >
                <div className="progress-fill" style={{ width: `${item.value}%` }} />
              </div>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="ecosystem-section" id="external-proof" aria-labelledby="external-proof-title">
        <div className="section-head">
          <p className="eyebrow">External Proof</p>
          <h2 id="external-proof-title">Prepared here. Completed by others.</h2>
        </div>
        <div className="block-grid">
          {externalProofTracks.map((item) => (
            <article className="block-card" key={item.label}>
              <span>{item.label}</span>
              <h3>{item.state}</h3>
              <p>{item.ready}</p>
              <p>{item.blockedOn}</p>
            </article>
          ))}
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

      <section className="proof-section" aria-labelledby="founder-title">
        <div>
          <p className="eyebrow">Founder Review</p>
          <h2 id="founder-title">Send this, then let the proof speak.</h2>
        </div>
        <div className="proof-panel">
          <div className="demo-step">
            <h3>Public post</h3>
            <pre className="install-command">
              <code>{founderCopy.post}</code>
            </pre>
          </div>
          <div className="demo-step">
            <h3>Direct message</h3>
            <pre className="install-command">
              <code>{founderCopy.dm}</code>
            </pre>
          </div>
          <div className="demo-step">
            <h3>Reply template</h3>
            <pre className="install-command">
              <code>
                {
                  "Persona:\nCommands run:\nPackage:\nResult:\nBlocker:\nMay quote anonymously: yes or no\nRedacted output:"
                }
              </code>
            </pre>
          </div>
        </div>
      </section>

      <section className="trust-section" aria-labelledby="truth-title">
        <div>
          <p className="eyebrow">Truth</p>
          <h2 id="truth-title">What becomes 100 only externally</h2>
        </div>
        <div className="check-list">
          {[
            "100 unique external install loops",
            "10 external owner publish dry runs",
            "3 external packages passing verified registry review",
            "1 signed independent review packet",
            "redacted external evidence ledger"
          ].map((item) => (
            <article className="check-row" key={item}>
              <span className="check-dot check-warn" aria-hidden="true" />
              <div>
                <h3>{item}</h3>
                <p>The path exists. This line reaches 100 only with external people or signed review evidence.</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
