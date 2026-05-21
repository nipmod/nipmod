import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  createReleasePublicKeyInfo,
  signReleaseArtifact,
  verifyReleaseSignature
} from "./release-signing.mjs";

describe("release signing", () => {
  test("signs and verifies a release artifact with the pinned public key", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-release-signing-"));
    const artifactPath = join(dir, "nipmod-0.1.0.tgz");
    await writeFile(artifactPath, "release-bytes");
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const publicKeyInfo = createReleasePublicKeyInfo(publicKey);
    const signature = await signReleaseArtifact({
      artifactName: "nipmod-0.1.0.tgz",
      artifactPath,
      privateKey,
      publicKeyInfo
    });

    expect(
      await verifyReleaseSignature({
        artifactName: "nipmod-0.1.0.tgz",
        artifactPath,
        publicKeyInfo,
        signature
      })
    ).toBe(true);
  });

  test("rejects tampered release bytes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-release-signing-tamper-"));
    const artifactPath = join(dir, "nipmod-0.1.0.tgz");
    await writeFile(artifactPath, "release-bytes");
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const publicKeyInfo = createReleasePublicKeyInfo(publicKey);
    const signature = await signReleaseArtifact({
      artifactName: "nipmod-0.1.0.tgz",
      artifactPath,
      privateKey,
      publicKeyInfo
    });
    await writeFile(artifactPath, "changed-release-bytes");

    await expect(
      verifyReleaseSignature({
        artifactName: "nipmod-0.1.0.tgz",
        artifactPath,
        publicKeyInfo,
        signature
      })
    ).rejects.toThrow("release artifact signature verification failed");
  });

  test("rejects a signature for a different artifact name", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-release-signing-name-"));
    const artifactPath = join(dir, "nipmod-0.1.0.tgz");
    await writeFile(artifactPath, "release-bytes");
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const publicKeyInfo = createReleasePublicKeyInfo(publicKey);
    const signature = await signReleaseArtifact({
      artifactName: "nipmod-0.1.0.tgz",
      artifactPath,
      privateKey,
      publicKeyInfo
    });

    await expect(
      verifyReleaseSignature({
        artifactName: "nipmod-0.0.1.tgz",
        artifactPath,
        publicKeyInfo,
        signature
      })
    ).rejects.toThrow("release signature artifact mismatch");
  });
});
