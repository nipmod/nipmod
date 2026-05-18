import type { Metadata } from "next";
import { notFound } from "next/navigation";
import registryData from "../../../registry-data.json";
import { CommandBlock } from "../../../command-block";
import {
  candidateFromScout,
  fetchScoutCandidates,
  findCandidateByGitlawbPath,
  type PackageCandidate
} from "../../../../lib/candidates";
import {
  findPackageByGitlawbPath,
  gitlawbOwnerHref,
  ownerSegmentFromDid,
  safeSourceRepoHref,
  type RegistryIndex,
  type RegistryPackage
} from "../../../../lib/registry";
import { packageQuality } from "../../../../lib/package-quality";
import { packageEvidenceHref, packagePageHref } from "../../../packages/content";

type GitlawbPackagePageProps = {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
};

const registry = registryData as RegistryIndex;

export function generateStaticParams(): Array<{ owner: string; repo: string }> {
  return registry.packages.map((pkg) => ({
    owner: ownerSegmentFromDid(pkg.owner),
    repo: pkg.repo
  }));
}

export async function generateMetadata({ params }: GitlawbPackagePageProps): Promise<Metadata> {
  const { owner, repo } = await params;
  const pkg = findPackageByGitlawbPath(registry.packages, owner, repo);
  const title = pkg ? `${pkg.name} Gitlawb package` : `${repo} package status`;
  const description = pkg
    ? `${pkg.name}: installable Nipmod package sourced from Gitlawb.`
    : "Nipmod package status for a Gitlawb repo.";

  return {
    alternates: {
      canonical: `https://nipmod.com/gitlawb/${owner}/${repo}`
    },
    description,
    openGraph: {
      description,
      title,
      url: `https://nipmod.com/gitlawb/${owner}/${repo}`
    },
    title
  };
}

export default async function GitlawbPackagePage({ params }: GitlawbPackagePageProps) {
  const { owner, repo } = await params;
  if (!isOwnerSegment(owner) || !isRepoName(repo)) {
    notFound();
  }

  const pkg = findPackageByGitlawbPath(registry.packages, owner, repo);
  const candidate = pkg ? null : await loadCandidate(owner, repo);

  if (!pkg && !candidate) {
    notFound();
  }

  return (
    <main className="page-shell" id="main">
      {pkg ? <PublishedPackageSurface pkg={pkg} owner={owner} repo={repo} /> : null}
      {!pkg && candidate ? <CandidatePackageSurface candidate={candidate} owner={owner} repo={repo} /> : null}
    </main>
  );
}

function PublishedPackageSurface({ owner, pkg, repo }: { owner: string; pkg: RegistryPackage; repo: string }) {
  const quality = packageQuality(pkg);
  const sourceRepoHref = safeSourceRepoHref(pkg.sourceRepo);
  const exactInstall = `nipmod install ${pkg.canonical}@${pkg.version}`;
  const badgeUrl = `https://nipmod.com/badge/${owner}/${repo}`;

  return (
    <>
      <section className="package-hero" aria-labelledby="gitlawb-package-title">
        <div>
          <p className="eyebrow">Gitlawb package</p>
          <h1 id="gitlawb-package-title">{pkg.name}</h1>
          <p className="lead">{pkg.description}</p>
          <div className="actions">
            <a className="button button-primary" href={packagePageHref(pkg)}>
              Package
            </a>
            <a className="button button-ghost" href={packageEvidenceHref(pkg)}>
              Evidence
            </a>
            {sourceRepoHref ? (
              <a className="button button-ghost" href={sourceRepoHref} rel="noreferrer" target="_blank">
                Gitlawb
              </a>
            ) : null}
            <a className="button button-ghost" href={gitlawbOwnerHref(pkg)}>
              Owner
            </a>
          </div>
        </div>
        <aside className="package-side" aria-label="Gitlawb package facts">
          <div className="badge-stack">
            <span className={`trust-badge trust-${pkg.trust.level}`}>{pkg.trust.level}</span>
            <span className={`trust-badge quality-${quality.label.toLowerCase()}`}>{quality.score}/100</span>
          </div>
          <dl className="proof-facts">
            <div>
              <dt>Status</dt>
              <dd>published</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{pkg.version}</dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd>{owner}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="trust-section" aria-labelledby="repo-install-title">
        <div>
          <p className="eyebrow">Install</p>
          <h2 id="repo-install-title">Exact package command</h2>
        </div>
        <div className="proof-panel">
          <CommandBlock command={exactInstall} label="Copy exact install command" />
        </div>
      </section>

      <RepoMachineLinks
        badgeMarkdown={`![Nipmod package](${badgeUrl})`}
        badgeUrl={badgeUrl}
        links={[
          { href: packagePageHref(pkg), label: "Package page" },
          { href: gitlawbOwnerHref(pkg), label: "Owner page" },
          { href: packageEvidenceHref(pkg), label: "Evidence" },
          { href: packageDocumentHref(pkg.canonical), label: "Package JSON" },
          { href: packageVersionHref(pkg.canonical, pkg.version), label: "Version JSON" },
          { href: "/.well-known/nipmod.json", label: "Discovery" }
        ]}
      />
    </>
  );
}

