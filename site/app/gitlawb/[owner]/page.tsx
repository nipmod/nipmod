import type { Metadata } from "next";
import { notFound } from "next/navigation";
import registryData from "../../registry-data.json";
import { CommandBlock } from "../../command-block";
import { OwnerClaimFlow } from "../../owner-claim-flow";
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

  if (packages.length === 0) {
    notFound();
  }

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
            <a className="button button-ghost" href="/package">
              Create package
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
              <dt>DID</dt>
              <dd>did:key:{owner}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <OwnerClaimFlow
        actions={[
          { href: "/package", label: "Create package", variant: "primary" }
        ]}
        eyebrow="Owner path"
        lead="Use this flow for repos controlled by this owner. Nipmod verifies ownership before a package becomes trusted."
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
              <h3>Create package files locally</h3>
              <CommandBlock command={`nipmod package pr gitlawb://did:key:${owner}/your-repo --dir your-repo-pr --json`} label="Copy package command" />
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

function isOwnerSegment(value: string): boolean {
  return /^z[A-Za-z0-9]+$/.test(value);
}
