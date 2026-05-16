import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { generateIdentity } from "../nipmod/dist/identity.js";
import { createTransparencyLogFromLeaves } from "../nipmod/dist/transparency.js";
import { runRestoreDrill } from "./restore-drill.mjs";

describe("restore drill", () => {
  test("proves witness continuity and node package recoverability from live-style fixtures", async () => {
    const fixture = createFixture();
    const result = await runRestoreDrill({
      endpoints: fixture.endpoints,
      expected: fixture.expected,
      fetchFn: fixture.fetchFn,
      gitLsRemoteFn: fixture.gitLsRemoteFn
    });

    expect(result.ok).toBe(true);
    expect(result.summary).toEqual({ fail: 0, pass: 6, total: 6 });
    expect(result.checks.map((check) => check.name)).toEqual([
      "discovery_restore_pins",
      "registry_snapshot",
      "witness_continuity",
      "node_health",
      "package_blob_restore",
      "git_ref_restore"
    ]);
  });

  test("fails when witness root continuity drifts from the checkpoint", async () => {
    const fixture = createFixture({
      witnessPatch: {
        lastWitness: {
          rootHash: "f".repeat(64)
        }
      }
    });

    const result = await runRestoreDrill({
      endpoints: fixture.endpoints,
      expected: fixture.expected,
      fetchFn: fixture.fetchFn,
      gitLsRemoteFn: fixture.gitLsRemoteFn
    });

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === "witness_continuity")).toMatchObject({
      status: "fail"
    });
  });

  test("fails when restored package blob digest does not match the registry", async () => {
    const fixture = createFixture({
      bundleBytes: Buffer.from("tampered bundle")
    });

    const result = await runRestoreDrill({
      endpoints: fixture.endpoints,
      expected: fixture.expected,
      fetchFn: fixture.fetchFn,
      gitLsRemoteFn: fixture.gitLsRemoteFn
    });

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === "package_blob_restore")).toMatchObject({
      status: "fail"
    });
  });

  test("fails when source tag no longer resolves to the registry source commit", async () => {
    const fixture = createFixture({
      refs: [
        `${"1".repeat(40)}\tHEAD`,
        `${"2".repeat(40)}\trefs/tags/v0.1.0`
      ].join("\n")
    });

    const result = await runRestoreDrill({
      endpoints: fixture.endpoints,
      expected: fixture.expected,
      fetchFn: fixture.fetchFn,
      gitLsRemoteFn: fixture.gitLsRemoteFn
    });

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === "git_ref_restore")).toMatchObject({
      status: "fail"
    });
  });

  test("fails when a recoverable package is missing transparency evidence", async () => {
    const fixture = createFixture({
      packagePatch: {
        trust: {
          evidence: {
            releaseEventSigned: true,
            sourceProvenanceVerified: true,
            transparencyLogIncluded: false,
            transparencyLogVerified: true
          },
          level: "verified",
          score: 100
        }
      }
    });

    const result = await runRestoreDrill({
      endpoints: fixture.endpoints,
      expected: fixture.expected,
      fetchFn: fixture.fetchFn,
      gitLsRemoteFn: fixture.gitLsRemoteFn
    });

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === "registry_snapshot")).toMatchObject({
      status: "fail"
    });
  });

  test("fails closed when registry package URLs leave the public node origin", async () => {
    const fixture = createFixture({
      packagePatch: {
        resolved: "https://evil.test/bundle.nipmod"
      }
    });

    const result = await runRestoreDrill({
      endpoints: fixture.endpoints,
      expected: fixture.expected,
      fetchFn: fixture.fetchFn,
      gitLsRemoteFn: fixture.gitLsRemoteFn
    });

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === "registry_snapshot")).toMatchObject({
      status: "fail"
    });
  });

  test("fails when discovery restore URLs drift from pinned endpoints", async () => {
    const fixture = createFixture({
      discoveryPatch: {
        node: {
          url: "https://evil.test"
        },
        transparency: {
          checkpoint: "https://evil.test/transparency/checkpoint.json"
        }
      },
      packagePatch: {
        cloneUrl: "https://evil.test/z6Mkevil/example.git",
        resolved: "https://evil.test/api/v1/repos/z6Mkevil/example/blob/releases/0.1.0/bundle.nipmod"
      }
    });

    const result = await runRestoreDrill({
      endpoints: fixture.endpoints,
      expected: fixture.expected,
      fetchFn: fixture.fetchFn,
      gitLsRemoteFn: fixture.gitLsRemoteFn
    });

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === "discovery_restore_pins")).toMatchObject({
      status: "fail"
    });
  });

  test("fails when the package proof is not witnessed by the pinned witness", async () => {
    const fixture = createFixture({
      packagePatch: {
        proof: {
          witnesses: [generateIdentity().did]
        }
      }
    });

    const result = await runRestoreDrill({
      endpoints: fixture.endpoints,
      expected: fixture.expected,
      fetchFn: fixture.fetchFn,
      gitLsRemoteFn: fixture.gitLsRemoteFn
    });

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === "registry_snapshot")).toMatchObject({
      status: "fail"
    });
  });

  test("fails when the checkpoint signature is missing", async () => {
    const fixture = createFixture({
      checkpointPatch: {
        signature: undefined
      }
    });

    const result = await runRestoreDrill({
      endpoints: fixture.endpoints,
      expected: fixture.expected,
      fetchFn: fixture.fetchFn,
      gitLsRemoteFn: fixture.gitLsRemoteFn
    });

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === "registry_snapshot")).toMatchObject({
      status: "fail"
    });
  });

  test("fails bundle restore as soon as the streamed response exceeds the size cap", async () => {
    const fixture = createFixture({
      bundleResponse: oversizedStreamResponse()
    });

    const result = await runRestoreDrill({
      endpoints: fixture.endpoints,
      expected: fixture.expected,
      fetchFn: fixture.fetchFn,
      gitLsRemoteFn: fixture.gitLsRemoteFn
    });

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === "package_blob_restore")).toMatchObject({
      error: expect.stringContaining("exceeded 10485760 bytes"),
      status: "fail"
    });
  });
});

