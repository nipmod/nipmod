import { describe, expect, test } from "vitest";
import { evaluateWitnessRequest } from "./witness-worker.ts";

const identity = {
  did: "did:key:z6Mkwitness",
  privateKeyPem: "private",
  publicKeyPem: "public"
};

describe("witness worker", () => {
  test("signs the first valid checkpoint and records leaf state", () => {
    const log = logFixture(["a".repeat(64)]);
    const request = requestFixture(log.treeHead);
    request.bootstrap = true;
    const result = evaluateWitnessRequest({
      allowedLogIds: [log.treeHead.logId],
      identity,
      log,
      request,
      transparency: fakeTransparency()
    });

    expect(result.statement.witness).toBe(identity.did);
    expect(result.statement.treeHead.rootHash).toBe(log.treeHead.rootHash);
    expect(result.state.leafHashes).toEqual(["a".repeat(64)]);
  });

  test("accepts append-only extension from worker state", () => {
    const previous = logFixture(["a".repeat(64)]);
    const next = logFixture(["a".repeat(64), "b".repeat(64)], {
      generatedAt: "2026-05-16T00:00:00.000Z",
      rootHash: "2".repeat(64),
      treeSize: 2
    });
    const state = stateFixture(previous);
    const result = evaluateWitnessRequest({
      allowedLogIds: [next.treeHead.logId],
      identity,
      log: next,
      request: requestFixture(next.treeHead, previous.treeHead),
      state,
      transparency: fakeTransparency()
    });

    expect(result.state.leafHashes).toEqual(["a".repeat(64), "b".repeat(64)]);
  });

  test("accepts idempotent reruns of an already witnessed checkpoint", () => {
    const previous = logFixture(["a".repeat(64)]);
    const current = logFixture(["a".repeat(64), "b".repeat(64)], {
      generatedAt: "2026-05-16T00:00:00.000Z",
      rootHash: "2".repeat(64),
      treeSize: 2
    });
    const result = evaluateWitnessRequest({
      allowedLogIds: [current.treeHead.logId],
      identity,
      log: current,
      request: requestFixture(current.treeHead, previous.treeHead),
      state: stateFixture(current),
      transparency: fakeTransparency()
    });

    expect(result.state.treeHead.rootHash).toBe(current.treeHead.rootHash);
    expect(result.state.leafHashes).toEqual(["a".repeat(64), "b".repeat(64)]);
  });

  test("rejects a rewritten prefix", () => {
    const previous = logFixture(["a".repeat(64)]);
    const next = logFixture(["c".repeat(64), "b".repeat(64)], {
      generatedAt: "2026-05-16T00:00:00.000Z",
      rootHash: "2".repeat(64),
      treeSize: 2
    });

    expect(() =>
      evaluateWitnessRequest({
        allowedLogIds: [next.treeHead.logId],
        identity,
        log: next,
        request: requestFixture(next.treeHead, previous.treeHead),
        state: stateFixture(previous),
        transparency: fakeTransparency()
      })
    ).toThrow(/append-only/i);
  });

  test("rejects a request whose previous checkpoint does not match worker state", () => {
    const previous = logFixture(["a".repeat(64)]);
    const next = logFixture(["a".repeat(64), "b".repeat(64)], {
      generatedAt: "2026-05-16T00:00:00.000Z",
      rootHash: "2".repeat(64),
      treeSize: 2
    });
    const wrongPrevious = { ...previous.treeHead, rootHash: "3".repeat(64) };

    expect(() =>
      evaluateWitnessRequest({
        allowedLogIds: [next.treeHead.logId],
        identity,
        log: next,
        request: requestFixture(next.treeHead, wrongPrevious),
        state: stateFixture(previous),
        transparency: fakeTransparency()
      })
    ).toThrow(/previous checkpoint/i);
  });

  test("requires explicit bootstrap when prior checkpoint exists without state", () => {
    const previous = logFixture(["a".repeat(64)]);
    const next = logFixture(["a".repeat(64), "b".repeat(64)], {
      generatedAt: "2026-05-16T00:00:00.000Z",
      rootHash: "2".repeat(64),
      treeSize: 2
    });

    expect(() =>
      evaluateWitnessRequest({
        allowedLogIds: [next.treeHead.logId],
        identity,
        log: next,
        request: requestFixture(next.treeHead, previous.treeHead),
        transparency: fakeTransparency()
      })
    ).toThrow(/worker has no state/i);

    const request = requestFixture(next.treeHead, previous.treeHead);
    request.bootstrap = true;
    expect(
      evaluateWitnessRequest({
        allowedLogIds: [next.treeHead.logId],
        identity,
        log: next,
        request,
        transparency: fakeTransparency()
      }).state.leafHashes
    ).toEqual(["a".repeat(64), "b".repeat(64)]);
  });

  test("requires explicit bootstrap when state is missing without a previous checkpoint", () => {
    const log = logFixture(["a".repeat(64)]);

    expect(() =>
      evaluateWitnessRequest({
        allowedLogIds: [log.treeHead.logId],
        identity,
        log,
        request: requestFixture(log.treeHead),
        transparency: fakeTransparency()
      })
    ).toThrow(/explicit bootstrap/i);
  });

  test("rejects unpinned log ids", () => {
    const log = logFixture(["a".repeat(64)]);
    const request = requestFixture(log.treeHead);
    request.bootstrap = true;

    expect(() =>
      evaluateWitnessRequest({
        allowedLogIds: ["did:key:z6Mkother"],
        identity,
        log,
        request,
        transparency: fakeTransparency()
      })
    ).toThrow(/not allowed/i);
  });

  test("rejects a request checkpoint that does not match the log", () => {
    const log = logFixture(["a".repeat(64)]);
    const mismatchedCheckpoint = { ...log.treeHead, rootHash: "9".repeat(64) };

    expect(() =>
      evaluateWitnessRequest({
        allowedLogIds: [log.treeHead.logId],
        identity,
        log,
        request: requestFixture(mismatchedCheckpoint),
        transparency: fakeTransparency()
      })
    ).toThrow(/does not match/i);
  });
});

