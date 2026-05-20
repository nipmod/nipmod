import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, test } from "vitest";
import { runSyntheticMonitor } from "./prod-synthetic-monitor.mjs";

const now = Date.parse("2026-05-16T12:42:00.000Z");

describe("production synthetic monitor", () => {
  test("passes the public production contract with healthy fixtures", async () => {
    const fixture = createFixture();
    const result = await runSyntheticMonitor({
      endpoints: fixture.endpoints,
      expected: fixture.expected,
      fetchFn: fixture.fetchFn,
      now
    });

    expect(result.ok).toBe(true);
    expect(result.summary).toEqual({ fail: 0, pass: 16, total: 16 });
    expect(result.checks.map((check) => check.name)).toEqual([
      "site_home",
      "trust_page",
      "platform_connections",
      "security_disclosure",
      "discovery_manifest",
      "remote_readonly_mcp",
      "deploy_drift",
      "release_artifacts",
      "registry_verified",
      "quorum_receipts",
      "advisory_feed_signature",
      "transparency_checkpoint",
      "witness_health",
      "witness_run_auth",
      "node_health",
      "receive_pack_auth"
    ]);
  });

  test("fails when the live discovery manifest drifts from the expected release", async () => {
    const fixture = createFixture({
      discoveryPatch: {
        install: {
          release: {
            version: "0.1.12"
          }
        }
      }
    });

    const result = await runSyntheticMonitor({
      endpoints: fixture.endpoints,
      expected: fixture.expected,
      fetchFn: fixture.fetchFn,
      now
    });

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === "deploy_drift")).toMatchObject({
      status: "fail"
    });
  });

  test("fails when discovery key material does not match the pinned fingerprint", async () => {
    const rogueKey = generateKeyPairSync("ed25519").publicKey.export({ format: "der", type: "spki" }).toString("base64");
    const fixture = createFixture({
      discoveryPatch: {
        advisoriesPublicKey: {
          publicKeySpkiBase64: rogueKey
        }
      }
    });

    const result = await runSyntheticMonitor({
      endpoints: fixture.endpoints,
      expected: fixture.expected,
      fetchFn: fixture.fetchFn,
      now
    });

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === "deploy_drift")).toMatchObject({
      status: "fail"
    });
  });

  test("fails when live installer bytes drift while manifest claims stay pinned", async () => {
    const fixture = createFixture({
      routeOverrides: {
        "GET https://nipmod.test/install.sh": bytesResponse(Buffer.from("modified installer"))
      }
    });

    const result = await runSyntheticMonitor({
      endpoints: fixture.endpoints,
      expected: fixture.expected,
      fetchFn: fixture.fetchFn,
      now
    });

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === "release_artifacts")).toMatchObject({
      status: "fail"
    });
  });

  test("fails when verified registry records lose source provenance fields", async () => {
    const fixture = createFixture({
      registryPackagePatch: {
        sourceTag: undefined
      }
    });

    const result = await runSyntheticMonitor({
      endpoints: fixture.endpoints,
      expected: fixture.expected,
      fetchFn: fixture.fetchFn,
      now
    });

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === "registry_verified")).toMatchObject({
      status: "fail"
    });
  });

  test("fails when the witness manual run endpoint is unauthenticated", async () => {
    const fixture = createFixture({
      routeOverrides: {
        "POST https://witness.nipmod.test/run": jsonResponse({ ok: true }, 200)
      }
    });

    const result = await runSyntheticMonitor({
      endpoints: fixture.endpoints,
      expected: fixture.expected,
      fetchFn: fixture.fetchFn,
      now
    });

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === "witness_run_auth")).toMatchObject({
      status: "fail"
    });
  });

  test("passes when an old static checkpoint is freshly observed by the witness", async () => {
    const fixture = createFixture({
      checkpointPatch: {
        generatedAt: "2026-05-15T12:41:00.000Z"
      }
    });

    const result = await runSyntheticMonitor({
      endpoints: fixture.endpoints,
      expected: fixture.expected,
      fetchFn: fixture.fetchFn,
      now
    });

    expect(result.ok).toBe(true);
    expect(result.checks.find((check) => check.name === "transparency_checkpoint")).toMatchObject({
      status: "pass"
    });
    expect(result.checks.find((check) => check.name === "witness_health")).toMatchObject({
      status: "pass"
    });
  });

  test("fails when the witness has not freshly observed the checkpoint", async () => {
    const fixture = createFixture({
      routeOverrides: {
        "GET https://witness.nipmod.test/health": jsonResponse({
          ok: true,
          lastError: null,
          lastRunAt: "2026-05-16T10:41:00.000Z",
          lastWitness: {
            rootHash: "c".repeat(64),
            treeSize: 7,
            witness: "did:key:z6Mkwitness"
          }
        })
      }
    });

    const result = await runSyntheticMonitor({
      endpoints: fixture.endpoints,
      expected: fixture.expected,
      fetchFn: fixture.fetchFn,
      now
    });

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === "witness_health")).toMatchObject({
      status: "fail"
    });
  });

  test("fails when the checkpoint timestamp is invalid", async () => {
    const fixture = createFixture({
      checkpointPatch: {
        generatedAt: "not-a-date"
      }
    });

    const result = await runSyntheticMonitor({
      endpoints: fixture.endpoints,
      expected: fixture.expected,
      fetchFn: fixture.fetchFn,
      now
    });

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === "transparency_checkpoint")).toMatchObject({
      status: "fail"
    });
  });
});

