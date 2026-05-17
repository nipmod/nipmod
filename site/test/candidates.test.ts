import { describe, expect, test } from "vitest";
import { candidateFromRepo, candidateStats, searchCandidates, type GitlawbRepoSummary } from "../lib/candidates";

describe("candidate content", () => {
  const repo: GitlawbRepoSummary = {
    clone_url: "https://node.example/z6Owner/repo-reader.git",
    default_branch: "main",
    description: "Read Gitlawb repos for agents",
    is_public: true,
    name: "repo-reader",
    owner_did: "did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD",
    updated_at: "2026-05-17T00:00:00.000Z"
  };

  test("turns a Gitlawb repo into a claimable package candidate", () => {
    const candidate = candidateFromRepo(repo, {
      claimedPackages: new Set(),
      publishedPackages: new Set()
    });

    expect(candidate).toMatchObject({
      claimCommand:
        "nipmod claim gitlawb://did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/repo-reader",
      draftCommand:
        "nipmod package pr gitlawb://did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/repo-reader --dir repo-reader-pr --json",
      packageId: "pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/repo-reader",
      repoName: "repo-reader",
      source: "gitlawb://did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/repo-reader",
      status: "unclaimed"
    });
    expect(candidate.readinessScore).toBeGreaterThanOrEqual(60);
  });

  test("does not mark registry packages as claimed without a verified proof", () => {
    const candidate = candidateFromRepo(repo, {
      claimedPackages: new Set(),
      publishedPackages: new Set([`pkg:${repo.owner_did}/${repo.name}`])
    });

    expect(candidate.status).toBe("published");
    expect(candidate.readinessScore).toBe(100);
  });

  test("marks verified claim proof packages as claimed", () => {
    const candidate = candidateFromRepo(repo, {
      claimedPackages: new Set([`pkg:${repo.owner_did}/${repo.name}`]),
      publishedPackages: new Set([`pkg:${repo.owner_did}/${repo.name}`])
    });

    expect(candidate.status).toBe("claimed");
    expect(candidate.readinessScore).toBe(100);
  });

  test("searches candidates by repo, package and description", () => {
    const candidate = candidateFromRepo(repo, {
      claimedPackages: new Set(),
      publishedPackages: new Set()
    });

    expect(searchCandidates([candidate], "reader")).toHaveLength(1);
    expect(searchCandidates([candidate], "agent")).toHaveLength(1);
    expect(searchCandidates([candidate], "missing")).toHaveLength(0);
  });

  test("summarizes candidate states", () => {
    const unclaimed = candidateFromRepo(repo, {
      claimedPackages: new Set(),
      publishedPackages: new Set()
    });
    const published = candidateFromRepo(repo, {
      claimedPackages: new Set(),
      publishedPackages: new Set([`pkg:${repo.owner_did}/${repo.name}`])
    });
    const claimed = candidateFromRepo(repo, {
      claimedPackages: new Set([`pkg:${repo.owner_did}/${repo.name}`]),
      publishedPackages: new Set([`pkg:${repo.owner_did}/${repo.name}`])
    });

    expect(candidateStats([unclaimed, published, claimed])).toEqual([
      { label: "Repos", value: "3" },
      { label: "Drafts", value: "2" },
      { label: "Claimed", value: "1" },
      { label: "Published", value: "1" },
      { label: "Unclaimed drafts", value: "1" }
    ]);
  });
});
