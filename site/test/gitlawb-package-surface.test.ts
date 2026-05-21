import { describe, expect, test } from "vitest";
import registryData from "../app/registry-data.json";
import { GET as badgeGET } from "../app/badge/[owner]/[repo]/route";
import {
  didFromOwnerSegment,
  findPackageByGitlawbPath,
  gitlawbPackageHref,
  gitlawbOwnerHref,
  ownerSegmentFromDid,
  type RegistryIndex
} from "../lib/registry";

const registry = registryData as RegistryIndex;

describe("Gitlawb package surface", () => {
  test("maps DID owners to stable Gitlawb package URLs", () => {
    const pkg = {
      canonical: "pkg:did:key:z6Mkfixture/fixture-package",
      owner: "did:key:z6Mkfixture",
      publisher: "did:key:z6Mkfixture",
      repo: "fixture-package"
    };

    const owner = ownerSegmentFromDid(pkg.publisher);
    expect(owner).toMatch(/^z[A-Za-z0-9]+$/);
    expect(didFromOwnerSegment(owner)).toBe(pkg.publisher);
    expect(gitlawbOwnerHref(pkg)).toBe(`/gitlawb/${owner}`);
    expect(gitlawbPackageHref(pkg)).toBe(`/gitlawb/${owner}/${pkg.repo}`);
    expect(findPackageByGitlawbPath([pkg] as any, owner, pkg.repo)?.canonical).toBe(pkg.canonical);
    expect(findPackageByGitlawbPath(registry.packages, "bad-owner", pkg.repo)).toBeNull();
  });

  test("renders an unlisted SVG badge for old seed package paths", async () => {
    const owner = "z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD";
    const response = await badgeGET(new Request(`https://nipmod.com/badge/${owner}/gitlawb-repo-reader`), {
      params: Promise.resolve({ owner, repo: "gitlawb-repo-reader" })
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/svg+xml");
    expect(body).toContain("Nipmod");
    expect(body).toContain("not listed");
    expect(body).not.toContain("<script");
  });

  test("renders an unlisted SVG badge for unpublished Gitlawb repo paths", async () => {
    const response = await badgeGET(new Request("https://nipmod.com/badge/z6Mkdraftowner/draft-repo?status=draft"), {
      params: Promise.resolve({ owner: "z6Mkdraftowner", repo: "draft-repo" })
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("not listed");
  });

  test("rejects invalid Gitlawb badge paths", async () => {
    const response = await badgeGET(new Request("https://nipmod.com/badge/not-valid/../x"), {
      params: Promise.resolve({ owner: "not-valid", repo: "../x" })
    });

    expect(response.status).toBe(404);
  });
});