function createFixture({ checkpointPatch = {}, discoveryPatch = {}, registryPackagePatch = {}, routeOverrides = {} } = {}) {
  const advisoryKeyPair = generateKeyPairSync("ed25519");
  const advisoryPublicKeyDer = advisoryKeyPair.publicKey.export({ format: "der", type: "spki" });
  const advisoryPublicKey = {
    algorithm: "Ed25519",
    publicKeySpkiBase64: advisoryPublicKeyDer.toString("base64"),
    publicKeySpkiSha256: createHash("sha256").update(advisoryPublicKeyDer).digest("hex"),
    type: "dev.nipmod.advisory.public-key.v1"
  };
  const advisoryFeed = {
    advisories: [],
    expiresAt: "2026-06-16T00:00:00.000Z",
    formatVersion: 1,
    generatedAt: "2026-05-16T12:40:00.000Z",
    type: "dev.nipmod.advisories.v1"
  };
  const advisoryBytes = Buffer.from(JSON.stringify(advisoryFeed));
  const advisorySignature = {
    algorithm: "Ed25519",
    artifact: "advisories.json",
    publicKeySpkiSha256: advisoryPublicKey.publicKeySpkiSha256,
    signatureBase64: sign(null, advisoryBytes, advisoryKeyPair.privateKey).toString("base64"),
    type: "dev.nipmod.advisory.signature.v1"
  };
  const releaseKeyPair = generateKeyPairSync("ed25519");
  const releasePublicKeyDer = releaseKeyPair.publicKey.export({ format: "der", type: "spki" });
  const releasePublicKey = {
    algorithm: "Ed25519",
    publicKeySpkiBase64: releasePublicKeyDer.toString("base64"),
    publicKeySpkiSha256: createHash("sha256").update(releasePublicKeyDer).digest("hex"),
    type: "dev.nipmod.release.public-key.v1"
  };
  const installerBytes = Buffer.from("#!/bin/sh\necho install\n");
  const releaseBytes = Buffer.from("release artifact");
  const releaseSignature = {
    algorithm: "Ed25519",
    artifact: "nipmod-0.1.13.tgz",
    publicKeySpkiSha256: releasePublicKey.publicKeySpkiSha256,
    signatureBase64: sign(null, releaseBytes, releaseKeyPair.privateKey).toString("base64"),
    type: "dev.nipmod.release.signature.v1"
  };
  const expected = {
    advisoryPublicKey,
    checkpointMaxAgeMs: 6 * 60 * 60 * 1000,
    installerSha256: createHash("sha256").update(installerBytes).digest("hex"),
    logId: "did:key:z6Mklog",
    releaseName: "nipmod-0.1.13.tgz",
    releasePublicKey,
    releaseSha256: createHash("sha256").update(releaseBytes).digest("hex"),
    version: "0.1.13",
    witnessDid: "did:key:z6Mkwitness",
    witnessMaxAgeMs: 15 * 60 * 1000
  };
  const endpoints = {
    advisories: "https://nipmod.test/advisories.json",
    advisoriesSignature: "https://nipmod.test/advisories.json.sig",
    checkpoint: "https://nipmod.test/transparency/checkpoint.json",
    discovery: "https://nipmod.test/.well-known/nipmod.json",
    home: "https://nipmod.test",
    nodeHealth: "https://node.nipmod.test/health",
    nodeUrl: "https://node.nipmod.test",
    platforms: "https://nipmod.test/platforms",
    platformConnections: "https://nipmod.test/compatibility/platform-connections.json",
    quorumPolicy: "https://nipmod.test/quorum/policy.json",
    quorumReceipts: "https://nipmod.test/quorum/receipts.json",
    quorumSigners: "https://nipmod.test/quorum/signers.json",
    registry: "https://nipmod.test/registry/packages.json",
    remoteMcp: "https://nipmod.test/api/mcp",
    security: "https://nipmod.test/security",
    securityTxt: "https://nipmod.test/.well-known/security.txt",
    trust: "https://nipmod.test/trust",
    witnessHealth: "https://witness.nipmod.test/health",
    witnessRun: "https://witness.nipmod.test/run"
  };
  const checkpoint = {
    formatVersion: 1,
    generatedAt: "2026-05-16T12:40:00.000Z",
    logId: expected.logId,
    rootHash: "c".repeat(64),
    treeSize: 7,
    ...checkpointPatch
  };
  const discovery = deepMerge(
    {
      advisories: endpoints.advisories,
      advisoriesPublicKey: {
        algorithm: "Ed25519",
        publicKeySpkiBase64: advisoryPublicKey.publicKeySpkiBase64,
        spkiSha256: advisoryPublicKey.publicKeySpkiSha256
      },
      advisoriesSignature: endpoints.advisoriesSignature,
      formatVersion: 1,
      homepage: endpoints.home,
      docs: {
        platforms: endpoints.platforms
      },
      install: {
        release: {
          artifact: `https://nipmod.test/releases/${expected.releaseName}`,
          artifactSha256: expected.releaseSha256,
          publicKey: {
            algorithm: "Ed25519",
            publicKeySpkiBase64: releasePublicKey.publicKeySpkiBase64,
            spkiSha256: releasePublicKey.publicKeySpkiSha256
          },
          signature: `https://nipmod.test/releases/${expected.releaseName}.sig`,
          version: expected.version
        },
        script: "https://nipmod.test/install.sh",
        scriptSha256: expected.installerSha256
      },
      mcp: {
        remoteEndpoint: endpoints.remoteMcp
      },
      name: "nipmod",
      node: {
        health: endpoints.nodeHealth,
        url: endpoints.nodeUrl
      },
      quorum: {
        policy: endpoints.quorumPolicy,
        receipts: endpoints.quorumReceipts,
        signers: endpoints.quorumSigners
      },
      registry: {
        source: endpoints.nodeUrl,
        url: endpoints.registry
      },
      review: {
        evidenceLedger: "https://nipmod.test/review/evidence-ledger.json",
        evidenceManifest: "https://nipmod.test/review/evidence-manifest.json",
        launch: "https://nipmod.test/launch",
        packet: "https://nipmod.test/review/packet.json",
        packetMarkdown: "https://nipmod.test/review/packet.md",
        platformConnections: endpoints.platformConnections,
        proofTranscript: "https://nipmod.test/proof/transcript.json"
      },
      transparency: {
        checkpoint: endpoints.checkpoint,
        log: "https://nipmod.test/transparency/log.json",
        logId: expected.logId
      },
      trustPage: endpoints.trust,
      type: "dev.nipmod.discovery.v1",
      witness: {
        did: expected.witnessDid,
        health: endpoints.witnessHealth,
        statements: "https://witness.nipmod.test/witness-statements.json"
      }
    },
    discoveryPatch
  );
  const routes = {
    [`GET ${endpoints.home}`]: textResponse("nipmod install shasum"),
    [`GET ${endpoints.trust}`]: textResponse("Verified registry Current public roots Release key Quorum"),
    [`GET ${endpoints.platforms}`]: textResponse("Connection matrix Only usable paths are shown"),
    [`GET ${endpoints.platformConnections}`]: jsonResponse({
      connections: [{ id: "aeon" }, { id: "hermes" }],
      type: "dev.nipmod.platform-connections.v1"
    }),
    [`GET ${endpoints.security}`]: textResponse("Report with proof No central deletion"),
    [`GET ${endpoints.securityTxt}`]: textResponse(
      `Contact: https://nipmod.test/security\nCanonical: ${endpoints.securityTxt}\nPolicy: ${endpoints.security}`
    ),
    [`GET ${endpoints.discovery}`]: jsonResponse(discovery),
    [`GET ${endpoints.remoteMcp}`]: jsonResponse({
      endpoint: endpoints.remoteMcp,
      mode: "remote-read-only",
      notExposed: ["nipmod.install"],
      tools: ["nipmod.search", "nipmod.view", "nipmod.inspect", "nipmod.install_plan", "nipmod.demo"],
      type: "dev.nipmod.remote-mcp.v1"
    }),
    [`POST ${endpoints.remoteMcp}`]: jsonResponse({
      id: 1,
      jsonrpc: "2.0",
      result: {
        tools: [
          { name: "nipmod.search" },
          { name: "nipmod.view" },
          { name: "nipmod.inspect" },
          { name: "nipmod.install_plan" },
          { name: "nipmod.demo" }
        ]
      }
    }),
    [`GET ${endpoints.registry}`]: jsonResponse(registryFixture(checkpoint, registryPackagePatch)),
    [`GET ${endpoints.quorumPolicy}`]: jsonResponse({
      id: "nipmod-quorum-release-v1",
      threshold: 2,
      type: "dev.nipmod.quorum-policy.v1"
    }),
    [`GET ${endpoints.quorumSigners}`]: jsonResponse({
      signers: [{ id: "release" }, { id: "security" }],
      type: "dev.nipmod.quorum-signers.v1"
    }),
    [`GET ${endpoints.quorumReceipts}`]: jsonResponse({
      receipts: [{ package: "pkg:did:key:z6Mkpkg/example", version: "0.1.0" }],
      type: "dev.nipmod.quorum-receipts.v1"
    }),
    [`GET ${endpoints.advisories}`]: bytesResponse(advisoryBytes),
    [`GET ${endpoints.advisoriesSignature}`]: jsonResponse(advisorySignature),
    "GET https://nipmod.test/install.sh": bytesResponse(installerBytes),
    "GET https://nipmod.test/releases/nipmod-0.1.13.tgz": bytesResponse(releaseBytes),
    "GET https://nipmod.test/releases/nipmod-0.1.13.tgz.sig": jsonResponse(releaseSignature),
    [`GET ${endpoints.checkpoint}`]: jsonResponse(checkpoint),
    [`GET ${endpoints.witnessHealth}`]: jsonResponse({
      ok: true,
      lastError: null,
      lastRunAt: "2026-05-16T12:41:00.000Z",
      lastWitness: {
        rootHash: checkpoint.rootHash,
        treeSize: checkpoint.treeSize,
        witness: expected.witnessDid
      }
    }),
    [`POST ${endpoints.witnessRun}`]: jsonResponse({ error: "missing run authorization" }, 401),
    [`GET ${endpoints.nodeHealth}`]: jsonResponse({ status: "ok" }),
    "POST https://node.nipmod.test/z6MknipmodUnauthProbe/receive-pack-abuse/git-receive-pack": jsonResponse(
      { error: "missing Signature-Input or Signature headers" },
      401,
      { "www-authenticate": "Signature realm=\"gitlawb-alpha\"" }
    ),
    ...routeOverrides
  };

  return {
    endpoints,
    expected,
    fetchFn: fakeFetch(routes)
  };
}

