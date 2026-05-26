"use client";

import { useMemo, useState } from "react";
import { packageQuality } from "../../lib/package-quality";
import { homepagePackages, type RegistryIndex, type RegistryPackage } from "../../lib/registry";
import { DocsCard, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";
import registryData from "../registry-data.json";
import { packageEvidenceHref, packagePageHref } from "./content";

const registry = registryData as RegistryIndex;
const packages = homepagePackages(registry.packages);

type TrustFilter = "all" | "verified" | "review";
type SortKey = "relevance" | "quality" | "newest" | "name";

export function PackagesView() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [trust, setTrust] = useState<TrustFilter>("all");
  const [sort, setSort] = useState<SortKey>("relevance");

  const types = useMemo(() => [...new Set(packages.map((pkg) => pkg.type))].sort(), []);
  const stats = useMemo(() => packageArchiveStats(packages), []);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return packages
      .filter((pkg) => (type === "all" ? true : pkg.type === type))
      .filter((pkg) => {
        if (trust === "all") return true;
        if (trust === "verified") return pkg.trust.level === "verified";
        return pkg.trust.level !== "verified" || packageQuality(pkg).score < 90;
      })
      .filter((pkg) => {
        if (!normalized) return true;
        return searchableText(pkg).includes(normalized);
      })
      .sort((left, right) => comparePackages(left, right, sort, normalized));
  }, [query, sort, trust, type]);

  const topPackages = useMemo(() => [...packages].sort((left, right) => comparePackages(left, right, "quality", "")).slice(0, 3), []);
  const hasPackages = packages.length > 0;
  const hasActiveFilters = query.trim() !== "" || type !== "all" || trust !== "all";
  const showFeatured = hasPackages && query.trim() === "" && type === "all" && trust === "all";

  return (
    <DocsShell
      description="The archive contains confirmed package records saved after public gates. Search still works through live external sources even when the public archive is empty."
      eyebrow="Archive"
      stats={[
        { label: "Packages", value: stats.total },
        { label: "Verified", value: stats.verified },
        { label: "Quorum", value: stats.quorum },
        { label: "Updated", value: formatRegistryDate(registry.generatedAt) }
      ]}
      title="Confirmed package records."
    >
      <DocsSection title="Archive status">
        <DocsGrid>
          <DocsCard title={hasPackages ? "Records available" : "No public packages yet"}>
            <p>
              {hasPackages
                ? "The records below passed the public package gates and can be inspected with source and trust context."
                : "The public archive is intentionally clean. New records appear only after a useful package discovery is confirmed and passes the archive gates."}
            </p>
          </DocsCard>
          <DocsCard title="Live source search">
            <p>Agents do not need the archive to be populated before using Nipmod. They can search npm, PyPI, GitHub, Hugging Face and MCP through the API.</p>
          </DocsCard>
          <DocsCard title="Durable records">
            <p>Archive records are for reuse and receipts. They should not be confused with ownership of external source packages.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      {hasPackages ? (
        <>
          <DocsSection title="Filter records">
            <div className="docs-filter-panel" aria-label="Package filters">
              <label>
                <span>Search</span>
                <input
                  autoComplete="off"
                  inputMode="search"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="package, policy, skill, mcp..."
                  type="search"
                  value={query}
                />
              </label>
              <label>
                <span>Trust</span>
                <select onChange={(event) => setTrust(event.target.value as TrustFilter)} value={trust}>
                  <option value="all">All</option>
                  <option value="verified">Verified</option>
                  <option value="review">Review</option>
                </select>
              </label>
              <label>
                <span>Type</span>
                <select onChange={(event) => setType(event.target.value)} value={type}>
                  <option value="all">All types</option>
                  {types.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Sort</span>
                <select onChange={(event) => setSort(event.target.value as SortKey)} value={sort}>
                  <option value="relevance">Relevant</option>
                  <option value="quality">Quality</option>
                  <option value="newest">Newest</option>
                  <option value="name">Name</option>
                </select>
              </label>
            </div>
          </DocsSection>

          {showFeatured ? (
            <DocsSection title="Highest signal packages">
              <DocsGrid>
                {topPackages.map((pkg) => (
                  <FeaturedPackageCard key={`${pkg.canonical}@${pkg.version}`} pkg={pkg} />
                ))}
              </DocsGrid>
            </DocsSection>
          ) : null}

          <DocsSection title={`${filtered.length} package records`}>
            {filtered.length > 0 ? (
              <div className="docs-package-list">
                {filtered.map((pkg, index) => (
                  <PackageCard index={index + 1} key={`${pkg.canonical}@${pkg.version}`} pkg={pkg} />
                ))}
              </div>
            ) : (
              <DocsCard title="No packages match">
                <p>{hasActiveFilters ? "Try a different package name, type or trust filter." : activeFilterLabel(query, type, trust, sort)}</p>
              </DocsCard>
            )}
          </DocsSection>
        </>
      ) : (
        <DocsSection title="Use live search instead">
          <DocsTable
            rows={[
              {
                first: "Search",
                second: <code>GET /api/search?q=http%20client&amp;sources=npm,pypi&amp;limit=5</code>,
                third: "Find live candidates with x-nipmod-api-key."
              },
              {
                first: "Inspect",
                second: <code>GET /api/inspect?source=npm&amp;name=undici</code>,
                third: "Read trust factors with x-nipmod-api-key."
              },
              {
                first: "Plan",
                second: <code>GET /api/install-plan?source=npm&amp;name=undici</code>,
                third: "Return approved install steps with x-nipmod-api-key."
              }
            ]}
          />
        </DocsSection>
      )}
    </DocsShell>
  );
}