function fakeTransparency() {
  return {
    signWitnessStatement: (treeHead, signer) => ({
      formatVersion: 1,
      signature: {
        algorithm: "Ed25519",
        keyId: signer.did,
        signatureBase64: "signed"
      },
      treeHead: {
        formatVersion: treeHead.formatVersion,
        generatedAt: treeHead.generatedAt,
        logId: treeHead.logId,
        rootHash: treeHead.rootHash,
        treeSize: treeHead.treeSize
      },
      type: "dev.nipmod.transparency.witness.v1",
      witness: signer.did
    }),
    verifyTransparencyLog: (log, allowedLogIds) =>
      allowedLogIds.includes(log.treeHead.logId) && log.entries.length === log.treeHead.treeSize
  };
}

function logFixture(leafHashes, overrides = {}) {
  const treeHead = {
    formatVersion: 1,
    generatedAt: overrides.generatedAt ?? "2026-05-15T00:00:00.000Z",
    logId: "did:key:z6Mklog",
    rootHash: overrides.rootHash ?? "1".repeat(64),
    signature: {
      algorithm: "Ed25519",
      keyId: "did:key:z6Mklog",
      signatureBase64: "signed"
    },
    treeSize: overrides.treeSize ?? leafHashes.length
  };
  return {
    entries: leafHashes.map((leafHash, leafIndex) => ({
      inclusionProof: [],
      leaf: {
        artifactSha256: String(leafIndex).repeat(64).slice(0, 64).padEnd(64, "0"),
        eventHash: String(leafIndex + 1).repeat(64).slice(0, 64).padEnd(64, "1"),
        package: `pkg:did:key:z6Mkowner/package-${leafIndex}`,
        publisher: "did:key:z6Mkowner",
        version: "0.1.0"
      },
      leafHash,
      leafIndex
    })),
    formatVersion: 1,
    treeHead
  };
}

function requestFixture(checkpoint, previousCheckpoint = null) {
  return {
    checkpoint,
    formatVersion: 1,
    logUrl: "/transparency/log.json",
    previousCheckpoint,
    type: "dev.nipmod.transparency.witness-request.v1"
  };
}

function stateFixture(log) {
  return {
    formatVersion: 1,
    leafHashes: log.entries.map((entry) => entry.leafHash),
    treeHead: log.treeHead,
    type: "dev.nipmod.transparency.witness-state.v1"
  };
}
