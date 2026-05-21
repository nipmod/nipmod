import { afterEach, describe, expect, test, vi } from "vitest";
import { fallbackLiveStats, loadLiveStats } from "../lib/live-stats";
import type { RegistryIndex } from "../lib/registry";

describe("live stats", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
      status: "Local archive",
      tiles: [{ label: "Nipmod archive packages", value: "2" }]
    });
  });

  test("loadLiveStats uses the live public registry when it is available", async () => {
    const registry = {
      packages: [{ canonical: "pkg:did:key:z6MkA/one" }]
    } as RegistryIndex;
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: async () => ({
        generatedAt: "2026-05-20T13:16:37.242Z",
        packages: [{ canonical: "pkg:did:key:z6MkA/one" }, { canonical: "pkg:did:key:z6MkB/two" }]
      }),
      ok: true
    } as Response);

    const stats = await loadLiveStats({ registry, registryUrl: "https://example.test/registry.json" });

    expect(stats.source).toBe("live");
    expect(stats.status).toBe("Live archive");
    expect(stats.generatedAt).toBe("2026-05-20T13:16:37.242Z");
    expect(stats.tiles).toEqual([{ label: "Nipmod archive packages", value: "2" }]);
  });

  test("loadLiveStats falls back to the committed registry when live fetch fails", async () => {
    const registry = {
      packages: [{ canonical: "pkg:did:key:z6MkA/one" }]
    } as RegistryIndex;
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    const stats = await loadLiveStats({ registry, registryUrl: "https://example.test/registry.json" });

    expect(stats.source).toBe("registry");
    expect(stats.status).toBe("Local archive");
    expect(stats.tiles).toEqual([{ label: "Nipmod archive packages", value: "1" }]);
  });
});
