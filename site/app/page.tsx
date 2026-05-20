import { homeContent } from "./content";
import { packageEvidenceHref, packagePageHref } from "./packages/content";
import { PlatformMark, platformStatusClass } from "./platform-brand";
import registryData from "./registry-data.json";
import platformConnections from "../public/compatibility/platform-connections.json";
import { loadLiveStats } from "../lib/live-stats";
import {
  gitlawbOwnerHref,
  gitlawbPackageHref,
  installCommand,
  homepagePackages,
  registryStats,
  safeSourceRepoHref,
  searchPackages,
  type RegistryIndex,
  type RegistryPackage
} from "../lib/registry";

type HomeProps = {
  searchParams?: Promise<{
    q?: string | string[] | undefined;
  }>;
};

const registry = registryData as RegistryIndex;
const platformPathLabel: Record<string, string> = {
  Candidate: "Review needed",
  Live: "Live",
  "MCP ready": "MCP",
  "Under review": "Review"
};

export default async function Home({ searchParams }: HomeProps) {
  const params = searchParams ? await searchParams : {};
  const query = firstParam(params.q);
  const publicRegistry = { ...registry, packages: homepagePackages(registry.packages) };
  const packageResults = searchPackages(publicRegistry.packages, query);
  const packages = query ? packageResults : packageResults.slice(0, 6);
  const liveStats = await loadLiveStats({ registry });

  return (
    <main className="page-shell" id="main">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="product-line">Built on Gitlawb</p>
          <h1 id="hero-title">{homeContent.headline}</h1>
          <p className="lead">{homeContent.lead}</p>
        </div>

        <div className="terminal-panel" id="flow" aria-label="Terminal flow">
          <div className="terminal-top">
            <span className="terminal-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>Nipmod</span>
          </div>
          <pre>
            {homeContent.commands.map((command) => (
              <code key={command}>
                <span aria-hidden="true">$ </span>
                {command}
              </code>
            ))}
          </pre>
        </div>
      </section>

      <section className="live-section" id="live" aria-labelledby="live-title">
        <div className="live-head">
          <div>
            <p className="eyebrow">Live archive</p>
            <h2 id="live-title">Live package count</h2>
            <p className="live-copy">Current package count from the public Nipmod archive.</p>
          </div>
          <p className={`live-status ${liveStats.healthy ? "live-ok" : "live-warn"}`}>
            <span aria-hidden="true" />
            {liveStats.status}
          </p>
        </div>
        <div className="live-stat-grid" aria-label="Live Nipmod registry stats">
          {liveStats.tiles.map((item) => (
            <div className="live-stat" key={item.label}>
              <span>{item.value}</span>
              <p>{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="usage-strip" aria-label="Where Nipmod is used">
        {homeContent.usage.map((item) => (
          <article className="usage-item" key={item.label}>
            <h2>{item.label}</h2>
            <p>{item.text}</p>
          </article>
        ))}
      </section>

      <section className="platform-section" id="platforms" aria-labelledby="platforms-title">
        <div className="section-head">
          <p className="eyebrow">Platforms</p>
          <h2 id="platforms-title">{homeContent.platformRoadmap.headline}</h2>
          <p>{homeContent.platformRoadmap.lead}</p>
        </div>
        <div className="platform-logo-rail" aria-label="Current Nipmod platform paths">
          {platformConnections.connections.map((connection) => (
            <a className="platform-logo-tile" href={connection.url} key={connection.id}>
              <PlatformMark id={connection.id} name={connection.name} />
              <span className="platform-logo-copy">
                <strong>{connection.name}</strong>
                <span>{platformPathLabel[connection.status] ?? connection.status}</span>
              </span>
            </a>
          ))}
        </div>
        <div className="platform-grid" aria-label="Nipmod platform roadmap">
          {platformConnections.connections.map((connection) => (
            <article className="platform-card" key={connection.id}>
              <div className="platform-top">
                <div className="platform-title-row">
                  <PlatformMark id={connection.id} name={connection.name} />
                  <div>
                    <p className="platform-label">{connection.category}</p>
                    <h3>{connection.name}</h3>
                  </div>
                </div>
                <span className={`platform-status ${platformStatusClass(connection.status)}`}>{connection.status}</span>
              </div>
              <p>{connection.scope}</p>
              <a href={connection.url}>{connection.externalApprovalRequired ? "Review path" : "Open path"}</a>
            </article>
          ))}
        </div>
        <p className="platform-note">{homeContent.platformRoadmap.note}</p>
      </section>

      <section className="claim-section" id="claim" aria-labelledby="claim-title">
        <div className="section-head">
          <p className="eyebrow">Claim</p>
          <h2 id="claim-title">{homeContent.claimFlow.headline}</h2>
          <p>{homeContent.claimFlow.lead}</p>
        </div>
        <div className="claim-flow">
          {homeContent.claimFlow.steps.map((step) => (
            <article className="claim-step" key={step.label}>
              <h3>{step.label}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
        <div className="section-actions">
          <a className="button button-primary" href="/package">
            Create package
          </a>
        </div>
      </section>

      <section className="start-section" id="start" aria-labelledby="start-title">
        <div className="section-head">
          <p className="eyebrow">Use</p>
          <h2 id="start-title">Start here</h2>
        </div>
        <div className="start-grid">
          {homeContent.startCards.map((card) => (
            <a className="start-card" href={card.href} key={card.title}>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="registry-section" id="registry" aria-labelledby="registry-title">
        <div className="registry-head">
          <div>
            <p className="eyebrow">Registry</p>
            <h2 id="registry-title">Search. Inspect. Install.</h2>
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
        <p className="ranking-note">Ordered by relevance and trust.</p>

        <div className="package-grid" aria-live="polite">
          {packages.length > 0 ? (
            packages.map((pkg) => <PackageCard key={`${pkg.canonical}@${pkg.version}`} pkg={pkg} />)
          ) : (
            <div className="empty-state">
              <p>No packages found.</p>
            </div>
          )}
        </div>
        {!query ? (
          <div className="registry-more">
            <a className="button button-primary" href="/packages">
              Browse all packages
            </a>
          </div>
        ) : null}
      </section>

      <section className="proof-section" aria-labelledby="package-title">
        <div>
          <p className="eyebrow">Create</p>
          <h2 id="package-title">Package your Gitlawb repo.</h2>
        </div>
        <div className="proof-panel">
          <p className="panel-copy">Use this only for a repo you own or maintain.</p>
          <pre className="install-command">
            <code>{"nipmod package pr gitlawb://did:key:z6Mk.../your-repo --dir your-repo-pr\nnipmod publish your-repo-pr --dry-run --json"}</code>
          </pre>
          <a className="button button-primary" href="/package">
            Create package
          </a>
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
            <a href={packagePageHref(pkg)}>{pkg.name}</a>
          </h3>
          <p>{pkg.description}</p>
        </div>
        <span className={`trust-badge trust-${pkg.trust.level}`}>{pkg.trust.level}</span>
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
        <a href={packagePageHref(pkg)} aria-label={`View ${pkg.name} package page`}>
          Package
        </a>
        <a href={gitlawbPackageHref(pkg)}>
          Repo status
        </a>
        <a href={gitlawbOwnerHref(pkg)}>
          Owner
        </a>
        <a href={packageEvidenceHref(pkg, "package-proof")} aria-label={`View ${pkg.name} evidence`}>
          Evidence
        </a>
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
