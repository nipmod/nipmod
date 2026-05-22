#!/usr/bin/env node
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export const QUORUM_POLICY_ID = "nipmod-quorum-release-v1";
export const QUORUM_POLICY_TYPE = "dev.nipmod.quorum-policy.v1";
export const QUORUM_SIGNERS_TYPE = "dev.nipmod.quorum-signers.v1";
export const QUORUM_RECEIPT_INDEX_TYPE = "dev.nipmod.quorum-receipts.v1";
export const QUORUM_RECEIPT_TYPE = "dev.nipmod.quorum-receipt.v1";
export const QUORUM_APPROVAL_PAYLOAD_TYPE = "dev.nipmod.quorum-approval-payload.v1";
export const QUORUM_APPROVAL_TYPE = "dev.nipmod.quorum-approval.v1";
export const QUORUM_STATUS_TYPE = "dev.nipmod.quorum-status.v1";
export const QUORUM_THRESHOLD = 2;
export const QUORUM_REQUIRED_ROLES = ["release", "security"];
export const QUORUM_SIGNERS_URL = "https://nipmod.com/quorum/signers.json";
export const QUORUM_POLICY_URL = "https://nipmod.com/quorum/policy.json";
export const QUORUM_RECEIPTS_URL = "https://nipmod.com/quorum/receipts.json";

const DEFAULT_SIGNERS = [
  {
    id: "nipmod-release-gate",
    label: "Nipmod release gate",
    privateKeyFile: "quorum-release-gate-private-key.pem",
    role: "release"
  },
  {
    id: "nipmod-security-gate",
    label: "Nipmod security gate",
    privateKeyFile: "quorum-security-gate-private-key.pem",
    role: "security"
  }
];

const SHA256_RE = /^[a-f0-9]{64}$/;
const COMMIT_RE = /^[a-f0-9]{40}$/;
const PACKAGE_RE = /^pkg:did:key:z[A-Za-z0-9]+\/[a-z0-9][a-z0-9._-]*$/;
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function quorumPolicyDocument(generatedAt = new Date().toISOString()) {
  return {
    formatVersion: 1,
    generatedAt,
    id: QUORUM_POLICY_ID,
    meaning:
      "Verified public Nipmod packages require matching release and security approval signatures for the exact package digest and source tuple.",
    mode: "registry-enforced",
    receipts: QUORUM_RECEIPTS_URL,
    requiredRoles: [...QUORUM_REQUIRED_ROLES],
    scope: "verified public Nipmod registry packages",
    signers: QUORUM_SIGNERS_URL,
    threshold: QUORUM_THRESHOLD,
    type: QUORUM_POLICY_TYPE
  };
}

export function quorumPolicySummary(index) {
  const policy = index?.policy ?? index;
  return {
    id: policy.id ?? QUORUM_POLICY_ID,
    mode: policy.mode ?? "registry-enforced",
    receipts: policy.receipts ?? QUORUM_RECEIPTS_URL,
    requiredRoles: [...(policy.requiredRoles ?? QUORUM_REQUIRED_ROLES)],
    signers: policy.signers ?? QUORUM_SIGNERS_URL,
    threshold: policy.threshold ?? QUORUM_THRESHOLD,
    type: QUORUM_POLICY_TYPE
  };
}

export async function ensureQuorumSignerSet({ keyDir, generatedAt = new Date().toISOString() } = {}) {
  const resolvedKeyDir = resolve(keyDir ?? ".nipmod");
  await mkdir(resolvedKeyDir, { recursive: true });
  const signers = [];
  const privateKeys = new Map();

  for (const signer of DEFAULT_SIGNERS) {
    const keyPath = join(resolvedKeyDir, signer.privateKeyFile);
    const privateKeyPem = await readOrCreatePrivateKeyPem(keyPath);
    const privateKey = createPrivateKey(privateKeyPem);
    const publicKey = createPublicKey(privateKey);
    const publicKeySpkiBase64 = publicKey.export({ format: "der", type: "spki" }).toString("base64");
    const publicKeySpkiSha256 = sha256Hex(Buffer.from(publicKeySpkiBase64, "base64"));
    signers.push({
      algorithm: "Ed25519",
      id: signer.id,
      label: signer.label,
      publicKeySpkiBase64,
      publicKeySpkiSha256,
      role: signer.role
    });
    privateKeys.set(signer.id, privateKey);
  }

  return {
    privateKeys,
    signersDocument: {
      formatVersion: 1,
      generatedAt,
      policyId: QUORUM_POLICY_ID,
      signers,
      type: QUORUM_SIGNERS_TYPE
    }
  };
}