function registryFixture(checkpoint, packagePatch = {}) {
  const pkg = removeUndefined({
    canonical: "pkg:did:key:z6Mkpkg/example",
    digest: "d".repeat(64),
    proof: {
      rootHash: checkpoint.rootHash,
      treeSize: checkpoint.treeSize,
      witnesses: ["did:key:z6Mkwitness"]
    },
    sourceCommit: "1".repeat(40),
    sourceTag: "v0.1.0",
    quorum: {
      approvedRoles: ["release", "security"],
      approvals: 2,
      status: "passed",
      threshold: 2
    },
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
    version: "0.1.0",
    ...packagePatch
  });
  return {
    formatVersion: 1,
    packages: [pkg],
    source: "https://node.nipmod.test"
  };
}

function fakeFetch(routes) {
  return async (url, init = {}) => {
    const method = init.method ?? "GET";
    const key = `${method} ${url}`;
    const response = routes[key];
    if (!response) {
      throw new Error(`unexpected fetch ${key}`);
    }
    return response;
  };
}

function jsonResponse(payload, status = 200, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => payload,
    text: async () => JSON.stringify(payload),
    arrayBuffer: async () => Buffer.from(JSON.stringify(payload))
  };
}

function textResponse(text, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => text
  };
}

function bytesResponse(bytes, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    arrayBuffer: async () => bytes
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

function removeUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
