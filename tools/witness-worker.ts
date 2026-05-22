#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DEFAULT_REGISTRY_URL = "https://nipmod.com";
const DEFAULT_IDENTITY_PATH = join(ROOT, ".nipmod", "transparency-witness-identity.json");
const DEFAULT_OUTPUT_PATH = join(ROOT, ".nipmod", "witness-statements.json");
const DEFAULT_STATE_PATH = join(ROOT, ".nipmod", "witness-worker-state.json");

export function evaluateWitnessRequest({ allowedLogIds, identity, log, request, state = null, transparency }) {
  const checkpoint = request?.checkpoint;
  if (!checkpoint || request.type !== "dev.nipmod.transparency.witness-request.v1") {
    throw new Error("witness request is invalid");
  }
  if (!Array.isArray(allowedLogIds) || allowedLogIds.length === 0) {
    throw new Error("witness allowed log ids are required");
  }
  if (!allowedLogIds.includes(checkpoint.logId)) {
    throw new Error("witness request log id is not allowed");
  }
  if (canonicalJson(checkpointPayload(checkpoint)) !== canonicalJson(checkpointPayload(log?.treeHead))) {
    throw new Error("witness request checkpoint does not match log tree head");
  }
  if (!transparency.verifyTransparencyLog(log, allowedLogIds)) {
    throw new Error("transparency log verification failed");
  }
  if (identity.did === checkpoint.logId) {
    throw new Error("witness identity must differ from transparency log identity");
  }

  const leafHashes = log.entries.map((entry) => entry.leafHash);
  assertAppendOnly({
    bootstrap: request.bootstrap === true,
    leafHashes,
    previousCheckpoint: request.previousCheckpoint ?? null,
    state,
    treeHead: checkpoint
  });

  const statement = transparency.signWitnessStatement(checkpoint, identity);
  return {
    state: {
      formatVersion: 1,
      leafHashes,
      treeHead: checkpoint,
      type: "dev.nipmod.transparency.witness-state.v1"
    },
    statement
  };
}