export function signQuorumReceiptForPackage(pkg, signersDocument, privateKeys, signedAt = new Date().toISOString()) {
  assertPackageShape(pkg);
  const approvals = [];
  for (const signer of signersDocument.signers) {
    if (!QUORUM_REQUIRED_ROLES.includes(signer.role)) {
      continue;
    }
    const privateKey = privateKeys.get(signer.id);
    if (!privateKey) {
      throw new Error(`missing quorum private key for ${signer.id}`);
    }
    const payload = approvalPayload(pkg, signer);
    const payloadBytes = Buffer.from(canonicalJson(payload), "utf8");
    approvals.push({
      algorithm: "Ed25519",
      payloadSha256: sha256Hex(payloadBytes),
      publicKeySpkiSha256: signer.publicKeySpkiSha256,
      role: signer.role,
      signedAt,
      signer: signer.id,
      signatureBase64: sign(null, payloadBytes, privateKey).toString("base64"),
      type: QUORUM_APPROVAL_TYPE
    });
  }

  return {
    approvals: approvals.sort((left, right) => left.role.localeCompare(right.role) || left.signer.localeCompare(right.signer)),
    artifactSha256: pkg.digest,
    id: quorumReceiptId(pkg),
    package: pkg.canonical,
    policyId: QUORUM_POLICY_ID,
    sourceCommit: pkg.sourceCommit,
    sourceRepo: pkg.sourceRepo,
    sourceTag: pkg.sourceTag,
    status: "passed",
    threshold: QUORUM_THRESHOLD,
    type: QUORUM_RECEIPT_TYPE,
    version: pkg.version
  };
}

export function buildQuorumReceiptIndex({ generatedAt = new Date().toISOString(), packages, signersDocument, privateKeys }) {
  const receipts = packages.map((pkg) => signQuorumReceiptForPackage(pkg, signersDocument, privateKeys, generatedAt));
  return {
    formatVersion: 1,
    generatedAt,
    policy: quorumPolicyDocument(generatedAt),
    receipts: receipts.sort((left, right) => `${left.package}@${left.version}`.localeCompare(`${right.package}@${right.version}`)),
    signers: signersDocument.signers,
    type: QUORUM_RECEIPT_INDEX_TYPE
  };
}

