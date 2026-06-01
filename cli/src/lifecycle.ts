import {
  publicKeyPemFromDidKey,
  signBytes,
  type Identity,
  verifyBytes
} from "./identity.js";
import {
  type LifecycleEvent,
  type SignedLifecycleEvent,
  validateLifecycleEvent,
  validateSignedLifecycleEvent
} from "./protocol.js";
import { canonicalJson } from "./verifier.js";

export interface LifecycleEventExpected {
  actionKind?: LifecycleEvent["action"]["kind"];
  package?: string;
  publisher?: string;
  sourceRepo?: string;
  tag?: string;
  version?: string;
}

const LIFECYCLE_EVENT_SIGNATURE_CONTEXT = "nipmod-lifecycle-event-v1";

export function signLifecycleEvent(value: LifecycleEvent, identity: Identity): SignedLifecycleEvent {
  const payload = validateLifecycleEvent(value);
  if (payload.publisher !== identity.did) {
    throw new Error("lifecycle event publisher must match signing identity");
  }

  return validateSignedLifecycleEvent({
    payload,
    signature: {
      keyId: identity.did,
      algorithm: "Ed25519",
      signatureBase64: signBytes(identity.privateKeyPem, lifecycleEventSignaturePayload(payload)).toString("base64")
    }
  });
}

export function verifySignedLifecycleEvent(value: unknown, expected: LifecycleEventExpected = {}): SignedLifecycleEvent {
  const event = validateSignedLifecycleEvent(value);
  assertExpected(event, expected);
  const publicKeyPem = publicKeyPemFromDidKey(event.signature.keyId);
  const signature = Buffer.from(event.signature.signatureBase64, "base64");
  if (!verifyBytes(publicKeyPem, lifecycleEventSignaturePayload(event.payload), signature)) {
    throw new Error("lifecycle event signature verification failed");
  }

  return event;
}

function assertExpected(event: SignedLifecycleEvent, expected: LifecycleEventExpected): void {
  assertMatch("package", event.payload.package, expected.package);
  assertMatch("publisher", event.payload.publisher, expected.publisher);
  assertMatch("source repo", event.payload.source.repo, expected.sourceRepo);
  assertMatch("action", event.payload.action.kind, expected.actionKind);
  assertMatch("tag", actionTag(event.payload.action), expected.tag);
  assertMatch("version", actionVersion(event.payload.action), expected.version);
}

function actionTag(action: LifecycleEvent["action"]): string | undefined {
  return "tag" in action ? action.tag : undefined;
}

function actionVersion(action: LifecycleEvent["action"]): string | undefined {
  return "version" in action ? action.version : undefined;
}

function assertMatch(label: string, actual: string | undefined, expected: string | undefined): void {
  if (expected !== undefined && actual !== expected) {
    throw new Error(`lifecycle event ${label} mismatch`);
  }
}

function lifecycleEventSignaturePayload(payload: LifecycleEvent): Buffer {
  return Buffer.from(`${LIFECYCLE_EVENT_SIGNATURE_CONTEXT}\n${canonicalJson(payload)}`, "utf8");
}
