import { describe, expect, test } from "vitest";
import { createPackageDraft, createPackagePatch, runScoutCycle } from "./scout-agent.mjs";

const owner = "did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD";

describe("nipmod scout agent", () => {
  test("scans public Gitlawb repos into package candidates without remote writes", async () => {
    const result = await runScoutCycle({
      fetchFn: async (url) => {
        if (String(url) === "https://node.example/api/v1/repos") {
          return jsonResponse([
            repoFixture({ description: "Read Gitlawb repos for agents", name: "repo-reader" }),
            repoFixture({ is_public: false, name: "private-agent" }),
            repoFixture({ description: "Internal probe", name: "source-bound-probe-123" })
          ]);
        }
        if (String(url) === "https://claims.example/index.json") {
          return jsonResponse({
            verifiedClaims: [
              {
                package: `pkg:${owner}/repo-reader`,
                status: "verified"
              }
            ]
          });
        }
        return new Response("not found", { status: 404 });
      },
      claimIndexUrl: "https://claims.example/index.json",
      generatedAt: "2026-05-17T21:00:00.000Z",
      nodeUrl: "https://node.example",
      scoutUrl: "https://scout.example"
    });

    expect(result).toMatchObject({
      formatVersion: 1,
      generatedAt: "2026-05-17T21:00:00.000Z",
      ok: true,
      summary: {
        claimed: 1,
        drafts: 1,
        patchable: 1,
        scanned: 1
      },
      type: "dev.nipmod.scout-cycle.v1"
    });
    expect(result.candidates).toEqual([
      expect.objectContaining({
        claimStatus: "claimed",
        commands: {
          claim: `nipmod claim gitlawb://${owner}/repo-reader --dir . --identity .nipmod/identity.json`,
          claimVerify: `nipmod claim verify gitlawb://${owner}/repo-reader --json`,
          packagePr: `nipmod package pr gitlawb://${owner}/repo-reader --dir repo-reader-pr --json`
        },
        package: `pkg:${owner}/repo-reader`,
        draft: {
          claimRequired: false,
          endpoint: `https://scout.example/draft?repo=${encodeURIComponent(`gitlawb://${owner}/repo-reader`)}`,
          remoteWrites: false,
          status: "claimed"
        },
        patch: {
          endpoint: `https://scout.example/patch?repo=${encodeURIComponent(`gitlawb://${owner}/repo-reader`)}`,
          remoteWrites: false
        },
        source: `gitlawb://${owner}/repo-reader`
      })
    ]);
    expect(result.drafts).toEqual([
      expect.objectContaining({
        claim: expect.objectContaining({
          required: false,
          verifyCommand: `nipmod claim verify gitlawb://${owner}/repo-reader --json`
        }),
        package: `pkg:${owner}/repo-reader`,
        remoteWrites: false,
        source: `gitlawb://${owner}/repo-reader`,
        status: "claimed",
        type: "dev.nipmod.package-draft.v1"
      })
    ]);
  });

  test("creates a package-ready patch for a Gitlawb repo", () => {
    const patch = createPackagePatch({
      default_branch: "main",
      description: "Read Gitlawb repos for agents",
      is_public: true,
      name: "repo-reader",
      owner_did: owner,
      updated_at: "2026-05-17T00:00:00.000Z"
    });

    expect(patch.remoteWrites).toBe(false);
    expect(patch.files.map((file) => file.path)).toEqual(["nipmod.json", "README.nipmod.md"]);
    expect(patch.files[0].content).toContain(`"canonical": "pkg:${owner}/repo-reader"`);
    expect(patch.nextCommands).toEqual([
      "git add nipmod.json README.nipmod.md",
      "git commit -m \"feat: add nipmod package manifest\"",
      "GITLAWB_NODE=https://node.nipmod.com git push"
    ]);
  });

  test("creates an unclaimed package draft with owner-only promotion commands", () => {
    const draft = createPackageDraft(repoFixture({ description: "Read Gitlawb repos for agents" }), {
      generatedAt: "2026-05-17T21:00:00.000Z",
      scoutUrl: "https://scout.example",
      status: "unclaimed"
    });

    expect(draft).toMatchObject({
      claim: {
        command: `nipmod claim gitlawb://${owner}/repo-reader --dir . --identity .nipmod/identity.json`,
        required: true,
        verifyCommand: `nipmod claim verify gitlawb://${owner}/repo-reader --json`
      },
      manifest: {
        canonical: `pkg:${owner}/repo-reader`,
        publish: {
          provenance: `gitlawb://${owner}/repo-reader`,
          signingKey: owner
        }
      },
      package: `pkg:${owner}/repo-reader`,
      remoteWrites: false,
      status: "unclaimed",
      type: "dev.nipmod.package-draft.v1"
    });
    expect(draft.files.map((file) => file.path)).toEqual(["nipmod.json", "README.nipmod.md"]);
    expect(draft.nextCommands).toEqual([
      `nipmod package pr gitlawb://${owner}/repo-reader --dir . --identity .nipmod/identity.json --json`,
      "git add nipmod.json README.nipmod.md .nipmod/package-claim.json",
      "git commit -m \"feat: add nipmod package manifest\"",
      "GITLAWB_NODE=https://node.nipmod.com git push",
      `nipmod claim verify gitlawb://${owner}/repo-reader --json`
    ]);
  });

  test("does not treat source-only repo records as public during node scans", async () => {
    const result = await runScoutCycle({
      fetchFn: async (url) => {
        if (String(url) === "https://node.example/api/v1/repos") {
          return jsonResponse([
            {
              clone_url: `https://node.example/${owner.slice("did:key:".length)}/hidden-agent.git`,
              default_branch: "main",
              description: "Hidden agent repo",
              name: "hidden-agent",
              owner_did: owner,
              source: `gitlawb://${owner}/hidden-agent`,
              updated_at: "2026-05-17T00:00:00.000Z"
            }
          ]);
        }
        if (String(url) === "https://claims.example/index.json") {
          return jsonResponse({ verifiedClaims: [] });
        }
        return new Response("not found", { status: 404 });
      },
      claimIndexUrl: "https://claims.example/index.json",
      nodeUrl: "https://node.example"
    });

    expect(result.summary.scanned).toBe(0);
    expect(result.candidates).toEqual([]);
    expect(result.drafts).toEqual([]);
  });

  test("prioritizes unclaimed drafts before already claimed repos", async () => {
    const result = await runScoutCycle({
      fetchFn: async (url) => {
        if (String(url) === "https://node.example/api/v1/repos") {
          return jsonResponse([
            repoFixture({ description: "Already claimed repo", name: "repo-reader" }),
            repoFixture({ description: "Agent runtime compatibility check", name: "agent-runtime-compat-check" })
          ]);
        }
        if (String(url) === "https://claims.example/index.json") {
          return jsonResponse({
            verifiedClaims: [
              {
                package: `pkg:${owner}/repo-reader`,
                status: "verified"
              }
            ]
          });
        }
        return new Response("not found", { status: 404 });
      },
      claimIndexUrl: "https://claims.example/index.json",
      nodeUrl: "https://node.example"
    });

    expect(result.candidates[0]).toMatchObject({
      repoName: "agent-runtime-compat-check",
      status: "unclaimed-draft"
    });
  });

  test("does not create drafts for packages that are already published", async () => {
    const result = await runScoutCycle({
      fetchFn: async (url) => {
        if (String(url) === "https://node.example/api/v1/repos") {
          return jsonResponse([
            repoFixture({ description: "Already published package", name: "repo-reader" }),
            repoFixture({ description: "Agent runtime compatibility check", name: "agent-runtime-compat-check" })
          ]);
        }
        if (String(url) === "https://claims.example/index.json") {
          return jsonResponse({ verifiedClaims: [] });
        }
        if (String(url) === "https://registry.example/packages.json") {
          return jsonResponse({
            packages: [
              {
                canonical: `pkg:${owner}/repo-reader`
              }
            ]
          });
        }
        return new Response("not found", { status: 404 });
      },
      claimIndexUrl: "https://claims.example/index.json",
      nodeUrl: "https://node.example",
      registryUrl: "https://registry.example/packages.json"
    });

    expect(result.summary).toMatchObject({
      drafts: 1,
      published: 1,
      scanned: 2
    });
    expect(result.candidates.find((candidate) => candidate.repoName === "repo-reader")).toMatchObject({
      status: "published"
    });
    expect(result.drafts.map((draft) => draft.package)).toEqual([`pkg:${owner}/agent-runtime-compat-check`]);
  });

  test("surfaces claim index failure without failing candidate generation", async () => {
    const result = await runScoutCycle({
      fetchFn: async (url) => {
        if (String(url).endsWith("/api/v1/repos")) {
          return jsonResponse([repoFixture({ name: "repo-reader" })]);
        }
        return new Response("unavailable", { status: 503 });
      },
      claimIndexUrl: "https://claims.example/index.json",
      nodeUrl: "https://node.example"
    });

    expect(result.ok).toBe(true);
    expect(result.claimIndex).toMatchObject({
      ok: false,
      verifiedClaims: 0
    });
    expect(result.candidates[0]).toMatchObject({
      claimStatus: "unclaimed",
      package: `pkg:${owner}/repo-reader`
    });
  });
});

function repoFixture(overrides = {}) {
  return {
    clone_url: `https://node.example/${owner.slice("did:key:".length)}/${overrides.name ?? "repo-reader"}.git`,
    default_branch: "main",
    description: "",
    is_public: true,
    name: "repo-reader",
    owner_did: owner,
    updated_at: "2026-05-17T00:00:00.000Z",
    ...overrides
  };
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json" },
    status
  });
}
