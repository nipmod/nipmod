import type { Metadata } from "next";
import claimIndexData from "../claim-index.json";
import registryData from "../registry-data.json";
import { OwnerClaimFlow } from "../owner-claim-flow";
import {
  candidateActivationPost,
  candidateClaimState,
  candidateConversionStats,
  candidateFromScout,
  candidateFromRepo,
  candidateGitlawbOwnerHref,
  candidateGitlawbPackageHref,
  candidateNoticeLabel,
  candidateNoticeStats,
  candidateOutreachKit,
  candidateStats,
  emptyCandidateNoticeState,
  fetchGitlawbRepos,
  fetchScoutCandidates,
  fetchScoutNoticeState,
  searchCandidates,
  type CandidateNoticeState,
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
  const notices = await loadNoticeState();
  const filtered = searchCandidates(candidates, query);
  const visibleLimit = query ? 80 : 48;
  const visibleCandidates = filtered.slice(0, visibleLimit);
  const hiddenCount = Math.max(filtered.length - visibleCandidates.length, 0);

  return (
    <main className="page-shell" id="main">
      <section className="quickstart-hero" aria-labelledby="candidates-title">
        <p className="eyebrow">Package Claim</p>
        <h1 id="candidates-title">Find your repo. Claim the package.</h1>
        <p className="lead">Search by repo name, DID owner or package id.</p>
      </section>

      <OwnerClaimFlow
        actions={[
          { href: "/package", label: "Package one repo manually", variant: "primary" },
          { href: "/agents", label: "Agent docs" }
        ]}
        eyebrow="Owner path"
        lead="Scout can prepare a draft, but the source owner decides when it becomes a verified package."
        title="How package claim works"
      />

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

        <section className="claim-conversion" aria-labelledby="claim-conversion-title">
          <div className="section-head compact-section-head">
            <p className="eyebrow">Funnel</p>
            <h2 id="claim-conversion-title">Claim conversion</h2>
            <p>Found repos become drafts. Owners turn drafts into verified packages.</p>
          </div>
          <div className="registry-stats claim-conversion-stats" aria-label="Claim conversion stats">
            {candidateConversionStats(candidates, notices).map((item) => (
              <div className="stat-tile" key={item.label}>
                <span>{item.value}</span>
                <p>{item.label}</p>
              </div>
            ))}
          </div>
          {notices.failed > 0 ? <p className="ranking-note">Owner notice delivery has {notices.failed} failed writes.</p> : null}
        </section>

        <section className="activation-grid" aria-label="Claim activation">
          <article className="activation-panel" aria-labelledby="notice-dashboard-title">
            <div className="section-head compact-section-head">
              <p className="eyebrow">Scout</p>
              <h2 id="notice-dashboard-title">Notice dashboard</h2>
              <p>Track outreach without pretending a draft is claimed before the owner signs it.</p>
            </div>
            <div className="registry-stats notice-stats" aria-label="Scout notice stats">
              {candidateNoticeStats(candidates, notices).map((item) => (
                <div className="stat-tile" key={item.label}>
                  <span>{item.value}</span>
                  <p>{item.label}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="activation-panel" aria-labelledby="public-update-title">
            <div className="section-head compact-section-head">
              <p className="eyebrow">Post</p>
              <h2 id="public-update-title">Public update</h2>
              <p>Use real Scout numbers. No inflated adoption claims.</p>
            </div>
            <pre className="install-command activation-post">
              <code>{candidateActivationPost(candidates, notices)}</code>
            </pre>
          </article>
        </section>

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
          {visibleCandidates.length > 0 ? (
            visibleCandidates.map((candidate) => <CandidateCard candidate={candidate} key={candidate.packageId} notices={notices} />)
          ) : (
            <div className="empty-state">
              <p>No candidates found.</p>
            </div>
          )}
        </div>
        {hiddenCount > 0 ? (
          <p className="ranking-note">
            Showing {visibleCandidates.length} of {filtered.length}. Search by repo name or DID owner to narrow the list.
          </p>
        ) : null}
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

async function loadNoticeState(): Promise<CandidateNoticeState> {
  try {
    return await fetchScoutNoticeState({ scoutUrl: "https://nipmod.com/scout" });
  } catch {
    return emptyCandidateNoticeState();
  }
}

function CandidateCard({ candidate, notices }: { candidate: PackageCandidate; notices: CandidateNoticeState }) {
  const statusLabel = candidateStatusLabel(candidate);
  const claimHref = packageHrefForSource(candidate.source);
  const outreach = candidateOutreachKit(candidate);

  return (
    <article className="package-card candidate-card">
      <div className="package-card-top">
        <div>
          <h3>
            <a
              href={candidate.gitlawbHref}
              aria-label={`Open ${candidate.repoName} on Gitlawb in a new tab`}
              rel="noreferrer"
              target="_blank"
            >
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
        <div>
          <dt>Notice status</dt>
          <dd>{candidateNoticeLabel(candidate, notices)}</dd>
        </div>
        <div>
          <dt>Claim link</dt>
          <dd>
            <a href={claimHref}>{candidate.status === "published" || candidate.status === "claimed" ? "done" : "ready"}</a>
          </dd>
        </div>
      </dl>

      <pre className="install-command">
        <code>{candidate.status === "claimed" || candidate.status === "published" ? `nipmod add ${candidate.packageId}` : candidate.draftCommand}</code>
      </pre>

      <div className="outreach-kit" aria-label={`${candidate.repoName} owner outreach`}>
        <div>
          <h4>Owner outreach</h4>
          <p>{outreach.xDm}</p>
        </div>
        <details>
          <summary>Gitlawb issue</summary>
          <pre className="outreach-copy">
            <code>{`${outreach.gitlawbIssueTitle}\n\n${outreach.gitlawbIssueBody}`}</code>
          </pre>
        </details>
        <details>
          <summary>Community reply</summary>
          <p>{outreach.communityReply}</p>
        </details>
        <a href={claimHref}>Ready claim link</a>
      </div>

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
          <a href={claimHref}>Claim package</a>
        )}
        <a href={candidateGitlawbOwnerHref(candidate)}>Owner page</a>
        <a href={candidateGitlawbPackageHref(candidate)}>Repo status</a>
        <a href={shareHref(candidate)} aria-label={`Share ${candidate.repoName} on X in a new tab`} rel="noreferrer" target="_blank">
          Share
        </a>
      </div>
    </article>
  );
}

function candidateStatusLabel(candidate: PackageCandidate): string {
  if (candidate.status === "claimed") return "claimed";
  if (candidate.status === "published") return "published";
  if (candidate.status === "unclaimed") return "Ready to claim";
  return "needs work";
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
