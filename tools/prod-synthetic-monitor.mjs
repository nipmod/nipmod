#!/usr/bin/env node
import { createHash, createPublicKey, verify } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateAdvisoryFeed } from "./advisory-signing.mjs";
import { assertUnauthenticatedReceivePackBlocked } from "./receive-pack-abuse-smoke.mjs";

const DEFAULT_ENDPOINTS = {
  advisories: "https://nipmod.com/advisories.json",
  advisoriesSignature: "https://nipmod.com/advisories.json.sig",
  checkpoint: "https://nipmod.com/transparency/checkpoint.json",
  discovery: "https://nipmod.com/.well-known/nipmod.json",
  home: "https://nipmod.com",
  nodeHealth: "https://node.nipmod.com/health",
  nodeUrl: "https://node.nipmod.com",
  platforms: "https://nipmod.com/platforms",
  platformConnections: "https://nipmod.com/compatibility/platform-connections.json",
  registry: "https://nipmod.com/registry/packages.json",
  security: "https://nipmod.com/security",
  securityTxt: "https://nipmod.com/.well-known/security.txt",
  trust: "https://nipmod.com/trust",
  witnessHealth: "https://nipmod-witness.fly.dev/health",
  witnessRun: "https://nipmod-witness.fly.dev/run"
};
const DEFAULT_CHECKPOINT_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const DEFAULT_WITNESS_MAX_AGE_MS = 15 * 60 * 1000;
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;
const HEX_SHA256 = /^[a-f0-9]{64}$/;
const SOURCE_COMMIT = /^[a-f0-9]{40}$/;
const SOURCE_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export async function runSyntheticMonitor({
  endpoints = DEFAULT_ENDPOINTS,
  expected,
  fetchFn = fetch,
  now = Date.now(),
  rootDir = resolve(import.meta.dirname, "..")
} = {}) {
  const config = expected ?? (await readExpectedConfig(rootDir));
  const timedFetch = createTimedFetch(fetchFn, config.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS);
  const state = {};
  const checks = [];

  await runCheck(checks, "site_home", async () => {
    const text = await fetchText(endpoints.home, timedFetch);
    assertIncludes(text, "nipmod", "homepage missing product name");
    return { url: endpoints.home };
  });

  await runCheck(checks, "trust_page", async () => {
    const text = await fetchText(endpoints.trust, timedFetch);
    for (const marker of ["Verified registry", "Current public roots", "Release key"]) {
      assertIncludes(text, marker, `trust page missing ${marker}`);
    }
    return { url: endpoints.trust };
  });

  await runCheck(checks, "platform_connections", async () => {
    const page = await fetchText(endpoints.platforms, timedFetch);
    assertIncludes(page, "Connection matrix", "platform page missing matrix title");
    assertIncludes(page, "Under review", "platform page missing review status");
    const matrix = await fetchJson(endpoints.platformConnections, timedFetch);
    assertEqual(matrix.type, "dev.nipmod.platform-connections.v1", "platform connection type mismatch");
    assertIncludes(JSON.stringify(matrix), "aeon", "platform matrix missing Aeon candidate");
    return { matrix: endpoints.platformConnections, page: endpoints.platforms };
  });

  await runCheck(checks, "security_disclosure", async () => {
    const page = await fetchText(endpoints.security, timedFetch);
    assertIncludes(page, "Report with proof", "security page missing disclosure marker");
    assertIncludes(page, "No central deletion", "security page missing decentralized control marker");
    const securityTxt = await fetchText(endpoints.securityTxt, timedFetch);
    assertIncludes(securityTxt, `Canonical: ${endpoints.securityTxt}`, "security.txt canonical mismatch");
    assertIncludes(securityTxt, `Policy: ${endpoints.security}`, "security.txt policy mismatch");
    return { policy: endpoints.security, securityTxt: endpoints.securityTxt };
  });

  await runCheck(checks, "discovery_manifest", async () => {
    state.discovery = await fetchJson(endpoints.discovery, timedFetch);
    assertEqual(state.discovery.type, "dev.nipmod.discovery.v1", "discovery type mismatch");
    assertEqual(state.discovery.homepage, endpoints.home, "discovery homepage mismatch");
    assertEqual(state.discovery.trustPage, endpoints.trust, "discovery trust page mismatch");
    assertEqual(state.discovery.registry?.url, endpoints.registry, "discovery registry URL mismatch");
    assertEqual(state.discovery.node?.health, endpoints.nodeHealth, "discovery node health URL mismatch");
    assertEqual(state.discovery.witness?.health, endpoints.witnessHealth, "discovery witness health URL mismatch");
    assertEqual(state.discovery.advisories, endpoints.advisories, "discovery advisory URL mismatch");
    assertEqual(state.discovery.advisoriesSignature, endpoints.advisoriesSignature, "discovery advisory signature URL mismatch");
    assertEqual(state.discovery.transparency?.checkpoint, endpoints.checkpoint, "discovery checkpoint URL mismatch");
    assertEqual(state.discovery.docs?.platforms, endpoints.platforms, "discovery platforms URL mismatch");
    assertEqual(
      state.discovery.review?.platformConnections,
      endpoints.platformConnections,
      "discovery platform connections URL mismatch"
    );
    assertEqual(state.discovery.review?.packet, `${endpoints.home}/review/packet.json`, "discovery review packet URL mismatch");
    assertEqual(
      state.discovery.review?.evidenceManifest,
      `${endpoints.home}/review/evidence-manifest.json`,
      "discovery review evidence manifest URL mismatch"
    );
    assertEqual(
      state.discovery.review?.evidenceLedger,
      `${endpoints.home}/review/evidence-ledger.json`,
      "discovery review evidence ledger URL mismatch"
    );
    return { url: endpoints.discovery };
  });

  await runCheck(checks, "deploy_drift", async () => {
    const discovery = requireState(state.discovery, "discovery manifest");
    assertEqual(discovery.install?.scriptSha256, config.installerSha256, "live installer hash drifted");
    assertEqual(discovery.install?.release?.version, config.version, "live release version drifted");
    assertEqual(discovery.install?.release?.artifactSha256, config.releaseSha256, "live release hash drifted");
    assertEqual(discovery.install?.release?.artifact, `${endpoints.home}/releases/${config.releaseName}`, "live release artifact URL drifted");
    assertPublicKeyMatches(discovery.install?.release?.publicKey, config.releasePublicKey, "live release key");
    assertPublicKeyMatches(discovery.advisoriesPublicKey, config.advisoryPublicKey, "live advisory key");
    assertEqual(discovery.transparency?.logId, config.logId, "live transparency log ID drifted");
    assertEqual(discovery.witness?.did, config.witnessDid, "live witness DID drifted");
    return {
      release: config.version,
      witness: config.witnessDid
    };
  });

  await runCheck(checks, "release_artifacts", async () => {
    const discovery = requireState(state.discovery, "discovery manifest");
    const installBytes = await fetchBytes(discovery.install?.script, timedFetch);
    assertEqual(sha256(installBytes), config.installerSha256, "live installer bytes drifted");
    const releaseBytes = await fetchBytes(discovery.install?.release?.artifact, timedFetch);
    assertEqual(sha256(releaseBytes), config.releaseSha256, "live release bytes drifted");
    await verifyReleaseSignatureBytes({
      artifactName: config.releaseName,
      publicKeyInfo: config.releasePublicKey,
      releaseBytes,
      signature: await fetchJson(discovery.install?.release?.signature, timedFetch)
    });
    return {
      release: config.releaseName
    };
  });

  await runCheck(checks, "registry_verified", async () => {
    state.registry = await fetchJson(endpoints.registry, timedFetch);
    if (!Array.isArray(state.registry.packages) || state.registry.packages.length === 0) {
      throw new Error("registry has no packages");
    }
    const badPackage = state.registry.packages.find((pkg) => !isPublicVerifiedPackage(pkg, config));
    if (badPackage) {
      throw new Error(`registry package is not public verified/100: ${badPackage.name ?? badPackage.canonical ?? "unknown"}`);
    }
    return { packages: state.registry.packages.length };
  });

  await runCheck(checks, "advisory_feed_signature", async () => {
    const feedBytes = await fetchBytes(endpoints.advisories, timedFetch);
    const feed = JSON.parse(feedBytes.toString("utf8"));
    validateAdvisoryFeed(feed, now);
    await verifyAdvisorySignatureBytes({
      feedBytes,
      publicKeyInfo: config.advisoryPublicKey,
      signature: await fetchJson(endpoints.advisoriesSignature, timedFetch)
    });
    return {
      advisories: feed.advisories.length,
      expiresAt: feed.expiresAt
    };
  });

  await runCheck(checks, "transparency_checkpoint", async () => {
    state.checkpoint = await fetchJson(endpoints.checkpoint, timedFetch);
    assertEqual(state.checkpoint.formatVersion, 1, "checkpoint format mismatch");
    assertEqual(state.checkpoint.logId, config.logId, "checkpoint log ID drifted");
    assertTimestampNotFuture(state.checkpoint.generatedAt, now, "checkpoint");
    if (!HEX_SHA256.test(state.checkpoint.rootHash ?? "")) {
      throw new Error("checkpoint root hash is invalid");
    }
    if (!Number.isInteger(state.checkpoint.treeSize) || state.checkpoint.treeSize < 1) {
      throw new Error("checkpoint tree size is invalid");
    }
    for (const pkg of state.registry?.packages ?? []) {
      assertEqual(pkg.proof?.rootHash, state.checkpoint.rootHash, `registry proof root drifted for ${pkg.name ?? pkg.canonical}`);
      assertEqual(pkg.proof?.treeSize, state.checkpoint.treeSize, `registry proof tree size drifted for ${pkg.name ?? pkg.canonical}`);
    }
    return {
      generatedAt: state.checkpoint.generatedAt,
      rootHash: state.checkpoint.rootHash,
      treeSize: state.checkpoint.treeSize
    };
  });

  await runCheck(checks, "witness_health", async () => {
    state.witnessHealth = await fetchJson(endpoints.witnessHealth, timedFetch);
    if (state.witnessHealth.ok !== true) {
      throw new Error("witness health is not ok");
    }
    if (state.witnessHealth.lastError !== null) {
      throw new Error(`witness has lastError: ${state.witnessHealth.lastError}`);
    }
    assertFresh(state.witnessHealth.lastRunAt, now, config.witnessMaxAgeMs, "witness");
    assertEqual(state.witnessHealth.lastWitness?.witness, config.witnessDid, "witness DID drifted");
    if (state.checkpoint) {
      assertEqual(state.witnessHealth.lastWitness?.rootHash, state.checkpoint.rootHash, "witness root drifted");
      assertEqual(state.witnessHealth.lastWitness?.treeSize, state.checkpoint.treeSize, "witness tree size drifted");
    }
    return {
      lastRunAt: state.witnessHealth.lastRunAt,
      witness: state.witnessHealth.lastWitness?.witness
    };
  });

  await runCheck(checks, "witness_run_auth", async () => {
    const response = await timedFetch(endpoints.witnessRun, { method: "POST", redirect: "error" });
    if (![401, 403, 503].includes(response.status)) {
      throw new Error(`witness /run accepted unauthenticated request: ${response.status}`);
    }
    return {
      status: response.status
    };
  });

  await runCheck(checks, "node_health", async () => {
    const payload = await fetchJson(endpoints.nodeHealth, timedFetch);
    assertEqual(payload.status, "ok", "node health status mismatch");
    return { url: endpoints.nodeHealth };
  });

  await runCheck(checks, "receive_pack_auth", async () => {
    const result = await assertUnauthenticatedReceivePackBlocked({
      baseUrl: endpoints.nodeUrl,
      fetchFn: timedFetch
    });
    return {
      probes: result.probes.map((probe) => ({
        bytes: probe.bytes,
        label: probe.label,
        status: probe.status
      }))
    };
  });

  const summary = {
    fail: checks.filter((check) => check.status === "fail").length,
    pass: checks.filter((check) => check.status === "pass").length,
    total: checks.length
  };

  return {
    checkedAt: new Date(now).toISOString(),
    checks,
    formatVersion: 1,
    ok: summary.fail === 0,
    summary,
    type: "dev.nipmod.prod-synthetic-monitor.v1"
  };
}

