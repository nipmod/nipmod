import { describe, expect, test } from "vitest";
import { generateIdentity, publicKeyPemFromDidKey, signBytes, verifyBytes } from "../src/identity.js";

describe("did:key identity", () => {
  test("generates an Ed25519 did:key and verifies signatures", () => {
    const identity = generateIdentity();
    const message = Buffer.from("nipmod");
    const signature = signBytes(identity.privateKeyPem, message);

    expect(identity.did).toMatch(/^did:key:z/);
    expect(verifyBytes(identity.publicKeyPem, message, signature)).toBe(true);
    expect(verifyBytes(identity.publicKeyPem, Buffer.from("tampered"), signature)).toBe(false);
  });

  test("resolves did:key public keys for signature verification", () => {
    const identity = generateIdentity();
    const message = Buffer.from("nipmod");
    const signature = signBytes(identity.privateKeyPem, message);
    const publicKeyPem = publicKeyPemFromDidKey(identity.did);

    expect(verifyBytes(publicKeyPem, message, signature)).toBe(true);
  });
});
