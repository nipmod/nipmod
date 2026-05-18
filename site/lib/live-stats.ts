import type { RegistryIndex } from "./registry";

export interface ScoutHealthPayload {
  intervalMs?: unknown;
  lastRunAt?: unknown;
  ok?: unknown;
  stale?: unknown;
  summary?: unknown;
}

export interface LiveStatTile {
  label: "Published packages" | "Claimable drafts";
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
  if (!summary) {
    return null;
  }

  const healthy = payload.ok === true && payload.stale !== true;
  return {
    generatedAt: typeof payload.lastRunAt === "string" ? payload.lastRunAt : null,
    healthy,
    source: "live",
    status: healthy ? "Live registry + Scout" : "Registry status pending",
    tiles: liveStatTiles({
      packagesIndexed: summary.published,
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
    status: "Registry snapshot",
    tiles: liveStatTiles({
      packagesIndexed: packageCount,
      unclaimedDrafts: 0
    })
  };
}

function liveStatTiles({
  packagesIndexed,
  unclaimedDrafts
}: {
  packagesIndexed: number;
  unclaimedDrafts: number;
}): LiveStatTile[] {
  return [
    { label: "Published packages", value: String(packagesIndexed) },
    { label: "Claimable drafts", value: String(unclaimedDrafts) }
  ];
}

function parseScoutSummary(value: unknown): ScoutSummary | null {
  if (!isRecord(value)) {
    return null;
  }
  const published = readFiniteNumber(value.published);
  const unclaimedDrafts = readFiniteNumber(value.unclaimedDrafts);
  if (published === null || unclaimedDrafts === null) {
    return null;
  }
  return { published, unclaimedDrafts };
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
