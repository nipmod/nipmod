import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { createWitnessServer } from "./witness-server.ts";

const identity = {
  did: "did:key:z6Mkwitness",
  privateKeyPem: "private",
  publicKeyPem: "public"
};

describe("witness server", () => {
  test("serves witness statements after a successful run", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-witness-server-"));
    const outputPath = join(dir, "witness-statements.json");
    const statePath = join(dir, "state.json");
    const log = logFixture(["a".repeat(64)]);
    const request = requestFixture(log.treeHead);
    request.bootstrap = true;
    const service = createWitnessServer({
      allowedLogIds: [log.treeHead.logId],
      identity,
      intervalMs: 0,
      log,
      outputPath,
      request,
      statePath,
      transparency: fakeTransparency()
    });
    await service.runOnce();
    await new Promise((resolve) => service.server.listen(0, "127.0.0.1", resolve));
    const address = service.server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/witness-statements.json`);
    const payload = await response.json();

    service.stop();

    expect(response.status).toBe(200);
    expect(payload.type).toBe("dev.nipmod.transparency.witness-statements.v1");
    expect(payload.statements[0].witness).toBe(identity.did);
    expect(JSON.parse(await readFile(statePath, "utf8")).leafHashes).toEqual(["a".repeat(64)]);
  });

  test("health stays unavailable until a witness statement exists", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-witness-server-health-"));
    const log = logFixture(["a".repeat(64)]);
    const request = requestFixture(log.treeHead);
    request.bootstrap = true;
    const service = createWitnessServer({
      allowedLogIds: [log.treeHead.logId],
      identity,
      intervalMs: 0,
      log,
      outputPath: join(dir, "witness-statements.json"),
      request,
      statePath: join(dir, "state.json"),
      transparency: fakeTransparency()
    });
    await new Promise((resolve) => service.server.listen(0, "127.0.0.1", resolve));
    const address = service.server.address();
    const initial = await fetch(`http://127.0.0.1:${address.port}/health`);
    await service.runOnce();
    const ready = await fetch(`http://127.0.0.1:${address.port}/health`);

    service.stop();

    expect(initial.status).toBe(503);
    expect((await initial.json()).ok).toBe(false);
    expect(ready.status).toBe(200);
    expect((await ready.json()).ok).toBe(true);
  });

  test("health can route existing statements when the next refresh fails", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-witness-server-persisted-"));
    const outputPath = join(dir, "witness-statements.json");
    const log = logFixture(["a".repeat(64)]);
    const request = requestFixture({ ...log.treeHead, rootHash: "2".repeat(64) });
    await writeFile(
      outputPath,
      `${JSON.stringify({
        formatVersion: 1,
        statements: [fakeTransparency().signWitnessStatement(log.treeHead, identity)],
        type: "dev.nipmod.transparency.witness-statements.v1"
      })}\n`
    );
    const service = createWitnessServer({
      allowedLogIds: [log.treeHead.logId],
      identity,
      intervalMs: 0,
      log,
      outputPath,
      request,
      statePath: join(dir, "state.json"),
      transparency: fakeTransparency()
    });
    await new Promise((resolve) => service.server.listen(0, "127.0.0.1", resolve));
    await service.runOnce();
    const address = service.server.address();
    const health = await fetch(`http://127.0.0.1:${address.port}/health`);
    const statements = await fetch(`http://127.0.0.1:${address.port}/witness-statements.json`);
    const healthPayload = await health.json();

    service.stop();

    expect(health.status).toBe(200);
    expect(healthPayload.ok).toBe(true);
    expect(healthPayload.lastError).toMatch(/checkpoint/i);
    expect(statements.status).toBe(200);
  });

  test("protects manual witness runs with bearer auth when a token is configured", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-witness-server-auth-"));
    const outputPath = join(dir, "witness-statements.json");
    const log = logFixture(["a".repeat(64)]);
    const request = requestFixture(log.treeHead);
    request.bootstrap = true;
    const service = createWitnessServer({
      allowedLogIds: [log.treeHead.logId],
      identity,
      intervalMs: 0,
      log,
      outputPath,
      request,
      runToken: "secret-token",
      statePath: join(dir, "state.json"),
      transparency: fakeTransparency()
    });
    await new Promise((resolve) => service.server.listen(0, "127.0.0.1", resolve));
    const address = service.server.address();
    const url = `http://127.0.0.1:${address.port}`;
    const missingAuth = await fetch(`${url}/run`, { method: "POST" });
    const missingStatements = await fetch(`${url}/witness-statements.json`);
    const wrongAuth = await fetch(`${url}/run`, {
      headers: { authorization: "Bearer wrong-token" },
      method: "POST"
    });
    const rightAuth = await fetch(`${url}/run`, {
      headers: { authorization: "Bearer secret-token" },
      method: "POST"
    });
    const payload = await fetch(`${url}/witness-statements.json`).then((response) => response.json());

    service.stop();

    expect(missingAuth.status).toBe(401);
    expect(missingStatements.status).toBe(404);
    expect(wrongAuth.status).toBe(403);
    expect(rightAuth.status).toBe(200);
    expect(payload.statements[0].witness).toBe(identity.did);
  });

  test("rejects manual witness runs when no run token is configured", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-witness-server-no-token-"));
    const log = logFixture(["a".repeat(64)]);
    const request = requestFixture(log.treeHead);
    request.bootstrap = true;
    const service = createWitnessServer({
      allowedLogIds: [log.treeHead.logId],
      identity,
      intervalMs: 0,
      log,
      outputPath: join(dir, "witness-statements.json"),
      request,
      statePath: join(dir, "state.json"),
      transparency: fakeTransparency()
    });
    await new Promise((resolve) => service.server.listen(0, "127.0.0.1", resolve));
    const address = service.server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/run`, { method: "POST" });
    const payload = await response.json();
    const statements = await fetch(`http://127.0.0.1:${address.port}/witness-statements.json`);

    service.stop();

    expect(response.status).toBe(503);
    expect(payload.error).toBe("manual run authorization is not configured");
    expect(statements.status).toBe(404);
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

function logFixture(leafHashes) {
  const treeHead = {
    formatVersion: 1,
    generatedAt: "2026-05-15T00:00:00.000Z",
    logId: "did:key:z6Mklog",
    rootHash: "1".repeat(64),
    signature: {
      algorithm: "Ed25519",
      keyId: "did:key:z6Mklog",
      signatureBase64: "signed"
    },
    treeSize: leafHashes.length
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

function requestFixture(checkpoint) {
  return {
    checkpoint,
    formatVersion: 1,
    logUrl: "/transparency/log.json",
    previousCheckpoint: null,
    type: "dev.nipmod.transparency.witness-request.v1"
  };
}