function FeaturedPackageCard({ pkg }: { pkg: RegistryPackage }) {
  const quality = packageQuality(pkg);

  return (
    <a className="archive-featured-card" href={packagePageHref(pkg)}>
      <span className="archive-card-index">{pkg.type}</span>
      <h3>{pkg.name}</h3>
      <p>{pkg.description}</p>
      <div className="archive-featured-meta">
        <span>{quality.score}/100</span>
        <span>{pkg.quorum?.status === "passed" ? `quorum ${pkg.quorum.approvals}/${pkg.quorum.threshold}` : "quorum missing"}</span>
        <span>v{pkg.version}</span>
      </div>
    </a>
  );
}

function PackageCard({ index, pkg }: { index: number; pkg: RegistryPackage }) {
  const quality = packageQuality(pkg);
  const permissions = permissionLabel(pkg);
  const source = sourceLabel(pkg);

  return (
    <article className="archive-pro-card">
      <div className="archive-pro-card-top">
        <span className="archive-card-index">{String(index).padStart(2, "0")}</span>
        <div className="archive-pro-badges">
          <span className={`trust-badge trust-${pkg.trust.level}`}>{pkg.trust.level}</span>
          <span className={`trust-badge quality-${quality.label.toLowerCase()}`}>{quality.score}/100</span>
        </div>
      </div>

      <div className="archive-pro-main">
        <p className="archive-pro-type">{pkg.type}</p>
        <h3>
          <a href={packagePageHref(pkg)}>{pkg.name}</a>
        </h3>
        <p>{pkg.description}</p>
      </div>

      <dl className="archive-pro-facts">
        <div>
          <dt>Version</dt>
          <dd>{pkg.version}</dd>
        </div>
        <div>
          <dt>Quorum</dt>
          <dd>{pkg.quorum?.status === "passed" ? `${pkg.quorum.approvals}/${pkg.quorum.threshold}` : "missing"}</dd>
        </div>
        <div>
          <dt>Access</dt>
          <dd>{permissions}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{source}</dd>
        </div>
      </dl>

      <div className="archive-pro-footer">
        <code>{`nipmod install ${pkg.name}`}</code>
        <div>
          <a href={packageEvidenceHref(pkg)}>Proof</a>
          <a href={packagePageHref(pkg)}>Open</a>
        </div>
      </div>
    </article>
  );
}

function packageArchiveStats(items: readonly RegistryPackage[]) {
  return {
    quorum: items.filter((pkg) => pkg.quorum?.status === "passed").length.toLocaleString(),
    total: items.length.toLocaleString(),
    verified: items.filter((pkg) => pkg.trust.level === "verified").length.toLocaleString()
  };
}

function searchableText(pkg: RegistryPackage): string {
  return [pkg.name, pkg.description, pkg.type, pkg.publisher, pkg.owner, pkg.repo, pkg.canonical].join(" ").toLowerCase();
}

function comparePackages(left: RegistryPackage, right: RegistryPackage, sort: SortKey, query: string): number {
  if (sort === "name") return left.name.localeCompare(right.name);
  if (sort === "newest") return right.updatedAt.localeCompare(left.updatedAt) || left.name.localeCompare(right.name);

  const leftQuality = packageQuality(left).score;
  const rightQuality = packageQuality(right).score;
  if (sort === "quality") return rightQuality - leftQuality || left.name.localeCompare(right.name);

  return relevanceScore(right, query) - relevanceScore(left, query) || rightQuality - leftQuality || left.name.localeCompare(right.name);
}

function relevanceScore(pkg: RegistryPackage, query: string): number {
  let score = packageQuality(pkg).score + (pkg.quorum?.status === "passed" ? 18 : 0) + (pkg.trust.level === "verified" ? 20 : 0);
  if (query) {
    if (pkg.name.toLowerCase().includes(query)) score += 60;
    if (pkg.type.toLowerCase().includes(query)) score += 24;
    if (pkg.description.toLowerCase().includes(query)) score += 16;
  }
  return score;
}

function permissionLabel(pkg: RegistryPackage): string {
  const requested =
    pkg.permissions.env +
    pkg.permissions.filesystem +
    pkg.permissions.mcpTools +
    pkg.permissions.network +
    pkg.permissions.secrets +
    (pkg.permissions.exec ? 1 : 0) +
    (pkg.permissions.postinstall ? 1 : 0);
  return requested === 0 ? "quiet" : `${requested} requested`;
}

function sourceLabel(pkg: RegistryPackage): string {
  if (pkg.repo) return pkg.repo;
  const parts = pkg.sourceRepo.split("/");
  return parts[parts.length - 1] || "source";
}

function activeFilterLabel(query: string, type: string, trust: TrustFilter, sort: SortKey): string {
  const parts = [];
  if (query.trim()) parts.push(`search "${query.trim()}"`);
  if (type !== "all") parts.push(type);
  if (trust !== "all") parts.push(trust);
  parts.push(`sorted by ${sort}`);
  return parts.join(" / ");
}

function formatRegistryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
    year: "numeric"
  }).format(date);
}