function createFixture({
  bundleBytes = Buffer.from("bundle"),
  bundleResponse,
  checkpointPatch = {},
  discoveryPatch = {},
  packagePatch = {},
  refs,
  witnessPatch = {}
} = {}) {
  const bundleDigest = createHash("sha256").update(Buffer.from("bundle")).digest("hex");
  const logIdentity = generateIdentity();
  const publisher = generateIdentity();
  const witnessIdentity = generateIdentity();
  const canonical = `pkg:${publisher.did}/example`;
  const transparencyLog = createTransparencyLogFromLeaves(
    [
      {
        artifactSha256: bundleDigest,
        eventHash: "b".repeat(64),
        package: canonical,
        publisher: publisher.did,
        version: "0.1.0"
      }
    ],
    logIdentity,
    "2026-05-16T12:00:00.000Z"
  );
  const expected = {
    logId: logIdentity.did,
    witnessDid: witnessIdentity.did
  };
  const endpoints = {
    checkpoint: "https://nipmod.test/transparency/checkpoint.json",
    discovery: "https://nipmod.test/.well-known/nipmod.json",
    nodeHealth: "https://node.nipmod.test/health",
    nodeUrl: "https://node.nipmod.test",
    registry: "https://nipmod.test/registry/packages.json",
    witnessHealth: "https://witness.nipmod.test/health"
  };
  const checkpoint = deepMerge(transparencyLog.treeHead, checkpointPatch);
  const ownerPath = publisher.did.replace("did:key:", "");
  const pkg = deepMerge({
    canonical,
    cloneUrl: `${endpoints.nodeUrl}/${ownerPath}/example.git`,
    digest: bundleDigest,
    name: "example",
    proof: {
      rootHash: checkpoint.rootHash,
      treeSize: checkpoint.treeSize,
      witnesses: [expected.witnessDid]
    },
    resolved: `${endpoints.nodeUrl}/api/v1/repos/${ownerPath}/example/blob/releases/0.1.0/bundle.nipmod`,
    sourceCommit: "1".repeat(40),
    sourceTag: "v0.1.0",
    trust: {
      evidence: {
        releaseEventSigned: true,
        sourceProvenanceVerified: true,
        transparencyLogIncluded: true,
        transparencyLogVerified: true
      },
      level: "verified",
      score: 100
    },
    version: "0.1.0"
  }, packagePatch);
  const discovery = deepMerge({
    node: {
      health: endpoints.nodeHealth,
      url: endpoints.nodeUrl
    },
    registry: {
      url: endpoints.registry
    },
    transparency: {
      checkpoint: endpoints.checkpoint,
      logId: expected.logId
    },
    type: "dev.nipmod.discovery.v1",
    witness: {
      did: expected.witnessDid,
      health: endpoints.witnessHealth
    }
  }, discoveryPatch);
  const routes = {
    [`GET ${endpoints.discovery}`]: jsonResponse(discovery),
    [`GET ${endpoints.registry}`]: jsonResponse({
      formatVersion: 1,
      packages: [pkg]
    }),
    [`GET ${endpoints.checkpoint}`]: jsonResponse(checkpoint),
    "GET https://evil.test/transparency/checkpoint.json": jsonResponse(checkpoint),
    [`GET ${endpoints.witnessHealth}`]: jsonResponse(deepMerge({
      ok: true,
      lastError: null,
      lastWitness: {
        rootHash: checkpoint.rootHash,
        treeSize: checkpoint.treeSize,
        witness: expected.witnessDid
      }
    }, witnessPatch)),
    [`GET ${endpoints.nodeHealth}`]: jsonResponse({ status: "ok" }),
    [pkg.resolved]: bundleResponse ?? bytesResponse(bundleBytes)
  };

  return {
    endpoints,
    expected,
    fetchFn: fakeFetch(routes),
    gitLsRemoteFn: async () =>
      refs ??
      [
        `${pkg.sourceCommit}\tHEAD`,
        `${pkg.sourceCommit}\trefs/heads/main`,
        `${pkg.sourceCommit}\trefs/tags/${pkg.sourceTag}`
      ].join("\n")
  };
}

function fakeFetch(routes) {
  return async (url, init = {}) => {
    const method = init.method ?? "GET";
    const response = routes[`${method} ${url}`] ?? routes[url];
    if (!response) {
      throw new Error(`unexpected fetch ${method} ${url}`);
    }
    return response;
  };
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload)
  };
}

function bytesResponse(bytes, status = 200) {
  const bodyBytes = Buffer.from(bytes);
  return {
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bodyBytes);
        controller.close();
      }
    }),
    ok: status >= 200 && status < 300,
    status,
    arrayBuffer: async () => bodyBytes
  };
}

function oversizedStreamResponse() {
  let remainingChunks = 11;
  return {
    body: new ReadableStream({
      pull(controller) {
        if (remainingChunks <= 0) {
          controller.close();
          return;
        }
        remainingChunks -= 1;
        controller.enqueue(new Uint8Array(1024 * 1024));
      }
    }),
    ok: true,
    status: 200,
    arrayBuffer: async () => {
      throw new Error("arrayBuffer should not be called for streamed package blobs");
    }
  };
}

function deepMerge(base, patch) {
  const output = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    output[key] =
      value && typeof value === "object" && !Array.isArray(value) && base[key] && typeof base[key] === "object"
        ? deepMerge(base[key], value)
        : value;
  }
  return output;
}
