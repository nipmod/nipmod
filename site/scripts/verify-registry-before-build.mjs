#!/usr/bin/env node
import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SITE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const REGISTRY_PATH = join(SITE_ROOT, "app", "registry-data.json");
const CHECKPOINT_PATH = join(SITE_ROOT, "public", "transparency", "checkpoint.json");
const TRANSPARENCY_LOG_PATH = join(SITE_ROOT, "public", "transparency", "log.json");
const WITNESS_SOURCE = "https://nipmod-witness.fly.dev/witness-statements.json";
const ALLOWED_LOG_IDS = ["did:key:z6MkugeJcjgGhG1EpUMhhJ1Q5SoYn65T4cmiuBFE8E82TMyk"];
const ALLOWED_WITNESSES = ["did:key:z6Mkv8WH5QeiZU1sJwGrCs8xe35AiH4gMfAy86zFMiEkewWJ"];
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ED25519_MULTICODEC = Buffer.from([0xed, 0x01]);
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const TRANSPARENCY_LEAF_CONTEXT = "nipmod-transparency-leaf-v1";
const TRANSPARENCY_NODE_CONTEXT = "nipmod-transparency-node-v1";
const TRANSPARENCY_STH_CONTEXT = "nipmod-transparency-sth-v1";
const TRANSPARENCY_WITNESS_CONTEXT = "nipmod-transparency-witness-v1";
const RELEASE_EVENT_SIGNATURE_CONTEXT = "nipmod-release-event-v1";
const BUNDLE_MEDIA_TYPE = "application/vnd.nipmod.bundle.v1+json";
const SOURCE_REF_LIMIT = 512 * 1024;
const TRUSTED_PACKAGE_ORIGINS = ["https://node.nipmod.com"];

export async function assertRegistryVerified({
  allowedLogIds = ALLOWED_LOG_IDS,
  allowedWitnesses = ALLOWED_WITNESSES,
  checkpoint,
  fetchFn = fetch,
  index,
  transparencyLog,
  witnessPayload
}) {
  if (!checkpoint || typeof checkpoint.logId !== "string" || typeof checkpoint.rootHash !== "string") {
    throw new Error("static transparency checkpoint is invalid");
  }
  if (!allowedLogIds.includes(checkpoint.logId)) {
    throw new Error(`checkpoint log id is not pinned: ${checkpoint.logId}`);
  }
  if (!verifySignedTreeHead(checkpoint, allowedLogIds)) {
    throw new Error("checkpoint signature is invalid");
  }
  if (
    !transparencyLog ||
    transparencyLog.formatVersion !== 1 ||
    !Array.isArray(transparencyLog.entries) ||
    canonicalJson(transparencyLog.treeHead) !== canonicalJson(checkpoint) ||
    !verifySignedTreeHead(transparencyLog.treeHead, allowedLogIds)
  ) {
    throw new Error("transparency log does not match checkpoint");
  }
  if (transparencyLog.entries.length !== checkpoint.treeSize) {
    throw new Error("transparency log tree size mismatch");
  }
  if (!index || !Array.isArray(index.packages) || index.packages.length === 0) {
    throw new Error("registry contains no packages");
  }
  const statement = matchingWitnessStatement(witnessPayload, allowedWitnesses);
  if (!verifyWitnessStatement(statement, checkpoint, allowedWitnesses)) {
    throw new Error("witness signature is invalid");
  }

  for (const pkg of index.packages) {
    const subject = `${pkg?.canonical ?? "package"}@${pkg?.version ?? "unknown"}`;
    const evidence = pkg?.trust?.evidence;
    if (!evidence?.transparencyLogIncluded) {
      throw new Error(`${subject} is missing transparency inclusion`);
    }
    if (!evidence.transparencyLogVerified) {
      throw new Error(`${subject} is not externally witnessed`);
    }
    if (!evidence.sourceProvenanceVerified) {
      throw new Error(`${subject} source provenance is not verified`);
    }
    if (!pkg?.proof?.witnesses?.some((witness) => allowedWitnesses.includes(witness))) {
      throw new Error(`${subject} does not reference a pinned witness`);
    }
    assertPackageTransparency(pkg, transparencyLog, checkpoint);
    await assertPackageSourceProvenance(pkg, fetchFn);
    await assertPackageCompatibilityReceipts(pkg);
  }
}

