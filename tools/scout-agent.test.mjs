import { describe, expect, test } from "vitest";
import { createPackageDraft, createPackagePatch, runScoutCycle } from "./scout-agent.mjs";
import { createOwnerNotificationPlan, runOwnerNotificationDelivery } from "./scout-notify.mjs";

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
    expect(result.ownerNotifications).toMatchObject({
      ready: false,
      remoteWrites: false,
      summary: {
        planned: 0
      },
      type: "dev.nipmod.scout-owner-notifications.v1"
    });
  });

  test("plans owner notifications only for unclaimed unpublished drafts", async () => {
    const result = await runScoutCycle({
      fetchFn: async (url) => {
        if (String(url) === "https://node.example/api/v1/repos") {
          return jsonResponse([
            repoFixture({ description: "Agent runtime compatibility check", name: "agent-runtime-compat-check" }),
            repoFixture({ description: "Already claimed repo", name: "repo-reader" }),
            repoFixture({ description: "Already published package", name: "published-tool" }),
            repoFixture({ description: "", name: "raw-source" })
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
        if (String(url) === "https://registry.example/packages.json") {
          return jsonResponse({
            packages: [
              {
                canonical: `pkg:${owner}/published-tool`
              }
            ]
          });
        }
        return new Response("not found", { status: 404 });
      },
      claimIndexUrl: "https://claims.example/index.json",
      generatedAt: "2026-05-17T21:00:00.000Z",
      nodeUrl: "https://node.example",
      registryUrl: "https://registry.example/packages.json",
      scoutUrl: "https://scout.example"
    });

    expect(result.ownerNotifications).toMatchObject({
      dryRun: true,
      ready: true,
      remoteWrites: false,
      summary: {
        eligible: 1,
        planned: 1
      }
    });
    expect(result.ownerNotifications.notifications).toEqual([
      expect.objectContaining({
        channel: "gitlawb-issue",
        package: `pkg:${owner}/agent-runtime-compat-check`,
        remoteWrites: false,
        source: `gitlawb://${owner}/agent-runtime-compat-check`,
        status: "planned"
      })
    ]);
    expect(JSON.stringify(result.ownerNotifications)).not.toMatch(/published-tool|repo-reader|raw-source/);
  });

  test("dedupes opt-outs and rate limits owner notification plans", () => {
    const cycle = scoutCycleFixture({
      candidates: [
        candidateFixture("repo-reader"),
        candidateFixture("repo-reader"),
        candidateFixture("ignored-tool"),
        candidateFixture("second-tool"),
        candidateFixture("third-tool"),
        candidateFixture("fourth-tool")
      ],
      drafts: [
        draftFixture("repo-reader"),
        draftFixture("ignored-tool"),
        draftFixture("second-tool"),
        draftFixture("third-tool"),
        draftFixture("fourth-tool")
      ]
    });

    const plan = createOwnerNotificationPlan(cycle, {
      maxPerCycle: 2,
      optOut: [`pkg:${owner}/ignored-tool`],
      sentKeys: [notificationKey("repo-reader")]
    });

    expect(plan.summary).toMatchObject({
      deduped: 2,
      eligible: 6,
      optedOut: 1,
      planned: 2,
      rateLimited: 1
    });
    expect(plan.notifications.map((notification) => notification.package)).toEqual([
      `pkg:${owner}/second-tool`,
      `pkg:${owner}/third-tool`
    ]);
  });

  test("does not deliver owner notifications unless remote writes and identity are explicit", async () => {
    const plan = createOwnerNotificationPlan(scoutCycleFixture(), {
      allowAll: true
    });
    const calls = [];

    const blocked = await runOwnerNotificationDelivery({
      fetchFn: async (url, init) => {
        calls.push({ init, url });
        return jsonResponse({ ok: true }, 201);
      },
      plan,
      remoteWrites: false
    });

    expect(blocked.remoteWrites).toBe(false);
    expect(blocked.summary.written).toBe(0);
    expect(calls).toEqual([]);
  });

  test("delivers signed Gitlawb issue notifications with remote dedupe", async () => {
    const plan = createOwnerNotificationPlan(scoutCycleFixture(), {
      allowAll: true
    });
    const posts = [];

    const result = await runOwnerNotificationDelivery({
      fetchFn: async (url, init = {}) => {
        if (String(url).endsWith("/issues") && init.method === "GET") {
          return jsonResponse({ issues: [] });
        }
        if (String(url).endsWith("/issues") && init.method === "POST") {
          posts.push({ init, url: String(url) });
          return jsonResponse({ id: "issue-1" }, 201);
        }
        return new Response("not found", { status: 404 });
      },
      identity: {
        did: owner,
        privateKeyPem: testPrivateKeyPem
      },
      nodeUrl: "https://node.example",
      plan,
      remoteWrites: true
    });

    expect(result.summary).toMatchObject({
      deduped: 0,
      written: 1
    });
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toBe("https://node.example/api/v1/repos/z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/repo-reader/issues");
    expect(posts[0].init.headers.Signature).toMatch(/^sig1=:/);
    expect(posts[0].init.headers["Signature-Input"]).toContain(`keyid="${owner}"`);
    expect(JSON.parse(posts[0].init.body).body).toContain(plan.notifications[0].dedupeKey);
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

function scoutCycleFixture(overrides = {}) {
  return {
    candidates: [candidateFixture("repo-reader")],
    claimIndex: { ok: true, verifiedClaims: 0 },
    drafts: [draftFixture("repo-reader")],
    formatVersion: 1,
    generatedAt: "2026-05-17T21:00:00.000Z",
    ok: true,
    registry: { ok: true, publishedPackages: 0 },
    summary: { claimed: 0, drafts: 1, patchable: 1, published: 0, scanned: 1, unclaimedDrafts: 1 },
    type: "dev.nipmod.scout-cycle.v1",
    ...overrides
  };
}

function candidateFixture(name) {
  return {
    claimStatus: "unclaimed",
    cloneUrl: `https://node.example/${owner.slice("did:key:".length)}/${name}.git`,
    commands: {
      claim: `nipmod claim gitlawb://${owner}/${name} --dir . --identity .nipmod/identity.json`,
      claimVerify: `nipmod claim verify gitlawb://${owner}/${name} --json`,
      packagePr: `nipmod package pr gitlawb://${owner}/${name} --dir ${name}-pr --json`
    },
    defaultBranch: "main",
    description: "Agent package repo",
    draft: {
      claimRequired: true,
      endpoint: `https://scout.example/draft?repo=${encodeURIComponent(`gitlawb://${owner}/${name}`)}`,
      remoteWrites: false,
      status: "unclaimed"
    },
    gitlawbUrl: `https://gitlawb.com/node/repos/${owner.slice("did:key:".length)}/${name}`,
    package: `pkg:${owner}/${name}`,
    patch: {
      endpoint: `https://scout.example/patch?repo=${encodeURIComponent(`gitlawb://${owner}/${name}`)}`,
      remoteWrites: false
    },
    readinessScore: 75,
    repoName: name,
    shortOwner: owner.slice("did:key:".length).slice(0, 8),
    source: `gitlawb://${owner}/${name}`,
    status: "unclaimed-draft",
    suggestedType: "agent-tool",
    updatedAt: "2026-05-17T00:00:00.000Z"
  };
}

function draftFixture(name) {
  return {
    claim: {
      command: `nipmod claim gitlawb://${owner}/${name} --dir . --identity .nipmod/identity.json`,
      proofPath: ".nipmod/package-claim.json",
      required: true,
      verifyCommand: `nipmod claim verify gitlawb://${owner}/${name} --json`
    },
    files: [],
    formatVersion: 1,
    generatedAt: "2026-05-17T21:00:00.000Z",
    manifest: {},
    nextCommands: [],
    package: `pkg:${owner}/${name}`,
    remoteWrites: false,
    repo: {
      gitlawbUrl: `https://gitlawb.com/node/repos/${owner.slice("did:key:".length)}/${name}`,
      name,
      ownerDid: owner
    },
    source: `gitlawb://${owner}/${name}`,
    status: "unclaimed",
    type: "dev.nipmod.package-draft.v1",
    warnings: []
  };
}

function notificationKey(name) {
  return `nipmod-scout:${Buffer.from(`pkg:${owner}/${name}`).toString("base64url")}:package-claim`;
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json" },
    status
  });
}

const testPrivateKeyPem = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIO0OouCxuC+m+GCb25pIoKXSbiKs6CtBPHm8LxW6doZR
-----END PRIVATE KEY-----
`;
