import { describe, expect, test } from "vitest";
import { fallbackLiveStats, loadLiveStats } from "../lib/live-stats";
import type { RegistryIndex } from "../lib/registry";

describe("live stats", () => {
  test("builds homepage stats from the verified registry", () => {
    const registry = {
      packages: [
        { canonical: "pkg:did:key:z6MkA/one" },
        { canonical: "pkg:did:key:z6MkB/two" }
      ]
    } as RegistryIndex;

    expect(fallbackLiveStats(registry)).toEqual({
      generatedAt: null,
      healthy: true,
      source: "registry",
      status: "Registry live",
      tiles: [{ label: "Verified packages", value: "2" }]
    });
  });

  test("loadLiveStats uses the committed registry only", async () => {
    const registry = {
      packages: [{ canonical: "pkg:did:key:z6MkA/one" }]
    } as RegistryIndex;
    const stats = await loadLiveStats({ registry });

    expect(stats.source).toBe("registry");
    expect(stats.tiles).toEqual([{ label: "Verified packages", value: "1" }]);
  });
});
