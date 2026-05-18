import { describe, expect, test } from "vitest";
import registryData from "../app/registry-data.json";
import { GET as badgeGET } from "../app/badge/[owner]/[repo]/route";
import {
  candidateFromRepo,
  candidateGitlawbPackageHref,
  findCandidateByGitlawbPath,
  type GitlawbRepoSummary
} from "../lib/candidates";
import {
  didFromOwnerSegment,
  findPackageByGitlawbPath,
  gitlawbPackageHref,
  ownerSegmentFromDid,
  type RegistryIndex
} from "../lib/registry";

const registry = registryData as RegistryIndex;

describe("Gitlawb package surface", () => {
  test("maps DID owners to stable Gitlawb package URLs", () => {
    const pkg = registry.packages[0];

    expect(pkg).toBeDefined();
    if (!pkg) {
      return;
    }

    const owner = ownerSegmentFromDid(pkg.publisher);
    expect(owner).toMatch(/^z[A-Za-z0-9]+$/);
    expect(didFromOwnerSegment(owner)).toBe(pkg.publisher);
    expect(gitlawbPackageHref(pkg)).toBe(`/gitlawb/${owner}/${pkg.repo}`);
    expect(findPackageByGitlawbPath(registry.packages, owner, pkg.repo)?.canonical).toBe(pkg.canonical);
    expect(findPackageByGitlawbPath(registry.packages, "bad-owner", pkg.repo)).toBeNull();
  });

  test("maps Scout candidates to the same Gitlawb package URL shape", () => {
    const repo: GitlawbRepoSummary = {
      clone_url: "https://node.nipmod.com/z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader.git",
      default_branch: "main",
      description: "Read Gitlawb repos for agents",
      is_public: true,
      name: "gitlawb-repo-reader",
      owner_did: "did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD",
      updated_at: "2026-05-17T00:00:00.000Z"
    };
    const candidate = candidateFromRepo(repo, {
      claimedPackages: new Set(),
      publishedPackages: new Set()
    });

    expect(candidateGitlawbPackageHref(candidate)).toBe(
      "/gitlawb/z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader"
    );
    expect(
      findCandidateByGitlawbPath(
        [candidate],
        "z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD",
        "gitlawb-repo-reader"
      )?.packageId
    ).toBe(candidate.packageId);
  });

  test("renders a verified SVG badge for published packages", async () => {
    const pkg = registry.packages[0];

    expect(pkg).toBeDefined();
    if (!pkg) {
      return;
    }

    const owner = ownerSegmentFromDid(pkg.publisher);
    const response = await badgeGET(new Request(`https://nipmod.com/badge/${owner}/${pkg.repo}`), {
      params: Promise.resolve({ owner, repo: pkg.repo })
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/svg+xml");
    expect(body).toContain("Nipmod");
    expect(body).toContain("verified");
    expect(body).not.toContain("<script");
  });

  test("renders a draft SVG badge for valid Gitlawb repo paths", async () => {
    const response = await badgeGET(new Request("https://nipmod.com/badge/z6Mkdraftowner/draft-repo?status=draft"), {
      params: Promise.resolve({ owner: "z6Mkdraftowner", repo: "draft-repo" })
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("draft ready");
  });

  test("rejects invalid Gitlawb badge paths", async () => {
    const response = await badgeGET(new Request("https://nipmod.com/badge/not-valid/../x"), {
      params: Promise.resolve({ owner: "not-valid", repo: "../x" })
    });

    expect(response.status).toBe(404);
  });
});
