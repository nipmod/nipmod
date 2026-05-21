import { mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { packProject, readBundle, verifyBundle } from "../src/bundle.js";
import { signBytes } from "../src/identity.js";
import { canonicalJson } from "../src/verifier.js";
import { createSignedSkillProject } from "./helpers/package.js";

const fixture = (...parts: string[]) => join(import.meta.dirname, "fixtures", ...parts);

describe("bundle packing", () => {
  test("packs the same project deterministically", async () => {
    const projectDir = fixture("valid-skill");

    const first = await packProject(projectDir);
    const second = await packProject(projectDir);

    expect(first.bytes.equals(second.bytes)).toBe(true);
    expect(first.digest).toBe(second.digest);
    expect(first.manifest.name).toBe("@probe/valid-skill");
  });

  test("verifies a packed bundle and rejects tampering", async () => {
    const packed = await packProject(fixture("valid-skill"));
    const bundle = readBundle(packed.bytes);

    const verified = verifyBundle(packed.bytes, packed.digest);
    expect(verified.manifest.name).toBe("@probe/valid-skill");
    expect(bundle.files.map((file) => file.path)).toEqual(["README.md", "SKILL.md", "nipmod.json"]);

    const temp = await mkdtemp(join(tmpdir(), "nipmod-tamper-"));
    const tamperedPath = join(temp, "tampered.nipmod");
    const tampered = Buffer.from(packed.bytes);
    tampered[tampered.length - 2] = tampered[tampered.length - 2] === 65 ? 66 : 65;
    await writeFile(tamperedPath, tampered);

    await expect(readFile(tamperedPath).then((bytes) => verifyBundle(bytes, packed.digest))).rejects.toThrow(
      /digest/i
    );
  });

  test("verifies signed bundles and rejects unsigned bundles when trust is required", async () => {
    const signedProject = await createSignedSkillProject();
    const signed = await packProject(signedProject.dir, {
      signingPrivateKeyPem: signedProject.identity.privateKeyPem
    });
    const unsigned = await packProject(fixture("valid-skill"));

    expect(verifyBundle(signed.bytes, signed.digest, { requireSignature: true }).signature?.keyId).toBe(
      signedProject.identity.did
    );
    expect(() => verifyBundle(unsigned.bytes, unsigned.digest, { requireSignature: true })).toThrow(/signature/i);
  });

  test("rejects legacy bundle signatures without the nipmod bundle context", async () => {
    const signedProject = await createSignedSkillProject();
    const signed = await packProject(signedProject.dir, {
      signingPrivateKeyPem: signedProject.identity.privateKeyPem
    });
    const bundle = readBundle(signed.bytes);
    const legacyPayload = Buffer.from(
      canonicalJson({
        files: bundle.files,
        formatVersion: bundle.formatVersion,
        manifest: bundle.manifest,
        manifestDigest: bundle.manifestDigest,
        mediaType: bundle.mediaType
      }),
      "utf8"
    );
    const legacyBundle = {
      ...bundle,
      signature: {
        keyId: signedProject.identity.did,
        algorithm: "Ed25519",
        signatureBase64: signBytes(signedProject.identity.privateKeyPem, legacyPayload).toString("base64")
      }
    };

    expect(() =>
      verifyBundle(Buffer.from(canonicalJson(legacyBundle), "utf8"), undefined, { requireSignature: true })
    ).toThrow(/signature/i);
  });

  test("rejects package file paths that escape the project", async () => {
    const temp = await mkdtemp(join(tmpdir(), "nipmod-escape-"));
    const manifest = JSON.parse(await readFile(fixture("valid-skill", "nipmod.json"), "utf8")) as {
      files: string[];
    };
    manifest.files = ["nipmod.json", "../secret.txt"];
    await writeFile(join(temp, "nipmod.json"), JSON.stringify(manifest));

    await expect(packProject(temp)).rejects.toThrow(/unsafe/i);
  });

  test("rejects symlinked package files", async () => {
    const temp = await mkdtemp(join(tmpdir(), "nipmod-symlink-"));
    const outsidePath = join(temp, "outside-secret.txt");
    const manifest = JSON.parse(await readFile(fixture("valid-skill", "nipmod.json"), "utf8")) as {
      files: string[];
    };
    manifest.files = ["SKILL.md", "nipmod.json"];
    await writeFile(outsidePath, "secret");
    await symlink(outsidePath, join(temp, "SKILL.md"));
    await writeFile(join(temp, "nipmod.json"), JSON.stringify(manifest));

    await expect(packProject(temp)).rejects.toThrow(/symlink/i);
  });
});
