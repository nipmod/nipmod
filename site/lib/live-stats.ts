import type { RegistryIndex } from "./registry";

export interface LiveStatTile {
  label: "Verified packages";
  value: string;
}

export interface LiveStats {
  generatedAt: string | null;
  healthy: boolean;
  source: "live" | "registry";
  status: string;
  tiles: LiveStatTile[];
}

export async function loadLiveStats({
  registry
}: {
  registry: RegistryIndex;
}): Promise<LiveStats> {
  return fallbackLiveStats(registry);
}

export function fallbackLiveStats(registry: RegistryIndex): LiveStats {
  const packageCount = registry.packages.length;
  return {
    generatedAt: null,
    healthy: true,
    source: "registry",
    status: "Registry live",
    tiles: [{ label: "Verified packages", value: String(packageCount) }]
  };
}
