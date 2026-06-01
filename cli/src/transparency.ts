import {
  publicKeyPemFromDidKey,
  signBytes,
  type Identity,
  verifyBytes
} from "./identity.js";
import { type SignedReleaseEvent } from "./protocol.js";
import { verifySignedReleaseEvent } from "./release.js";
import { canonicalJson, sha256Hex } from "./verifier.js";

export interface TransparencyLogLeafInput {
  artifactSha256: string;
  package: string;
  publisher: string;
  releaseEvent: SignedReleaseEvent;
  version: string;
}

export interface TransparencyLogLeaf {
  artifactSha256: string;
  eventHash: string;
  package: string;
  publisher: string;
  version: string;
}

export interface InclusionProofStep {
  hash: string;
  side: "left" | "right";
}

export interface SignedTreeHead {
  formatVersion: 1;
  generatedAt: string;
  logId: string;
  rootHash: string;
  signature: {
    algorithm: "Ed25519";
    keyId: string;
    signatureBase64: string;
  };
  treeSize: number;
}

export type SignedTreeHeadPayload = Omit<SignedTreeHead, "signature">;

export interface WitnessStatement {
  formatVersion: 1;
  signature: {
    algorithm: "Ed25519";
    keyId: string;
    signatureBase64: string;
  };
  treeHead: SignedTreeHeadPayload;
  type: "dev.nipmod.transparency.witness.v1";
  witness: string;
}

export interface TransparencyLogEntry {
  inclusionProof: InclusionProofStep[];
  leaf: TransparencyLogLeaf;
  leafHash: string;
  leafIndex: number;
}

export interface TransparencyLog {
  entries: TransparencyLogEntry[];
  formatVersion: 1;
  treeHead: SignedTreeHead;
}

const RELEASE_EVENT_HASH_CONTEXT = "nipmod-release-event-hash-v1";
const TRANSPARENCY_LEAF_CONTEXT = "nipmod-transparency-leaf-v1";
const TRANSPARENCY_NODE_CONTEXT = "nipmod-transparency-node-v1";
const TRANSPARENCY_EMPTY_TREE_CONTEXT = "nipmod-transparency-empty-tree-v1";
const TRANSPARENCY_STH_CONTEXT = "nipmod-transparency-sth-v1";
const TRANSPARENCY_WITNESS_CONTEXT = "nipmod-transparency-witness-v1";

export function createTransparencyLog(
  inputs: readonly TransparencyLogLeafInput[],
  identity: Identity,
  generatedAt = new Date().toISOString()
): TransparencyLog {
  return createLogFromLeaves(inputs.map(normalizeLeafInput).sort(compareLeaves), identity, generatedAt);
}

export function createTransparencyLogFromLeaves(
  inputs: readonly TransparencyLogLeaf[],
  identity: Identity,
  generatedAt = new Date().toISOString()
): TransparencyLog {
  return createLogFromLeaves(inputs.map(validateTransparencyLeaf), identity, generatedAt);
}

export function extendTransparencyLog(
  previousLog: TransparencyLog | null | undefined,
  inputs: readonly TransparencyLogLeafInput[],
  identity: Identity,
  generatedAt = new Date().toISOString()
): TransparencyLog {
  if (!previousLog) {
    return createTransparencyLog(inputs, identity, generatedAt);
  }
  if (!verifyTransparencyLog(previousLog, [identity.did])) {
    throw new Error("previous transparency log is invalid");
  }

  const leaves = previousLog.entries.map((entry) => validateTransparencyLeaf(entry.leaf));
  const seen = new Map(leaves.map((leaf) => [subjectKey(leaf.package, leaf.version), leaf]));
  const newLeaves = inputs.map(normalizeLeafInput).sort(compareLeaves);

  for (const leaf of newLeaves) {
    const key = subjectKey(leaf.package, leaf.version);
    const previous = seen.get(key);
    if (!previous) {
      leaves.push(leaf);
      seen.set(key, leaf);
      continue;
    }
    if (previous.eventHash !== leaf.eventHash || previous.artifactSha256 !== leaf.artifactSha256) {
      throw new Error(`transparency log leaf changed for ${key}`);
    }
  }

  return createTransparencyLogFromLeaves(leaves, identity, generatedAt);
}

function createLogFromLeaves(
  inputs: readonly TransparencyLogLeaf[],
  identity: Identity,
  generatedAt: string
): TransparencyLog {
  const leaves = inputs.map(validateTransparencyLeaf);
  assertNoConflicts(leaves);

  const leafHashes = leaves.map(transparencyLeafHash);
  const levels = merkleLevels(leafHashes);
  const rootHash = merkleRootFromLevels(levels);
  const treeHead = signTreeHead(
    {
      formatVersion: 1,
      generatedAt,
      logId: identity.did,
      rootHash,
      treeSize: leaves.length
    },
    identity
  );

  return {
    entries: leaves.map((leaf, leafIndex) => ({
      inclusionProof: inclusionProof(levels, leafIndex),
      leaf,
      leafHash: at(leafHashes, leafIndex),
      leafIndex
    })),
    formatVersion: 1,
    treeHead
  };
}

