import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { readFile } from "node:fs/promises";

export const ADVISORY_SIGNATURE_TYPE = "dev.nipmod.advisory.signature.v1";
export const ADVISORY_PUBLIC_KEY_TYPE = "dev.nipmod.advisory.public-key.v1";
const ADVISORY_MAX_TTL_MS = 45 * 24 * 60 * 60 * 1000;
const ADVISORY_FUTURE_SKEW_MS = 5 * 60 * 1000;
const FEED_KEYS = ["advisories", "expiresAt", "formatVersion", "generatedAt", "type"];
const ADVISORY_KEYS = ["id", "package", "severity", "status", "title", "versions"];
const RFC3339_UTC_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

export function createAdvisoryPublicKeyInfo(publicKey) {
  const publicKeyDer = publicKey.export({ format: "der", type: "spki" });
  return {
    algorithm: "Ed25519",
    publicKeySpkiBase64: publicKeyDer.toString("base64"),
    publicKeySpkiSha256: createHash("sha256").update(publicKeyDer).digest("hex"),
    type: ADVISORY_PUBLIC_KEY_TYPE
  };
}

export async function readAdvisoryPublicKeyInfo(path) {
  return parseAdvisoryPublicKeyInfo(JSON.parse(await readFile(path, "utf8")));
}

export async function signAdvisoryFeed({ feedPath, privateKey, privateKeyPath, publicKeyInfo }) {
  const normalizedPublicKeyInfo = parseAdvisoryPublicKeyInfo(publicKeyInfo);
  const signingKey = privateKey ?? createPrivateKey(await readFile(privateKeyPath, "utf8"));
  const feedBytes = await readFile(feedPath);
  validateAdvisoryFeed(JSON.parse(feedBytes.toString("utf8")));
  const signature = {
    algorithm: "Ed25519",
    artifact: "advisories.json",
    publicKeySpkiSha256: normalizedPublicKeyInfo.publicKeySpkiSha256,
    signatureBase64: sign(null, feedBytes, signingKey).toString("base64"),
    type: ADVISORY_SIGNATURE_TYPE
  };
  await verifyAdvisorySignature({
    feedPath,
    publicKeyInfo: normalizedPublicKeyInfo,
    signature
  });
  return signature;
}

export function validateAdvisoryFeed(value, now = Date.now()) {
  if (!value || typeof value !== "object") {
    throw new Error("advisory feed is invalid");
  }
  assertExactKeys(value, FEED_KEYS, "advisory feed");
  if (value.formatVersion !== 1) {
    throw new Error("advisory feed formatVersion is invalid");
  }
  if (value.type !== "dev.nipmod.advisories.v1") {
    throw new Error("advisory feed type is invalid");
  }
  if (
    typeof value.generatedAt !== "string" ||
    typeof value.expiresAt !== "string" ||
    !RFC3339_UTC_DATETIME.test(value.generatedAt) ||
    !RFC3339_UTC_DATETIME.test(value.expiresAt)
  ) {
    throw new Error("advisory feed timestamps are invalid");
  }
  const generatedAt = Date.parse(value.generatedAt);
  const expiresAt = Date.parse(value.expiresAt);
  if (!Number.isFinite(generatedAt) || !Number.isFinite(expiresAt)) {
    throw new Error("advisory feed timestamps are invalid");
  }
  if (generatedAt > now + ADVISORY_FUTURE_SKEW_MS) {
    throw new Error("advisory feed generatedAt is in the future");
  }
  if (expiresAt <= now) {
    throw new Error("advisory feed expired");
  }
  if (expiresAt <= generatedAt || expiresAt - generatedAt > ADVISORY_MAX_TTL_MS) {
    throw new Error("advisory feed expiry window is invalid");
  }
  if (!Array.isArray(value.advisories) || value.advisories.length > 1000) {
    throw new Error("advisory feed advisories are invalid");
  }
  for (const advisory of value.advisories) {
    validateAdvisory(advisory);
  }
  return value;
}

