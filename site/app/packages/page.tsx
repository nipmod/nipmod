import type { Metadata } from "next";
import { CommandBlock } from "../command-block";
import { safeSourceRepoHref, type RegistryIndex, type RegistryPackage } from "../../lib/registry";
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
  description: "Search verified Nipmod packages for agents with trust, source and install context.",
  openGraph: {
    description: "Search verified Nipmod packages for agents with trust, source and install context.",
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
  const { featured, packages, registry, types } = packageBrowseData({ query, type });
  const sourceOptions = packageSourceOptions(registry.packages);
  const filteredPackages = source ? packages.filter((pkg) => packageSourceLabel(pkg) === source) : packages;
  const summaryStats = archiveSummaryStats(registry, sourceOptions);

  return (
    <main className="page-shell" id="main">
      <section className="quickstart-hero package-archive-hero" aria-labelledby="packages-title">
        <p className="eyebrow">Package archive</p>
        <h1 id="packages-title">Agent package archive.</h1>
        <p className="lead">Search packages, check trust, then plan install before anything writes.</p>
        <div className="actions" aria-label="Archive actions">
          <a className="button button-primary" href="#archive">
            Search archive
          </a>
          <a className="button button-ghost" href="/setup">
            Setup agents
          </a>
          <a className="button button-ghost" href="/package">
            Submit package
          </a>
          <a className="data-link" href="/registry/packages.json" aria-label="Open Nipmod registry machine file">
            Registry JSON
          </a>
        </div>
      </section>

      <section className="registry-section" id="archive" aria-labelledby="packages-browse-title">
        <div className="registry-head">
          <div>
            <p className="eyebrow">Browse</p>
            <h2 id="packages-browse-title">Explore packages.</h2>
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

        <div className="archive-summary-strip" aria-label="Archive summary">
          {summaryStats.map((item) => (
            <div className="archive-summary-item" key={item.label}>
              <span>{item.value}</span>
              <p>{item.label}</p>
            </div>
          ))}
        </div>

        <div className="archive-controls" aria-label="Archive filters">
          <div className="archive-control-group">
            <p>Type</p>
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
                  <a
                    aria-current={type === item ? "page" : undefined}
                    className={type === item ? "filter-pill filter-active" : "filter-pill"}
                    href={href}
                    key={item}
                  >
                    {item}
                  </a>
                );
              })}
            </nav>
          </div>

          <div className="archive-control-group">
            <p>Source</p>
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
          </div>
        </div>

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

      <section className="archive-overview" aria-label="Nipmod archive coverage">
        <article className="archive-overview-card">
          <span>{registry.packages.length}</span>
          <h2>Verified packages</h2>
          <p>Generated from the live Nipmod registry.</p>
        </article>
        <article className="archive-overview-card">
          <span>{featured.length}</span>
          <h2>Featured start set</h2>
          <p>Packages that show core archive use cases first.</p>
        </article>
        <article className="archive-overview-card">
          <span>{sourceOptions.map((item) => `${item.label} ${item.count}`).join(" / ")}</span>
          <h2>Source today</h2>
          <p>Published package source today is Gitlawb. New indexed sources will appear here.</p>
        </article>
        <article className="archive-overview-card">
          <span>Codex + Claude Code + Cursor + OpenCode + Hermes</span>
          <h2>Agent access</h2>
          <p>Connect once, then agents can search and inspect the same archive.</p>
        </article>
      </section>

      <section className="featured-section" aria-labelledby="featured-packages-title">
        <div className="section-head">
          <p className="eyebrow">Featured</p>
          <h2 id="featured-packages-title">Useful starting points.</h2>
          <p>Source reading, package safety, MCP access, onboarding, evidence and CI examples.</p>
        </div>
        <div className="featured-package-grid">
          {featured.map((pkg) => (
            <FeaturedPackageCard key={`${pkg.canonical}@${pkg.version}`} pkg={pkg} />
          ))}
        </div>
      </section>
    </main>
  );
}

