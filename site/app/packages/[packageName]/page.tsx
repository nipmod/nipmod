import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  installCommand,
  permissionHighlights,
  safeSourceRepoHref,
  shortDid
} from "../../../lib/registry";
import {
  findPackage,
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

  return {
    alternates: {
      canonical: pkg ? `https://nipmod.com${packagePageHref(pkg)}` : "https://nipmod.com/packages"
    },
    description: pkg ? `${pkg.name}: ${pkg.description}` : "Verified nipmod package.",
    openGraph: {
      description: pkg ? `${pkg.name}: ${pkg.description}` : "Verified nipmod package.",
      title,
      url: pkg ? `https://nipmod.com${packagePageHref(pkg)}` : "https://nipmod.com/packages"
    },
    title
  };
}

export default async function PackagePage({ params }: PackagePageProps) {
  const { packageName } = await params;
  const pkg = findPackage(packageName);

  if (!pkg) {
    notFound();
  }

  const versions = packageVersions(pkg);
  const sourceRepoHref = safeSourceRepoHref(pkg.sourceRepo);

  return (
    <main className="page-shell" id="main">
      <section className="package-hero" aria-labelledby="package-title">
        <div>
          <p className="eyebrow">{pkg.type}</p>
          <h1 id="package-title">{pkg.name}</h1>
          <p className="lead">{pkg.description}</p>
          <div className="actions">
            <a className="button button-primary" href="#install">
              Install
            </a>
            <a className="button button-ghost" href={`/evidence/package/${encodeURIComponent(pkg.name)}#package-proof`}>
              Evidence
            </a>
            {sourceRepoHref ? (
              <a className="button button-ghost" href={sourceRepoHref} rel="noreferrer" target="_blank">
                Source
              </a>
            ) : null}
          </div>
        </div>
        <aside className="package-side" aria-label="Package facts">
          <span className={`trust-badge trust-${pkg.trust.level}`}>{pkg.trust.level}</span>
          <dl className="proof-facts">
            <div>
              <dt>Version</dt>
              <dd>{pkg.version}</dd>
            </div>
            <div>
              <dt>Publisher</dt>
              <dd>{shortDid(pkg.publisher)}</dd>
            </div>
            <div>
              <dt>Score</dt>
              <dd>{pkg.trust.score}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <nav className="package-tabs" aria-label="Package sections">
        {["readme", "install", "versions", "dependencies", "trust", "advisories", "provenance", "agent-use"].map((item) => (
          <a href={`#${item}`} key={item}>
            {item.replace("-", " ")}
          </a>
        ))}
      </nav>

      <section className="trust-section" id="readme" aria-labelledby="readme-title">
        <div>
          <p className="eyebrow">Readme</p>
          <h2 id="readme-title">What this package gives an agent</h2>
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
          <h2 id="install-title">Choose the safest command for the job</h2>
        </div>
        <div className="check-list">
          {packageInstallVariants(pkg).map((variant) => (
            <article className="check-row evidence-row" key={variant.label}>
              <span className="check-dot check-ok" aria-hidden="true" />
              <div>
                <h3>{variant.label}</h3>
                <pre className="install-command">
                  <code>{variant.command}</code>
                </pre>
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
                <dd>{version.digest}</dd>
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
              { label: "Transparency", value: pkg.trust.evidence.transparencyLogVerified ? "verified" : "missing" }
            ].map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
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
