import type { Metadata } from "next";
import { createPageMetadata } from "../../metadata";
import { notFound } from "next/navigation";
import { CommandBlock } from "../../command-block";
import {
  installCommand,
  permissionHighlights,
  safeSourceRepoHref,
  type RegistryPackage
} from "../../../lib/registry";
import { auditSummaryForPackage, packageQuality } from "../../../lib/package-quality";
import {
  findPackage,
  packageEvidenceHref,
  packageDependencyEntries,
  packageDependencyText,
  packageInstallVariants,
  packagePageHref,
  packagePageParams,
  packageVersions
} from "../content";

type PackagePageProps = {
  params: Promise<{
    packageName: string;
  }>;
};

export function generateStaticParams() {
  return packagePageParams();
}

export async function generateMetadata({ params }: PackagePageProps): Promise<Metadata> {
  const { packageName } = await params;
  const pkg = findPackage(packageName);
  const title = pkg ? `${pkg.name} package` : "package";
  const description = pkg
    ? `${pkg.name}: source context, trust signals and a safe install plan through Nipmod.`
    : "Nipmod package record with source context, trust signals and safe install planning.";

  return createPageMetadata({
    description,
    path: pkg ? packagePageHref(pkg) : "/packages",
    title
  });
}

export default async function PackagePage({ params }: PackagePageProps) {
  const { packageName } = await params;
  const pkg = findPackage(packageName);

  if (!pkg) {
    notFound();
  }

  const versions = packageVersions(pkg);
  const sourceRepoHref = safeSourceRepoHref(pkg.sourceRepo);
  const quality = packageQuality(pkg);
  const audit = auditSummaryForPackage(pkg);
  const decisionItems = installDecisionItems(pkg);

  return (
    <main className="page-shell" id="main">
      <section className="package-hero" aria-labelledby="package-title">
        <div>
          <p className="eyebrow">{pkg.type}</p>
          <h1 id="package-title">{pkg.name}</h1>
          <p className="lead">{pkg.description}</p>
          <div className="actions">
            <a className="button button-primary" href="#trust">
              Inspect trust
            </a>
            <a className="button button-ghost" href="#install">
              Plan install
            </a>
            <a className="button button-ghost" href={packageEvidenceHref(pkg)}>
              Evidence
            </a>
            <a className="button button-ghost" href="#audit">
              Audit
            </a>
            {sourceRepoHref ? (
              <a
                className="button button-ghost"
                href={sourceRepoHref}
                aria-label={`Open ${pkg.name} Git source in a new tab`}
                rel="noreferrer"
                target="_blank"
              >
                Source
              </a>
            ) : null}
          </div>
        </div>
        <aside className="package-side" aria-label="Package facts">
          <div className="badge-stack">
            <span className={`trust-badge trust-${pkg.trust.level}`}>{pkg.trust.level}</span>
            <span className={`trust-badge quorum-${pkg.quorum?.status ?? "missing"}`}>{quorumStatusText(pkg)}</span>
            <span className={`trust-badge quality-${quality.label.toLowerCase()}`}>{quality.score}/100</span>
          </div>
          <div className="install-decision">
            <strong>Ready to review</strong>
            {decisionItems.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <dl className="proof-facts">
            <div>
              <dt>Version</dt>
              <dd>{pkg.version}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{pkg.type}</dd>
            </div>
            <div>
              <dt>Quality</dt>
              <dd>{quality.label}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <nav className="package-tabs" aria-label="Package sections">
        {["overview", "install", "versions", "dependencies", "trust", "audit", "advisories", "provenance", "agent-use"].map((item) => (
          <a href={`#${item}`} key={item}>
            {item.replace("-", " ")}
          </a>
        ))}
      </nav>

      <section className="trust-section" id="overview" aria-labelledby="overview-title">
        <div>
          <p className="eyebrow">Overview</p>
          <h2 id="overview-title">What this package gives an agent</h2>
        </div>
        <div className="proof-panel">
          <p className="panel-copy">{pkg.description}</p>
          <p className="panel-copy">
            The signed bundle is stored on Gitlawb, pinned by digest and checked against transparency evidence before
            install. Use the evidence page for the exact source, release and witness proof for this package version.
          </p>
        </div>
      </section>

      <section className="trust-section" id="install" aria-labelledby="install-title">
        <div>
          <p className="eyebrow">Install</p>
          <h2 id="install-title">Inspect first, plan next</h2>
        </div>
        <div className="check-list">
          {packageInstallVariants(pkg).map((variant) => (
            <article className="check-row evidence-row" key={variant.label}>
              <span className="check-dot check-ok" aria-hidden="true" />
              <div>
                <h3>{variant.label}</h3>
                <CommandBlock command={variant.command} label={`Copy ${variant.label} command`} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="trust-section" id="versions" aria-labelledby="versions-title">
        <div>
          <p className="eyebrow">Versions</p>
          <h2 id="versions-title">Published versions</h2>
        </div>
        <div className="proof-panel">
          <dl className="proof-facts">
            {versions.map((version) => (
              <div key={`${version.canonical}@${version.version}`}>
                <dt>{version.version}</dt>
                <dd>
                  {version.distTags
                    ? Object.entries(version.distTags)
                        .filter(([, taggedVersion]) => taggedVersion === version.version)
                        .map(([tag]) => tag)
                        .join(", ") || version.digest
                    : version.digest}
                  {version.deprecated?.active !== false && version.deprecated ? ` deprecated: ${version.deprecated.reason}` : ""}
                  {version.yanked?.active !== false && version.yanked ? ` yanked: ${version.yanked.reason}` : ""}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="trust-section" id="dependencies" aria-labelledby="dependencies-title">
        <div>
          <p className="eyebrow">Dependencies</p>
          <h2 id="dependencies-title">Capability graph</h2>
        </div>
        <div className="proof-panel">
          <p className="panel-copy">{packageDependencyText(pkg)}</p>
          {packageDependencyEntries(pkg).length > 0 ? (
            <dl className="proof-facts">
              {packageDependencyEntries(pkg).map((dependency) => (
                <div key={`${dependency.kind}:${dependency.name}`}>
                  <dt>{dependency.name}</dt>
                  <dd>
                    {dependency.spec} · {dependency.kind}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </section>

      <section className="trust-section" id="trust" aria-labelledby="trust-title">
        <div>
          <p className="eyebrow">Trust</p>
          <h2 id="trust-title">Verification status</h2>
        </div>
        <div className="proof-panel">
          <dl className="proof-facts">
            {[
              { label: "Level", value: pkg.trust.level },
              { label: "Score", value: String(pkg.trust.score) },
              { label: "Artifact digest", value: pkg.trust.evidence.artifactDigestVerified ? "verified" : "missing" },
              { label: "Bundle signature", value: pkg.trust.evidence.bundleSignatureVerified ? "verified" : "missing" },
              { label: "Source provenance", value: pkg.trust.evidence.sourceProvenanceVerified ? "verified" : "missing" },
              { label: "Transparency", value: pkg.trust.evidence.transparencyLogVerified ? "verified" : "missing" },
              { label: "Quorum", value: pkg.quorum ? `${pkg.quorum.status} ${pkg.quorum.approvals}/${pkg.quorum.threshold}` : "missing" },
              { label: "Approval roles", value: pkg.quorum?.approvedRoles.join(", ") ?? "missing" },
              { label: "Quality", value: `${quality.score}/100 ${quality.label}` }
            ].map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="trust-section" id="audit" aria-labelledby="audit-title">
        <div>
          <p className="eyebrow">Audit</p>
          <h2 id="audit-title">Install decision</h2>
        </div>
        <div className="proof-panel">
          <span className={`status-pill ${audit.status === "Ready" ? "status-ok" : "status-review"}`}>{audit.status}</span>
          <dl className="proof-facts">
            {audit.items.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
          <CommandBlock command={audit.command} label="Copy audit command" />
        </div>
      </section>

      <section className="trust-section" id="advisories" aria-labelledby="advisories-title">
        <div>
          <p className="eyebrow">Advisories</p>
          <h2 id="advisories-title">Install risk</h2>
        </div>
        <div className="proof-panel">
          <p className="panel-copy">
            {pkg.quarantine?.status === "active"
              ? `${pkg.quarantine.advisoryId}: ${pkg.quarantine.reason}`
              : pkg.yanked?.active !== false && pkg.yanked
              ? `Yanked: ${pkg.yanked.reason}`
              : pkg.deprecated?.active !== false && pkg.deprecated
              ? `Deprecated: ${pkg.deprecated.reason}`
              : "No active high or critical quarantine blocks this package version."}
          </p>
          <pre className="install-command">
            <code>{installCommand(pkg)}</code>
          </pre>
        </div>
      </section>

      <section className="trust-section" id="provenance" aria-labelledby="provenance-title">
        <div>
          <p className="eyebrow">Provenance</p>
          <h2 id="provenance-title">Gitlawb source and proof</h2>
        </div>
        <div className="proof-panel">
          <dl className="proof-facts">
            {[
              { label: "Canonical", value: `${pkg.canonical}@${pkg.version}` },
              { label: "Digest", value: pkg.digest },
              { label: "Source tag", value: pkg.sourceTag ?? "missing" },
              { label: "Source commit", value: pkg.sourceCommit ?? "missing" },
              { label: "Quorum receipt", value: pkg.quorum?.receiptUrl ?? "missing" },
              { label: "Root", value: pkg.proof?.rootHash ?? "missing" }
            ].map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="trust-section" id="agent-use" aria-labelledby="agent-use-title">
        <div>
          <p className="eyebrow">Agent use</p>
          <h2 id="agent-use-title">Permissions and host fit</h2>
        </div>
        <div className="proof-panel">
          <div className="permission-row" aria-label={`${pkg.name} permissions`}>
            {permissionHighlights(pkg).map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <p className="panel-copy">
            Agents should inspect first, then install only when trust score, permissions, advisories and local policy match
            the workspace.
          </p>
        </div>
      </section>
    </main>
  );
}

function installDecisionItems(pkg: RegistryPackage): string[] {
  return [
    pkg.trust.evidence.bundleSignatureVerified ? "Signed bundle" : "Signature missing",
    pkg.trust.evidence.artifactDigestVerified ? "Digest pinned" : "Digest missing",
    pkg.quorum?.status === "passed" ? `Quorum ${pkg.quorum.approvals}/${pkg.quorum.threshold}` : "Quorum missing",
    pkg.quarantine?.status === "active" ? "Active advisory block" : "No active advisory block"
  ];
}

function quorumStatusText(pkg: RegistryPackage): string {
  return pkg.quorum ? `quorum ${pkg.quorum.approvals}/${pkg.quorum.threshold}` : "quorum missing";
}
