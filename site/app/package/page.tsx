import type { Metadata } from "next";
import { homeContent } from "../content";
import { OwnerClaimFlow } from "../owner-claim-flow";
import { PackageDraftForm } from "./package-draft-form";

type PackagePageProps = {
  searchParams?: Promise<{
    repo?: string | string[] | undefined;
  }>;
};

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/package"
  },
  description: "Create a Nipmod package draft from a public Gitlawb repo and claim it with a DID signature.",
  openGraph: {
    description: "Create a Nipmod package draft from a public Gitlawb repo and claim it with a DID signature.",
    title: "Package a Gitlawb repo",
    url: "https://nipmod.com/package"
  },
  title: "Package a Gitlawb repo"
};

export default async function PackagePage({ searchParams }: PackagePageProps) {
  const params = searchParams ? await searchParams : {};
  const initialRepo = firstParam(params.repo);

  return (
    <main className="page-shell" id="main">
      <section className="quickstart-hero" aria-labelledby="package-title">
        <p className="eyebrow">Create</p>
        <h1 id="package-title">Package a Gitlawb repo.</h1>
        <p className="lead">Paste a repo. Get package doctor, draft files, claim check and a safe publish dry run.</p>
        <div className="actions" aria-label="Package actions">
          <a className="button button-primary" href="/quickstart#install">
            Install
          </a>
          <a className="button button-ghost" href="/quickstart#docs">
            Docs
          </a>
        </div>
      </section>

      <OwnerClaimFlow
        actions={[
          { href: "/candidates", label: "Browse prepared drafts", variant: "primary" },
          { href: "/agents", label: "Agent docs" }
        ]}
        eyebrow="Package path"
        lead="Use this path when you already know the Gitlawb repo. If Scout found it first, start from the prepared draft."
        title="Package path"
      />

      <PackageDraftForm
        initialRepo={initialRepo}
        inputLabel={homeContent.repoToPackage.inputLabel}
        inputPlaceholder={homeContent.repoToPackage.inputPlaceholder}
      />

      <section className="proof-section" aria-labelledby="publish-requirements-title">
        <div>
          <p className="eyebrow">Publish</p>
          <h2 id="publish-requirements-title">Dry run first. Ownership before public listing.</h2>
        </div>
        <div className="proof-panel">
          <p className="panel-copy">
            A draft is safe for any public Gitlawb repo. A verified publish needs the matching DID identity, helper,
            manifest and registry candidate.
          </p>
          <pre className="install-command">
            <code>{"nipmod package doctor gitlawb://did:key:z6Mk.../repo --json\nnipmod manifest validate --dir repo --json\nnipmod publish repo --dry-run --json"}</code>
          </pre>
        </div>
      </section>

      <section className="usage-strip" aria-label="Repo to package steps">
        {homeContent.repoToPackage.steps.map((step) => (
          <article className="usage-item" key={step.label}>
            <h2>{step.label}</h2>
            <p>{step.text}</p>
          </article>
        ))}
      </section>

      <section className="proof-section" aria-labelledby="boundary-title">
        <div>
          <p className="eyebrow">Boundary</p>
          <h2 id="boundary-title">Gitlawb stores it. Nipmod verifies it.</h2>
        </div>
        <div className="proof-panel">
          <p className="panel-copy">
            Moving refs are not enough. A green package needs digest, DID signature, release event, transparency,
            witness and advisory evidence.
          </p>
          <pre className="install-command">
            <code>{"nipmod publish repo --dry-run --json"}</code>
          </pre>
        </div>
      </section>
    </main>
  );
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}
