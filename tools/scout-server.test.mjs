import { describe, expect, test } from "vitest";
import { startScoutServer } from "./scout-server.mjs";

const repoSource = "gitlawb://did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/repo-reader";

describe("nipmod scout server", () => {
  test("runs scout cycles on start and exposes public candidate state", async () => {
    let runs = 0;
    const server = await startScoutServer({
      intervalMs: 25,
      port: 0,
      runScoutCycleFn: async () => scoutCycle(++runs)
    });

    try {
      await waitFor(async () => (await fetchJson(`${server.url}/health`)).runs >= 2);
      const health = await fetchJson(`${server.url}/health`);
      const last = await fetchJson(`${server.url}/last`);
      const candidates = await fetchJson(`${server.url}/candidates`);
      const drafts = await fetchJson(`${server.url}/drafts`);

      expect(health).toMatchObject({
        ok: true,
        intervalMs: 25,
        type: "dev.nipmod.scout-health.v1"
      });
      expect(health.runs).toBeGreaterThanOrEqual(2);
      expect(last).toMatchObject({
        ok: true,
        summary: {
          scanned: 1
        },
        type: "dev.nipmod.scout-last-public.v1"
      });
      expect(candidates).toMatchObject({
        candidates: [
          expect.objectContaining({
            draft: expect.objectContaining({
              endpoint: `${server.url}/draft?repo=${encodeURIComponent(repoSource)}`,
              remoteWrites: false
            }),
            package: "pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/repo-reader",
            source: repoSource
          })
        ],
        type: "dev.nipmod.scout-candidates.v1"
      });
      expect(drafts).toMatchObject({
        drafts: [
          expect.objectContaining({
            package: "pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/repo-reader",
            remoteWrites: false,
            source: repoSource,
            type: "dev.nipmod.package-draft.v1"
          })
        ],
        type: "dev.nipmod.scout-drafts.v1"
      });
    } finally {
      await server.close();
    }
  });

  test("serves package-ready patches without remote writes", async () => {
    const server = await startScoutServer({
      intervalMs: 1_000,
      port: 0,
      runScoutCycleFn: async () => scoutCycle(1)
    });

    try {
      await waitFor(async () => (await fetchJson(`${server.url}/health`)).runs === 1);
      const patch = await fetchJson(`${server.url}/patch?repo=${encodeURIComponent(repoSource)}`);
      const draft = await fetchJson(`${server.url}/draft?repo=${encodeURIComponent(repoSource)}`);

      expect(patch).toMatchObject({
        remoteWrites: false,
        source: repoSource,
        type: "dev.nipmod.package-patch.v1"
      });
      expect(patch.files.map((file) => file.path)).toEqual(["nipmod.json", "README.nipmod.md"]);
      expect(draft).toMatchObject({
        claim: {
          required: false
        },
        remoteWrites: false,
        source: repoSource,
        status: "claimed",
        type: "dev.nipmod.package-draft.v1"
      });
      expect(draft.files.map((file) => file.path)).toEqual(["nipmod.json", "README.nipmod.md"]);
    } finally {
      await server.close();
    }
  });

  test("uses configured public origin instead of spoofable forwarded headers", async () => {
    const server = await startScoutServer({
      intervalMs: 1_000,
      port: 0,
      publicOrigin: "https://scout.nipmod.com",
      runScoutCycleFn: async () => scoutCycle(1)
    });

    try {
      await waitFor(async () => (await fetchJson(`${server.url}/health`)).runs === 1);
      const response = await fetch(`${server.url}/candidates`, {
        headers: {
          "x-forwarded-host": "evil.example",
          "x-forwarded-proto": "https"
        }
      });
      const candidates = await response.json();

      expect(candidates.candidates[0].draft.endpoint).toBe(`https://scout.nipmod.com/draft?repo=${encodeURIComponent(repoSource)}`);
    } finally {
      await server.close();
    }
  });

  test("reports unhealthy when the latest cycle fails", async () => {
    const server = await startScoutServer({
      intervalMs: 1_000,
      port: 0,
      runScoutCycleFn: async () => {
        throw new Error("gitlawb unavailable");
      }
    });

    try {
      await waitFor(async () => (await fetchJson(`${server.url}/health`)).runs === 1);
      const response = await fetch(`${server.url}/health`);
      const health = await response.json();

      expect(response.status).toBe(503);
      expect(health).toMatchObject({
        lastError: "gitlawb unavailable",
        ok: false,
        runs: 1
      });
    } finally {
      await server.close();
    }
  });

  test("does not expose unauthenticated manual runs", async () => {
    const server = await startScoutServer({
      intervalMs: 1_000,
      port: 0,
      runScoutCycleFn: async () => scoutCycle(1)
    });

    try {
      await waitFor(async () => (await fetchJson(`${server.url}/health`)).runs === 1);
      const response = await fetch(`${server.url}/run`, { method: "POST" });
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.ok).toBe(false);
    } finally {
      await server.close();
    }
  });
});

function scoutCycle(run) {
  return {
    candidates: [
      {
        draft: {
          endpoint: `/draft?repo=${encodeURIComponent(repoSource)}`,
          remoteWrites: false
        },
        package: "pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/repo-reader",
        source: repoSource
      }
    ],
    drafts: [
      {
        files: [
          { content: "{}\n", path: "nipmod.json" },
          { content: "# repo-reader\n", path: "README.nipmod.md" }
        ],
        formatVersion: 1,
        generatedAt: new Date(1_776_444_800_000 + run).toISOString(),
        manifest: {},
        package: "pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/repo-reader",
        claim: {
          required: false
        },
        remoteWrites: false,
        source: repoSource,
        status: "claimed",
        type: "dev.nipmod.package-draft.v1"
      }
    ],
    claimIndex: {
      ok: true,
      verifiedClaims: 0
    },
    formatVersion: 1,
    generatedAt: new Date(1_776_444_800_000 + run).toISOString(),
    ok: true,
    summary: {
      claimed: 0,
      drafts: 1,
      patchable: 1,
      scanned: 1
    },
    type: "dev.nipmod.scout-cycle.v1"
  };
}

async function fetchJson(url) {
  const response = await fetch(url);
  return response.json();
}

async function waitFor(predicate) {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("timed out waiting for condition");
}