function matchingWitnessStatement(payload, allowedWitnesses) {
  if (
    !payload ||
    payload.type !== "dev.nipmod.transparency.witness-statements.v1" ||
    !Array.isArray(payload.statements)
  ) {
    throw new Error("witness source did not return witness statements");
  }
  const statement = payload.statements.find((candidate) => allowedWitnesses.includes(candidate?.witness));
  if (!statement) {
    throw new Error("no pinned witness statement found");
  }
  return statement;
}

function assertPackageTransparency(pkg, transparencyLog, checkpoint) {
  const subject = `${pkg.canonical}@${pkg.version}`;
  const entry = transparencyLog.entries.find((candidate) => `${candidate?.leaf?.package}@${candidate?.leaf?.version}` === subject);
  if (!entry || !verifyTransparencyEntry(entry, checkpoint)) {
    throw new Error(`${subject} transparency proof is invalid`);
  }
  if (entry.leaf.artifactSha256 !== pkg.artifactSha256 || entry.leaf.publisher !== pkg.publisher) {
    throw new Error(`${subject} transparency leaf does not match package`);
  }
  if (
    pkg.proof?.leafHash !== entry.leafHash ||
    pkg.proof?.rootHash !== checkpoint.rootHash ||
    pkg.proof?.treeSize !== checkpoint.treeSize
  ) {
    throw new Error(`${subject} proof metadata does not match checkpoint`);
  }
}

async function assertPackageSourceProvenance(pkg, fetchFn) {
  const subject = `${pkg.canonical}@${pkg.version}`;
  const expectedSourceRepo = `gitlawb://${pkg.publisher}/${pkg.repo}`;
  if (
    pkg.sourceTag !== `v${pkg.version}` ||
    !isGitCommitHash(pkg.sourceCommit) ||
    typeof pkg.sourceRepo !== "string" ||
    pkg.sourceRepo.length === 0
  ) {
    throw new Error(`${subject} source provenance metadata is invalid`);
  }

  const releaseEvent = await fetchJsonWith(fetchFn, releaseEventUrl(pkg), "release event");
  const signedRelease = verifySignedReleaseEvent(releaseEvent, {
    artifactPath: pkg.artifactPath,
    artifactSha256: pkg.artifactSha256,
    mediaType: BUNDLE_MEDIA_TYPE,
    package: pkg.canonical,
    publisher: pkg.publisher,
    sourceRepo: expectedSourceRepo,
    sourceTag: pkg.sourceTag,
    version: pkg.version
  });
  if (signedRelease.payload.source.commit !== undefined && signedRelease.payload.source.commit !== pkg.sourceCommit) {
    throw new Error(`${subject} release event source commit mismatch`);
  }

  const refs = parseGitInfoRefs(await fetchBytesWith(fetchFn, sourceRefsUrl(pkg), SOURCE_REF_LIMIT, "source refs"));
  const tagCommit = refs.get(`refs/tags/${pkg.sourceTag}`);
  if (tagCommit !== pkg.sourceCommit) {
    throw new Error(`${subject} source tag does not match pinned commit`);
  }
}

async function assertPackageCompatibilityReceipts(pkg) {
  const receipts = pkg.compatibilityReceipts ?? [];
  if (!Array.isArray(receipts)) {
    throw new Error(`${pkg.canonical}@${pkg.version} compatibility receipts are invalid`);
  }
  const ids = new Set();
  for (const receipt of receipts) {
    const subject = `${pkg.canonical}@${pkg.version}`;
    if (!receipt || typeof receipt !== "object" || receipt.type !== "dev.nipmod.compatibility-receipt.v1") {
      throw new Error(`${subject} compatibility receipt is invalid`);
    }
    if (ids.has(receipt.id)) {
      throw new Error(`${subject} duplicate compatibility receipt`);
    }
    ids.add(receipt.id);
    if (receipt.package !== pkg.canonical || receipt.version !== pkg.version || receipt.packageDigest !== pkg.digest) {
      throw new Error(`${subject} compatibility receipt package binding mismatch`);
    }
    if (
      receipt.sourceRepo !== pkg.sourceRepo ||
      receipt.sourceCommit !== pkg.sourceCommit ||
      receipt.sourceTag !== pkg.sourceTag
    ) {
      throw new Error(`${subject} compatibility receipt source binding mismatch`);
    }
    if (!Array.isArray(receipt.provenanceLoss) || receipt.provenanceLoss.length !== 0) {
      throw new Error(`${subject} compatibility receipt provenance loss must be explicit and empty`);
    }
    if (!isCompatibilityUrl(receipt.receiptUrl) || !isCompatibilityUrl(receipt.exampleUrl)) {
      throw new Error(`${subject} compatibility receipt URL is invalid`);
    }
    if (!["apm-package", "git-source-provenance", "mcp-server-json"].includes(receipt.externalFormat)) {
      throw new Error(`${subject} compatibility receipt format is unsupported`);
    }
    const exampleUrl = new URL(receipt.exampleUrl);
    const examplePath = join(SITE_ROOT, "public", exampleUrl.pathname);
    const exampleDigest = createHash("sha256").update(await readFile(examplePath)).digest("hex");
    if (receipt.externalInputSha256 !== exampleDigest) {
      throw new Error(`${subject} compatibility receipt example hash mismatch`);
    }
  }
}

function isCompatibilityUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === "https://nipmod.com" && url.pathname.startsWith("/compatibility/");
  } catch {
    return false;
  }
}

function verifySignedReleaseEvent(value, expected) {
  const event = validateSignedReleaseEvent(value);
  assertReleaseMatch("package", event.payload.package, expected.package);
  assertReleaseMatch("version", event.payload.version, expected.version);
  assertReleaseMatch("publisher", event.payload.publisher, expected.publisher);
  assertReleaseMatch("artifact media type", event.payload.artifact.mediaType, expected.mediaType);
  assertReleaseMatch("artifact path", event.payload.artifact.path, expected.artifactPath);
  assertReleaseMatch("artifact sha256", event.payload.artifact.sha256, expected.artifactSha256);
  assertReleaseMatch("source repo", event.payload.source.repo, expected.sourceRepo);
  assertReleaseMatch("source tag", event.payload.source.tag, expected.sourceTag);
  if (
    !verifyDidSignature(
      event.signature.keyId,
      Buffer.from(`${RELEASE_EVENT_SIGNATURE_CONTEXT}\n${canonicalJson(event.payload)}`, "utf8"),
      event.signature.signatureBase64
    )
  ) {
    throw new Error("release event signature is invalid");
  }
  return event;
}

function validateSignedReleaseEvent(value) {
  const payload = value?.payload;
  const signature = value?.signature;
  if (
    payload?.type !== "dev.nipmod.release.v1" ||
    payload.formatVersion !== 1 ||
    typeof payload.package !== "string" ||
    typeof payload.version !== "string" ||
    typeof payload.publisher !== "string" ||
    payload.source?.type !== "gitlawb" ||
    typeof payload.source.repo !== "string" ||
    !payload.artifact ||
    typeof payload.artifact !== "object" ||
    signature?.algorithm !== "Ed25519" ||
    signature.keyId !== payload.publisher ||
    typeof signature.signatureBase64 !== "string"
  ) {
    throw new Error("release event is invalid");
  }
  return { payload, signature };
}

function assertReleaseMatch(label, actual, expected) {
  if (expected !== undefined && actual !== expected) {
    throw new Error(`release event ${label} mismatch`);
  }
}

function releaseEventUrl(pkg) {
  const url = trustedPackageUrl(pkg.resolved, "release event");
  const blobPrefix = "/blob/";
  const blobIndex = url.pathname.indexOf(blobPrefix);
  if (blobIndex === -1) {
    throw new Error(`${pkg.canonical}@${pkg.version} resolved URL is not a Gitlawb blob URL`);
  }
  url.pathname = `${url.pathname.slice(0, blobIndex + blobPrefix.length)}${encodeBlobPath(pkg.releasePath)}`;
  url.search = "";
  url.hash = "";
  return url.href;
}

function sourceRefsUrl(pkg) {
  const url = trustedPackageUrl(pkg.sourceRepo, "source repo");
  if (!url.pathname.endsWith(".git")) {
    throw new Error(`${pkg.canonical}@${pkg.version} source repo is not a Git URL`);
  }
  url.pathname = `${url.pathname.replace(/\/$/, "")}/info/refs`;
  url.search = "service=git-upload-pack";
  url.hash = "";
  return url.href;
}

function trustedPackageUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} URL is invalid`);
  }
  const loopbackAllowed =
    process.env.NIPMOD_ALLOW_LOOPBACK_PACKAGE_URLS === "1" &&
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || (!TRUSTED_PACKAGE_ORIGINS.includes(url.origin) && !loopbackAllowed)) {
    throw new Error(`${label} URL is not trusted`);
  }
  return url;
}

function encodeBlobPath(path) {
  if (typeof path !== "string" || path.length === 0 || path.includes("\\") || path.startsWith("/") || path.startsWith("~")) {
    throw new Error(`unsafe blob path: ${path}`);
  }
  const parts = path.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new Error(`unsafe blob path: ${path}`);
  }
  return parts.map((part) => encodeURIComponent(part)).join("/");
}

function parseGitInfoRefs(bytes) {
  const refs = new Map();
  let offset = 0;
  while (offset + 4 <= bytes.length) {
    const rawLength = bytes.subarray(offset, offset + 4).toString("utf8");
    const length = Number.parseInt(rawLength, 16);
    if (!Number.isFinite(length) || length < 0) {
      break;
    }
    offset += 4;
    if (length === 0) {
      continue;
    }
    if (length < 4 || offset + length - 4 > bytes.length) {
      break;
    }
    const line = bytes.subarray(offset, offset + length - 4).toString("utf8").trimEnd();
    offset += length - 4;
    if (line.startsWith("#")) {
      continue;
    }
    const [sha, ref] = line.split("\0")[0].split(" ");
    if (isGitCommitHash(sha) && typeof ref === "string" && ref.length > 0) {
      refs.set(ref, sha);
    }
  }
  return refs;
}

function verifyTransparencyEntry(entry, treeHead) {
  if (!Number.isSafeInteger(entry.leafIndex) || entry.leafIndex < 0 || entry.leafIndex >= treeHead.treeSize) {
    return false;
  }
  if (transparencyLeafHash(entry.leaf) !== entry.leafHash) {
    return false;
  }
  let hash = entry.leafHash;
  let index = entry.leafIndex;
  let width = treeHead.treeSize;
  let proofIndex = 0;
  while (width > 1) {
    const side = index % 2 === 0 ? "right" : "left";
    const hasSibling = side === "left" || index + 1 < width;
    if (hasSibling) {
      const step = entry.inclusionProof?.[proofIndex];
      if (!step || step.side !== side || !isSha256(step.hash)) {
        return false;
      }
      hash = step.side === "left" ? parentHash(step.hash, hash) : parentHash(hash, step.hash);
      proofIndex += 1;
    }
    index = Math.floor(index / 2);
    width = Math.ceil(width / 2);
  }
  return proofIndex === (entry.inclusionProof?.length ?? 0) && index === 0 && hash === treeHead.rootHash;
}

function verifySignedTreeHead(treeHead, allowedLogIds) {
  if (
    treeHead?.formatVersion !== 1 ||
    treeHead.signature?.algorithm !== "Ed25519" ||
    treeHead.signature?.keyId !== treeHead.logId ||
    !allowedLogIds.includes(treeHead.logId) ||
    !isSha256(treeHead.rootHash) ||
    !Number.isSafeInteger(treeHead.treeSize) ||
    treeHead.treeSize < 0
  ) {
    return false;
  }
  return verifyDidSignature(
    treeHead.signature.keyId,
    treeHeadSignaturePayload(treeHeadPayload(treeHead)),
    treeHead.signature.signatureBase64
  );
}

function verifyWitnessStatement(statement, checkpoint, allowedWitnesses) {
  if (
    statement?.formatVersion !== 1 ||
    statement.type !== "dev.nipmod.transparency.witness.v1" ||
    statement.signature?.algorithm !== "Ed25519" ||
    statement.signature?.keyId !== statement.witness ||
    statement.witness === checkpoint.logId ||
    !allowedWitnesses.includes(statement.witness) ||
    canonicalJson(statement.treeHead) !== canonicalJson(treeHeadPayload(checkpoint))
  ) {
    return false;
  }
  return verifyDidSignature(
    statement.signature.keyId,
    witnessSignaturePayload(witnessPayload(statement.treeHead, statement.witness)),
    statement.signature.signatureBase64
  );
}

function verifyDidSignature(did, payload, signatureBase64) {
  try {
    return verifySignature(null, payload, publicKeyFromDidKey(did), Buffer.from(signatureBase64, "base64"));
  } catch {
    return false;
  }
}

function publicKeyFromDidKey(did) {
  if (typeof did !== "string" || !did.startsWith("did:key:z")) {
    throw new Error("expected did:key");
  }
  const decoded = base58Decode(did.slice("did:key:z".length));
  if (decoded.length !== 34 || !decoded.subarray(0, 2).equals(ED25519_MULTICODEC)) {
    throw new Error("expected Ed25519 did:key");
  }
  return createPublicKey({
    format: "der",
    key: Buffer.concat([ED25519_SPKI_PREFIX, decoded.subarray(2)]),
    type: "spki"
  });
}

function base58Decode(value) {
  const bytes = [0];
  for (const char of value) {
    const digit = BASE58_ALPHABET.indexOf(char);
    if (digit === -1) {
      throw new Error("invalid base58 value");
    }
    let carry = digit;
    for (let index = 0; index < bytes.length; index += 1) {
      const next = bytes[index] * 58 + carry;
      bytes[index] = next & 0xff;
      carry = next >> 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const char of value) {
    if (char !== "1") {
      break;
    }
    bytes.push(0);
  }
  return Buffer.from(bytes.reverse());
}

function transparencyLeafHash(leaf) {
  return sha256Hex(`${TRANSPARENCY_LEAF_CONTEXT}\n${canonicalJson(leaf)}`);
}

function parentHash(left, right) {
  return sha256Hex(`${TRANSPARENCY_NODE_CONTEXT}\n${left}\n${right}`);
}

function treeHeadSignaturePayload(payload) {
  return Buffer.from(`${TRANSPARENCY_STH_CONTEXT}\n${canonicalJson(payload)}`, "utf8");
}

function witnessSignaturePayload(payload) {
  return Buffer.from(`${TRANSPARENCY_WITNESS_CONTEXT}\n${canonicalJson(payload)}`, "utf8");
}

function witnessPayload(treeHead, witness) {
  return {
    formatVersion: 1,
    treeHead,
    type: "dev.nipmod.transparency.witness.v1",
    witness
  };
}

function treeHeadPayload(treeHead) {
  return {
    formatVersion: treeHead.formatVersion,
    generatedAt: treeHead.generatedAt,
    logId: treeHead.logId,
    rootHash: treeHead.rootHash,
    treeSize: treeHead.treeSize
  };
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value) {
  return JSON.stringify(normalizeJson(value));
}

function normalizeJson(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("canonical JSON does not support non-finite numbers");
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJson(item));
  }
  if (typeof value === "object") {
    const normalized = {};
    for (const key of Object.keys(value).sort()) {
      const item = value[key];
      if (item === undefined) {
        throw new Error(`canonical JSON does not support undefined at ${key}`);
      }
      normalized[key] = normalizeJson(item);
    }
    return normalized;
  }
  throw new Error(`canonical JSON does not support ${typeof value}`);
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isGitCommitHash(value) {
  return typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function fetchJson(url, label = "witness statements") {
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) {
    throw new Error(`failed to fetch ${label}: ${response.status}`);
  }
  return response.json();
}

export async function verifyRegistryBeforeBuild({ fetchFn = fetch } = {}) {
  const [checkpoint, index, transparencyLog, witnessPayload] = await Promise.all([
    readJson(CHECKPOINT_PATH),
    readJson(REGISTRY_PATH),
    readJson(TRANSPARENCY_LOG_PATH),
    fetchJsonWith(fetchFn, WITNESS_SOURCE)
  ]);
  await assertRegistryVerified({ checkpoint, fetchFn, index, transparencyLog, witnessPayload });
  return { packages: index.packages.length, witness: WITNESS_SOURCE };
}

async function fetchJsonWith(fetchFn, url, label = "witness statements") {
  if (fetchFn === fetch) {
    return fetchJson(url, label);
  }
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`failed to fetch ${label}: ${response.status}`);
  }
  return response.json();
}

async function fetchBytesWith(fetchFn, url, maxBytes, label) {
  const response = await fetchFn(url, {
    redirect: "error",
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) {
    throw new Error(`failed to fetch ${label}: ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxBytes) {
    throw new Error(`${label} response is too large`);
  }
  return bytes;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  verifyRegistryBeforeBuild()
    .then(({ packages }) => {
      console.log(`registry verified for build: ${packages} package${packages === 1 ? "" : "s"}`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
