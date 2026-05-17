import claimIndexData from "../claim-index.json";
import registryData from "../registry-data.json";
import { buildScoutCycle, DEFAULT_NODE_URL, SCOUT_BASE_URL } from "../../lib/scout";
import type { PackageClaimIndex } from "../../lib/candidates";
import type { RegistryIndex } from "../../lib/registry";

const claimIndex = claimIndexData as PackageClaimIndex;
const registry = registryData as RegistryIndex;

export function readScoutCycle() {
  return buildScoutCycle({
    claimIndex,
    nodeUrl: registry.source || DEFAULT_NODE_URL,
    registry,
    scoutBaseUrl: SCOUT_BASE_URL
  });
}
