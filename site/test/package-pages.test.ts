import { describe, expect, test } from "vitest";
import {
  findPackage,
  packageBrowseData,
  packageDependencyEntries,
  packageDependencyText,
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
  });

  test("filters browse data by query and package type", () => {
    const all = packageBrowseData({ query: "gitlawb", type: "" });
    const type = all.packages[0]?.type ?? "";
    const filtered = packageBrowseData({ query: "gitlawb", type });

    expect(all.packages.length).toBeGreaterThan(0);
    expect(filtered.packages.every((pkg) => pkg.type === type)).toBe(true);
    expect(filtered.types).toContain(type);
  });

  test("renders install variants and dependency copy for package decisions", () => {
    const pkg = findPackage("gitlawb-repo-reader");

    expect(pkg).not.toBeNull();
    if (!pkg) {
      return;
    }
    expect(packageInstallVariants(pkg).map((item) => item.label)).toEqual(["Add", "Inspect first", "Plan only"]);
    expect(packageInstallVariants(pkg)[0]?.command).toContain(pkg.canonical);
    expect(packageVersions(pkg)[0]?.version).toBe(pkg.version);
    expect(packageDependencyText(pkg)).toContain("dependency");
    expect(Array.isArray(packageDependencyEntries(pkg))).toBe(true);
  });
});
