import type { RegistryIndex } from "./registry";

export interface LiveStatTile {
  label: "Nipmod archive packages";
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
  registry,
  registryUrl = process.env.NIPMOD_LIVE_REGISTRY_URL ?? "https://nipmod.com/registry/packages.json"
}: {
  registry: RegistryIndex;
  registryUrl?: string;
}): Promise<LiveStats> {
  try {
    const response = await fetch(registryUrl, { cache: "no-store" });

    if (!response.ok) {
      return fallbackLiveStats(registry);
    }

    const liveRegistry = (await response.json()) as Pick<RegistryIndex, "generatedAt" | "packages">;
    if (!Array.isArray(liveRegistry.packages)) {
      return fallbackLiveStats(registry);
    }

    return {
      generatedAt: typeof liveRegistry.generatedAt === "string" ? liveRegistry.generatedAt : null,
      healthy: true,
      source: "live",
      status: "Live archive",
      tiles: [{ label: "Nipmod archive packages", value: String(liveRegistry.packages.length) }]
    };
  } catch {
    return fallbackLiveStats(registry);
  }
}

export function fallbackLiveStats(registry: RegistryIndex): LiveStats {
  const packageCount = registry.packages.length;
  return {
    generatedAt: null,
    healthy: true,
    source: "registry",
    status: "Local archive",
    tiles: [{ label: "Nipmod archive packages", value: String(packageCount) }]
  };
}
