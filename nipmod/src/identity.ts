import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as signMessage,
  verify as verifyMessage
} from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { base58 } from "@scure/base";

export interface Identity {
  did: string;
  privateKeyPem: string;
  publicKeyPem: string;
}

const ED25519_MULTICODEC = Buffer.from([0xed, 0x01]);
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export function generateIdentity(): Identity {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const publicKeyPem = publicKey.export({ format: "pem", type: "spki" }).toString();

  return {
    did: publicKeyToDidKey(publicKey.export({ format: "der", type: "spki" })),
    privateKeyPem,
    publicKeyPem
  };
}

export async function readIdentityPath(path: string): Promise<Identity> {
  const pathStat = await stat(path);
  if (pathStat.isDirectory()) {
    return readGitlawbIdentityDirectory(path);
  }

  const text = await readFile(path, "utf8");
  if (text.includes("BEGIN PRIVATE KEY")) {
    return identityFromPrivateKeyPem(text);
  }

  return parseIdentityJson(text);
}

export function identityFromPrivateKeyPem(privateKeyPem: string): Identity {
  const publicKey = createPublicKey(createPrivateKey(privateKeyPem));
  const publicKeyPem = publicKey.export({ format: "pem", type: "spki" }).toString();
  return {
    did: publicKeyToDidKey(publicKey.export({ format: "der", type: "spki" })),
    privateKeyPem,
    publicKeyPem
  };
}

export function signBytes(privateKeyPem: string, message: Uint8Array): Buffer {
  return signMessage(null, Buffer.from(message), createPrivateKey(privateKeyPem));
}

export function verifyBytes(publicKeyPem: string, message: Uint8Array, signature: Uint8Array): boolean {
  return verifyMessage(null, Buffer.from(message), createPublicKey(publicKeyPem), Buffer.from(signature));
}

export function publicKeyPemFromDidKey(did: string): string {
  if (!did.startsWith("did:key:z")) {
    throw new Error("expected did:key");
  }

  const decoded = Buffer.from(base58.decode(did.slice("did:key:z".length)));
  if (decoded.length !== 34 || !decoded.subarray(0, 2).equals(ED25519_MULTICODEC)) {
    throw new Error("expected Ed25519 did:key");
  }

  const spkiDer = Buffer.concat([ED25519_SPKI_PREFIX, decoded.subarray(2)]);
  return createPublicKey({ format: "der", key: spkiDer, type: "spki" }).export({ format: "pem", type: "spki" }).toString();
}

function publicKeyToDidKey(spkiDer: Uint8Array): string {
  const rawPublicKey = Buffer.from(spkiDer).subarray(-32);
  const ed25519Multicodec = Buffer.concat([ED25519_MULTICODEC, rawPublicKey]);
  return `did:key:z${base58.encode(ed25519Multicodec)}`;
}

async function readGitlawbIdentityDirectory(path: string): Promise<Identity> {
  const identity = identityFromPrivateKeyPem(await readFile(join(path, "identity.pem"), "utf8"));
  const ucanText = await readFile(join(path, "ucan.json"), "utf8").catch(() => null);
  if (!ucanText) {
    return identity;
  }

  const ucan = JSON.parse(ucanText) as { did?: unknown };
  if (typeof ucan.did === "string" && ucan.did !== identity.did) {
    throw new Error("Gitlawb identity.pem does not match ucan.json DID");
  }
  return identity;
}

function parseIdentityJson(text: string): Identity {
  const identity = JSON.parse(text) as Partial<Identity>;
  if (!identity.did || !identity.privateKeyPem || !identity.publicKeyPem) {
    throw new Error("local identity is incomplete");
  }

  return {
    did: identity.did,
    privateKeyPem: identity.privateKeyPem,
    publicKeyPem: identity.publicKeyPem
  };
}
