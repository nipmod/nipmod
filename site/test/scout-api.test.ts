import { describe, expect, test } from "vitest";
import { buildScoutCycle, createPackageDraftFromSource, createPackagePatchFromSource, packageDraftFromScoutCycle } from "../lib/scout";
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
        drafts: 1,
        patchable: 1,
        scanned: 1
      },
      type: "dev.nipmod.scout-cycle.v1"
    });
    expect(cycle.candidates[0]).toMatchObject({
      claimStatus: "claimed",
        package: `pkg:${owner}/gitlawb-repo-reader`,
        draft: {
          claimRequired: false,
          endpoint: `https://nipmod.com/scout/draft?repo=${encodeURIComponent(`gitlawb://${owner}/gitlawb-repo-reader`)}`,
          remoteWrites: false,
          status: "claimed"
        },
        patch: {
          endpoint: `https://nipmod.com/scout/patch?repo=${encodeURIComponent(`gitlawb://${owner}/gitlawb-repo-reader`)}`,
          remoteWrites: false
      },
      source: `gitlawb://${owner}/gitlawb-repo-reader`
    });
    expect(cycle.drafts[0]).toMatchObject({
      claim: {
        required: false,
        verifyCommand: `nipmod claim verify gitlawb://${owner}/gitlawb-repo-reader --json`
      },
      manifest: {
        canonical: `pkg:${owner}/gitlawb-repo-reader`,
        publish: {
          provenance: `gitlawb://${owner}/gitlawb-repo-reader`,
          signingKey: owner
        }
      },
      package: `pkg:${owner}/gitlawb-repo-reader`,
      remoteWrites: false,
      status: "claimed",
      type: "dev.nipmod.package-draft.v1"
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

  test("creates claim-safe package drafts from scout sources", () => {
    const draft = createPackageDraftFromSource(`gitlawb://${owner}/gitlawb-repo-reader`, {
      generatedAt: "2026-05-17T21:30:00.000Z",
      scoutBaseUrl: "https://nipmod.com/scout",
      status: "unclaimed"
    });

    expect(draft).toMatchObject({
      claim: {
        command: `nipmod claim gitlawb://${owner}/gitlawb-repo-reader --dir . --identity .nipmod/identity.json`,
        required: true,
        verifyCommand: `nipmod claim verify gitlawb://${owner}/gitlawb-repo-reader --json`
      },
      files: [
        expect.objectContaining({ path: "nipmod.json" }),
        expect.objectContaining({ path: "README.nipmod.md" })
      ],
      manifest: {
        canonical: `pkg:${owner}/gitlawb-repo-reader`,
        permissions: {
          exec: { allowed: false },
          postinstall: { allowed: false }
        }
      },
      package: `pkg:${owner}/gitlawb-repo-reader`,
      remoteWrites: false,
      source: `gitlawb://${owner}/gitlawb-repo-reader`,
      status: "unclaimed",
      type: "dev.nipmod.package-draft.v1"
    });
    expect(draft.nextCommands).toEqual([
      `nipmod package pr gitlawb://${owner}/gitlawb-repo-reader --dir . --identity .nipmod/identity.json --json`,
      "git add nipmod.json README.nipmod.md .nipmod/package-claim.json",
      "git commit -m \"feat: add nipmod package manifest\"",
      "GITLAWB_NODE=https://node.nipmod.com git push",
      `nipmod claim verify gitlawb://${owner}/gitlawb-repo-reader --json`
    ]);
  });

  test("resolves single package drafts from the current scout cycle status", async () => {
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

    const draft = packageDraftFromScoutCycle(cycle, `gitlawb://${owner}/gitlawb-repo-reader`);

    expect(draft).toMatchObject({
      claim: {
        required: false
      },
      source: `gitlawb://${owner}/gitlawb-repo-reader`,
      status: "claimed"
    });
    expect(packageDraftFromScoutCycle(cycle, `gitlawb://${owner}/not-in-cycle`)).toBeNull();
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
