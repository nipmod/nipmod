import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { generateIdentity } from "../src/identity.js";
import { packProject } from "../src/bundle.js";
import {
  installBundlePackage,
  installFilePackage,
  installPackageGraph,
  listInstalledPackages,
  uninstallPackage
} from "../src/install.js";
import { type Manifest } from "../src/protocol.js";
import { NIPMOD_VERSION } from "../src/version.js";
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
    expect(lockfile.formatVersion).toBe(2);
    expect(lockfile.generatedBy).toBe(`nipmod/${NIPMOD_VERSION}`);
    expect(lockfile.packages[`${signedProject.manifest.canonical}@0.1.0`].integrity).toBe(
      `sha256-${packed.digest}`
    );
  });

  test("single package install records dependency snapshots without requiring unfetched dependencies", async () => {
    const app = await createSignedPackage({
      dependencies: { "agent-logger": "^1.0.0" },
      name: "workflow-runner",
      slug: "workflow-runner",
      version: "0.1.0"
    });
    const appBundle = await packProject(app.dir, {
      signingPrivateKeyPem: app.identity.privateKeyPem
    });
    const temp = await mkdtemp(join(tmpdir(), "nipmod-single-deps-"));

    await expect(
      installBundlePackage(appBundle.bytes, graphNode(app, appBundle).resolved, temp, {
        integrity: `sha256-${appBundle.digest}`
      })
    ).resolves.toMatchObject({ lockfileChanged: true });

    const lockfile = JSON.parse(await readFile(join(temp, "nipmod.lock.json"), "utf8"));
    const appKey = `${app.manifest.canonical}@0.1.0`;
    expect(lockfile.snapshots[appKey].dependencies).toEqual({});
  });

  test("installs a dependency graph into a v2 lockfile with root intent and snapshots", async () => {
    const dependency = await createSignedPackage({ name: "agent-logger", slug: "agent-logger", version: "1.2.0" });
    const app = await createSignedPackage({
      dependencies: { "agent-logger": "^1.0.0" },
      name: "workflow-runner",
      slug: "workflow-runner",
      version: "0.1.0"
    });
    const depBundle = await packProject(dependency.dir, {
      signingPrivateKeyPem: dependency.identity.privateKeyPem
    });
    const appBundle = await packProject(app.dir, {
      signingPrivateKeyPem: app.identity.privateKeyPem
    });
    const temp = await mkdtemp(join(tmpdir(), "nipmod-graph-"));

    const result = await installPackageGraph(
      [
        graphNode(app, appBundle, {
          rootDependency: {
            kind: "dependencies",
            name: "workflow-runner",
            spec: "latest"
          }
        }),
        graphNode(dependency, depBundle)
      ],
      temp
    );

    const lockfile = JSON.parse(await readFile(join(temp, "nipmod.lock.json"), "utf8"));
    const appKey = `${app.manifest.canonical}@0.1.0`;
    const depKey = `${dependency.manifest.canonical}@1.2.0`;

    expect(result.lockfileChanged).toBe(true);
    expect(lockfile).toMatchObject({
      formatVersion: 2,
      root: {
        dependencies: {
          "workflow-runner": "latest"
        }
      }
    });
    expect(lockfile.packages[appKey].storePath).toMatch(/^\.nipmod\/store\/sha256\/[a-f0-9]{64}\/bundle\.nipmod$/);
    expect(lockfile.packages[depKey].storePath).toMatch(/^\.nipmod\/store\/sha256\/[a-f0-9]{64}\/bundle\.nipmod$/);
    expect(lockfile.snapshots[appKey].dependencies).toEqual({
      "agent-logger": depKey
    });
    expect(lockfile.snapshots[depKey].dependencies).toEqual({});

    const removed = await uninstallPackage(app.manifest.name, temp);
    const nextLockfile = JSON.parse(await readFile(join(temp, "nipmod.lock.json"), "utf8"));

    expect(removed.removed).toBe(true);
    expect(removed.removedPackages.map((pkg) => pkg.packageKey).sort()).toEqual([appKey, depKey].sort());
    expect(nextLockfile.root.dependencies).toEqual({});
    expect(nextLockfile.packages[appKey]).toBeUndefined();
    expect(nextLockfile.packages[depKey]).toBeUndefined();
  });

  test("keeps canonical root dependencies distinct for packages with the same display name", async () => {
    const first = await createSignedPackage({ name: "shared-agent", slug: "shared-agent", version: "0.1.0" });
    const second = await createSignedPackage({ name: "shared-agent", slug: "shared-agent", version: "0.1.0" });
    const firstBundle = await packProject(first.dir, {
      signingPrivateKeyPem: first.identity.privateKeyPem
    });
    const secondBundle = await packProject(second.dir, {
      signingPrivateKeyPem: second.identity.privateKeyPem
    });
    const temp = await mkdtemp(join(tmpdir(), "nipmod-canonical-roots-"));

    await installPackageGraph(
      [
        graphNode(first, firstBundle, {
          rootDependency: {
            kind: "dependencies",
            name: first.manifest.canonical,
            spec: first.manifest.version
          }
        }),
        graphNode(second, secondBundle, {
          rootDependency: {
            kind: "dependencies",
            name: second.manifest.canonical,
            spec: second.manifest.version
          }
        })
      ],
      temp
    );

    const lockfile = JSON.parse(await readFile(join(temp, "nipmod.lock.json"), "utf8"));

    expect(lockfile.root.dependencies).toEqual({
      [first.manifest.canonical]: "0.1.0",
      [second.manifest.canonical]: "0.1.0"
    });
  });

  test("rejects graph installs with missing required dependencies before writing the lockfile", async () => {
    const app = await createSignedPackage({
      dependencies: { missing: "^1.0.0" },
      name: "workflow-runner",
      slug: "workflow-runner",
      version: "0.1.0"
    });
    const appBundle = await packProject(app.dir, {
      signingPrivateKeyPem: app.identity.privateKeyPem
    });
    const temp = await mkdtemp(join(tmpdir(), "nipmod-graph-missing-"));

    await expect(installPackageGraph([graphNode(app, appBundle)], temp)).rejects.toThrow(/missing dependency/i);
    await expect(readFile(join(temp, "nipmod.lock.json"), "utf8")).rejects.toThrow(/ENOENT/);
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

  test("refuses to write the local store through symlinked store directories", async () => {
    const signedProject = await createSignedSkillProject();
    const packed = await packProject(signedProject.dir, {
      signingPrivateKeyPem: signedProject.identity.privateKeyPem
    });
    const temp = await mkdtemp(join(tmpdir(), "nipmod-store-symlink-"));
    const outside = await mkdtemp(join(tmpdir(), "nipmod-store-outside-"));
    await symlink(outside, join(temp, ".nipmod"));

    await expect(
      installBundlePackage(packed.bytes, "https://node.nipmod.com/api/v1/repos/z6MkProbe/signed-skill/blob/releases/0.1.0/bundle.nipmod", temp, {
        integrity: `sha256-${packed.digest}`
      })
    ).rejects.toThrow(/symlink/i);
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

async function createSignedPackage(options: {
  dependencies?: Record<string, string>;
  name: string;
  slug: string;
  version: string;
}) {
  const dir = await mkdtemp(join(tmpdir(), "nipmod-package-"));
  const identity = generateIdentity();
  const manifest: Manifest = {
    formatVersion: 2,
    name: options.name,
    canonical: `pkg:${identity.did}/${options.slug}`,
    version: options.version,
    type: "skill",
    exports: {
      ".": {
        skill: "./SKILL.md"
      }
    },
    files: ["README.md", "SKILL.md", "nipmod.json"],
    permissions: {
      env: [],
      exec: { allowed: false },
      filesystem: [],
      mcpTools: [],
      network: [],
      postinstall: { allowed: false },
      secrets: []
    },
    publish: {
      provenance: "local",
      signingKey: identity.did
    },
    ...(options.dependencies ? { dependencies: options.dependencies } : {})
  };

  await mkdir(join(dir, ".nipmod"), { recursive: true });
  await writeFile(join(dir, "README.md"), `# ${options.name}\n`);
  await writeFile(join(dir, "SKILL.md"), `# ${options.name}\n`);
  await writeFile(join(dir, "nipmod.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(dir, ".nipmod", "identity.json"), `${JSON.stringify(identity, null, 2)}\n`, {
    mode: 0o600
  });

  return { dir, identity, manifest };
}

function graphNode(
  project: { manifest: Manifest },
  bundle: { bytes: Uint8Array; digest: string },
  options: {
    rootDependency?: {
      kind: "dependencies" | "devDependencies" | "optionalDependencies" | "peerDependencies";
      name: string;
      spec: string;
    };
  } = {}
) {
  const resolved = `https://node.nipmod.com/api/v1/repos/${project.manifest.publish.signingKey.slice(
    "did:key:".length
  )}/${project.manifest.canonical.split("/").at(-1)}/blob/releases/${project.manifest.version}/bundle.nipmod`;
  return {
    bundleBytes: bundle.bytes,
    expected: {
      canonical: project.manifest.canonical,
      version: project.manifest.version
    },
    integrity: `sha256-${bundle.digest}`,
    resolved,
    ...options
  };
}