export function releaseEventHash(value: SignedReleaseEvent): string {
  const event = verifySignedReleaseEvent(value);
  return sha256Hex(`${RELEASE_EVENT_HASH_CONTEXT}\n${canonicalJson(event)}`);
}

export function transparencyLeafHash(leaf: TransparencyLogLeaf): string {
  return sha256Hex(`${TRANSPARENCY_LEAF_CONTEXT}\n${canonicalJson(leaf)}`);
}

export function verifyTransparencyEntry(
  entry: TransparencyLogEntry | undefined,
  treeHead: SignedTreeHead | undefined,
  allowedLogIds?: readonly string[]
): boolean {
  if (!entry || !treeHead || !verifySignedTreeHead(treeHead, allowedLogIds)) {
    return false;
  }

  if (entry.leafIndex < 0 || entry.leafIndex >= treeHead.treeSize) {
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
      const step = entry.inclusionProof[proofIndex];
      if (!step || step.side !== side) {
        return false;
      }
      hash = step.side === "left" ? parentHash(step.hash, hash) : parentHash(hash, step.hash);
      proofIndex += 1;
    }
    index = Math.floor(index / 2);
    width = Math.ceil(width / 2);
  }

  return proofIndex === entry.inclusionProof.length && index === 0 && hash === treeHead.rootHash;
}

export function verifyTransparencyLog(log: TransparencyLog | undefined, allowedLogIds?: readonly string[]): boolean {
  if (!log || log.formatVersion !== 1 || !Array.isArray(log.entries) || !verifySignedTreeHead(log.treeHead, allowedLogIds)) {
    return false;
  }
  if (log.treeHead.treeSize !== log.entries.length) {
    return false;
  }

  return log.entries.every(
    (entry, index) => entry.leafIndex === index && verifyTransparencyEntry(entry, log.treeHead, allowedLogIds)
  );
}

export function signWitnessStatement(treeHead: SignedTreeHead, identity: Identity): WitnessStatement {
  if (!verifySignedTreeHead(treeHead)) {
    throw new Error("cannot witness an invalid signed tree head");
  }
  if (identity.did === treeHead.logId) {
    throw new Error("witness identity must differ from transparency log identity");
  }

  const payload = witnessPayload(treeHeadPayload(treeHead), identity.did);
  return {
    ...payload,
    signature: {
      algorithm: "Ed25519",
      keyId: identity.did,
      signatureBase64: signBytes(identity.privateKeyPem, witnessSignaturePayload(payload)).toString("base64")
    }
  };
}

export function verifyWitnessStatement(
  statement: WitnessStatement | undefined,
  treeHead: SignedTreeHead | undefined,
  allowedWitnesses?: readonly string[]
): boolean {
  try {
    if (!statement || !treeHead || !verifySignedTreeHead(treeHead)) {
      return false;
    }

    if (
      statement.formatVersion !== 1 ||
      statement.type !== "dev.nipmod.transparency.witness.v1" ||
      statement.signature.algorithm !== "Ed25519" ||
      statement.signature.keyId !== statement.witness ||
      statement.witness === treeHead.logId ||
      canonicalJson(statement.treeHead) !== canonicalJson(treeHeadPayload(treeHead)) ||
      (allowedWitnesses !== undefined && !allowedWitnesses.includes(statement.witness))
    ) {
      return false;
    }

    const publicKeyPem = publicKeyPemFromDidKey(statement.signature.keyId);
    const signature = Buffer.from(statement.signature.signatureBase64, "base64");
    return verifyBytes(publicKeyPem, witnessSignaturePayload(witnessPayload(statement.treeHead, statement.witness)), signature);
  } catch {
    return false;
  }
}

export function verifySignedTreeHead(treeHead: SignedTreeHead, allowedLogIds?: readonly string[]): boolean {
  if (
    treeHead.formatVersion !== 1 ||
    treeHead.signature.algorithm !== "Ed25519" ||
    treeHead.signature.keyId !== treeHead.logId ||
    !isSha256(treeHead.rootHash) ||
    !Number.isSafeInteger(treeHead.treeSize) ||
    treeHead.treeSize < 0 ||
    (allowedLogIds !== undefined && !allowedLogIds.includes(treeHead.logId))
  ) {
    return false;
  }

  try {
    const publicKeyPem = publicKeyPemFromDidKey(treeHead.signature.keyId);
    const signature = Buffer.from(treeHead.signature.signatureBase64, "base64");
    return verifyBytes(publicKeyPem, treeHeadSignaturePayload(treeHeadPayload(treeHead)), signature);
  } catch {
    return false;
  }
}