async function readExpectedConfig(rootDir) {
  const version = JSON.parse(await readFile(join(rootDir, "nipmod", "package.json"), "utf8")).version;
  const releaseName = `nipmod-${version}.tgz`;
  return {
    advisoryPublicKey: JSON.parse(await readFile(join(rootDir, "tools", "advisory-signing-public-key.json"), "utf8")),
    checkpointMaxAgeMs: DEFAULT_CHECKPOINT_MAX_AGE_MS,
    fetchTimeoutMs: DEFAULT_FETCH_TIMEOUT_MS,
    installerSha256: await readSha(join(rootDir, "site", "public", "install.sh.sha256")),
    logId: JSON.parse(await readFile(join(rootDir, "site", "public", "transparency", "checkpoint.json"), "utf8")).logId,
    releaseName,
    releasePublicKey: JSON.parse(await readFile(join(rootDir, "tools", "release-signing-public-key.json"), "utf8")),
    releaseSha256: await readSha(join(rootDir, "site", "public", "releases", `${releaseName}.sha256`)),
    version,
    witnessDid: JSON.parse(await readFile(join(rootDir, "site", "public", ".well-known", "nipmod.json"), "utf8")).witness.did,
    witnessMaxAgeMs: DEFAULT_WITNESS_MAX_AGE_MS
  };
}

