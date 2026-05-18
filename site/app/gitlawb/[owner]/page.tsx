import type { Metadata } from "next";
import { notFound } from "next/navigation";
import registryData from "../../registry-data.json";
import { CommandBlock } from "../../command-block";
import { OwnerClaimFlow } from "../../owner-claim-flow";
import {
  candidateGitlawbPackageHref,
  candidateFromScout,
  candidateNoticeLabel,
  candidatesByGitlawbOwner,
  emptyCandidateNoticeState,
  fetchScoutCandidates,
  fetchScoutNoticeState,
  type CandidateNoticeState,
  type PackageCandidate
} from "../../../lib/candidates";
import {
  gitlawbPackageHref,
  packagesByGitlawbOwner,
  safeSourceRepoHref,
  type RegistryIndex,
  type RegistryPackage
} from "../../../lib/registry";
import { packageEvidenceHref, packagePageHref } from "../../packages/content";

type GitlawbOwnerPageProps = {
  params: Promise<{
    owner: string;
  }>;
};

const registry = registryData as RegistryIndex;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: GitlawbOwnerPageProps): Promise<Metadata> {
  const { owner } = await params;

  return {
    alternates: {
      canonical: `https://nipmod.com/gitlawb/${owner}`
    },
    description: "Nipmod package status for a Gitlawb DID owner.",
    openGraph: {
      description: "Nipmod package status for a Gitlawb DID owner.",
      title: "Gitlawb owner package status",
      url: `https://nipmod.com/gitlawb/${owner}`
    },
    title: "Gitlawb owner package status"
  };
}