export async function loadQuorumReceiptIndex(path, { optional = false } = {}) {
  if (path === null || path === false) {
    return null;
  }
  try {
    return parseQuorumReceiptIndex(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    if (optional && isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

export function parseQuorumReceiptIndex(index) {
  if (!index || typeof index !== "object" || index.formatVersion !== 1 || index.type !== QUORUM_RECEIPT_INDEX_TYPE) {
    throw new Error("quorum receipt index is invalid");
  }
  if (!index.policy || index.policy.type !== QUORUM_POLICY_TYPE || index.policy.id !== QUORUM_POLICY_ID) {
    throw new Error("quorum policy is invalid");
  }
  if (!Array.isArray(index.signers) || index.signers.length < QUORUM_THRESHOLD) {
    throw new Error("quorum signer set is invalid");
  }
  if (!Array.isArray(index.receipts)) {
    throw new Error("quorum receipts are invalid");
  }
  const signers = index.signers.map(parseQuorumSigner);
  const seenRoles = new Set(signers.map((signer) => signer.role));
  for (const role of QUORUM_REQUIRED_ROLES) {
    if (!seenRoles.has(role)) {
      throw new Error(`quorum signer role missing: ${role}`);
    }
  }
  return {
    formatVersion: 1,
    generatedAt: requiredDate(index.generatedAt, "generatedAt"),
    policy: {
      ...quorumPolicyDocument(requiredDate(index.policy.generatedAt ?? index.generatedAt, "policy.generatedAt")),
      ...index.policy,
      requiredRoles: requiredRoles(index.policy.requiredRoles),
      threshold: requiredThreshold(index.policy.threshold)
    },
    receipts: index.receipts.map((receipt) => parseQuorumReceipt(receipt)),
    signers,
    type: QUORUM_RECEIPT_INDEX_TYPE
  };
}

export function quorumStatusForPackage(pkg, index) {
  if (!index) {
    return undefined;
  }
  const receipt = index.receipts.find((item) => item.package === pkg.canonical && item.version === pkg.version);
  const base = {
    policyId: QUORUM_POLICY_ID,
    receiptUrl: `${QUORUM_RECEIPTS_URL}#${quorumReceiptId(pkg)}`,
    requiredRoles: [...QUORUM_REQUIRED_ROLES],
    threshold: QUORUM_THRESHOLD,
    type: QUORUM_STATUS_TYPE
  };
  if (!receipt) {
    return {
      ...base,
      approvedRoles: [],
      approvals: 0,
      statement: "No quorum receipt matches this package digest.",
      status: "missing"
    };
  }
  const result = verifyQuorumReceiptForPackage(pkg, receipt, index.signers);
  const approvedRoles = [...new Set(result.validApprovals.map((approval) => approval.role))].sort();
  const passed = result.ok && approvedRoles.length >= QUORUM_THRESHOLD && QUORUM_REQUIRED_ROLES.every((role) => approvedRoles.includes(role));
  return {
    ...base,
    approvedRoles,
    approvals: result.validApprovals.length,
    statement: passed
      ? `${result.validApprovals.length} of ${QUORUM_THRESHOLD} quorum approvals match this package digest.`
      : result.findings.join("; ") || "Quorum receipt did not pass.",
    status: passed ? "passed" : "failed"
  };
}

export function verifyQuorumReceiptForPackage(pkg, receipt, signers) {
  const findings = [];
  const validApprovals = [];
  if (receipt.package !== pkg.canonical || receipt.version !== pkg.version) {
    findings.push("quorum receipt package/version mismatch");
  }
  if (receipt.artifactSha256 !== pkg.digest) {
    findings.push("quorum receipt digest mismatch");
  }
  if (receipt.sourceCommit !== pkg.sourceCommit || receipt.sourceRepo !== pkg.sourceRepo || receipt.sourceTag !== pkg.sourceTag) {
    findings.push("quorum receipt source tuple mismatch");
  }
  const signerById = new Map(signers.map((signer) => [signer.id, signer]));
  const seenRoles = new Set();

  for (const approval of receipt.approvals) {
    const signer = signerById.get(approval.signer);
    if (!signer) {
      findings.push(`quorum signer is unknown: ${approval.signer}`);
      continue;
    }
    if (signer.role !== approval.role) {
      findings.push(`quorum signer role mismatch: ${approval.signer}`);
      continue;
    }
    if (signer.publicKeySpkiSha256 !== approval.publicKeySpkiSha256) {
      findings.push(`quorum signer key mismatch: ${approval.signer}`);
      continue;
    }
    const payload = approvalPayload(pkg, signer);
    const payloadBytes = Buffer.from(canonicalJson(payload), "utf8");
    if (sha256Hex(payloadBytes) !== approval.payloadSha256) {
      findings.push(`quorum payload hash mismatch: ${approval.signer}`);
      continue;
    }
    const publicKey = createPublicKey({
      format: "der",
      key: Buffer.from(signer.publicKeySpkiBase64, "base64"),
      type: "spki"
    });
    if (!verify(null, payloadBytes, publicKey, Buffer.from(approval.signatureBase64, "base64"))) {
      findings.push(`quorum signature invalid: ${approval.signer}`);
      continue;
    }
    if (seenRoles.has(approval.role)) {
      findings.push(`duplicate quorum role approval: ${approval.role}`);
      continue;
    }
    seenRoles.add(approval.role);
    validApprovals.push(approval);
  }

  for (const role of QUORUM_REQUIRED_ROLES) {
    if (!seenRoles.has(role)) {
      findings.push(`quorum role approval missing: ${role}`);
    }
  }

  return {
    findings,
    ok: findings.length === 0 && validApprovals.length >= QUORUM_THRESHOLD,
    validApprovals
  };
}

export function assertQuorumReceiptIndexMatchesPackages(packages, index) {
  const receiptKeys = new Set();
  for (const receipt of index.receipts) {
    const key = `${receipt.package}@${receipt.version}`;
    if (receiptKeys.has(key)) {
      throw new Error(`duplicate quorum receipt: ${key}`);
    }
    receiptKeys.add(key);
  }

  for (const pkg of packages) {
    const status = quorumStatusForPackage(pkg, index);
    if (status?.status !== "passed") {
      throw new Error(`${pkg.canonical}@${pkg.version} quorum failed: ${status?.statement ?? "missing"}`);
    }
  }
}

export async function writeQuorumPublicFiles({ outputDir, policyDocument, receiptIndex, signersDocument }) {
  await mkdir(outputDir, { recursive: true });
  await writeJson(join(outputDir, "policy.json"), policyDocument);
  await writeJson(join(outputDir, "signers.json"), signersDocument);
  await writeJson(join(outputDir, "receipts.json"), receiptIndex);
}

export function canonicalJson(value) {
  return JSON.stringify(sortJson(value));
}

export function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function approvalPayload(pkg, signer) {
  return {
    artifactSha256: pkg.digest,
    package: pkg.canonical,
    policyId: QUORUM_POLICY_ID,
    role: signer.role,
    signer: signer.id,
    sourceCommit: pkg.sourceCommit,
    sourceRepo: pkg.sourceRepo,
    sourceTag: pkg.sourceTag,
    type: QUORUM_APPROVAL_PAYLOAD_TYPE,
    version: pkg.version
  };
}

function quorumReceiptId(pkg) {
  return `quorum.${Buffer.from(`${pkg.canonical}@${pkg.version}`, "utf8").toString("base64url")}`;
}

async function readOrCreatePrivateKeyPem(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (!isNotFound(error)) {
      throw error;
    }
  }
  await mkdir(dirname(path), { recursive: true });
  const { privateKey } = generateKeyPairSync("ed25519");
  const pem = privateKey.export({ format: "pem", type: "pkcs8" });
  await writeFile(path, pem, { mode: 0o600 });
  return pem.toString();
}

function assertPackageShape(pkg) {
  if (!pkg || typeof pkg !== "object") {
    throw new Error("quorum package is invalid");
  }
  requiredPackage(pkg.canonical, "canonical");
  requiredSemver(pkg.version, "version");
  requiredSha256(pkg.digest, "digest");
  requiredCommit(pkg.sourceCommit, "sourceCommit");
  requiredString(pkg.sourceRepo, "sourceRepo", 260);
  requiredString(pkg.sourceTag, "sourceTag", 80);
  if (pkg.sourceTag !== `v${pkg.version}`) {
    throw new Error(`${pkg.canonical}@${pkg.version} quorum source tag mismatch`);
  }
}

function parseQuorumSigner(value) {
  if (!value || typeof value !== "object") {
    throw new Error("quorum signer is invalid");
  }
  return {
    algorithm: literal(value.algorithm, "Ed25519", "signer.algorithm"),
    id: requiredString(value.id, "signer.id", 80),
    label: requiredString(value.label, "signer.label", 80),
    publicKeySpkiBase64: requiredString(value.publicKeySpkiBase64, "signer.publicKeySpkiBase64", 160),
    publicKeySpkiSha256: requiredSha256(value.publicKeySpkiSha256, "signer.publicKeySpkiSha256"),
    role: requiredRole(value.role, "signer.role")
  };
}

function parseQuorumReceipt(value) {
  if (!value || typeof value !== "object") {
    throw new Error("quorum receipt is invalid");
  }
  const receipt = {
    approvals: requiredArray(value.approvals, "approvals").map(parseQuorumApproval),
    artifactSha256: requiredSha256(value.artifactSha256, "artifactSha256"),
    id: requiredString(value.id, "id", 260),
    package: requiredPackage(value.package, "package"),
    policyId: literal(value.policyId, QUORUM_POLICY_ID, "policyId"),
    sourceCommit: requiredCommit(value.sourceCommit, "sourceCommit"),
    sourceRepo: requiredString(value.sourceRepo, "sourceRepo", 260),
    sourceTag: requiredString(value.sourceTag, "sourceTag", 80),
    status: literal(value.status, "passed", "status"),
    threshold: requiredThreshold(value.threshold),
    type: literal(value.type, QUORUM_RECEIPT_TYPE, "type"),
    version: requiredSemver(value.version, "version")
  };
  if (receipt.id !== quorumReceiptId({ canonical: receipt.package, version: receipt.version })) {
    throw new Error(`quorum receipt id mismatch: ${receipt.package}@${receipt.version}`);
  }
  return receipt;
}

function parseQuorumApproval(value) {
  if (!value || typeof value !== "object") {
    throw new Error("quorum approval is invalid");
  }
  return {
    algorithm: literal(value.algorithm, "Ed25519", "approval.algorithm"),
    payloadSha256: requiredSha256(value.payloadSha256, "approval.payloadSha256"),
    publicKeySpkiSha256: requiredSha256(value.publicKeySpkiSha256, "approval.publicKeySpkiSha256"),
    role: requiredRole(value.role, "approval.role"),
    signedAt: requiredDate(value.signedAt, "approval.signedAt"),
    signer: requiredString(value.signer, "approval.signer", 80),
    signatureBase64: requiredString(value.signatureBase64, "approval.signatureBase64", 180),
    type: literal(value.type, QUORUM_APPROVAL_TYPE, "approval.type")
  };
}

function sortJson(value) {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (value && typeof value === "object" && value.constructor === Object) {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortJson(item)]));
  }
  return value;
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function requiredArray(value, field) {
  if (!Array.isArray(value)) {
    throw new Error(`quorum ${field} is invalid`);
  }
  return value;
}

function requiredRoles(value) {
  const roles = requiredArray(value, "requiredRoles").map((role) => requiredRole(role, "requiredRoles"));
  if (roles.length !== QUORUM_REQUIRED_ROLES.length || !QUORUM_REQUIRED_ROLES.every((role) => roles.includes(role))) {
    throw new Error("quorum required roles are invalid");
  }
  return roles;
}

function requiredRole(value, field) {
  const role = requiredString(value, field, 32);
  if (!QUORUM_REQUIRED_ROLES.includes(role)) {
    throw new Error(`quorum role is unsupported: ${role}`);
  }
  return role;
}

function requiredThreshold(value) {
  if (value !== QUORUM_THRESHOLD) {
    throw new Error("quorum threshold is invalid");
  }
  return value;
}

function requiredString(value, field, maxLength) {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
    throw new Error(`quorum ${field} is invalid`);
  }
  return value;
}

function requiredPackage(value, field) {
  const text = requiredString(value, field, 220);
  if (!PACKAGE_RE.test(text)) {
    throw new Error(`quorum ${field} is invalid`);
  }
  return text;
}

function requiredSha256(value, field) {
  const text = requiredString(value, field, 64);
  if (!SHA256_RE.test(text)) {
    throw new Error(`quorum ${field} is invalid`);
  }
  return text;
}

function requiredCommit(value, field) {
  const text = requiredString(value, field, 40);
  if (!COMMIT_RE.test(text)) {
    throw new Error(`quorum ${field} is invalid`);
  }
  return text;
}

function requiredSemver(value, field) {
  const text = requiredString(value, field, 40);
  if (!SEMVER_RE.test(text)) {
    throw new Error(`quorum ${field} is invalid`);
  }
  return text;
}

function requiredDate(value, field) {
  const text = requiredString(value, field, 40);
  if (Number.isNaN(Date.parse(text))) {
    throw new Error(`quorum ${field} is invalid`);
  }
  return text;
}

function literal(value, expected, field) {
  if (value !== expected) {
    throw new Error(`quorum ${field} is invalid`);
  }
  return value;
}

function isNotFound(error) {
  return error && typeof error === "object" && error.code === "ENOENT";
}
