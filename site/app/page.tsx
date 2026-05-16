import { homeContent } from "./content";
import registryData from "./registry-data.json";
import {
  installCommand,
  homepagePackages,
  permissionHighlights,
  registryStats,
  safeSourceRepoHref,
  searchPackages,
  shortDid,
  type RegistryIndex,
  type RegistryPackage
} from "../lib/registry";

type HomeProps = {
  searchParams?: Promise<{
    q?: string | string[] | undefined;
  }>;
};

const registry = registryData as RegistryIndex;

export default async function Home({ searchParams }: HomeProps) {
  const params = searchParams ? await searchParams : {};
  const query = firstParam(params.q);
  const publicRegistry = { ...registry, packages: homepagePackages(registry.packages) };
  const packages = searchPackages(publicRegistry.packages, query);

  return (
    <main className="page-shell" id="main">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title">{homeContent.headline}</h1>
          <p className="lead">{homeContent.lead}</p>
          <div className="actions" aria-label="Actions">
            <a className="button button-primary" href={homeContent.links.install}>
              {homeContent.primaryAction}
            </a>
            <a className="button button-ghost" href="/quickstart">
              Start
            </a>
            <a className="button button-ghost" href="/packages">
              Packages
            </a>
            <a className="button button-ghost" href="/package">
              Package
            </a>
            <a
              className="button button-ghost"
              href={homeContent.links.x}
              aria-label="Open nipmod updates on X in a new tab"
              rel="noreferrer"
              target="_blank"
            >
              {homeContent.secondaryAction}
            </a>
          </div>
        </div>

        <div className="terminal-panel" id="flow" aria-label="Terminal flow">
          <div className="terminal-top">
            <span>flow</span>
            <span>gitlawb</span>
          </div>
          <pre>
            {homeContent.commands.map((command) => (
              <code key={command}>{command}</code>
            ))}
          </pre>
        </div>
      </section>

      <section className="usage-strip" aria-label="Where nipmod is used">
        {homeContent.usage.map((item) => (
          <article className="usage-item" key={item.label}>
            <h2>{item.label}</h2>
            <p>{item.text}</p>
          </article>
        ))}
      </section>

      <section className="ecosystem-section" aria-labelledby="ecosystem-title">
        <div className="section-head">
          <p className="eyebrow">Packages</p>
          <h2 id="ecosystem-title">Useful capabilities. Verifiable proof.</h2>
        </div>
        <div className="usage-strip">
          {homeContent.packageUseCases.map((item) => (
            <article className="usage-item" key={item.label}>
              <h2>{item.label}</h2>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="proof-section" aria-labelledby="package-title">
        <div>
          <p className="eyebrow">Gitlawb</p>
          <h2 id="package-title">{homeContent.repoToPackage.headline}</h2>
        </div>
        <div className="proof-panel">
          <p className="panel-copy">{homeContent.repoToPackage.lead}</p>
          <a className="button button-primary" href="/package">
            Package
          </a>
        </div>
      </section>

      <section className="ecosystem-section" aria-labelledby="launch-title">
        <div className="section-head">
          <p className="eyebrow">Launch</p>
          <h2 id="launch-title">Ready to review in public.</h2>
        </div>
        <div className="block-grid">
          {homeContent.launchReadiness.map((item) => (
            <article className="block-card" key={item.label}>
              <span>{item.label}</span>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="proof-section" aria-labelledby="demo-title">
        <div>
          <p className="eyebrow">Demo</p>
          <h2 id="demo-title">Repo to package without an account.</h2>
        </div>
        <div className="proof-panel">
          {homeContent.demoFlow.map((item) => (
            <div className="demo-step" key={item.label}>
              <h3>{item.label}</h3>
              <p>{item.text}</p>
              <pre className="install-command">
                <code>{item.command}</code>
              </pre>
            </div>
          ))}
        </div>
      </section>

      <section className="ecosystem-section" aria-labelledby="ecosystem-packages-title">
        <div className="section-head">
          <p className="eyebrow">Ecosystem</p>
          <h2 id="ecosystem-packages-title">First packages are already useful.</h2>
        </div>
        <div className="package-grid">
          {homeContent.ecosystemPackages.map((pkg) => (
            <article className="package-card" key={pkg.name}>
              <div className="package-card-top">
                <div>
                  <h3>
                    <a href={`/packages/${encodeURIComponent(pkg.name)}`}>{pkg.name}</a>
                  </h3>
                  <p>{pkg.text}</p>
                </div>
              </div>
              <pre className="install-command">
                <code>{pkg.command}</code>
              </pre>
            </article>
          ))}
        </div>
      </section>

      <section className="registry-section" id="registry" aria-labelledby="registry-title">
        <div className="registry-head">
          <div>
            <p className="eyebrow">Registry</p>
            <h2 id="registry-title">Install from Gitlawb. Inspect the proof.</h2>
          </div>
          <form className="search-form" action="/#registry">
            <label className="sr-only" htmlFor="package-search">
              Search packages
            </label>
            <input
              autoComplete="off"
              defaultValue={query}
              id="package-search"
              name="q"
              placeholder="Search packages"
              type="search"
            />
            <button className="button button-primary button-small" type="submit">
              Search
            </button>
          </form>
        </div>

        <div className="registry-stats" aria-label="Registry stats">
          {registryStats(publicRegistry).map((item) => (
            <div className="stat-tile" key={item.label}>
              <span>{item.value}</span>
              <p>{item.label}</p>
            </div>
          ))}
        </div>
        <p className="ranking-note">
          Ranked by trust, exact match, agent native type, quiet permissions, compatibility proof and freshness.
        </p>

        <div className="package-grid" aria-live="polite">
          {packages.length > 0 ? (
            packages.map((pkg) => <PackageCard key={`${pkg.canonical}@${pkg.version}`} pkg={pkg} />)
          ) : (
            <div className="empty-state">
              <p>No packages found.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function PackageCard({ pkg }: { pkg: RegistryPackage }) {
  const receipts = (pkg.compatibilityReceipts ?? []).filter((receipt) => receipt.provenanceLoss.length === 0).slice(0, 3);
  const sourceRepoHref = safeSourceRepoHref(pkg.sourceRepo);

  return (
    <article className="package-card">
      <div className="package-card-top">
        <div>
          <h3>
            <a href={`/packages/${encodeURIComponent(pkg.name)}`}>{pkg.name}</a>
          </h3>
          <p>{pkg.description}</p>
        </div>
        <span className={`trust-badge trust-${pkg.trust.level}`}>{pkg.trust.level}</span>
      </div>

      <dl className="package-meta">
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

      <div className="permission-row" aria-label={`${pkg.name} permissions`}>
        {permissionHighlights(pkg).map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>

      {receipts.length > 0 ? (
        <div className="compatibility-row" aria-label={`${pkg.name} compatibility receipts`}>
          {receipts.map((receipt) => (
            <a href={packageEvidenceHref(pkg, "compatibility")} key={receipt.id}>
              {receipt.label}
            </a>
          ))}
        </div>
      ) : null}

      {pkg.trust.warnings.length > 0 ? <p className="warning-line">{pkg.trust.warnings[0]}</p> : null}

      <pre className="install-command">
        <code>{installCommand(pkg)}</code>
      </pre>

      <div className="package-links">
        {sourceRepoHref ? (
          <a
            href={sourceRepoHref}
            aria-label={`Open ${pkg.name} Git source in a new tab`}
            rel="noreferrer"
            target="_blank"
          >
            Git source
          </a>
        ) : null}
        <a href={`/packages/${encodeURIComponent(pkg.name)}`} aria-label={`View ${pkg.name} package page`}>
          Package
        </a>
        <a href={packageEvidenceHref(pkg, "package-proof")} aria-label={`View ${pkg.name} evidence`}>
          Evidence
        </a>
      </div>
    </article>
  );
}

function packageEvidenceHref(pkg: RegistryPackage, anchor: string): string {
  return `/evidence/package/${encodeURIComponent(pkg.name)}#${anchor}`;
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}
