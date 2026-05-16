import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { packProject } from "../src/bundle.js";
import { installBundlePackage, installFilePackage, listInstalledPackages, uninstallPackage } from "../src/install.js";
import { createSignedSkillProject } from "./helpers/package.js";

const fixture = (...parts: string[]) => join(import.meta.dirname, "fixtures", ...parts);

describe("local install", () => {
  test("installs a file bundle and writes a lockfile entry", async () => {
    const signedProject = await createSignedSkillProject();
    const packed = await packProject(signedProject.dir, {
      signingPrivateKeyPem: signedProject.identity.privateKeyPem
    });
    const temp = await mkdtemp(join(tmpdir(), "nipmod-install-"));
    const bundlePath = join(temp, "valid-skill.nipmod");
    await writeFile(bundlePath, packed.bytes);

    const result = await installFilePackage(bundlePath, temp, {
      integrity: `sha256-${packed.digest}`
    });
    const lockfile = JSON.parse(await readFile(join(temp, "nipmod.lock.json"), "utf8"));

    expect(result.lockfileChanged).toBe(true);
    expect(lockfile.packages[`${signedProject.manifest.canonical}@0.1.0`].integrity).toBe(
      `sha256-${packed.digest}`
    );
  });

  test("materializes installed bundles in the local content-addressed store", async () => {
    const signedProject = await createSignedSkillProject();
    const packed = await packProject(signedProject.dir, {
      signingPrivateKeyPem: signedProject.identity.privateKeyPem
    });
    const temp = await mkdtemp(join(tmpdir(), "nipmod-store-"));

    await installBundlePackage(packed.bytes, "https://node.nipmod.com/api/v1/repos/z6MkProbe/signed-skill/blob/releases/0.1.0/bundle.nipmod", temp, {
      integrity: `sha256-${packed.digest}`
    });

    const storePath = join(temp, ".nipmod", "store", "sha256", packed.digest, "bundle.nipmod");
    const lockfile = JSON.parse(await readFile(join(temp, "nipmod.lock.json"), "utf8"));
    const entry = lockfile.packages[`${signedProject.manifest.canonical}@0.1.0`];

    expect(await readFile(storePath, "utf8")).toBe(packed.bytes.toString("utf8"));
    expect(entry.storePath).toBe(`.nipmod/store/sha256/${packed.digest}/bundle.nipmod`);
  });

  test("rejects installs without an external integrity pin", async () => {
    const packed = await packProject(fixture("valid-skill"));
    const temp = await mkdtemp(join(tmpdir(), "nipmod-no-integrity-"));
    const bundlePath = join(temp, "unsigned.nipmod");
    await writeFile(bundlePath, packed.bytes);

    await expect(installFilePackage(bundlePath, temp)).rejects.toThrow(/integrity/i);
  });

  test("rejects malformed existing lockfiles", async () => {
    const signedProject = await createSignedSkillProject();
    const packed = await packProject(signedProject.dir, {
      signingPrivateKeyPem: signedProject.identity.privateKeyPem
    });
    const temp = await mkdtemp(join(tmpdir(), "nipmod-bad-lock-"));
    const bundlePath = join(temp, "signed.nipmod");
    await writeFile(bundlePath, packed.bytes);
    await writeFile(
      join(temp, "nipmod.lock.json"),
      JSON.stringify({ formatVersion: 1, generatedBy: "test", packages: { broken: { integrity: "bad" } } })
    );

    await expect(
      installFilePackage(bundlePath, temp, {
        integrity: `sha256-${packed.digest}`
      })
    ).rejects.toThrow(/lockfile/i);
  });

  test("rejects unsafe permission scopes in existing lockfiles before overwrite", async () => {
    const signedProject = await createSignedSkillProject();
    const packed = await packProject(signedProject.dir, {
      signingPrivateKeyPem: signedProject.identity.privateKeyPem
    });
    const temp = await mkdtemp(join(tmpdir(), "nipmod-unsafe-lock-"));
    const bundlePath = join(temp, "signed.nipmod");
    const packageKey = `${signedProject.manifest.canonical}@0.1.0`;
    await writeFile(bundlePath, packed.bytes);
    await writeFile(
      join(temp, "nipmod.lock.json"),
      JSON.stringify({
        formatVersion: 1,
        generatedBy: "test",
        packages: {
          [packageKey]: {
            canonical: signedProject.manifest.canonical,
            files: ["README.md", "SKILL.md", "nipmod.json"],
            integrity: `sha256-${packed.digest}`,
            manifestDigest: packed.manifestDigest,
            name: signedProject.manifest.name,
            permissions: {
              env: [],
              exec: { allowed: false },
              filesystem: [],
              mcpTools: [],
              network: ["*"],
              postinstall: { allowed: false },
              secrets: []
            },
            publisher: signedProject.identity.did,
            resolved: "https://node.nipmod.com/api/v1/repos/z6MkProbe/signed-skill/blob/releases/0.1.0/bundle.nipmod",
            version: "0.1.0"
          }
        }
      })
    );

    await expect(
      installFilePackage(bundlePath, temp, {
        integrity: `sha256-${packed.digest}`
      })
    ).rejects.toThrow(/lockfile invalid/i);
  });

  test("records HTTPS Gitlawb bundle URLs in the lockfile", async () => {
    const signedProject = await createSignedSkillProject();
    const packed = await packProject(signedProject.dir, {
      signingPrivateKeyPem: signedProject.identity.privateKeyPem
    });
    const temp = await mkdtemp(join(tmpdir(), "nipmod-remote-lock-"));
    const resolved =
      "https://node.nipmod.com/api/v1/repos/z6MkProbe/signed-skill/blob/releases/0.1.0/bundle.nipmod";

    const result = await installBundlePackage(packed.bytes, resolved, temp, {
      integrity: `sha256-${packed.digest}`
    });
    const lockfile = JSON.parse(await readFile(join(temp, "nipmod.lock.json"), "utf8"));

    expect(result.lockfileChanged).toBe(true);
    expect(lockfile.packages[`${signedProject.manifest.canonical}@0.1.0`].resolved).toBe(resolved);
  });

  test("records loopback HTTP Gitlawb bundle URLs for local nodes", async () => {
    const signedProject = await createSignedSkillProject();
    const packed = await packProject(signedProject.dir, {
      signingPrivateKeyPem: signedProject.identity.privateKeyPem
    });
    const temp = await mkdtemp(join(tmpdir(), "nipmod-local-node-lock-"));
    const resolved = "http://127.0.0.1:7545/api/v1/repos/z6MkProbe/signed-skill/blob/releases/0.1.0/bundle.nipmod";

    await installBundlePackage(packed.bytes, resolved, temp, {
      integrity: `sha256-${packed.digest}`
    });
    const lockfile = JSON.parse(await readFile(join(temp, "nipmod.lock.json"), "utf8"));

    expect(lockfile.packages[`${signedProject.manifest.canonical}@0.1.0`].resolved).toBe(resolved);
  });

  test("lists and uninstalls lockfile packages without deleting the content store", async () => {
    const signedProject = await createSignedSkillProject();
    const packed = await packProject(signedProject.dir, {
      signingPrivateKeyPem: signedProject.identity.privateKeyPem
    });
    const temp = await mkdtemp(join(tmpdir(), "nipmod-uninstall-"));

    await installBundlePackage(packed.bytes, "https://node.nipmod.com/api/v1/repos/z6MkProbe/signed-skill/blob/releases/0.1.0/bundle.nipmod", temp, {
      integrity: `sha256-${packed.digest}`
    });

    expect(await listInstalledPackages(temp)).toEqual([
      expect.objectContaining({
        canonical: signedProject.manifest.canonical,
        name: signedProject.manifest.name,
        version: "0.1.0"
      })
    ]);

    const result = await uninstallPackage(signedProject.manifest.name, temp);
    const lockfile = JSON.parse(await readFile(join(temp, "nipmod.lock.json"), "utf8"));
    const storePath = join(temp, ".nipmod", "store", "sha256", packed.digest, "bundle.nipmod");

    expect(result).toMatchObject({ lockfileChanged: true, removed: true });
    expect(lockfile.packages).toEqual({});
    expect(await readFile(storePath, "utf8")).toBe(packed.bytes.toString("utf8"));
  });

  test("rejects remote bundles that do not match the requested package identity", async () => {
    const signedProject = await createSignedSkillProject();
    const packed = await packProject(signedProject.dir, {
      signingPrivateKeyPem: signedProject.identity.privateKeyPem
    });
    const temp = await mkdtemp(join(tmpdir(), "nipmod-identity-mismatch-"));

    await expect(
      installBundlePackage(packed.bytes, "https://node.nipmod.com/api/v1/repos/z6MkProbe/other/blob/releases/0.1.0/bundle.nipmod", temp, {
        integrity: `sha256-${packed.digest}`,
        expected: {
          canonical: `pkg:${signedProject.identity.did}/other`,
          version: "0.1.0"
        }
      })
    ).rejects.toThrow(/identity mismatch/i);
  });
});
