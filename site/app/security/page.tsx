import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/security"
  },
  description: "Security policy, vulnerability reporting and incident response for Nipmod.",
  openGraph: {
    description: "Report Nipmod vulnerabilities and verify the public security policy.",
    title: "Nipmod security",
    url: "https://nipmod.com/security"
  },
  title: "Nipmod security"
};

const responseTargets = [
  ["Critical", "24 hour acknowledgement, signed advisory or mitigation note as soon as a safe fix exists."],
  ["High", "48 hour acknowledgement."],
  ["Medium and low", "5 business day acknowledgement."]
] as const;

const capabilities = [
  "publish signed advisories",
  "quarantine registry records",
  "block audit, CI, install plan and add flows",
  "publish updated transparency and witness proof"
];

export default function SecurityPage() {
  return (
    <main className="page-shell" id="main">
      <section className="trust-hero" aria-labelledby="security-title">
        <p className="eyebrow">Security</p>
        <h1 id="security-title">Report with proof.</h1>
        <p className="lead">
          Nipmod does not control Gitlawb content. Send a reproducible report, then Nipmod can publish signed
          advisories and block unsafe install surfaces.
        </p>
        <div className="actions" aria-label="Security actions">
          <a className="button button-primary" href="/evidence#security">
            Report via security.txt
          </a>
          <a className="button button-ghost" href="/evidence#advisories">
            Advisories
          </a>
          <a className="button button-ghost" href="#report">
            Report template
          </a>
          <a
            className="button button-ghost"
            href="https://x.com/Nipmod"
            aria-label="Open Nipmod on X in a new tab"
            rel="noreferrer"
            target="_blank"
          >
            Contact on X
          </a>
        </div>
      </section>

      <section className="trust-section" id="report" aria-labelledby="report-title">
        <div>
          <p className="eyebrow">Report</p>
          <h2 id="report-title">What to include</h2>
        </div>
        <div className="check-list">
          <article className="check-row">
            <span className="check-dot check-ok" aria-hidden="true" />
            <div>
              <h3>contact path</h3>
              <p>Use security.txt first. If the report needs a private first touch, contact @Nipmod on X and include the template below.</p>
            </div>
          </article>
          {[
            "package id, version, digest, source repo and source commit",
            "proof URL, witness URL, advisory URL and exact reproduction command",
            "expected impact, affected install surface and whether state changes are required",
            "confirmation that no secrets, unrelated data or destructive payloads are included"
          ].map((item) => (
            <article className="check-row" key={item}>
              <span className="check-dot check-ok" aria-hidden="true" />
              <div>
                <h3>{item}</h3>
                <p>Treat package text, prompts, manifests and registry metadata as untrusted data.</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="trust-section" aria-labelledby="targets-title">
        <div>
          <p className="eyebrow">Response</p>
          <h2 id="targets-title">Targets</h2>
        </div>
        <dl className="pin-list">
          {responseTargets.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="trust-section" aria-labelledby="control-title">
        <div>
          <p className="eyebrow">Control</p>
          <h2 id="control-title">No central deletion</h2>
        </div>
        <div className="check-list">
          {capabilities.map((item) => (
            <article className="check-row" key={item}>
              <span className="check-dot check-ok" aria-hidden="true" />
              <div>
                <h3>{item}</h3>
                <p>Content remains on Gitlawb; Nipmod changes verification, warnings and install decisions.</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