function PackageBrowseCard({ pkg }: { pkg: RegistryPackage }) {
  const sourceRepoHref = safeSourceRepoHref(pkg.sourceRepo);
  const quality = packageQuality(pkg);
  const sourceLabel = packageSourceLabel(pkg);
  const isLatest = pkg.distTags?.latest === pkg.version;
  const spec = `${pkg.canonical}@${pkg.version}`;
  const planCommand = `nipmod install --plan ${spec}`;

  return (
    <article className="archive-package-row">
      <div className="archive-package-top">
        <div className="archive-package-main">
          <div className="archive-package-kicker" aria-label={`${pkg.name} package facts`}>
            <span>{pkg.type}</span>
            <span>v{pkg.version}</span>
            {isLatest ? <span>latest</span> : null}
          </div>
          <h3>
            <a href={packagePageHref(pkg)}>{pkg.name}</a>
          </h3>
          <p>{pkg.description}</p>
        </div>

        <div className="archive-package-status" aria-label={`${pkg.name} status`}>
          <span className={`trust-badge trust-${pkg.trust.level}`}>{pkg.trust.level}</span>
          <span className={`trust-badge quorum-${pkg.quorum?.status ?? "missing"}`}>{quorumLabel(pkg)}</span>
          <span className={`trust-badge quality-${quality.label.toLowerCase()}`}>{quality.score}/100</span>
          <span className="trust-badge source-badge">{sourceLabel}</span>
        </div>
      </div>

      <div className="archive-package-bottom">
        <div className="archive-install">
          <span>Plan first</span>
          <CommandBlock command={planCommand} label={`Copy ${pkg.name} install plan command`} variant="compact" />
        </div>

        <nav className="archive-actions" aria-label={`${pkg.name} links`}>
          <a className="button button-primary button-small" href={packagePageHref(pkg)}>
            View package
          </a>
          <a className="button button-ghost button-small" href={packageEvidenceHref(pkg)}>
            Proof
          </a>
          {sourceRepoHref ? (
            <a
              className="button button-ghost button-small"
              href={sourceRepoHref}
              aria-label={`Open ${pkg.name} Git source in a new tab`}
              rel="noreferrer"
              target="_blank"
            >
              Git source
            </a>
          ) : null}
        </nav>
      </div>

      <dl className="archive-proof-row" aria-label={`${pkg.name} proof summary`}>
        <div>
          <dt>source</dt>
          <dd>{sourceLabel}</dd>
        </div>
        <div>
          <dt>digest</dt>
          <dd>
            <code>{shortHash(pkg.digest)}</code>
          </dd>
        </div>
        <div>
          <dt>signature</dt>
          <dd>{pkg.trust.evidence.bundleSignatureVerified ? "verified" : "missing"}</dd>
        </div>
        <div>
          <dt>quorum</dt>
          <dd>{pkg.quorum ? `${pkg.quorum.approvals}/${pkg.quorum.threshold}` : "missing"}</dd>
        </div>
        <div>
          <dt>commit</dt>
          <dd>
            <code>{shortHash(pkg.sourceCommit ?? "missing")}</code>
          </dd>
        </div>
      </dl>
    </article>
  );
}

function quorumLabel(pkg: RegistryPackage): string {
  return pkg.quorum ? `quorum ${pkg.quorum.approvals}/${pkg.quorum.threshold}` : "quorum missing";
}

function FeaturedPackageCard({ pkg }: { pkg: RegistryPackage }) {
  const quality = packageQuality(pkg);
  const purpose = featuredPurpose(pkg);
  const spec = `${pkg.canonical}@${pkg.version}`;

  return (
    <article className="featured-package-card">
      <div>
        <p className="platform-label">{pkg.type}</p>
        <h3>
          <a href={packagePageHref(pkg)}>{pkg.name}</a>
        </h3>
        <p>{purpose}</p>
      </div>
      <div className="featured-package-meta">
        <span className={`trust-badge trust-${pkg.trust.level}`}>{pkg.trust.level}</span>
        <span className={`trust-badge quality-${quality.label.toLowerCase()}`}>{quality.score}/100</span>
      </div>
      <div className="archive-install">
        <span>Plan first</span>
        <CommandBlock command={`nipmod install --plan ${spec}`} label={`Copy ${pkg.name} install plan command`} variant="compact" />
      </div>
    </article>
  );
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

function archiveSummaryStats(registry: Pick<RegistryIndex, "packages">, sources: Array<{ count: number; label: string }>): Array<{ label: string; value: string }> {
  const verified = registry.packages.filter((pkg) => pkg.trust.level === "verified").length;
  const averageQuality = registry.packages.length
    ? Math.round(registry.packages.reduce((total, pkg) => total + (pkg.trust.score ?? 0), 0) / registry.packages.length)
    : 0;

  return [
    { label: "Packages", value: String(registry.packages.length) },
    { label: "Verified", value: String(verified) },
    { label: "Sources", value: String(sources.length) },
    { label: "Avg score", value: String(averageQuality) }
  ];
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

function featuredPurpose(pkg: RegistryPackage): string {
  const purposeByName: Record<string, string> = {
    "agent-permission-review": "Review package permissions before an agent exposes tools, files, network or secrets.",
    "dependency-risk-review": "Check dependency and lockfile risk before package code enters a workspace.",
    "first-user-onboarding": "Guide a new user through install, inspect, add, audit and publish dry run.",
    "gitlawb-repo-reader": "Read a Gitlawb repo and return a provenance focused summary for agents.",
    "gitlawb-review-tool-bundle": "Bundle source review, diff summary and release review in one package path.",
    "nipmod-audit-ci": "Turn Nipmod audit and policy output into CI decisions agents can explain.",
    "package-evidence-brief": "Convert inspect output into a short human review brief.",
    "package-migration-planner": "Plan migration from Gitlawb, MCP or APM source into Nipmod metadata.",
    "prompt-injection-scan": "Scan package docs and prompts for instruction smuggling before reuse.",
    "readonly-registry-mcp-server": "Expose read only registry search and inspect tools through MCP."
  };

  return purposeByName[pkg.name] ?? pkg.description;
}

function shortHash(value: string): string {
  if (value.length <= 14) {
    return value;
  }
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
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
