import { describe, expect, test } from "vitest";
import { buildScoutCycle, createPackagePatchFromSource } from "../lib/scout";
import type { GitlawbRepoSummary } from "../lib/candidates";
import type { RegistryIndex } from "../lib/registry";

const owner = "did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD";

describe("scout API contract", () => {
  test("builds read only scout candidates from Gitlawb repos", async () => {
    const cycle = await buildScoutCycle({
      claimIndex: {
        verifiedClaims: [{ package: `pkg:${owner}/gitlawb-repo-reader`, status: "verified" }]
      },
      fetchReposFn: async () => [repoFixture()],
      generatedAt: "2026-05-17T21:30:00.000Z",
      nodeUrl: "https://node.nipmod.com",
      registry: registryFixture(),
      scoutBaseUrl: "https://nipmod.com/scout"
    });

    expect(cycle).toMatchObject({
      formatVersion: 1,
      generatedAt: "2026-05-17T21:30:00.000Z",
      ok: true,
      summary: {
        claimed: 1,
        patchable: 1,
        scanned: 1
      },
      type: "dev.nipmod.scout-cycle.v1"
    });
    expect(cycle.candidates[0]).toMatchObject({
      claimStatus: "claimed",
      package: `pkg:${owner}/gitlawb-repo-reader`,
      patch: {
        endpoint: `https://nipmod.com/scout/patch?repo=${encodeURIComponent(`gitlawb://${owner}/gitlawb-repo-reader`)}`,
        remoteWrites: false
      },
      source: `gitlawb://${owner}/gitlawb-repo-reader`
    });
  });

  test("creates package patches without remote writes", () => {
    const patch = createPackagePatchFromSource(`gitlawb://${owner}/gitlawb-repo-reader`, {
      generatedAt: "2026-05-17T21:30:00.000Z"
    });

    expect(patch).toMatchObject({
      package: `pkg:${owner}/gitlawb-repo-reader`,
      remoteWrites: false,
      source: `gitlawb://${owner}/gitlawb-repo-reader`,
      type: "dev.nipmod.package-patch.v1"
    });
    expect(patch.files.map((file) => file.path)).toEqual(["nipmod.json", "README.nipmod.md"]);
    expect(patch.nextCommands).toContain("GITLAWB_NODE=https://node.nipmod.com git push");
  });
});

function repoFixture(): GitlawbRepoSummary {
  return {
    clone_url: `https://node.nipmod.com/${owner.replace(/^did:key:/, "")}/gitlawb-repo-reader.git`,
    default_branch: "main",
    description: "Read Gitlawb repos for agents",
    is_public: true,
    name: "gitlawb-repo-reader",
    owner_did: owner,
    updated_at: "2026-05-17T00:00:00.000Z"
  };
}

function registryFixture(): RegistryIndex {
  return {
    formatVersion: 1,
    generatedAt: "2026-05-17T00:00:00.000Z",
    packages: [],
    skipped: [],
    source: "https://node.nipmod.com"
  };
}
