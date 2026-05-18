import { describe, expect, test } from "vitest";
import {
  fallbackLiveStats,
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
      status: "Live package count",
      tiles: [
        { label: "Nipmod packages", value: "28" },
        { label: "Claimable packages", value: "4" }
      ]
    });
  });

  test("rejects malformed scout health payloads", () => {
    expect(liveStatsFromScoutHealth({ ok: true })).toBeNull();
    expect(liveStatsFromScoutHealth({ ok: true, summary: { scanned: 1 } })).toBeNull();
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
      status: "Registry snapshot",
      tiles: [
        { label: "Nipmod packages", value: "2" },
        { label: "Claimable packages", value: "0" }
      ]
    });
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
    expect(stats.tiles[0]).toEqual({ label: "Nipmod packages", value: "1" });
  });
});
