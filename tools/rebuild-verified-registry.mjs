#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DEFAULT_ENV_PATH = join(ROOT, "tools", "verified-registry.env");
const REGISTRY_PATH = join(ROOT, "site", "app", "registry-data.json");
const CHECKPOINT_PATH = join(ROOT, "site", "public", "transparency", "checkpoint.json");

export function parseEnvFile(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separator = line.indexOf("=");
    if (separator <= 0) {
      throw new Error(`invalid env line: ${rawLine}`);
    }
    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    if (!/^[A-Z0-9_]+$/.test(key)) {
      throw new Error(`invalid env key: ${key}`);
    }
    env[key] = stripEnvQuotes(rawValue);
  }
  return env;
}

export function validateVerifiedRegistryEnv(env) {
  const source = requiredEnv(env, "NIPMOD_WITNESS_STATEMENTS_SOURCE");
  const allowedLogIds = didList(requiredEnv(env, "NIPMOD_ALLOWED_LOG_IDS"));
  const allowedWitnesses = didList(requiredEnv(env, "NIPMOD_ALLOWED_WITNESSES"));
  if (!/^https:\/\//.test(source)) {
    throw new Error("NIPMOD_WITNESS_STATEMENTS_SOURCE must be https");
  }
  return { allowedLogIds, allowedWitnesses, source };
}

export function assertWitnessMatchesCheckpoint({ allowedLogIds, allowedWitnesses, checkpoint, witnessPayload }) {
  if (
    !witnessPayload ||
    witnessPayload.type !== "dev.nipmod.transparency.witness-statements.v1" ||
    !Array.isArray(witnessPayload.statements)
  ) {
    throw new Error("witness source did not return witness statements");
  }
  if (!checkpoint || typeof checkpoint.rootHash !== "string" || typeof checkpoint.logId !== "string") {
    throw new Error("checkpoint is invalid");
  }
  if (!allowedLogIds.includes(checkpoint.logId)) {
    throw new Error(`checkpoint log id is not pinned: ${checkpoint.logId}`);
  }

  const statement = witnessPayload.statements.find((candidate) => allowedWitnesses.includes(candidate?.witness));
  if (!statement) {
    throw new Error("no pinned witness statement found");
  }
  if (statement.treeHead?.logId !== checkpoint.logId) {
    throw new Error("witness log id does not match checkpoint");
  }
  if (statement.treeHead?.rootHash !== checkpoint.rootHash) {
    throw new Error("witness root hash does not match checkpoint");
  }
  if (statement.treeHead?.treeSize !== checkpoint.treeSize) {
    throw new Error("witness tree size does not match checkpoint");
  }
  return statement;
}

export function assertVerifiedRegistry(index, { allowedWitnesses }) {
  if (!index || !Array.isArray(index.packages)) {
    throw new Error("registry packages must be an array");
  }
  if (index.packages.length === 0) {
    return;
  }
  assertNoVerifiedTyposquats(index.packages);
  for (const pkg of index.packages) {
    const evidence = pkg?.trust?.evidence;
    if (!evidence?.transparencyLogIncluded) {
      throw new Error(`${pkg?.canonical ?? "package"} is missing transparency inclusion`);
    }
    if (!evidence.transparencyLogVerified) {
      throw new Error(`${pkg?.canonical ?? "package"} is not verified by an external witness`);
    }
    if (!pkg?.proof?.witnesses?.some((witness) => allowedWitnesses.includes(witness))) {
      throw new Error(`${pkg?.canonical ?? "package"} does not reference a pinned witness`);
    }
  }
}

function assertNoVerifiedTyposquats(packages) {
  const seen = new Map();
  for (const pkg of packages) {
    if (pkg?.trust?.level !== "verified" || pkg?.trust?.score !== 100 || typeof pkg?.name !== "string") {
      continue;
    }
    const skeleton = packageNameSkeleton(pkg.name);
    const existing = seen.get(skeleton);
    if (existing && existing.canonical !== pkg.canonical) {
      throw new Error(`verified typosquat-confusable package names: ${existing.name} and ${pkg.name}`);
    }
    seen.set(skeleton, { canonical: pkg.canonical, name: pkg.name });
  }
}

function packageNameSkeleton(name) {
  return name
    .toLowerCase()
    .replaceAll("0", "o")
    .replaceAll("1", "l")
    .replaceAll("3", "e")
    .replaceAll("5", "s")
    .replaceAll("vv", "w")
    .replace(/[^a-z0-9]/g, "");
}

export async function rebuildVerifiedRegistry({ envPath = DEFAULT_ENV_PATH, fetchFn = fetch } = {}) {
  const fileEnv = parseEnvFile(await readFile(envPath, "utf8"));
  const verifiedEnv = validateVerifiedRegistryEnv(fileEnv);
  const child = spawnSync(process.execPath, [join(ROOT, "tools", "build-package-index.mjs")], {
    cwd: ROOT,
    env: { ...process.env, ...fileEnv },
    encoding: "utf8"
  });
  if (child.status !== 0) {
    throw new Error(child.stderr.trim() || child.stdout.trim() || "verified registry rebuild failed");
  }

  const [checkpoint, index, witnessPayload] = await Promise.all([
    readJsonFile(CHECKPOINT_PATH),
    readJsonFile(REGISTRY_PATH),
    fetchJson(verifiedEnv.source, fetchFn)
  ]);
  const statement = assertWitnessMatchesCheckpoint({
    allowedLogIds: verifiedEnv.allowedLogIds,
    allowedWitnesses: verifiedEnv.allowedWitnesses,
    checkpoint,
    witnessPayload
  });
  assertVerifiedRegistry(index, { allowedWitnesses: verifiedEnv.allowedWitnesses });
  return { index, statement, stdout: child.stdout.trim() };
}

async function fetchJson(url, fetchFn) {
  const response = await fetchFn(url, {
    redirect: "error",
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) {
    throw new Error(`failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
}

async function readJsonFile(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function didList(value) {
  const values = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (values.length === 0) {
    throw new Error("expected at least one DID");
  }
  for (const value of values) {
    if (!value.startsWith("did:key:z")) {
      throw new Error(`invalid did:key value: ${value}`);
    }
  }
  return values;
}

function requiredEnv(env, key) {
  const value = env[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function stripEnvQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  rebuildVerifiedRegistry()
    .then(({ index, statement, stdout }) => {
      if (stdout) {
        console.log(stdout);
      }
      console.log(
        `verified ${index.packages.length} packages with ${statement.witness} at ${statement.treeHead.rootHash}`
      );
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
