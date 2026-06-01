import {
  publicKeyPemFromDidKey,
  signBytes,
  type Identity,
  verifyBytes
} from "./identity.js";
import {
  type ReleaseEvent,
  type SignedReleaseEvent,
  validateReleaseEvent,
  validateSignedReleaseEvent
} from "./protocol.js";
import { canonicalJson } from "./verifier.js";

export interface ReleaseEventExpected {
  artifactPath?: string;
  artifactSha256?: string;
  manifestDigest?: string;
  mediaType?: string;
  package?: string;
  publisher?: string;
  sourceCommit?: string;
  sourceRepo?: string;
  sourceTag?: string;
  version?: string;
}

const RELEASE_EVENT_SIGNATURE_CONTEXT = "nipmod-release-event-v1";

export function signReleaseEvent(value: ReleaseEvent, identity: Identity): SignedReleaseEvent {
  const payload = validateReleaseEvent(value);
  if (payload.publisher !== identity.did) {
    throw new Error("release event publisher must match signing identity");
  }

  return validateSignedReleaseEvent({
    payload,
    signature: {
      keyId: identity.did,
      algorithm: "Ed25519",
      signatureBase64: signBytes(identity.privateKeyPem, releaseEventSignaturePayload(payload)).toString("base64")
    }
  });
}

export function verifySignedReleaseEvent(value: unknown, expected: ReleaseEventExpected = {}): SignedReleaseEvent {
  const event = validateSignedReleaseEvent(value);
  assertExpected(event, expected);
  const publicKeyPem = publicKeyPemFromDidKey(event.signature.keyId);
  const signature = Buffer.from(event.signature.signatureBase64, "base64");
  if (!verifyBytes(publicKeyPem, releaseEventSignaturePayload(event.payload), signature)) {
    throw new Error("release event signature verification failed");
  }

  return event;
}

function assertExpected(event: SignedReleaseEvent, expected: ReleaseEventExpected): void {
  assertMatch("package", event.payload.package, expected.package);
  assertMatch("version", event.payload.version, expected.version);
  assertMatch("publisher", event.payload.publisher, expected.publisher);
  assertMatch("artifact media type", event.payload.artifact.mediaType, expected.mediaType);
  assertMatch("artifact path", event.payload.artifact.path, expected.artifactPath);
  assertMatch("artifact sha256", event.payload.artifact.sha256, expected.artifactSha256);
  assertMatch("manifest digest", event.payload.artifact.manifestDigest, expected.manifestDigest);
  assertMatch("source repo", event.payload.source.repo, expected.sourceRepo);
  assertMatch("source commit", event.payload.source.commit, expected.sourceCommit);
  assertMatch("source tag", event.payload.source.tag, expected.sourceTag);
}

function assertMatch(label: string, actual: string | undefined, expected: string | undefined): void {
  if (expected !== undefined && actual !== expected) {
    throw new Error(`release event ${label} mismatch`);
  }
}

function releaseEventSignaturePayload(payload: ReleaseEvent): Buffer {
  return Buffer.from(`${RELEASE_EVENT_SIGNATURE_CONTEXT}\n${canonicalJson(payload)}`, "utf8");
}
