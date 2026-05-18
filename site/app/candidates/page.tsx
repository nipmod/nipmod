import type { Metadata } from "next";
import claimIndexData from "../claim-index.json";
import registryData from "../registry-data.json";
import {
  candidateClaimState,
  candidateFromScout,
  candidateFromRepo,
  candidateGitlawbOwnerHref,
  candidateGitlawbPackageHref,
  candidateStats,
  fetchGitlawbRepos,
  fetchScoutCandidates,
  searchCandidates,
  type PackageCandidate
} from "../../lib/candidates";
import type { PackageClaimIndex } from "../../lib/candidates";
import type { RegistryIndex } from "../../lib/registry";

type CandidatesPageProps = {
  searchParams?: Promise<{
    q?: string | string[] | undefined;
  }>;
};

const registry = registryData as RegistryIndex;
const claimIndex = claimIndexData as PackageClaimIndex;

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/candidates"
  },
  description: "Claim a Scout prepared Nipmod package draft for a public Gitlawb repo.",
  openGraph: {
    description: "Claim a Scout prepared Nipmod package draft for a public Gitlawb repo.",
    title: "Nipmod Package Claim",
    url: "https://nipmod.com/candidates"
  },
  title: "Package Claim"
};

export default async function CandidatesPage({ searchParams }: CandidatesPageProps) {
  const params = searchParams ? await searchParams : {};
  const query = firstParam(params.q);
  const candidates = await loadCandidates();
  const filtered = searchCandidates(candidates, query);

  return (
    <main className="page-shell" id="main">
      <section className="quickstart-hero" aria-labelledby="candidates-title">
        <p className="eyebrow">Package Claim</p>
        <h1 id="candidates-title">Claim package drafts.</h1>
        <p className="lead">Scout finds public Gitlawb repos, prepares package paths and lets owners verify with their own DID.</p>
      </section>

      <section className="registry-section" aria-labelledby="candidate-browse-title">
        <div className="registry-head">
          <div>
            <p className="eyebrow">Candidates</p>
            <h2 id="candidate-browse-title">Claim a prepared draft.</h2>
          </div>
          <form className="search-form" action="/candidates">
            <label className="sr-only" htmlFor="candidate-search">
              Search candidates
            </label>
            <input
              autoComplete="off"
              defaultValue={query}
              id="candidate-search"
              name="q"
              placeholder="Search Gitlawb repos"
              type="search"
            />
            <button className="button button-primary button-small" type="submit">
              Search
            </button>
          </form>
        </div>

        <div className="registry-stats" aria-label="Candidate stats">
          {candidateStats(candidates).map((item) => (
            <div className="stat-tile" key={item.label}>
              <span>{item.value}</span>
              <p>{item.label}</p>
            </div>
          ))}
        </div>

        <div className="candidate-flow" aria-label="Package Claim flow">
          <span>Gitlawb repo</span>
          <span>Scout draft</span>
          <span>Owner claim</span>
          <span>Verified package</span>
        </div>

        <div className="package-grid" aria-live="polite">
          {filtered.length > 0 ? (
            filtered.map((candidate) => <CandidateCard candidate={candidate} key={candidate.packageId} />)
          ) : (
            <div className="empty-state">
              <p>No candidates found.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

async function loadCandidates(): Promise<PackageCandidate[]> {
  const state = candidateClaimState({
    claimIndex,
    publishedPackages: new Set(registry.packages.map((pkg) => pkg.canonical))
  });
  try {
    const scoutCandidates = await fetchScoutCandidates({ scoutUrl: "https://nipmod.com/scout" });
    if (scoutCandidates.length > 0) {
      return scoutCandidates.map(candidateFromScout);
    }
  } catch {
    // Fall back to direct node scan below when the long-running scout service is unavailable.
  }
  try {
    const repos = await fetchGitlawbRepos({ nodeUrl: registry.source || "https://node.nipmod.com" });
    return repos.map((repo) => candidateFromRepo(repo, state));
  } catch {
    return registry.packages.map((pkg) =>
      candidateFromRepo(
        {
          clone_url: pkg.cloneUrl,
          default_branch: "main",
          description: pkg.description,
          is_public: true,
          name: pkg.repo,
          owner_did: pkg.publisher,
          updated_at: pkg.updatedAt
        },
        state
      )
    );
  }
}

function CandidateCard({ candidate }: { candidate: PackageCandidate }) {
  const statusLabel =
    candidate.status === "claimed"
      ? "claimed"
      : candidate.status === "published"
        ? "published"
        : candidate.status === "unclaimed"
          ? "unclaimed"
          : "needs work";

  return (
    <article className="package-card candidate-card">
      <div className="package-card-top">
        <div>
          <h3>
            <a href={candidate.gitlawbHref} rel="noreferrer" target="_blank">
              {candidate.repoName}
            </a>
          </h3>
          <p>{candidate.description}</p>
        </div>
        <span className={`trust-badge candidate-${candidate.status}`}>{statusLabel}</span>
      </div>

      <dl className="package-meta">
        <div>
          <dt>Ready</dt>
          <dd>{candidate.readinessScore}/100</dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd>
            <a href={candidateGitlawbOwnerHref(candidate)}>{candidate.shortOwner}</a>
          </dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{candidate.status === "published" ? "published" : candidate.draftStatus === "claimed" ? "claimed draft" : "draft ready"}</dd>
        </div>
      </dl>

      <pre className="install-command">
        <code>{candidate.status === "claimed" || candidate.status === "published" ? `nipmod add ${candidate.packageId}` : candidate.draftCommand}</code>
      </pre>

      <div className="package-links">
        <a
          href={candidate.gitlawbHref}
          aria-label={`Open ${candidate.repoName} on Gitlawb in a new tab`}
          rel="noreferrer"
          target="_blank"
        >
          Gitlawb
        </a>
        {candidate.draftEndpoint && candidate.status !== "published" ? (
          <a
            href={candidate.draftEndpoint}
            aria-label={`Open ${candidate.repoName} draft in a new tab`}
            rel="noreferrer"
            target="_blank"
          >
            Draft
          </a>
        ) : null}
        {candidate.status === "published" || candidate.status === "claimed" ? (
          <a href={`/packages?q=${encodeURIComponent(candidate.repoName)}`}>Package</a>
        ) : (
          <a href={packageHrefForSource(candidate.source)}>Claim package</a>
        )}
        <a href={candidateGitlawbPackageHref(candidate)}>Repo status</a>
        <a href={shareHref(candidate)} aria-label={`Share ${candidate.repoName} on X in a new tab`} rel="noreferrer" target="_blank">
          Share
        </a>
      </div>
    </article>
  );
}

function packageHrefForSource(source: string): string {
  return `/package?repo=${encodeURIComponent(source)}`;
}

function shareHref(candidate: PackageCandidate): string {
  const text = `Nipmod prepared a package draft for ${candidate.repoName}. Claim it here: https://nipmod.com${packageHrefForSource(candidate.source)}`;
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}
