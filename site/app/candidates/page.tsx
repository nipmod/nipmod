import type { Metadata } from "next";
import registryData from "../registry-data.json";
import {
  candidateFromRepo,
  candidateStats,
  fetchGitlawbRepos,
  searchCandidates,
  type PackageCandidate
} from "../../lib/candidates";
import type { RegistryIndex } from "../../lib/registry";

type CandidatesPageProps = {
  searchParams?: Promise<{
    q?: string | string[] | undefined;
  }>;
};

const registry = registryData as RegistryIndex;

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/candidates"
  },
  description: "Claim a public Gitlawb repo as an installable Nipmod package for agents.",
  openGraph: {
    description: "Claim a public Gitlawb repo as an installable Nipmod package for agents.",
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
        <h1 id="candidates-title">Turn Gitlawb repos into agent packages.</h1>
        <p className="lead">Nipmod finds public Gitlawb repos, scores package readiness and lets owners claim them with Gitlawb proof.</p>
      </section>

      <section className="registry-section" aria-labelledby="candidate-browse-title">
        <div className="registry-head">
          <div>
            <p className="eyebrow">Candidates</p>
            <h2 id="candidate-browse-title">Claim what is yours.</h2>
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
          <span>Candidate</span>
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
  const claimedPackages = new Set(registry.packages.map((pkg) => pkg.canonical));
  try {
    const repos = await fetchGitlawbRepos({ nodeUrl: registry.source || "https://node.nipmod.com" });
    return repos.map((repo) => candidateFromRepo(repo, claimedPackages));
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
        claimedPackages
      )
    );
  }
}

function CandidateCard({ candidate }: { candidate: PackageCandidate }) {
  const statusLabel =
    candidate.status === "claimed" ? "claimed" : candidate.status === "unclaimed" ? "unclaimed" : "needs work";

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
          <dd>{candidate.shortOwner}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>Gitlawb</dd>
        </div>
      </dl>

      <pre className="install-command">
        <code>{candidate.status === "claimed" ? `nipmod add ${candidate.packageId}` : candidate.claimCommand}</code>
      </pre>

      <div className="package-links">
        <a href={candidate.gitlawbHref} rel="noreferrer" target="_blank">
          Gitlawb
        </a>
        <a href={`/packages?q=${encodeURIComponent(candidate.repoName)}`}>Package</a>
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