function CandidatePackageSurface({ candidate, owner, repo }: { candidate: PackageCandidate; owner: string; repo: string }) {
  const badgeUrl = `https://nipmod.com/badge/${owner}/${repo}?status=draft`;
  const claimHref = `/package?repo=${encodeURIComponent(candidate.source)}`;

  return (
    <>
      <section className="package-hero" aria-labelledby="gitlawb-candidate-title">
        <div>
          <p className="eyebrow">Package draft</p>
          <h1 id="gitlawb-candidate-title">{candidate.repoName}</h1>
          <p className="lead">{candidate.description}</p>
          <div className="actions">
            <a className="button button-primary" href={claimHref}>
              Claim
            </a>
            {candidate.draftEndpoint ? (
              <a className="button button-ghost" href={candidate.draftEndpoint} rel="noreferrer" target="_blank">
                Draft
              </a>
            ) : null}
            <a className="button button-ghost" href={candidate.gitlawbHref} rel="noreferrer" target="_blank">
              Gitlawb
            </a>
            <a className="button button-ghost" href={`/gitlawb/${owner}`}>
              Owner
            </a>
          </div>
        </div>
        <aside className="package-side" aria-label="Gitlawb draft facts">
          <div className="badge-stack">
            <span className={`trust-badge candidate-${candidate.status}`}>{candidate.status}</span>
            <span className="trust-badge trust-signed">{candidate.readinessScore}/100</span>
          </div>
          <dl className="proof-facts">
            <div>
              <dt>Status</dt>
              <dd>{candidate.status}</dd>
            </div>
            <div>
              <dt>Package</dt>
              <dd>{candidate.packageId}</dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd>{owner}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="trust-section" aria-labelledby="repo-claim-title">
        <div>
          <p className="eyebrow">Claim</p>
          <h2 id="repo-claim-title">Owner verified package path</h2>
        </div>
        <div className="check-list">
          <article className="check-row evidence-row">
            <span className="check-dot check-ok" aria-hidden="true" />
            <div>
              <h3>Create package draft</h3>
              <CommandBlock command={candidate.draftCommand} label="Copy draft command" />
            </div>
          </article>
          <article className="check-row evidence-row">
            <span className="check-dot check-ok" aria-hidden="true" />
            <div>
              <h3>Verify ownership</h3>
              <CommandBlock command={candidate.claimVerifyCommand} label="Copy claim verification command" />
            </div>
          </article>
        </div>
      </section>

      <RepoMachineLinks
        badgeMarkdown={`![Nipmod draft](${badgeUrl})`}
        badgeUrl={badgeUrl}
        links={[
          { href: claimHref, label: "Claim page" },
          { href: `/gitlawb/${owner}`, label: "Owner page" },
          ...(candidate.draftEndpoint ? [{ href: candidate.draftEndpoint, label: "Draft JSON" }] : []),
          { href: "/candidates", label: "Candidates" },
          { href: "/.well-known/nipmod.json", label: "Discovery" }
        ]}
      />
    </>
  );
}

function RepoMachineLinks({
  badgeMarkdown,
  badgeUrl,
  links
}: {
  badgeMarkdown: string;
  badgeUrl: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <section className="trust-section" aria-labelledby="repo-machine-title">
      <div>
        <p className="eyebrow">Agent links</p>
        <h2 id="repo-machine-title">Stable URLs for this repo</h2>
      </div>
      <div className="proof-panel">
        <div className="package-links">
          <a href={badgeUrl}>Badge SVG</a>
          {links.map((link) => (
            <a href={link.href} key={`${link.label}:${link.href}`}>
              {link.label}
            </a>
          ))}
        </div>
        <CommandBlock command={badgeMarkdown} label="Copy badge markdown" />
      </div>
    </section>
  );
}

async function loadCandidate(owner: string, repo: string): Promise<PackageCandidate | null> {
  try {
    const scoutCandidates = await fetchScoutCandidates({ scoutUrl: "https://nipmod.com/scout" });
    const candidates = scoutCandidates.map(candidateFromScout);
    return findCandidateByGitlawbPath(candidates, owner, repo);
  } catch {
    return null;
  }
}

function packageDocumentHref(canonical: string): string {
  return `/registry/packages/${encodePackageCanonical(canonical)}.json`;
}

function packageVersionHref(canonical: string, version: string): string {
  return `/registry/packages/${encodePackageCanonical(canonical)}/${version}.json`;
}

function encodePackageCanonical(canonical: string): string {
  return Buffer.from(canonical).toString("base64url");
}

function isOwnerSegment(value: string): boolean {
  return /^z[A-Za-z0-9]+$/.test(value);
}

function isRepoName(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*$/i.test(value);
}
