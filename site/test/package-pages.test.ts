import { describe, expect, test } from "vitest";
import { findEvidencePackage } from "../app/evidence/evidence-view";
import {
  findPackage,
  packageBrowseData,
  packageBrowseHighlights,
  packagePageParams
} from "../app/packages/content";

describe("package pages", () => {
  test("does not expose stale seed package pages after archive reset", () => {
    const params = packagePageParams();

    expect(params).toEqual([]);
    expect(findPackage("gitlawb-repo-reader")).toBeNull();
  });

  test("keeps legacy unique name evidence URLs closed while archive is empty", () => {
    const packages = packageBrowseData({ query: "", type: "" }).packages;

    expect(packages).toEqual([]);
    expect(findEvidencePackage("gitlawb-repo-reader")).toBeNull();
  });

  test("filters browse data against the empty public archive", () => {
    const all = packageBrowseData({ query: "gitlawb", type: "" });

    expect(all.packages).toEqual([]);
    expect(all.types).toEqual([]);
  });

  test("builds trending, newest and quality highlights for package browse", () => {
    const browse = packageBrowseData({ query: "", type: "" });
    const highlights = packageBrowseHighlights(browse.registry.packages);

    expect(highlights.qualityStats.map((item) => item.label)).toEqual(["Quality avg", "Excellent", "Needs review"]);
    expect(highlights.qualityStats.map((item) => item.value)).toEqual(["0", "0", "0"]);
    expect(highlights.trending).toEqual([]);
    expect(highlights.newest).toEqual([]);
  });
});
