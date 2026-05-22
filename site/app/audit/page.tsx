import type { Metadata } from "next";
import { withPreviewImage } from "../metadata";
import registryData from "../registry-data.json";
import { CommandBlock } from "../command-block";
import { auditSummaryForPackage, packageQualityStats } from "../../lib/package-quality";
import { registryTrustSummary, searchPackages, type RegistryIndex } from "../../lib/registry";
import { packageEvidenceHref, packagePageHref } from "../packages/content";

const registry = registryData as RegistryIndex;
const summary = registryTrustSummary(registry);
const publicPackages = searchPackages(registry.packages, "");
const auditPackages = publicPackages.slice(0, 8);

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/audit"
  },
  description: "Audit Nipmod packages before install with trust, permission, advisory and provenance checks.",
  openGraph: withPreviewImage({
    description: "Audit Nipmod packages before install with trust, permission, advisory and provenance checks.",
    title: "Nipmod audit",
    url: "https://nipmod.com/audit"
  }),
  title: "Nipmod audit"
};

export default function AuditPage() {
  return (
    <main className="page-shell" id="main">
      <section className="quickstart-hero" aria-labelledby="audit-page-title">
        <p className="eyebrow">Audit</p>
        <h1 id="audit-page-title">Audit before install.</h1>
        <p className="lead">Check trust, quality, permissions and advisories before an agent changes a workspace.</p>
        <div className="actions" aria-label="Audit actions">
          <a className="button button-primary" href="/packages">
            Packages
          </a>
          <a className="button button-ghost" href="/trust">
            Trust
          </a>
        </div>
      </section>

      <section className="registry-section" aria-labelledby="audit-registry-title">
        <div className="section-head">
          <p className="eyebrow">Registry</p>
          <h2 id="audit-registry-title">Current audit surface</h2>
        </div>
        <div className="registry-stats" aria-label="Audit stats">
          {[...summary.cards, ...packageQualityStats(publicPackages)].map((item) => (
            <div className="stat-tile" key={item.label}>
              <span>{item.value}</span>
              <p>{item.label}</p>
            </div>
          ))}
        </div>
        <CommandBlock command={"nipmod audit --online\nnipmod ci --online"} label="Copy audit commands" />
      </section>

      <section className="trust-section" aria-labelledby="audit-checks-title">
        <div>
          <p className="eyebrow">Checks</p>
          <h2 id="audit-checks-title">What needs to pass</h2>
        </div>
        <div className="check-list">
          {summary.checks.map((check) => (
            <article className="check-row" key={check.label}>
              <span className={`check-dot ${check.ok ? "check-ok" : "check-warn"}`} aria-hidden="true" />
              <div>
                <h3>{check.label}</h3>
                <p>{check.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="registry-section" aria-labelledby="audit-packages-title">
        <div className="section-head">
          <p className="eyebrow">Packages</p>
          <h2 id="audit-packages-title">Package audit cards</h2>
        </div>
        <div className="package-grid">
          {auditPackages.map((pkg) => {
            const audit = auditSummaryForPackage(pkg);
            return (
              <article className="package-card" key={`${pkg.canonical}@${pkg.version}`}>
                <div className="package-card-top">
                  <div>
                    <h3>
                      <a href={packagePageHref(pkg)}>{pkg.name}</a>
                    </h3>
                    <p>{pkg.description}</p>
                  </div>
                  <span className={`status-pill ${audit.status === "Ready" ? "status-ok" : "status-review"}`}>{audit.status}</span>
                </div>
                <dl className="package-meta">
                  {audit.items.slice(0, 3).map((item) => (
                    <div key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
                <pre className="install-command">
                  <code>{audit.command}</code>
                </pre>
                <div className="package-links">
                  <a href={packagePageHref(pkg)}>Package</a>
                  <a href={packageEvidenceHref(pkg)}>Evidence</a>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
