import { SCOUT_INTERVAL_MS } from "./scout";
import type { RegistryIndex } from "./registry";

export interface ScoutHealthPayload {
  intervalMs?: unknown;
  lastRunAt?: unknown;
  ok?: unknown;
  stale?: unknown;
  summary?: unknown;
}

export interface LiveStatTile {
  label: "Repos scanned" | "Packages indexed" | "Claimable drafts" | "Scan interval";
  value: string;
}

export interface LiveStats {
  generatedAt: string | null;
  healthy: boolean;
  source: "live" | "registry";
  status: string;
  tiles: LiveStatTile[];
}

interface ScoutSummary {
  published: number;
  scanned: number;
  unclaimedDrafts: number;
}

export async function loadLiveStats({
  fetchFn = fetch,
  registry,
  scoutHealthUrl = "https://nipmod.com/scout/health",
  timeoutMs = 1_500
}: {
  fetchFn?: typeof fetch;
  registry: RegistryIndex;
  scoutHealthUrl?: string;
  timeoutMs?: number;
}): Promise<LiveStats> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(scoutHealthUrl, {
      cache: "no-store",
      headers: {
        accept: "application/json"
      },
      signal: controller.signal
    });
    if (response.ok) {
      const stats = liveStatsFromScoutHealth((await response.json()) as ScoutHealthPayload);
      if (stats) {
        return stats;
      }
    }
  } catch {
    return fallbackLiveStats(registry);
  } finally {
    clearTimeout(timeout);
  }

  return fallbackLiveStats(registry);
}

export function liveStatsFromScoutHealth(payload: ScoutHealthPayload): LiveStats | null {
  const summary = parseScoutSummary(payload.summary);
  const intervalMs = typeof payload.intervalMs === "number" && Number.isFinite(payload.intervalMs) ? payload.intervalMs : null;
  if (!summary || !intervalMs) {
    return null;
  }

  const healthy = payload.ok === true && payload.stale !== true;
  return {
    generatedAt: typeof payload.lastRunAt === "string" ? payload.lastRunAt : null,
    healthy,
    source: "live",
    status: healthy ? `Scout running every ${formatScoutCadence(intervalMs)}` : "Scout status needs attention",
    tiles: liveStatTiles({
      intervalMs,
      packagesIndexed: summary.published,
      reposScanned: summary.scanned,
      unclaimedDrafts: summary.unclaimedDrafts
    })
  };
}

export function fallbackLiveStats(registry: RegistryIndex): LiveStats {
  const packageCount = registry.packages.length;
  return {
    generatedAt: null,
    healthy: false,
    source: "registry",
    status: "Registry snapshot live, Scout status pending",
    tiles: liveStatTiles({
      intervalMs: SCOUT_INTERVAL_MS,
      packagesIndexed: packageCount,
      reposScanned: packageCount,
      unclaimedDrafts: 0
    })
  };
}

export function formatScoutInterval(intervalMs: number): string {
  const minutes = Math.max(1, Math.round(intervalMs / 60_000));
  return `${minutes} min`;
}

function liveStatTiles({
  intervalMs,
  packagesIndexed,
  reposScanned,
  unclaimedDrafts
}: {
  intervalMs: number;
  packagesIndexed: number;
  reposScanned: number;
  unclaimedDrafts: number;
}): LiveStatTile[] {
  return [
    { label: "Repos scanned", value: String(reposScanned) },
    { label: "Packages indexed", value: String(packagesIndexed) },
    { label: "Claimable drafts", value: String(unclaimedDrafts) },
    { label: "Scan interval", value: formatScoutInterval(intervalMs) }
  ];
}

function parseScoutSummary(value: unknown): ScoutSummary | null {
  if (!isRecord(value)) {
    return null;
  }
  const published = readFiniteNumber(value.published);
  const scanned = readFiniteNumber(value.scanned);
  const unclaimedDrafts = readFiniteNumber(value.unclaimedDrafts);
  if (published === null || scanned === null || unclaimedDrafts === null) {
    return null;
  }
  return { published, scanned, unclaimedDrafts };
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatScoutCadence(intervalMs: number): string {
  const minutes = Math.max(1, Math.round(intervalMs / 60_000));
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