export async function runWitnessWorker(options = {}) {
  const registryUrl = options.registryUrl ?? argValue("--registry") ?? process.env.NIPMOD_REGISTRY_URL ?? DEFAULT_REGISTRY_URL;
  const requestSource =
    options.requestSource ??
    argValue("--request") ??
    process.env.NIPMOD_WITNESS_REQUEST_SOURCE ??
    new URL("/transparency/witness-request.json", registryUrl).href;
  const outputPath = options.outputPath ?? argValue("--out") ?? process.env.NIPMOD_WITNESS_STATEMENTS_PATH ?? DEFAULT_OUTPUT_PATH;
  const statePath = options.statePath ?? argValue("--state") ?? process.env.NIPMOD_WITNESS_STATE_PATH ?? DEFAULT_STATE_PATH;
  const identityPath = options.identityPath ?? argValue("--identity") ?? process.env.NIPMOD_WITNESS_IDENTITY_PATH ?? DEFAULT_IDENTITY_PATH;
  const fetchFn = options.fetchFn ?? fetch;
  const transparency = options.transparency ?? (await loadTransparencyModule());
  const request = options.request ?? (await readJsonSource(requestSource, { fetchFn }));
  if (options.bootstrap === true || argFlag("--bootstrap") || process.env.NIPMOD_WITNESS_BOOTSTRAP === "1") {
    request.bootstrap = true;
  }
  const logSource =
    options.logSource ?? argValue("--log") ?? process.env.NIPMOD_WITNESS_LOG_SOURCE ?? resolveLogSource(request, requestSource, registryUrl);
  const log = options.log ?? (await readJsonSource(logSource, { fetchFn }));
  const state = options.state ?? (await readOptionalJson(statePath));
  const identity = options.identity ?? (await loadIdentity(identityPath));
  const allowedLogIds = parseDidList(
    options.allowedLogIds ?? argValue("--allowed-log-ids") ?? process.env.NIPMOD_WITNESS_ALLOWED_LOG_IDS
  );
  const result = evaluateWitnessRequest({ allowedLogIds, identity, log, request, state, transparency });
  const payload = {
    formatVersion: 1,
    statements: [result.statement],
    type: "dev.nipmod.transparency.witness-statements.v1"
  };

  if (options.write !== false) {
    await mkdir(dirname(outputPath), { recursive: true });
    await mkdir(dirname(statePath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
    await writeFile(statePath, `${JSON.stringify(result.state, null, 2)}\n`, { mode: 0o600 });
  }

  return {
    outputPath,
    payload,
    state: result.state,
    statePath
  };
}

function assertAppendOnly({ bootstrap, leafHashes, previousCheckpoint, state, treeHead }) {
  if (!state) {
    if (!bootstrap) {
      throw new Error("witness worker has no state; explicit bootstrap is required");
    }
    return;
  }
  if (state.type !== "dev.nipmod.transparency.witness-state.v1" || !Array.isArray(state.leafHashes)) {
    throw new Error("witness worker state is invalid");
  }
  if (state.treeHead.logId !== treeHead.logId) {
    throw new Error("transparency log identity changed");
  }
  if (
    canonicalJson(checkpointPayload(state.treeHead)) === canonicalJson(checkpointPayload(treeHead)) &&
    canonicalJson(state.leafHashes) === canonicalJson(leafHashes)
  ) {
    return;
  }
  if (previousCheckpoint && canonicalJson(checkpointPayload(previousCheckpoint)) !== canonicalJson(checkpointPayload(state.treeHead))) {
    throw new Error("witness request previous checkpoint does not match worker state");
  }
  if (treeHead.treeSize < state.treeHead.treeSize) {
    throw new Error("transparency log shrank");
  }
  const prefix = leafHashes.slice(0, state.leafHashes.length);
  if (canonicalJson(prefix) !== canonicalJson(state.leafHashes)) {
    throw new Error("transparency log is not append-only");
  }
}

function resolveLogSource(request, requestSource, registryUrl) {
  if (typeof request?.logUrl !== "string") {
    return new URL("/transparency/log.json", registryUrl).href;
  }
  if (/^https?:\/\//.test(request.logUrl)) {
    return request.logUrl;
  }
  if (/^https?:\/\//.test(requestSource)) {
    return new URL(request.logUrl, requestSource).href;
  }
  if (request.logUrl.startsWith("/")) {
    return join(ROOT, "site", "public", request.logUrl);
  }
  return join(dirname(requestSource), request.logUrl);
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }
  const value = process.argv[index + 1];
  if (!value) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function argFlag(name) {
  return process.argv.includes(name);
}

function parseDidList(value) {
  if (!value) {
    return [];
  }
  const values = Array.isArray(value)
    ? value
    : String(value)
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
  for (const did of values) {
    if (typeof did !== "string" || !did.startsWith("did:key:z")) {
      throw new Error(`invalid witness log id: ${did}`);
    }
  }
  return values;
}

async function readJsonSource(source, { fetchFn }) {
  if (/^https?:\/\//.test(source)) {
    const response = await fetchFn(source, {
      redirect: "error",
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) {
      throw new Error(`fetch failed ${response.status} at ${source}`);
    }
    return JSON.parse(await response.text());
  }
  return JSON.parse(await readFile(source, "utf8"));
}

async function readOptionalJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

async function loadIdentity(identityPath) {
  if (process.env.NIPMOD_WITNESS_IDENTITY_JSON) {
    return validateIdentity(JSON.parse(process.env.NIPMOD_WITNESS_IDENTITY_JSON));
  }
  try {
    return validateIdentity(JSON.parse(await readFile(identityPath, "utf8")));
  } catch (error) {
    if (!isNotFound(error)) {
      throw error;
    }
  }

  const identityModule = await loadIdentityModule();
  const identity = identityModule.generateIdentity();
  await mkdir(dirname(identityPath), { recursive: true });
  await writeFile(identityPath, `${JSON.stringify(identity, null, 2)}\n`, { mode: 0o600 });
  return identity;
}

async function loadTransparencyModule() {
  const transparencyPath = join(ROOT, "nipmod", "dist", "transparency.js");
  await ensureNipmodArtifact(transparencyPath);
  return import(pathToFileURL(transparencyPath).href);
}

async function loadIdentityModule() {
  const identityPath = join(ROOT, "nipmod", "dist", "identity.js");
  await ensureNipmodArtifact(identityPath);
  return import(pathToFileURL(identityPath).href);
}

function validateIdentity(value) {
  if (
    !value ||
    typeof value !== "object" ||
    typeof value.did !== "string" ||
    typeof value.privateKeyPem !== "string" ||
    typeof value.publicKeyPem !== "string"
  ) {
    throw new Error("witness identity is invalid");
  }
  return value;
}

function checkpointPayload(treeHead) {
  return {
    formatVersion: treeHead?.formatVersion,
    generatedAt: treeHead?.generatedAt,
    logId: treeHead?.logId,
    rootHash: treeHead?.rootHash,
    treeSize: treeHead?.treeSize
  };
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function isNotFound(error) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

let nipmodBuilt = false;

async function ensureNipmodArtifact(artifactPath) {
  try {
    await access(artifactPath);
    return;
  } catch (error) {
    if (!isNotFound(error)) {
      throw error;
    }
  }

  ensureNipmodBuilt();
  await access(artifactPath);
}

function ensureNipmodBuilt() {
  if (nipmodBuilt) {
    return;
  }
  const result = spawnSync("pnpm", ["--dir", join(ROOT, "nipmod"), "build"], {
    stdio: "inherit"
  });
  if (result.status !== 0) {
    throw new Error("failed to build nipmod before running witness worker");
  }
  nipmodBuilt = true;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runWitnessWorker()
    .then((result) => {
      const statement = result.payload.statements[0];
      console.log(`witnessed ${statement.treeHead.rootHash} as ${statement.witness}`);
      console.log(`wrote ${result.outputPath}`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
