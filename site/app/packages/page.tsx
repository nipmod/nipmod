import type { Metadata } from "next";
import {
  installCommand,
  permissionHighlights,
  registryStats,
  safeSourceRepoHref,
  shortDid,
  type RegistryPackage
} from "../../lib/registry";
import { packageBrowseData, packageEvidenceHref, packagePageHref } from "./content";

type PackagesPageProps = {
  searchParams?: Promise<{
    q?: string | string[] | undefined;
    type?: string | string[] | undefined;
  }>;
};

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/packages"
  },
  description: "Browse verified Gitlawb-sourced agent packages with trust, install and provenance context.",
  openGraph: {
    description: "Browse verified Gitlawb-sourced agent packages with trust, install and provenance context.",
    title: "nipmod packages",
    url: "https://nipmod.com/packages"
  },
  title: "packages"
};

export default async function PackagesPage({ searchParams }: PackagesPageProps) {
  const params = searchParams ? await searchParams : {};
  const query = firstParam(params.q);
  const type = firstParam(params.type);
  const { packages, registry, types } = packageBrowseData({ query, type });

  return (
    <main className="page-shell" id="main">
      <section className="quickstart-hero" aria-labelledby="packages-title">
        <p className="eyebrow">Packages</p>
        <h1 id="packages-title">Find tools worth installing.</h1>
        <p className="lead">Search signed Gitlawb packages. Check proof, permissions and source before install.</p>
      </section>

      <section className="registry-section" aria-labelledby="packages-browse-title">
        <div className="registry-head">
          <div>
            <p className="eyebrow">Browse</p>
            <h2 id="packages-browse-title">A registry for agent work.</h2>
          </div>
          <form className="search-form" action="/packages">
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
            {type ? <input name="type" type="hidden" value={type} /> : null}
            <button className="button button-primary button-small" type="submit">
              Search
            </button>
          </form>
        </div>

        <div className="registry-stats" aria-label="Registry stats">
          {registryStats(registry).map((item) => (
            <div className="stat-tile" key={item.label}>
              <span>{item.value}</span>
              <p>{item.label}</p>
            </div>
          ))}
        </div>

        <nav className="filter-row" aria-label="Package type filters">
          <a
            aria-current={!type ? "page" : undefined}
            className={!type ? "filter-pill filter-active" : "filter-pill"}
            href={query ? `/packages?q=${encodeURIComponent(query)}` : "/packages"}
          >
            All
          </a>
          {types.map((item) => {
            const href = `/packages?${new URLSearchParams({ ...(query ? { q: query } : {}), type: item }).toString()}`;
            return (
              <a aria-current={type === item ? "page" : undefined} className={type === item ? "filter-pill filter-active" : "filter-pill"} href={href} key={item}>
                {item}
              </a>
            );
          })}
        </nav>

        <div className="package-grid" aria-live="polite">
          {packages.length > 0 ? (
            packages.map((pkg) => <PackageBrowseCard key={`${pkg.canonical}@${pkg.version}`} pkg={pkg} />)
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

function PackageBrowseCard({ pkg }: { pkg: RegistryPackage }) {
  const sourceRepoHref = safeSourceRepoHref(pkg.sourceRepo);

  return (
    <article className="package-card">
      <div className="package-card-top">
        <div>
          <h3>
            <a href={packagePageHref(pkg)}>{pkg.name}</a>
          </h3>
          <p>{pkg.description}</p>
        </div>
        <span className={`trust-badge trust-${pkg.trust.level}`}>{pkg.trust.level}</span>
      </div>

      <dl className="package-meta">
        <div>
          <dt>Version</dt>
          <dd>
            {pkg.version}
            {pkg.distTags?.latest === pkg.version ? " latest" : ""}
            {pkg.deprecated?.active !== false && pkg.deprecated ? " deprecated" : ""}
          </dd>
        </div>
        <div>
          <dt>Publisher</dt>
          <dd>{shortDid(pkg.publisher)}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{pkg.type}</dd>
        </div>
      </dl>

      <div className="permission-row" aria-label={`${pkg.name} permissions`}>
        {permissionHighlights(pkg).map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>

      <pre className="install-command">
        <code>{installCommand(pkg)}</code>
      </pre>

      <div className="package-links">
        <a href={packagePageHref(pkg)}>Package</a>
        <a href={packageEvidenceHref(pkg)}>Evidence</a>
        {sourceRepoHref ? (
          <a href={sourceRepoHref} aria-label={`Open ${pkg.name} Git source in a new tab`} rel="noreferrer" target="_blank">
            Git source
          </a>
        ) : null}
      </div>
    </article>
  );
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}
