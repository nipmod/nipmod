import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  createAdvisoryPublicKeyInfo,
  signAdvisoryFeed,
  verifyAdvisorySignature
} from "./advisory-signing.mjs";

describe("advisory signing", () => {
  test("signs and verifies an advisory feed with a dedicated advisory key", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-advisory-signing-"));
    const feedPath = join(dir, "advisories.json");
    await writeFile(feedPath, JSON.stringify(freshAdvisoryFeed()));
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const publicKeyInfo = createAdvisoryPublicKeyInfo(publicKey);

    expect(publicKeyInfo.type).toBe("dev.nipmod.advisory.public-key.v1");
    const signature = await signAdvisoryFeed({ feedPath, privateKey, publicKeyInfo });

    expect(signature.type).toBe("dev.nipmod.advisory.signature.v1");
    expect(
      await verifyAdvisorySignature({
        feedPath,
        publicKeyInfo,
        signature
      })
    ).toBe(true);
  });

  test("rejects release signature envelopes for advisory feeds", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-advisory-signing-type-"));
    const feedPath = join(dir, "advisories.json");
    await writeFile(feedPath, JSON.stringify({ advisories: [] }));
    const { publicKey } = generateKeyPairSync("ed25519");
    const publicKeyInfo = createAdvisoryPublicKeyInfo(publicKey);

    await expect(
      verifyAdvisorySignature({
        feedPath,
        publicKeyInfo,
        signature: {
          algorithm: "Ed25519",
          artifact: "advisories.json",
          publicKeySpkiSha256: publicKeyInfo.publicKeySpkiSha256,
          signatureBase64: "deadbeef",
          type: "dev.nipmod.release.signature.v1"
        }
      })
    ).rejects.toThrow(/advisory signature type/i);
  });

  test("refuses to sign malformed or expired advisory feeds", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-advisory-signing-invalid-"));
    const feedPath = join(dir, "advisories.json");
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const publicKeyInfo = createAdvisoryPublicKeyInfo(publicKey);

    await writeFile(feedPath, JSON.stringify({ advisories: [] }));
    await expect(signAdvisoryFeed({ feedPath, privateKey, publicKeyInfo })).rejects.toThrow(/missing field/i);

    await writeFile(
      feedPath,
      JSON.stringify(
        freshAdvisoryFeed({
          expiresAt: "2026-05-15T00:00:00.000Z",
          generatedAt: "2026-05-14T00:00:00.000Z"
        })
      )
    );
    await expect(signAdvisoryFeed({ feedPath, privateKey, publicKeyInfo })).rejects.toThrow(/expired/i);
  });

  test("refuses advisory feeds that the CLI audit schema would reject", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-advisory-signing-strict-"));
    const feedPath = join(dir, "advisories.json");
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const publicKeyInfo = createAdvisoryPublicKeyInfo(publicKey);

    await writeFile(feedPath, JSON.stringify({ ...freshAdvisoryFeed(), ignored: true }));
    await expect(signAdvisoryFeed({ feedPath, privateKey, publicKeyInfo })).rejects.toThrow(/unexpected field/i);

    await writeFile(
      feedPath,
      JSON.stringify(
        freshAdvisoryFeed({
          advisories: [
            {
              id: "NIPMOD-2026-0001",
              package: "pkg:did:key:z6Mksafe/safe-skill",
              severity: "critical",
              status: "active",
              title: "Compromised release",
              versions: ["0.1.0"],
              ignored: true
            }
          ]
        })
      )
    );
    await expect(signAdvisoryFeed({ feedPath, privateKey, publicKeyInfo })).rejects.toThrow(/unexpected field/i);

    await writeFile(feedPath, JSON.stringify(freshAdvisoryFeed({ generatedAt: new Date().toUTCString() })));
    await expect(signAdvisoryFeed({ feedPath, privateKey, publicKeyInfo })).rejects.toThrow(/timestamps/i);
  });
});

function freshAdvisoryFeed(overrides = {}) {
  const now = Date.now();
  return {
    advisories: [],
    expiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
    formatVersion: 1,
    generatedAt: new Date(now - 60_000).toISOString(),
    type: "dev.nipmod.advisories.v1",
    ...overrides
  };
}
