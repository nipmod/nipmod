#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifySignedTreeHead } from "../nipmod/dist/transparency.js";

const DEFAULT_ENDPOINTS = {
  checkpoint: "https://nipmod.com/transparency/checkpoint.json",
  discovery: "https://nipmod.com/.well-known/nipmod.json",
  nodeHealth: "https://node.nipmod.com/health",
  nodeUrl: "https://node.nipmod.com",
  registry: "https://nipmod.com/registry/packages.json",
  witnessHealth: "https://nipmod-witness.fly.dev/health"
};
const FETCH_TIMEOUT_MS = 10_000;
const MAX_BUNDLE_BYTES = 10 * 1024 * 1024;
const HEX_SHA256 = /^[a-f0-9]{64}$/;
const SOURCE_COMMIT = /^[a-f0-9]{40}$/;
const SOURCE_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export async function runRestoreDrill({
  endpoints = DEFAULT_ENDPOINTS,
  expected,
  fetchFn = fetch,
  gitLsRemoteFn = gitLsRemote,
  rootDir = resolve(import.meta.dirname, "..")
} = {}) {
  const resolvedEndpoints = { ...DEFAULT_ENDPOINTS, ...endpoints };
  const config = expected ?? (await readExpectedConfig(rootDir));
  const timedFetch = createTimedFetch(fetchFn, FETCH_TIMEOUT_MS);
  const state = {};
  const checks = [];

  await runCheck(checks, "discovery_restore_pins", async () => {
    state.discovery = await fetchJson(resolvedEndpoints.discovery, timedFetch);
    assertEqual(state.discovery.type, "dev.nipmod.discovery.v1", "discovery type mismatch");
    assertEqual(state.discovery.transparency?.logId, config.logId, "log ID drifted");
    assertEqual(state.discovery.witness?.did, config.witnessDid, "witness DID drifted");
    assertEqual(state.discovery.registry?.url, resolvedEndpoints.registry, "registry URL drifted");
    assertEqual(state.discovery.node?.health, resolvedEndpoints.nodeHealth, "node health URL drifted");
    assertEqual(state.discovery.node?.url, resolvedEndpoints.nodeUrl, "node URL drifted");
    if (config.emptyPublicArchive) {
      assertEqual(
        state.discovery.transparency?.status,
        "pending_first_public_package",
        "empty archive transparency status drifted"
      );
      if (state.discovery.transparency?.checkpoint !== undefined) {
        throw new Error("empty archive discovery must not expose a missing checkpoint URL");
      }
    } else {
      assertEqual(state.discovery.transparency?.checkpoint, resolvedEndpoints.checkpoint, "checkpoint URL drifted");
    }
    assertEqual(state.discovery.witness?.health, resolvedEndpoints.witnessHealth, "witness health URL drifted");
    return {
      emptyPublicArchive: Boolean(config.emptyPublicArchive),
      logId: config.logId,
      witness: config.witnessDid
    };
  });

  await runCheck(checks, "registry_snapshot", async () => {
    state.registry = await fetchJson(resolvedEndpoints.registry, timedFetch);
    if (!Array.isArray(state.registry.packages)) {
      throw new Error("registry snapshot packages must be an array");
    }
    if (state.registry.packages.length === 0) {
      if (!config.emptyPublicArchive) {
        throw new Error("registry snapshot has no packages");
      }
      state.emptyPublicArchive = true;
      return {
        mode: "empty-public-archive",
        packages: 0
      };
    }
    if (config.emptyPublicArchive) {
      throw new Error("empty archive config does not allow public packages");
    }
    state.pkg = state.registry.packages.find((pkg) => isRecoverablePackage(pkg, config));
    if (!state.pkg) {
      throw new Error("registry snapshot has no recoverable verified package");
    }
    assertPackageUrls(state.pkg, resolvedEndpoints.nodeUrl);
    state.checkpoint = await fetchJson(resolvedEndpoints.checkpoint, timedFetch);
    assertSignedCheckpoint(state.checkpoint, config);
    assertEqual(state.checkpoint.logId, config.logId, "checkpoint log ID drifted");
    assertEqual(state.pkg.proof?.rootHash, state.checkpoint.rootHash, "package proof root drifted");
    assertEqual(state.pkg.proof?.treeSize, state.checkpoint.treeSize, "package proof tree size drifted");
    return {
      package: `${state.pkg.canonical}@${state.pkg.version}`,
      packages: state.registry.packages.length
    };
  });

  await runCheck(checks, "witness_continuity", async () => {
    state.witness = await fetchJson(resolvedEndpoints.witnessHealth, timedFetch);
    if (state.witness.ok !== true) {
      throw new Error("witness is not healthy");
    }
    if (state.emptyPublicArchive) {
      return {
        mode: "empty-public-archive",
        witness: config.witnessDid
      };
    }
    if (state.witness.lastError !== null) {
      throw new Error(`witness lastError is not clear: ${state.witness.lastError}`);
    }
    assertEqual(state.witness.lastWitness?.witness, config.witnessDid, "witness DID drifted");
    assertEqual(state.witness.lastWitness?.rootHash, state.checkpoint.rootHash, "witness root does not match checkpoint");
    assertEqual(state.witness.lastWitness?.treeSize, state.checkpoint.treeSize, "witness tree size does not match checkpoint");
    return {
      rootHash: state.witness.lastWitness.rootHash,
      treeSize: state.witness.lastWitness.treeSize,
      witness: state.witness.lastWitness.witness
    };
  });

  await runCheck(checks, "node_health", async () => {
    const health = await fetchJson(resolvedEndpoints.nodeHealth, timedFetch);
    assertEqual(health.status, "ok", "node health status mismatch");
    return { url: resolvedEndpoints.nodeHealth };
  });

  await runCheck(checks, "package_blob_restore", async () => {
    if (state.emptyPublicArchive) {
      return {
        mode: "empty-public-archive",
        skipped: "pending first public package"
      };
    }
    const bundleBytes = await fetchBytes(state.pkg.resolved, timedFetch, MAX_BUNDLE_BYTES);
    const digest = sha256(bundleBytes);
    assertEqual(digest, state.pkg.digest, "restored package blob digest mismatch");
    return {
      bytes: bundleBytes.length,
      digest
    };
  });

  await runCheck(checks, "git_ref_restore", async () => {
    if (state.emptyPublicArchive) {
      return {
        mode: "empty-public-archive",
        skipped: "pending first public package"
      };
    }
    const refs = parseLsRemote(await gitLsRemoteFn(state.pkg.cloneUrl));
    assertEqual(refs[`refs/tags/${state.pkg.sourceTag}`], state.pkg.sourceCommit, "source tag commit drifted");
    return {
      cloneUrl: state.pkg.cloneUrl,
      sourceCommit: state.pkg.sourceCommit,
      sourceTag: state.pkg.sourceTag
    };
  });

  const summary = {
    fail: checks.filter((check) => check.status === "fail").length,
    pass: checks.filter((check) => check.status === "pass").length,
    total: checks.length
  };

  return {
    checkedAt: new Date().toISOString(),
    checks,
    formatVersion: 1,
    mode: "non-destructive-live",
    ok: summary.fail === 0,
    summary,
    type: "dev.nipmod.restore-drill.v1"
  };
}

