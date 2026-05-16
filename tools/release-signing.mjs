import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { readFile } from "node:fs/promises";

export const RELEASE_SIGNATURE_TYPE = "dev.nipmod.release.signature.v1";
export const RELEASE_PUBLIC_KEY_TYPE = "dev.nipmod.release.public-key.v1";

export function createReleasePublicKeyInfo(publicKey) {
  const publicKeyDer = publicKey.export({ format: "der", type: "spki" });
  return {
    algorithm: "Ed25519",
    publicKeySpkiBase64: publicKeyDer.toString("base64"),
    publicKeySpkiSha256: createHash("sha256").update(publicKeyDer).digest("hex"),
    type: RELEASE_PUBLIC_KEY_TYPE
  };
}

export async function readReleasePublicKeyInfo(path) {
  return parseReleasePublicKeyInfo(JSON.parse(await readFile(path, "utf8")));
}

export async function signReleaseArtifact({ artifactName, artifactPath, privateKey, privateKeyPath, publicKeyInfo }) {
  const normalizedPublicKeyInfo = parseReleasePublicKeyInfo(publicKeyInfo);
  const signingKey = privateKey ?? createPrivateKey(await readFile(privateKeyPath, "utf8"));
  const artifactBytes = await readFile(artifactPath);
  const signatureBytes = sign(null, artifactBytes, signingKey);
  const signature = {
    algorithm: "Ed25519",
    artifact: artifactName,
    publicKeySpkiSha256: normalizedPublicKeyInfo.publicKeySpkiSha256,
    signatureBase64: signatureBytes.toString("base64"),
    type: RELEASE_SIGNATURE_TYPE
  };
  await verifyReleaseSignature({
    artifactName,
    artifactPath,
    publicKeyInfo: normalizedPublicKeyInfo,
    signature
  });
  return signature;
}

export async function verifyReleaseSignature({ artifactName, artifactPath, publicKeyInfo, signature }) {
  const normalizedPublicKeyInfo = parseReleasePublicKeyInfo(publicKeyInfo);
  const normalizedSignature = parseReleaseSignature(signature);
  if (normalizedSignature.artifact !== artifactName) {
    throw new Error("release signature artifact mismatch");
  }
  if (normalizedSignature.publicKeySpkiSha256 !== normalizedPublicKeyInfo.publicKeySpkiSha256) {
    throw new Error("release signature public key mismatch");
  }
  const publicKey = createPublicKey({
    format: "der",
    key: Buffer.from(normalizedPublicKeyInfo.publicKeySpkiBase64, "base64"),
    type: "spki"
  });
  const artifactBytes = await readFile(artifactPath);
  const signatureBytes = Buffer.from(normalizedSignature.signatureBase64, "base64");
  if (!verify(null, artifactBytes, publicKey, signatureBytes)) {
    throw new Error("release artifact signature verification failed");
  }
  return true;
}

function parseReleasePublicKeyInfo(value) {
  if (!value || typeof value !== "object") {
    throw new Error("release public key info is invalid");
  }
  if (value.type !== RELEASE_PUBLIC_KEY_TYPE) {
    throw new Error("release public key type is invalid");
  }
  if (value.algorithm !== "Ed25519") {
    throw new Error("release public key algorithm is invalid");
  }
  if (typeof value.publicKeySpkiBase64 !== "string" || !value.publicKeySpkiBase64) {
    throw new Error("release public key is invalid");
  }
  if (typeof value.publicKeySpkiSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.publicKeySpkiSha256)) {
    throw new Error("release public key fingerprint is invalid");
  }
  const publicKeyDer = Buffer.from(value.publicKeySpkiBase64, "base64");
  const fingerprint = createHash("sha256").update(publicKeyDer).digest("hex");
  if (fingerprint !== value.publicKeySpkiSha256) {
    throw new Error("release public key fingerprint mismatch");
  }
  return {
    algorithm: "Ed25519",
    publicKeySpkiBase64: value.publicKeySpkiBase64,
    publicKeySpkiSha256: value.publicKeySpkiSha256,
    type: RELEASE_PUBLIC_KEY_TYPE
  };
}

function parseReleaseSignature(value) {
  if (!value || typeof value !== "object") {
    throw new Error("release signature is invalid");
  }
  if (value.type !== RELEASE_SIGNATURE_TYPE) {
    throw new Error("release signature type is invalid");
  }
  if (value.algorithm !== "Ed25519") {
    throw new Error("release signature algorithm is invalid");
  }
  if (typeof value.artifact !== "string" || !value.artifact) {
    throw new Error("release signature artifact is invalid");
  }
  if (typeof value.publicKeySpkiSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.publicKeySpkiSha256)) {
    throw new Error("release signature public key fingerprint is invalid");
  }
  if (typeof value.signatureBase64 !== "string" || !value.signatureBase64) {
    throw new Error("release signature bytes are invalid");
  }
  return {
    algorithm: "Ed25519",
    artifact: value.artifact,
    publicKeySpkiSha256: value.publicKeySpkiSha256,
    signatureBase64: value.signatureBase64,
    type: RELEASE_SIGNATURE_TYPE
  };
}
