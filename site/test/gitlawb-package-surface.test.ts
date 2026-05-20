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
    const pkg = registry.packages[0];

    expect(pkg).toBeDefined();
    if (!pkg) {
      return;
    }

    const owner = ownerSegmentFromDid(pkg.publisher);
    expect(owner).toMatch(/^z[A-Za-z0-9]+$/);
    expect(didFromOwnerSegment(owner)).toBe(pkg.publisher);
    expect(gitlawbOwnerHref(pkg)).toBe(`/gitlawb/${owner}`);
    expect(gitlawbPackageHref(pkg)).toBe(`/gitlawb/${owner}/${pkg.repo}`);
    expect(findPackageByGitlawbPath(registry.packages, owner, pkg.repo)?.canonical).toBe(pkg.canonical);
    expect(findPackageByGitlawbPath(registry.packages, "bad-owner", pkg.repo)).toBeNull();
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