async function readExpectedConfig(rootDir) {
  const discovery = JSON.parse(await readFile(join(rootDir, "site", "public", ".well-known", "nipmod.json"), "utf8"));
  const registry = JSON.parse(await readFile(join(rootDir, "site", "public", "registry", "packages.json"), "utf8"));
  const packages = Array.isArray(registry.packages) ? registry.packages : [];
  let checkpoint = null;
  try {
    checkpoint = JSON.parse(await readFile(join(rootDir, "site", "public", "transparency", "checkpoint.json"), "utf8"));
  } catch (error) {
    if (packages.length > 0 || error?.code !== "ENOENT") {
      throw error;
    }
  }
  const logId = checkpoint?.logId ?? discovery.transparency?.logId;
  if (typeof logId !== "string" || !logId) {
    throw new Error("restore drill expected config has no transparency log ID");
  }
  return {
    emptyPublicArchive: packages.length === 0,
    logId,
    witnessDid: discovery.witness.did
  };
}

function isRecoverablePackage(pkg, config) {
  return (
    pkg &&
    typeof pkg === "object" &&
    typeof pkg.canonical === "string" &&
    typeof pkg.cloneUrl === "string" &&
    typeof pkg.resolved === "string" &&
    HEX_SHA256.test(pkg.digest ?? "") &&
    SOURCE_COMMIT.test(pkg.sourceCommit ?? "") &&
    SOURCE_TAG.test(pkg.sourceTag ?? "") &&
    HEX_SHA256.test(pkg.proof?.rootHash ?? "") &&
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

function assertPackageUrls(pkg, nodeUrl) {
  const node = new URL(nodeUrl);
  const cloneUrl = new URL(pkg.cloneUrl);
  const resolved = new URL(pkg.resolved);
  if (cloneUrl.origin !== node.origin || resolved.origin !== node.origin) {
    throw new Error(`package URLs must stay on ${node.origin}`);
  }
  const match = /^\/(?<owner>z[A-Za-z0-9]+)\/(?<repo>[a-z0-9][a-z0-9._-]*)\.git$/.exec(cloneUrl.pathname);
  if (!match?.groups) {
    throw new Error("cloneUrl does not match public Gitlawb path shape");
  }
  const expectedResolvedPrefix = `/api/v1/repos/${match.groups.owner}/${match.groups.repo}/blob/releases/`;
  if (!resolved.pathname.startsWith(expectedResolvedPrefix) || !resolved.pathname.endsWith("/bundle.nipmod")) {
    throw new Error("resolved bundle URL does not match public Gitlawb blob shape");
  }
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

async function fetchJson(url, fetchFn) {
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json();
}

async function fetchBytes(url, fetchFn, maxBytes) {
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  if (response.body && typeof response.body.getReader === "function") {
    return readStreamBytes(url, response.body, maxBytes);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (maxBytes && bytes.length > maxBytes) {
    throw new Error(`${url} exceeded ${maxBytes} bytes`);
  }
  return bytes;
}

async function readStreamBytes(url, body, maxBytes) {
  const reader = body.getReader();
  const chunks = [];
  let length = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      return Buffer.concat(chunks, length);
    }
    const chunk = Buffer.from(value);
    length += chunk.length;
    if (maxBytes && length > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // Best effort only; the size check has already failed closed.
      }
      throw new Error(`${url} exceeded ${maxBytes} bytes`);
    }
    chunks.push(chunk);
  }
}

function parseLsRemote(output) {
  const refs = {};
  for (const line of output.trim().split(/\n+/)) {
    const [commit, ref] = line.split(/\s+/);
    if (SOURCE_COMMIT.test(commit) && ref) {
      refs[ref] = commit;
    }
  }
  return refs;
}

function gitLsRemote(url) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("git", ["ls-remote", url], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`git ls-remote timed out for ${url}`));
    }, FETCH_TIMEOUT_MS);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`git ls-remote failed for ${url}: ${stderr.trim()}`));
        return;
      }
      resolvePromise(stdout);
    });
  });
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertSignedCheckpoint(checkpoint, config) {
  let verified = false;
  try {
    verified = verifySignedTreeHead(checkpoint, [config.logId]);
  } catch {
    verified = false;
  }
  if (!verified) {
    throw new Error("checkpoint signature verification failed");
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isInternalArtifact(pkg) {
  return [pkg?.name, pkg?.canonical, pkg?.description, pkg?.repo]
    .filter((value) => typeof value === "string")
    .some((value) => value.toLowerCase().includes("probe"));
}

function createTimedFetch(fetchFn, timeoutMs) {
  return (url, init = {}) =>
    fetchFn(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(timeoutMs)
    });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await runRestoreDrill();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}
