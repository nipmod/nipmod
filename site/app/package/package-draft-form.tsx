"use client";

import { useMemo, useState } from "react";

type PackageDraftFormProps = {
  inputLabel: string;
  inputPlaceholder: string;
};

export function PackageDraftForm({ inputLabel, inputPlaceholder }: PackageDraftFormProps) {
  const [repo, setRepo] = useState("");
  const draft = useMemo(() => draftFromRepo(repo), [repo]);
  const invalid = draft.status === "invalid";

  return (
    <section className="package-draft" aria-labelledby="draft-generator-title">
      <div className="draft-input">
        <h2 className="sr-only" id="draft-generator-title">
          Package draft generator
        </h2>
        <label htmlFor="repo-input">{inputLabel}</label>
        <input
          autoComplete="off"
          aria-describedby="repo-input-help"
          aria-errormessage={invalid ? "repo-input-help" : undefined}
          aria-invalid={invalid}
          id="repo-input"
          name="repo"
          onChange={(event) => setRepo(event.target.value)}
          placeholder={inputPlaceholder}
          type="text"
          value={repo}
        />
        <p id="repo-input-help" aria-live="polite" role={invalid ? "alert" : undefined}>
          {draft.helper}
        </p>
      </div>
      <div className="proof-panel">
        <h2 id="draft-title">Draft output</h2>
        <pre className="install-command">
          <code>{draft.commands}</code>
        </pre>
        <p className="panel-copy">
          The dry run returns the registry candidate, permissions checklist and source commit before any public write.
        </p>
      </div>
    </section>
  );
}

export function draftFromRepo(input: string) {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return {
      commands:
        "nipmod package gitlawb://did:key:z6Mk.../repo --dir repo\nnipmod manifest validate --dir repo\nnipmod publish repo --dry-run --json",
      helper: "Paste a public Gitlawb repo to generate exact commands.",
      status: "empty" as const
    };
  }

  if (!isValidGitlawbRepo(trimmed)) {
    return {
      commands: "No draft yet.",
      helper: "Enter a Gitlawb DID path or gitlawb.com repo URL.",
      status: "invalid" as const
    };
  }

  const repoName = inferRepoName(trimmed);
  const quotedInput = shellQuote(trimmed);
  const quotedDir = shellQuote(repoName);

  return {
    commands: `nipmod package ${quotedInput} --dir ${quotedDir}\nnipmod manifest validate --dir ${quotedDir}\nnipmod publish ${quotedDir} --dry-run --json`,
    helper: `Drafting as ${repoName}. Owner verification still requires the repo DID signature.`,
    status: "valid" as const
  };
}

export function isValidGitlawbRepo(input: string): boolean {
  const trimmed = input.trim().replace(/\.git$/i, "");
  return (
    /^gitlawb:\/\/(did:key:z[A-Za-z0-9]+|z[A-Za-z0-9]+)\/[a-z0-9][a-z0-9_-]*$/.test(trimmed) ||
    /^https:\/\/gitlawb\.com\/z[A-Za-z0-9]+\/[a-z0-9][a-z0-9_-]*$/.test(trimmed) ||
    /^https:\/\/node(?:2|3)?\.gitlawb\.com\/z[A-Za-z0-9]+\/[a-z0-9][a-z0-9_-]*$/.test(trimmed) ||
    /^https:\/\/node\.nipmod\.com\/z[A-Za-z0-9]+\/[a-z0-9][a-z0-9_-]*$/.test(trimmed)
  );
}

export function inferRepoName(input: string): string {
  const lastPathPart = input.replace(/\/+$/, "").split("/").at(-1) ?? "repo";
  const clean = lastPathPart
    .replace(/\.git$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return clean || "repo";
}

export function shellQuote(value: string): string {
  if (/^[a-zA-Z0-9_./:@-]+$/.test(value)) {
    return value;
  }

  return `'${value.replaceAll("'", "'\\''")}'`;
}
