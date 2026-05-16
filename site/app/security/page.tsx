import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/security"
  },
  description: "Security policy, vulnerability reporting and incident response for nipmod.",
  openGraph: {
    description: "Report nipmod vulnerabilities and verify the public security policy.",
    title: "nipmod security",
    url: "https://nipmod.com/security"
  },
  title: "nipmod security"
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
          nipmod does not control Gitlawb content. It verifies packages, publishes signed advisories and blocks unsafe
          install surfaces when a package becomes risky.
        </p>
        <div className="actions" aria-label="Security actions">
          <a className="button button-primary" href="/evidence#security">
            security.txt
          </a>
          <a className="button button-ghost" href="/evidence#advisories">
            Advisories
          </a>
          <a
            className="button button-ghost"
            href="https://x.com/Nipmod"
            aria-label="Open nipmod on X in a new tab"
            rel="noreferrer"
            target="_blank"
          >
            X fallback
          </a>
        </div>
      </section>

      <section className="trust-section" aria-labelledby="report-title">
        <div>
          <p className="eyebrow">Report</p>
          <h2 id="report-title">What to include</h2>
        </div>
        <div className="check-list">
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
                <p>Content remains on Gitlawb; nipmod changes verification, warnings and install decisions.</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