function normalizeLeafInput(input: TransparencyLogLeafInput): TransparencyLogLeaf {
  const releaseEvent = verifySignedReleaseEvent(input.releaseEvent, {
    artifactSha256: input.artifactSha256,
    package: input.package,
    publisher: input.publisher,
    version: input.version
  });
  if (
    releaseEvent.payload.package !== input.package ||
    releaseEvent.payload.version !== input.version ||
    releaseEvent.payload.publisher !== input.publisher ||
    releaseEvent.payload.artifact.sha256 !== input.artifactSha256
  ) {
    throw new Error("transparency log leaf does not match release event");
  }

  return {
    artifactSha256: input.artifactSha256,
    eventHash: releaseEventHash(releaseEvent),
    package: input.package,
    publisher: input.publisher,
    version: input.version
  };
}

function validateTransparencyLeaf(input: TransparencyLogLeaf): TransparencyLogLeaf {
  if (
    !input ||
    typeof input !== "object" ||
    typeof input.package !== "string" ||
    typeof input.publisher !== "string" ||
    typeof input.version !== "string" ||
    !isSha256(input.artifactSha256) ||
    !isSha256(input.eventHash)
  ) {
    throw new Error("transparency log leaf is invalid");
  }

  return {
    artifactSha256: input.artifactSha256,
    eventHash: input.eventHash,
    package: input.package,
    publisher: input.publisher,
    version: input.version
  };
}

function assertNoConflicts(leaves: readonly TransparencyLogLeaf[]): void {
  const seen = new Map<string, TransparencyLogLeaf>();
  for (const leaf of leaves) {
    const key = `${leaf.package}@${leaf.version}`;
    const previous = seen.get(key);
    if (!previous) {
      seen.set(key, leaf);
      continue;
    }

    if (previous.eventHash !== leaf.eventHash || previous.artifactSha256 !== leaf.artifactSha256) {
      throw new Error(`conflicting transparency log event for ${key}`);
    }

    throw new Error(`duplicate transparency log event for ${key}`);
  }
}

function signTreeHead(
  payload: SignedTreeHeadPayload,
  identity: Identity
): SignedTreeHead {
  return {
    ...payload,
    signature: {
      algorithm: "Ed25519",
      keyId: identity.did,
      signatureBase64: signBytes(identity.privateKeyPem, treeHeadSignaturePayload(payload)).toString("base64")
    }
  };
}

function witnessPayload(treeHead: SignedTreeHeadPayload, witness: string): Omit<WitnessStatement, "signature"> {
  return {
    formatVersion: 1,
    treeHead,
    type: "dev.nipmod.transparency.witness.v1",
    witness
  };
}

function treeHeadSignaturePayload(payload: SignedTreeHeadPayload): Buffer {
  return Buffer.from(`${TRANSPARENCY_STH_CONTEXT}\n${canonicalJson(payload)}`, "utf8");
}

function witnessSignaturePayload(payload: Omit<WitnessStatement, "signature">): Buffer {
  return Buffer.from(`${TRANSPARENCY_WITNESS_CONTEXT}\n${canonicalJson(payload)}`, "utf8");
}

function treeHeadPayload(treeHead: SignedTreeHead): SignedTreeHeadPayload {
  return {
    formatVersion: treeHead.formatVersion,
    generatedAt: treeHead.generatedAt,
    logId: treeHead.logId,
    rootHash: treeHead.rootHash,
    treeSize: treeHead.treeSize
  };
}

function merkleLevels(leafHashes: readonly string[]): string[][] {
  if (leafHashes.length === 0) {
    return [[sha256Hex(`${TRANSPARENCY_EMPTY_TREE_CONTEXT}\n`)]];
  }

  const levels: string[][] = [[...leafHashes]];
  while (at(levels, levels.length - 1).length > 1) {
    const previous = at(levels, levels.length - 1);
    const next: string[] = [];
    for (let index = 0; index < previous.length; index += 2) {
      const left = at(previous, index);
      const right = previous[index + 1];
      next.push(right ? parentHash(left, right) : left);
    }
    levels.push(next);
  }

  return levels;
}

function merkleRootFromLevels(levels: readonly string[][]): string {
  const top = at(levels, levels.length - 1);
  return at(top, 0);
}

function inclusionProof(levels: readonly string[][], leafIndex: number): InclusionProofStep[] {
  const proof: InclusionProofStep[] = [];
  let index = leafIndex;
  for (let levelIndex = 0; levelIndex < levels.length - 1; levelIndex += 1) {
    const level = at(levels, levelIndex);
    if (index % 2 === 0) {
      const sibling = level[index + 1];
      if (sibling) {
        proof.push({ hash: sibling, side: "right" });
      }
    } else {
      proof.push({ hash: at(level, index - 1), side: "left" });
    }
    index = Math.floor(index / 2);
  }

  return proof;
}

function parentHash(left: string, right: string): string {
  return sha256Hex(`${TRANSPARENCY_NODE_CONTEXT}\n${left}\n${right}`);
}

function compareLeaves(left: TransparencyLogLeaf, right: TransparencyLogLeaf): number {
  return (
    left.package.localeCompare(right.package) ||
    left.version.localeCompare(right.version) ||
    left.eventHash.localeCompare(right.eventHash)
  );
}

function subjectKey(packageId: string, version: string): string {
  return `${packageId}@${version}`;
}

function at<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) {
    throw new Error("transparency log index out of bounds");
  }
  return value;
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}
