import { describe, expect, test } from "vitest";
import { findEvidencePackage } from "../app/evidence/evidence-view";
import {
  featuredPackages,
  findPackage,
  packageBrowseData,
  packageBrowseHighlights,
  packageDependencyEntries,
  packageDependencyText,
  packageEvidenceHref,
  packageInstallVariants,
  packagePageHref,
  packagePageParams,
  packageVersions
} from "../app/packages/content";

describe("package pages", () => {
  test("exposes static package params and stable package URLs", () => {
    const params = packagePageParams();
    const pkg = findPackage(params[0]?.packageName ?? "");

    expect(params.length).toBeGreaterThan(0);
    expect(pkg).not.toBeNull();
    expect(pkg ? packagePageHref(pkg) : "").toMatch(/^\/packages\/z[A-Za-z0-9]+-[a-z0-9._-]+$/);
    expect(pkg ? packageEvidenceHref(pkg) : "").toMatch(/^\/evidence\/package\/z[A-Za-z0-9]+-[a-z0-9._-]+#package-proof$/);
  });

  test("keeps legacy unique name evidence URLs working", () => {
    const packages = packageBrowseData({ query: "", type: "" }).packages;
    const unique = packages.find((pkg) => packages.filter((candidate) => candidate.name === pkg.name).length === 1);

    expect(unique).toBeDefined();
    if (!unique) {
      return;
    }
    expect(findEvidencePackage(unique.name)?.canonical).toBe(unique.canonical);
  });

  test("filters browse data by query and package type", () => {
    const all = packageBrowseData({ query: "gitlawb", type: "" });
    const type = all.packages[0]?.type ?? "";
    const filtered = packageBrowseData({ query: "gitlawb", type });

    expect(all.packages.length).toBeGreaterThan(0);
    expect(filtered.packages.every((pkg) => pkg.type === type)).toBe(true);
    expect(filtered.types).toContain(type);
  });

  test("builds trending, newest and quality highlights for package browse", () => {
    const browse = packageBrowseData({ query: "", type: "" });
    const highlights = packageBrowseHighlights(browse.registry.packages);

    expect(highlights.qualityStats.map((item) => item.label)).toEqual(["Quality avg", "Excellent", "Needs review"]);
    expect(highlights.trending.length).toBeGreaterThan(0);
    expect(highlights.newest.length).toBeGreaterThan(0);
    expect(highlights.trending[0]?.canonical).toMatch(/^pkg:did:key:/);
    expect(highlights.newest[0]?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("selects a strong featured start set for the archive", () => {
    const browse = packageBrowseData({ query: "", type: "" });
    const featured = featuredPackages(browse.registry.packages);

    expect(featured.length).toBe(10);
    expect(featured.map((pkg) => pkg.name)).toContain("gitlawb-repo-reader");
    expect(featured.map((pkg) => pkg.name)).toContain("prompt-injection-scan");
    expect(new Set(featured.map((pkg) => pkg.canonical)).size).toBe(featured.length);
    expect(featured.every((pkg) => pkg.trust.level === "verified")).toBe(true);
  });

  test("renders install variants and dependency copy for package decisions", () => {
    const pkg = findPackage("gitlawb-repo-reader");

    expect(pkg).not.toBeNull();
    if (!pkg) {
      return;
    }
    expect(packageInstallVariants(pkg).map((item) => item.label)).toEqual(["Inspect trust", "Plan install", "Install after review"]);
    expect(packageInstallVariants(pkg)[0]?.command).toContain(pkg.canonical);
    expect(packageVersions(pkg)[0]?.version).toBe(pkg.version);
    expect(packageDependencyText(pkg)).toContain("dependency");
    expect(Array.isArray(packageDependencyEntries(pkg))).toBe(true);
  });
});
