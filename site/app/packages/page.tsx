import type { Metadata } from "next";
import {
  gitlawbOwnerHref,
  gitlawbPackageHref,
  installCommand,
  registryStats,
  safeSourceRepoHref,
  type RegistryPackage
} from "../../lib/registry";
import { packageQuality } from "../../lib/package-quality";
import { packageBrowseData, packageEvidenceHref, packagePageHref } from "./content";

type PackagesPageProps = {
  searchParams?: Promise<{
    q?: string | string[] | undefined;
    source?: string | string[] | undefined;
    type?: string | string[] | undefined;
  }>;
};

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/packages"
  },
  description: "Browse the Nipmod package archive with source, trust, install and agent usage context.",
  openGraph: {
    description: "Browse the Nipmod package archive with source, trust, install and agent usage context.",
    title: "Nipmod archive",
    url: "https://nipmod.com/packages"
  },
  title: "Nipmod archive"
};

export default async function PackagesPage({ searchParams }: PackagesPageProps) {
  const params = searchParams ? await searchParams : {};
  const query = firstParam(params.q);
  const source = firstParam(params.source);
  const type = firstParam(params.type);
  const { newest, packages, qualityStats, registry, trending, types } = packageBrowseData({ query, type });
  const sourceOptions = packageSourceOptions(registry.packages);
  const filteredPackages = source ? packages.filter((pkg) => packageSourceLabel(pkg) === source) : packages;
  const sourceStats = sourceOptions.map((item) => ({ label: item.label, value: String(item.count) }));

  return (
    <main className="page-shell" id="main">
      <section className="quickstart-hero package-archive-hero" aria-labelledby="packages-title">
        <p className="eyebrow">Archive</p>
        <h1 id="packages-title">All Nipmod packages in one place.</h1>
        <p className="lead">
          Every public package registered in Nipmod appears here with source, proof, permissions, install commands and
          agent setup paths.
        </p>
        <div className="actions" aria-label="Archive actions">
          <a className="button button-primary" href="#archive">
            Browse archive
          </a>
          <a className="data-link" href="/registry/packages.json" aria-label="Open Nipmod registry machine file">
            Registry JSON
          </a>
          <a className="button button-ghost" href="/setup">
            Setup agents
          </a>
        </div>
      </section>

      <section className="archive-overview" aria-label="Nipmod archive coverage">
        <article className="archive-overview-card">
          <span>{registry.packages.length}</span>
          <h2>Published packages</h2>
          <p>The public archive is generated from the live Nipmod registry.</p>
        </article>
        <article className="archive-overview-card">
          <span>{sourceStats.map((item) => `${item.label} ${item.value}`).join(" / ")}</span>
          <h2>Current sources</h2>
          <p>Published package source today is Gitlawb. Future indexed sources land in the same archive.</p>
        </article>
        <article className="archive-overview-card">
          <span>Codex / Claude / MCP</span>
          <h2>Agent access</h2>
          <p>Agent hosts use the same package archive through setup workflows and MCP-compatible tools.</p>
        </article>
        <article className="archive-overview-card">
          <span>nipmod.com + node.nipmod.com</span>
          <h2>Storage map</h2>
          <p>Metadata lives on Nipmod. Current bundles and source repos resolve through node.nipmod.com.</p>
        </article>
      </section>

      <section className="registry-section" id="archive" aria-labelledby="packages-browse-title">
        <div className="registry-head">
          <div>
            <p className="eyebrow">Browse</p>
            <h2 id="packages-browse-title">The shared package archive.</h2>
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
            {source ? <input name="source" type="hidden" value={source} /> : null}
            {type ? <input name="type" type="hidden" value={type} /> : null}
            <button className="button button-primary button-small" type="submit">
              Search
            </button>
          </form>
        </div>

        <div className="registry-stats" aria-label="Registry stats">
          {[...registryStats(registry), ...qualityStats, ...sourceStats].map((item) => (
            <div className="stat-tile" key={item.label}>
              <span>{item.value}</span>
              <p>{item.label}</p>
            </div>
          ))}
        </div>

        <div className="package-shelf-grid" aria-label="Package highlights">
          <PackageShelf title="Trending packages" packages={trending} />
          <PackageShelf title="New packages" packages={newest} />
        </div>

        <nav className="filter-row" aria-label="Package type filters">
          <a
            aria-current={!type ? "page" : undefined}
            className={!type ? "filter-pill filter-active" : "filter-pill"}
            href={packageFilterHref({ query, source })}
          >
            All
          </a>
          {types.map((item) => {
            const href = packageFilterHref({ query, source, type: item });
            return (
              <a aria-current={type === item ? "page" : undefined} className={type === item ? "filter-pill filter-active" : "filter-pill"} href={href} key={item}>
                {item}
              </a>
            );
          })}
        </nav>

        <nav className="filter-row" aria-label="Package source filters">
          <a
            aria-current={!source ? "page" : undefined}
            className={!source ? "filter-pill filter-active" : "filter-pill"}
            href={packageFilterHref({ query, type })}
          >
            All sources
          </a>
          {sourceOptions.map((item) => {
            const href = packageFilterHref({ query, source: item.label, type });
            return (
              <a
                aria-current={source === item.label ? "page" : undefined}
                className={source === item.label ? "filter-pill filter-active" : "filter-pill"}
                href={href}
                key={item.label}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <p className="archive-note">
          This page is the human-readable archive. Published packages from any future indexed source should appear here
          once they are registered, verified and added to Nipmod.
        </p>

        <div className="archive-list" aria-live="polite">
          {filteredPackages.length > 0 ? (
            filteredPackages.map((pkg) => <PackageBrowseCard key={`${pkg.canonical}@${pkg.version}`} pkg={pkg} />)
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

function PackageShelf({ packages, title }: { packages: RegistryPackage[]; title: string }) {
  return (
    <section className="package-shelf" aria-labelledby={slugId(title)}>
      <div className="section-head">
        <p className="eyebrow">Index</p>
        <h2 id={slugId(title)}>{title}</h2>
      </div>
      <div className="package-mini-list">
        {packages.map((pkg) => {
          const quality = packageQuality(pkg);
          return (
            <a className="package-mini" href={packagePageHref(pkg)} key={`${title}:${pkg.canonical}@${pkg.version}`}>
              <span>{pkg.name}</span>
              <small>{quality.score}/100</small>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function PackageBrowseCard({ pkg }: { pkg: RegistryPackage }) {
  const sourceRepoHref = safeSourceRepoHref(pkg.sourceRepo);
  const quality = packageQuality(pkg);
  const sourceLabel = packageSourceLabel(pkg);
  const compatibility = pkg.compatibilityReceipts?.filter((receipt) => receipt.provenanceLoss.length === 0).map((receipt) => receipt.label) ?? [];

  return (
    <article className="archive-package-row">
      <div className="archive-package-main">
        <div>
          <h3>
            <a href={packagePageHref(pkg)}>{pkg.name}</a>
          </h3>
          <p>{pkg.description}</p>
        </div>
      </div>

      <div className="archive-package-badges" aria-label={`${pkg.name} status`}>
        <span className={`trust-badge trust-${pkg.trust.level}`}>{pkg.trust.level}</span>
        <span className={`trust-badge quality-${quality.label.toLowerCase()}`}>{quality.score}/100</span>
        <span className="trust-badge source-badge">{sourceLabel}</span>
      </div>

      <dl className="archive-package-meta">
        <div>
          <dt>Version</dt>
          <dd>
            {pkg.version}
            {pkg.distTags?.latest === pkg.version ? " latest" : ""}
            {pkg.deprecated?.active !== false && pkg.deprecated ? " deprecated" : ""}
          </dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{pkg.type}</dd>
        </div>
        <div>
          <dt>Quality</dt>
          <dd>{quality.label}</dd>
        </div>
        <div>
          <dt>Agent formats</dt>
          <dd>{compatibility.length > 0 ? compatibility.join(", ") : "Nipmod native"}</dd>
        </div>
      </dl>

      <div className="archive-install">
        <span>Install</span>
        <code>{installCommand(pkg)}</code>
      </div>

      <div className="package-links">
        <a href={packagePageHref(pkg)}>Package</a>
        <a href={gitlawbPackageHref(pkg)}>Repo status</a>
        <a href={gitlawbOwnerHref(pkg)}>Owner</a>
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

function slugId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function packageFilterHref({ query, source, type }: { query?: string; source?: string; type?: string }): string {
  const params = new URLSearchParams();
  if (query) {
    params.set("q", query);
  }
  if (source) {
    params.set("source", source);
  }
  if (type) {
    params.set("type", type);
  }
  const search = params.toString();
  return search ? `/packages?${search}` : "/packages";
}

function packageSourceOptions(packages: readonly RegistryPackage[]): Array<{ count: number; label: string }> {
  const counts = new Map<string, number>();
  for (const pkg of packages) {
    const label = packageSourceLabel(pkg);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ count, label }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function packageSourceLabel(pkg: Pick<RegistryPackage, "sourceRepo" | "cloneUrl" | "resolved">): string {
  const urls = [pkg.sourceRepo, pkg.cloneUrl, pkg.resolved];
  if (urls.some((value) => hostMatches(value, ["node.nipmod.com", "gitlawb.com", "node.gitlawb.com", "node2.gitlawb.com", "node3.gitlawb.com"]))) {
    return "Gitlawb";
  }
  if (urls.some((value) => hostMatches(value, ["github.com", "raw.githubusercontent.com"]))) {
    return "GitHub";
  }
  return "Other";
}

function hostMatches(value: string, hosts: string[]): boolean {
  try {
    return hosts.includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}
