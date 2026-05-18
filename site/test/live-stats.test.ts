import { describe, expect, test } from "vitest";
import {
  fallbackLiveStats,
  formatScoutInterval,
  loadLiveStats,
  liveStatsFromScoutHealth,
  type ScoutHealthPayload
} from "../lib/live-stats";
import type { RegistryIndex } from "../lib/registry";

describe("live stats", () => {
  test("builds homepage stats from scout health", () => {
    const payload: ScoutHealthPayload = {
      intervalMs: 300_000,
      lastRunAt: "2026-05-18T02:16:42.579Z",
      ok: true,
      stale: false,
      summary: {
        claimed: 0,
        drafts: 4,
        patchable: 32,
        published: 28,
        scanned: 32,
        unclaimedDrafts: 4
      }
    };

    expect(liveStatsFromScoutHealth(payload)).toEqual({
      generatedAt: "2026-05-18T02:16:42.579Z",
      healthy: true,
      source: "live",
      status: "Scout running every 5 minutes",
      tiles: [
        { label: "Repos scanned", value: "32" },
        { label: "Packages indexed", value: "28" },
        { label: "Claimable drafts", value: "4" },
        { label: "Scan interval", value: "5 min" }
      ]
    });
  });

  test("rejects malformed scout health payloads", () => {
    expect(liveStatsFromScoutHealth({ ok: true })).toBeNull();
    expect(liveStatsFromScoutHealth({ intervalMs: 300_000, ok: true, summary: { scanned: 1 } })).toBeNull();
  });

  test("falls back to registry snapshot when live scout is unavailable", () => {
    const registry = {
      packages: [
        { canonical: "pkg:did:key:z6MkA/one" },
        { canonical: "pkg:did:key:z6MkB/two" }
      ]
    } as RegistryIndex;

    expect(fallbackLiveStats(registry)).toEqual({
      generatedAt: null,
      healthy: false,
      source: "registry",
      status: "Registry snapshot live, Scout status pending",
      tiles: [
        { label: "Repos scanned", value: "2" },
        { label: "Packages indexed", value: "2" },
        { label: "Claimable drafts", value: "0" },
        { label: "Scan interval", value: "5 min" }
      ]
    });
  });

  test("formats common scout intervals", () => {
    expect(formatScoutInterval(300_000)).toBe("5 min");
    expect(formatScoutInterval(60_000)).toBe("1 min");
    expect(formatScoutInterval(3_600_000)).toBe("60 min");
  });

  test("uses registry fallback when the scout request fails", async () => {
    const registry = {
      packages: [{ canonical: "pkg:did:key:z6MkA/one" }]
    } as RegistryIndex;
    const stats = await loadLiveStats({
      fetchFn: () => Promise.reject(new Error("offline")) as Promise<Response>,
      registry
    });

    expect(stats.source).toBe("registry");
    expect(stats.tiles[0]).toEqual({ label: "Repos scanned", value: "1" });
  });
});