export async function verifyAdvisorySignature({ feedPath, publicKeyInfo, signature }) {
  const normalizedPublicKeyInfo = parseAdvisoryPublicKeyInfo(publicKeyInfo);
  const normalizedSignature = parseAdvisorySignature(signature);
  if (normalizedSignature.publicKeySpkiSha256 !== normalizedPublicKeyInfo.publicKeySpkiSha256) {
    throw new Error("advisory signature public key mismatch");
  }
  const publicKey = createPublicKey({
    format: "der",
    key: Buffer.from(normalizedPublicKeyInfo.publicKeySpkiBase64, "base64"),
    type: "spki"
  });
  const feedBytes = await readFile(feedPath);
  if (!verify(null, feedBytes, publicKey, Buffer.from(normalizedSignature.signatureBase64, "base64"))) {
    throw new Error("advisory feed signature verification failed");
  }
  return true;
}

function parseAdvisoryPublicKeyInfo(value) {
  if (!value || typeof value !== "object") {
    throw new Error("advisory public key info is invalid");
  }
  if (value.type !== ADVISORY_PUBLIC_KEY_TYPE) {
    throw new Error("advisory public key type is invalid");
  }
  if (value.algorithm !== "Ed25519") {
    throw new Error("advisory public key algorithm is invalid");
  }
  if (typeof value.publicKeySpkiBase64 !== "string" || !value.publicKeySpkiBase64) {
    throw new Error("advisory public key is invalid");
  }
  if (typeof value.publicKeySpkiSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.publicKeySpkiSha256)) {
    throw new Error("advisory public key fingerprint is invalid");
  }
  const publicKeyDer = Buffer.from(value.publicKeySpkiBase64, "base64");
  const fingerprint = createHash("sha256").update(publicKeyDer).digest("hex");
  if (fingerprint !== value.publicKeySpkiSha256) {
    throw new Error("advisory public key fingerprint mismatch");
  }
  return {
    algorithm: "Ed25519",
    publicKeySpkiBase64: value.publicKeySpkiBase64,
    publicKeySpkiSha256: value.publicKeySpkiSha256,
    type: ADVISORY_PUBLIC_KEY_TYPE
  };
}

function parseAdvisorySignature(value) {
  if (!value || typeof value !== "object") {
    throw new Error("advisory signature is invalid");
  }
  if (value.type !== ADVISORY_SIGNATURE_TYPE) {
    throw new Error("advisory signature type is invalid");
  }
  if (value.algorithm !== "Ed25519") {
    throw new Error("advisory signature algorithm is invalid");
  }
  if (value.artifact !== "advisories.json") {
    throw new Error("advisory signature artifact mismatch");
  }
  if (typeof value.publicKeySpkiSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.publicKeySpkiSha256)) {
    throw new Error("advisory signature public key fingerprint is invalid");
  }
  if (typeof value.signatureBase64 !== "string" || !value.signatureBase64) {
    throw new Error("advisory signature bytes are invalid");
  }
  return {
    algorithm: "Ed25519",
    artifact: value.artifact,
    publicKeySpkiSha256: value.publicKeySpkiSha256,
    signatureBase64: value.signatureBase64,
    type: ADVISORY_SIGNATURE_TYPE
  };
}

function validateAdvisory(value) {
  if (!value || typeof value !== "object") {
    throw new Error("advisory entry is invalid");
  }
  assertExactKeys(value, ADVISORY_KEYS, "advisory entry");
  if (typeof value.id !== "string" || !/^NIPMOD-\d{4}-\d{4}$/.test(value.id)) {
    throw new Error("advisory id is invalid");
  }
  if (typeof value.package !== "string" || !/^pkg:did:key:z[A-Za-z0-9]+\/[a-z0-9][a-z0-9._-]*$/.test(value.package)) {
    throw new Error("advisory package is invalid");
  }
  if (!Array.isArray(value.versions) || value.versions.length === 0 || !value.versions.every((version) => /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version))) {
    throw new Error("advisory versions are invalid");
  }
  if (!["low", "moderate", "high", "critical"].includes(value.severity)) {
    throw new Error("advisory severity is invalid");
  }
  if (!["active", "withdrawn"].includes(value.status)) {
    throw new Error("advisory status is invalid");
  }
  if (typeof value.title !== "string" || value.title.length === 0 || value.title.length > 140) {
    throw new Error("advisory title is invalid");
  }
}

function assertExactKeys(value, expectedKeys, label) {
  const allowed = new Set(expectedKeys);
  const actual = Object.keys(value);
  for (const key of actual) {
    if (!allowed.has(key)) {
      throw new Error(`${label} has unexpected field: ${key}`);
    }
  }
  for (const key of expectedKeys) {
    if (!Object.hasOwn(value, key)) {
      throw new Error(`${label} is missing field: ${key}`);
    }
  }
}