async function runCheck(checks, name, fn) {
  const startedAt = Date.now();
  try {
    checks.push({
      data: await fn(),
      durationMs: Date.now() - startedAt,
      name,
      status: "pass"
    });
  } catch (error) {
    checks.push({
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      name,
      status: "fail"
    });
  }
}

async function fetchJson(url, fetchFn, init) {
  const response = await fetchFn(url, init);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json();
}

async function fetchText(url, fetchFn) {
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.text();
}

async function fetchBytes(url, fetchFn) {
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function readSha(path) {
  const digest = (await readFile(path, "utf8")).trim().split(/\s+/)[0];
  if (!HEX_SHA256.test(digest)) {
    throw new Error(`${path} has invalid sha256`);
  }
  return digest;
}

async function verifyAdvisorySignatureBytes({ feedBytes, publicKeyInfo, signature }) {
  if (signature?.type !== "dev.nipmod.advisory.signature.v1") {
    throw new Error("advisory signature type mismatch");
  }
  if (signature.algorithm !== "Ed25519") {
    throw new Error("advisory signature algorithm mismatch");
  }
  if (signature.artifact !== "advisories.json") {
    throw new Error("advisory signature artifact mismatch");
  }
  if (signature.publicKeySpkiSha256 !== publicKeyInfo.publicKeySpkiSha256) {
    throw new Error("advisory signature key drifted");
  }
  const publicKey = createPublicKey({
    format: "der",
    key: Buffer.from(publicKeyInfo.publicKeySpkiBase64, "base64"),
    type: "spki"
  });
  if (!verify(null, feedBytes, publicKey, Buffer.from(signature.signatureBase64, "base64"))) {
    throw new Error("advisory feed signature verification failed");
  }
}

async function verifyReleaseSignatureBytes({ artifactName, publicKeyInfo, releaseBytes, signature }) {
  if (signature?.type !== "dev.nipmod.release.signature.v1") {
    throw new Error("release signature type mismatch");
  }
  if (signature.algorithm !== "Ed25519") {
    throw new Error("release signature algorithm mismatch");
  }
  if (signature.artifact !== artifactName) {
    throw new Error("release signature artifact mismatch");
  }
  if (signature.publicKeySpkiSha256 !== publicKeyInfo.publicKeySpkiSha256) {
    throw new Error("release signature key drifted");
  }
  const publicKey = createPublicKey({
    format: "der",
    key: Buffer.from(publicKeyInfo.publicKeySpkiBase64, "base64"),
    type: "spki"
  });
  if (!verify(null, releaseBytes, publicKey, Buffer.from(signature.signatureBase64, "base64"))) {
    throw new Error("release artifact signature verification failed");
  }
}

function assertFresh(timestamp, now, maxAgeMs, label) {
  const parsed = assertTimestampNotFuture(timestamp, now, label);
  const ageMs = now - parsed;
  if (ageMs > maxAgeMs) {
    throw new Error(`${label} is stale: ${Math.round(ageMs / 1000)}s old`);
  }
}

function assertTimestampNotFuture(timestamp, now, label) {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} timestamp is invalid`);
  }
  if (parsed > now + 5 * 60 * 1000) {
    throw new Error(`${label} timestamp is in the future`);
  }
  return parsed;
}

function requireState(value, label) {
  if (!value) {
    throw new Error(`${label} was not available`);
  }
  return value;
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertIncludes(text, marker, message) {
  if (!text.includes(marker)) {
    throw new Error(message);
  }
}

function assertNoSecretLeak(value, label) {
  const text = JSON.stringify(value);
  if (/Bearer\s+[A-Za-z0-9._~+/=-]{20,}|BEGIN PRIVATE KEY|NIPMOD_SCOUT_NOTIFY_IDENTITY|TOKEN=|SECRET=/i.test(text)) {
    throw new Error(`${label} leaks notification secret material`);
  }
}

function assertPublicKeyMatches(discoveredKey, expectedKey, label) {
  if (!discoveredKey?.publicKeySpkiBase64) {
    throw new Error(`${label} is missing key material`);
  }
  const fingerprintClaim = discoveredKey.spkiSha256 ?? discoveredKey.publicKeySpkiSha256;
  const actualFingerprint = sha256(Buffer.from(discoveredKey.publicKeySpkiBase64, "base64"));
  assertEqual(fingerprintClaim, actualFingerprint, `${label} fingerprint claim mismatch`);
  assertEqual(actualFingerprint, expectedKey.publicKeySpkiSha256, `${label} fingerprint drifted`);
  assertEqual(discoveredKey.publicKeySpkiBase64, expectedKey.publicKeySpkiBase64, `${label} material drifted`);
}

function isPublicVerifiedPackage(pkg, config) {
  return (
    pkg &&
    typeof pkg === "object" &&
    typeof pkg.canonical === "string" &&
    HEX_SHA256.test(pkg.digest ?? "") &&
    SOURCE_COMMIT.test(pkg.sourceCommit ?? "") &&
    SOURCE_TAG.test(pkg.sourceTag ?? "") &&
    pkg.proof?.rootHash &&
    HEX_SHA256.test(pkg.proof.rootHash) &&
    Number.isInteger(pkg.proof?.treeSize) &&
    pkg.proof.treeSize > 0 &&
    Array.isArray(pkg.proof?.witnesses) &&
    pkg.proof.witnesses.includes(config.witnessDid) &&
    pkg.trust?.level === "verified" &&
    pkg.trust?.score === 100 &&
    pkg.trust?.evidence?.releaseEventSigned === true &&
    pkg.trust?.evidence?.sourceProvenanceVerified === true &&
    pkg.trust?.evidence?.transparencyLogIncluded === true &&
    pkg.trust?.evidence?.transparencyLogVerified === true &&
    !isInternalArtifact(pkg)
  );
}

function isInternalArtifact(pkg) {
  return [pkg?.name, pkg?.canonical, pkg?.description, pkg?.repo]
    .filter((value) => typeof value === "string")
    .some((value) => value.toLowerCase().includes("probe"));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function createTimedFetch(fetchFn, timeoutMs) {
  return (url, init = {}) =>
    fetchFn(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(timeoutMs)
    });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await runSyntheticMonitor();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}
