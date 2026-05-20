import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { generateIdentity, readIdentityPath, publicKeyPemFromDidKey, signBytes, verifyBytes } from "../src/identity.js";

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

  test("reads a Gitlawb identity directory without exposing private material", async () => {
    const identity = generateIdentity();
    const dir = join(tmpdir(), `nipmod-gitlawb-identity-${randomUUID()}`);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "identity.pem"), identity.privateKeyPem, { mode: 0o600 });
    await writeFile(
      join(dir, "ucan.json"),
      `${JSON.stringify({ did: identity.did, node: "https://node.nipmod.com" }, null, 2)}\n`
    );

    const loaded = await readIdentityPath(dir);

    expect(loaded.did).toBe(identity.did);
    expect(loaded.publicKeyPem).toBe(identity.publicKeyPem);
    expect(loaded.privateKeyPem).toBe(identity.privateKeyPem);
  });
});