export default async function GitlawbOwnerPage({ params }: GitlawbOwnerPageProps) {
  const { owner } = await params;
  if (!isOwnerSegment(owner)) {
    notFound();
  }

  const packages = packagesByGitlawbOwner(registry.packages, owner);
  const candidates = await loadOwnerCandidates(owner);
  const notices = await loadNoticeState();

  if (packages.length === 0 && candidates.length === 0) {
    notFound();
  }

  const claimable = candidates.filter((candidate) => candidate.status !== "published");
  const publishedPackageIds = new Set(packages.map((pkg) => pkg.canonical));
  const claimableOnly = claimable.filter((candidate) => !publishedPackageIds.has(candidate.packageId));

  return (
    <main className="page-shell" id="main">
      <section className="package-hero" aria-labelledby="owner-title">
        <div>
          <p className="eyebrow">Gitlawb owner</p>
          <h1 id="owner-title">Owner package status</h1>
          <p className="lead">{owner}</p>
          <div className="actions">
            <a className="button button-primary" href="#published">
              Published
            </a>
            <a className="button button-ghost" href="#drafts">
              Claim drafts
            </a>
            <a className="button button-ghost" href="/candidates">
              All candidates
            </a>
          </div>
        </div>
        <aside className="package-side" aria-label="Owner package facts">
          <dl className="proof-facts">
            <div>
              <dt>Published</dt>
              <dd>{packages.length}</dd>
            </div>
            <div>
              <dt>Claimable</dt>
              <dd>{claimableOnly.length}</dd>
            </div>
            <div>
              <dt>DID</dt>
              <dd>did:key:{owner}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <OwnerClaimFlow
        actions={[
          { href: "/package", label: "Package another repo", variant: "primary" },
          { href: "/candidates", label: "All candidates" }
        ]}
        eyebrow="Owner path"
        lead="Use a prepared draft when Scout found one. Package another public repo when it has no draft yet."
        title="Owner next steps"
      />

      <section className="trust-section" aria-labelledby="owner-commands-title">
        <div>
          <p className="eyebrow">Owner commands</p>
          <h2 id="owner-commands-title">Verify before publishing</h2>
        </div>
        <div className="check-list">
          <article className="check-row evidence-row">
            <span className="check-dot check-ok" aria-hidden="true" />
            <div>
              <h3>Check existing claims</h3>
              <CommandBlock command="nipmod claim index --node https://node.nipmod.com --json" label="Copy claim index command" />
            </div>
          </article>
          <article className="check-row evidence-row">
            <span className="check-dot check-ok" aria-hidden="true" />
            <div>
              <h3>Verify one repo</h3>
              <CommandBlock command={`nipmod claim verify gitlawb://did:key:${owner}/repo --json`} label="Copy claim verify command" />
            </div>
          </article>
          <article className="check-row evidence-row">
            <span className="check-dot check-ok" aria-hidden="true" />
            <div>
              <h3>Create one package draft</h3>
              <CommandBlock command={`nipmod package pr gitlawb://did:key:${owner}/repo --dir repo-pr --json`} label="Copy package draft command" />
            </div>
          </article>
        </div>
      </section>

      <section className="registry-section" id="published" aria-labelledby="published-title">
        <div className="registry-head">
          <div>
            <p className="eyebrow">Published</p>
            <h2 id="published-title">Published packages</h2>
          </div>
        </div>
        <div className="package-grid">
          {packages.length > 0 ? (
            packages.map((pkg) => <OwnerPackageCard key={`${pkg.canonical}@${pkg.version}`} pkg={pkg} />)
          ) : (
            <div className="empty-state">
              <p>No published packages for this owner yet.</p>
            </div>
          )}
        </div>
      </section>

      <section className="registry-section" id="drafts" aria-labelledby="drafts-title">
        <div className="registry-head">
          <div>
            <p className="eyebrow">Drafts</p>
            <h2 id="drafts-title">Claimable drafts</h2>
          </div>
        </div>
        <div className="package-grid">
          {claimableOnly.length > 0 ? (
            claimableOnly.map((candidate) => <OwnerCandidateCard candidate={candidate} key={candidate.packageId} notices={notices} />)
          ) : (
            <div className="empty-state">
              <p>No claimable drafts for this owner right now.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function OwnerPackageCard({ pkg }: { pkg: RegistryPackage }) {
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
          <dd>{pkg.version}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{pkg.type}</dd>
        </div>
        <div>
          <dt>Score</dt>
          <dd>{pkg.trust.score}/100</dd>
        </div>
      </dl>
      <pre className="install-command">
        <code>{`nipmod install ${pkg.canonical}@${pkg.version}`}</code>
      </pre>
      <div className="package-links">
        <a href={gitlawbPackageHref(pkg)}>Repo status</a>
        <a href={packagePageHref(pkg)}>Package</a>
        <a href={packageEvidenceHref(pkg)}>Evidence</a>
        {sourceRepoHref ? (
          <a
            href={sourceRepoHref}
            aria-label={`Open ${pkg.name} on Gitlawb in a new tab`}
            rel="noreferrer"
            target="_blank"
          >
            Gitlawb
          </a>
        ) : null}
      </div>
    </article>
  );
}

function OwnerCandidateCard({ candidate, notices }: { candidate: PackageCandidate; notices: CandidateNoticeState }) {
  const claimHref = `/package?repo=${encodeURIComponent(candidate.source)}`;

  return (
    <article className="package-card candidate-card">
      <div className="package-card-top">
        <div>
          <h3>
            <a href={claimHref}>{candidate.repoName}</a>
          </h3>
          <p>{candidate.description}</p>
        </div>
        <span className={`trust-badge candidate-${candidate.status}`}>{candidate.status}</span>
      </div>
      <dl className="package-meta">
        <div>
          <dt>Ready</dt>
          <dd>{candidate.readinessScore}/100</dd>
        </div>
        <div>
          <dt>Package</dt>
          <dd>{candidate.packageId}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{candidate.updatedAt.slice(0, 10)}</dd>
        </div>
        <div>
          <dt>Notice status</dt>
          <dd>{candidateNoticeLabel(candidate, notices)}</dd>
        </div>
        <div>
          <dt>Claim link</dt>
          <dd>
            <a href={claimHref}>ready</a>
          </dd>
        </div>
      </dl>
      <pre className="install-command">
        <code>{candidate.draftCommand}</code>
      </pre>
      <div className="package-links">
        <a href={claimHref}>Claim</a>
        <a href={candidateGitlawbPackageHref(candidate)}>Repo status</a>
        {candidate.draftEndpoint ? (
          <a
            href={candidate.draftEndpoint}
            aria-label={`Open ${candidate.repoName} draft JSON in a new tab`}
            rel="noreferrer"
            target="_blank"
          >
            Draft JSON
          </a>
        ) : null}
        <a
          href={candidate.gitlawbHref}
          aria-label={`Open ${candidate.repoName} on Gitlawb in a new tab`}
          rel="noreferrer"
          target="_blank"
        >
          Gitlawb
        </a>
      </div>
    </article>
  );
}

async function loadOwnerCandidates(owner: string): Promise<PackageCandidate[]> {
  try {
    const scoutCandidates = await fetchScoutCandidates({ scoutUrl: "https://nipmod.com/scout" });
    return candidatesByGitlawbOwner(scoutCandidates.map(candidateFromScout), owner);
  } catch {
    return [];
  }
}

async function loadNoticeState(): Promise<CandidateNoticeState> {
  try {
    return await fetchScoutNoticeState({ scoutUrl: "https://nipmod.com/scout" });
  } catch {
    return emptyCandidateNoticeState();
  }
}

function isOwnerSegment(value: string): boolean {
  return /^z[A-Za-z0-9]+$/.test(value);
}
