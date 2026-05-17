import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execaNode } from "./helpers/process.js";
import { describe, expect, test } from "vitest";
import { generateIdentity } from "../src/identity.js";
import { inspectRegistryPackage } from "../src/trust-report.js";
import { createTransparencyLogFromLeaves, signWitnessStatement } from "../src/transparency.js";
import { NIPMOD_VERSION } from "../src/version.js";

describe("nipmod CLI", () => {
  test("prints stable help with exit codes for humans and agents", async () => {
    const text = await execaNode(["src/cli.ts", "help"]);
    expect(text.stdout).toContain("usage: nipmod <command>");
    expect(text.stdout).toContain("exit codes:");
    expect(text.stdout).toContain("0 ok");
    expect(text.stdout).toContain("6 audit failed");
    expect(text.stdout).toContain("7 trust or advisory block");
    expect(text.stdout).toContain("8 ci policy failed");

    const json = await execaNode(["src/cli.ts", "help", "--json"]);
    const parsed = JSON.parse(json.stdout) as {
      ok: true;
      data: {
        commands: string[];
        exitCodes: Array<{ code: number; meaning: string }>;
      };
    };

    expect(parsed.ok).toBe(true);
    expect(parsed.data.commands).toEqual(
      expect.arrayContaining(["inspect", "add", "ci", "publish", "package", "manifest", "dist-tag", "deprecate", "yank", "mcp"])
    );
    expect(parsed.data.exitCodes).toEqual(
      expect.arrayContaining([
        { code: 0, meaning: "ok" },
        { code: 6, meaning: "audit failed" },
        { code: 7, meaning: "trust or advisory block" },
        { code: 8, meaning: "ci policy failed" },
        { code: 12, meaning: "preflight not ready" }
      ])
    );
  }, 15_000);

  test("prints the installed version with standard version flags", async () => {
    const long = await execaNode(["src/cli.ts", "--version"]);
    const short = await execaNode(["src/cli.ts", "-v"]);

    expect(long.stdout).toBe(`${NIPMOD_VERSION}\n`);
    expect(short.stdout).toBe(`${NIPMOD_VERSION}\n`);
  }, 15_000);

  test("initializes, packs, verifies, and installs a local package", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-"));
    const pkg = join(workspace, "pkg");
    const app = join(workspace, "app");

    await execaNode(["src/cli.ts", "init", "--name", "@probe/cli-skill", "--dir", pkg]);
    const pack = await execaNode(["src/cli.ts", "pack", pkg, "--out", workspace, "--json"]);
    const packed = JSON.parse(pack.stdout) as { ok: true; data: { path: string; digest: string } };
    await execaNode(["src/cli.ts", "verify", packed.data.path, "--integrity", `sha256-${packed.data.digest}`]);
    await execaNode([
      "src/cli.ts",
      "install",
      `file:${packed.data.path}`,
      "--dir",
      app,
      "--integrity",
      `sha256-${packed.data.digest}`
    ]);

    const lockfile = JSON.parse(await readFile(join(app, "nipmod.lock.json"), "utf8"));
    const packageKeys = Object.keys(lockfile.packages);
    expect(packageKeys).toHaveLength(1);
    expect(packageKeys[0]).toMatch(/^pkg:did:key:z[A-Za-z0-9]+\/cli-skill@0\.1\.0$/);
    expect(lockfile.packages[packageKeys[0]].integrity).toBe(`sha256-${packed.data.digest}`);
  }, 15_000);

  test("init rejects invalid package names before writing a manifest", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-init-invalid-"));
    const pkg = join(workspace, "pkg");

    await expect(execaNode(["src/cli.ts", "init", "--name", "Invalid Name", "--dir", pkg])).rejects.toThrow(/manifest/i);
    await expect(readFile(join(pkg, "nipmod.json"), "utf8")).rejects.toThrow(/ENOENT/);
  }, 15_000);

  test("restores installed packages from the lockfile with nipmod install", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-install-lockfile-"));
    const pkg = join(workspace, "pkg");
    const app = join(workspace, "app");

    await execaNode(["src/cli.ts", "init", "--name", "restored-agent", "--dir", pkg]);
    const pack = await execaNode(["src/cli.ts", "pack", pkg, "--out", workspace, "--json"]);
    const packed = JSON.parse(pack.stdout) as { ok: true; data: { path: string; digest: string } };
    await execaNode([
      "src/cli.ts",
      "install",
      `file:${packed.data.path}`,
      "--dir",
      app,
      "--integrity",
      `sha256-${packed.data.digest}`
    ]);
    await rm(join(app, ".nipmod"), { force: true, recursive: true });

    const restored = await execaNode(["src/cli.ts", "install", "--dir", app, "--json"]);
    const parsed = JSON.parse(restored.stdout) as {
      ok: true;
      data: { fetched: number; lockfileChanged: boolean; packageCount: number; restored: number };
    };
    const lockfile = JSON.parse(await readFile(join(app, "nipmod.lock.json"), "utf8"));
    const packageKey = Object.keys(lockfile.packages)[0];

    expect(parsed.data).toMatchObject({
      fetched: 0,
      lockfileChanged: false,
      packageCount: 1,
      restored: 1
    });
    await expect(readFile(join(app, lockfile.packages[packageKey].storePath))).resolves.toBeTruthy();
  }, 15_000);

  test("offline lockfile install refuses to fetch missing remote bundles", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-install-lockfile-offline-"));
    const pkg = join(workspace, "pkg");
    const app = join(workspace, "app");
    const registryPath = join(workspace, "registry.json");

    await execaNode(["src/cli.ts", "init", "--name", "remote-agent", "--dir", pkg]);
    const pack = JSON.parse((await execaNode(["src/cli.ts", "pack", pkg, "--out", workspace, "--json"])).stdout) as {
      ok: true;
      data: { digest: string; path: string };
    };
    const manifest = JSON.parse(await readFile(join(pkg, "nipmod.json"), "utf8")) as {
      canonical: string;
      publish: { signingKey: string };
      version: string;
    };
    const server = await serveBundle(await readFile(pack.data.path), manifest.canonical, manifest.version);
    try {
      const graphRegistry = cliGraphRegistry([
        {
          canonical: manifest.canonical,
          digest: pack.data.digest,
          owner: manifest.publish.signingKey,
          resolved: server.resolved,
          sourceRepo: server.sourceRepo
        }
      ]);
      await writeFile(registryPath, `${JSON.stringify(graphRegistry.registry)}\n`);
      await execaNode([
        "src/cli.ts",
        "add",
        "remote-agent",
        "--registry",
        pathToFileURL(registryPath).href,
        "--allow-custom-roots",
        "--log-id",
        graphRegistry.log.treeHead.logId,
        "--witness",
        graphRegistry.witness.witness,
        "--dir",
        app,
        "--json"
      ]);
      await rm(join(app, ".nipmod"), { force: true, recursive: true });

      const failed = await expectCliJsonFailure(["src/cli.ts", "install", "--dir", app, "--offline", "--json"]);
      expect(failed).toMatchObject({
        error: {
          message: expect.stringContaining("requires network access")
        },
        exitCode: 1,
        ok: false
      });
      await expect(readFile(join(app, "nipmod.lock.json"), "utf8")).resolves.toBeTruthy();
    } finally {
      await server.close();
    }
  }, 30_000);

  test("lockfile install rechecks signed manifest permissions before restore", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-install-lockfile-policy-"));
    const pkg = join(workspace, "pkg");
    const app = join(workspace, "app");

    await execaNode(["src/cli.ts", "init", "--name", "policy-restore-agent", "--dir", pkg]);
    const manifestPath = join(pkg, "nipmod.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      permissions: { mcpTools: string[] };
    };
    manifest.permissions.mcpTools = ["github.search"];
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const pack = JSON.parse((await execaNode(["src/cli.ts", "pack", pkg, "--out", workspace, "--json"])).stdout) as {
      ok: true;
      data: { digest: string; path: string };
    };
    await execaNode([
      "src/cli.ts",
      "install",
      `file:${pack.data.path}`,
      "--dir",
      app,
      "--integrity",
      `sha256-${pack.data.digest}`
    ]);

    const lockfilePath = join(app, "nipmod.lock.json");
    const lockfile = JSON.parse(await readFile(lockfilePath, "utf8")) as {
      packages: Record<string, { permissions: { mcpTools: string[] }; storePath: string }>;
    };
    const packageKey = Object.keys(lockfile.packages)[0]!;
    lockfile.packages[packageKey]!.permissions.mcpTools = [];
    await writeFile(lockfilePath, `${JSON.stringify(lockfile, null, 2)}\n`);
    await rm(join(app, ".nipmod"), { force: true, recursive: true });

    const failed = await expectCliJsonFailure([
      "src/cli.ts",
      "install",
      "--dir",
      app,
      "--profile",
      "developer-default",
      "--json"
    ]);
    const after = JSON.parse(await readFile(lockfilePath, "utf8")) as {
      packages: Record<string, { permissions: { mcpTools: string[] }; storePath: string }>;
    };

    expect(failed).toMatchObject({
      data: {
        policyCheck: {
          allowed: false
        }
      },
      exitCode: 11,
      ok: false
    });
    expect(failed.data?.policyCheck?.packages?.[0]?.decision?.reasons).toEqual(
      expect.arrayContaining(["permission mcpTools is blocked by developer-default"])
    );
    expect(after.packages[packageKey]!.permissions.mcpTools).toEqual([]);
    await expect(readFile(join(app, after.packages[packageKey]!.storePath))).rejects.toMatchObject({ code: "ENOENT" });
  }, 15_000);

  test("online lockfile install refetches a corrupt remote bundle cache", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-install-lockfile-refetch-"));
    const pkg = join(workspace, "pkg");
    const app = join(workspace, "app");
    const registryPath = join(workspace, "registry.json");

    await execaNode(["src/cli.ts", "init", "--name", "refetch-agent", "--dir", pkg]);
    const pack = JSON.parse((await execaNode(["src/cli.ts", "pack", pkg, "--out", workspace, "--json"])).stdout) as {
      ok: true;
      data: { digest: string; path: string };
    };
    const manifest = JSON.parse(await readFile(join(pkg, "nipmod.json"), "utf8")) as {
      canonical: string;
      publish: { signingKey: string };
      version: string;
    };
    const server = await serveBundle(await readFile(pack.data.path), manifest.canonical, manifest.version);
    try {
      const graphRegistry = cliGraphRegistry([
        {
          canonical: manifest.canonical,
          digest: pack.data.digest,
          owner: manifest.publish.signingKey,
          resolved: server.resolved,
          sourceRepo: server.sourceRepo
        }
      ]);
      await writeFile(registryPath, `${JSON.stringify(graphRegistry.registry)}\n`);
      await execaNode([
        "src/cli.ts",
        "add",
        "refetch-agent",
        "--registry",
        pathToFileURL(registryPath).href,
        "--allow-custom-roots",
        "--log-id",
        graphRegistry.log.treeHead.logId,
        "--witness",
        graphRegistry.witness.witness,
        "--dir",
        app,
        "--json"
      ]);
      const lockfile = JSON.parse(await readFile(join(app, "nipmod.lock.json"), "utf8")) as {
        packages: Record<string, { storePath: string }>;
      };
      const packageKey = Object.keys(lockfile.packages)[0]!;
      const storePath = join(app, lockfile.packages[packageKey]!.storePath);
      await writeFile(storePath, "corrupt bundle");

      const restored = await execaNode(["src/cli.ts", "install", "--dir", app, "--json"]);
      const parsed = JSON.parse(restored.stdout) as {
        ok: true;
        data: { fetched: number; restored: number };
      };

      expect(parsed.data).toMatchObject({ fetched: 1, restored: 1 });
      expect(Buffer.compare(await readFile(storePath), await readFile(pack.data.path))).toBe(0);
    } finally {
      await server.close();
    }
  }, 30_000);

  test("lockfile install with policy handles a missing lockfile as empty", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-install-empty-policy-"));
    const app = join(workspace, "app");

    const restored = await execaNode([
      "src/cli.ts",
      "install",
      "--dir",
      app,
      "--profile",
      "developer-default",
      "--json"
    ]);
    const parsed = JSON.parse(restored.stdout) as {
      ok: true;
      data: { packageCount: number; policyCheck: { allowed: boolean; summary: { total: number } }; restored: number };
    };

    expect(parsed.data).toMatchObject({
      packageCount: 0,
      policyCheck: { allowed: true, summary: { total: 0 } },
      restored: 0
    });
  });

  test("lockfile install rejects package install flags when no package is provided", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-install-flags-"));
    const failed = await expectCliJsonFailure([
      "src/cli.ts",
      "install",
      "--dir",
      workspace,
      "--integrity",
      `sha256-${"a".repeat(64)}`,
      "--json"
    ]);

    expect(failed).toMatchObject({
      error: {
        message: "install without a package specifier does not accept --integrity"
      },
      exitCode: 1,
      ok: false
    });
  });

  test("lists and uninstalls installed packages from the CLI", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-uninstall-"));
    const pkg = join(workspace, "pkg");
    const app = join(workspace, "app");

    await execaNode(["src/cli.ts", "init", "--name", "@probe/removable-agent", "--dir", pkg]);
    const pack = await execaNode(["src/cli.ts", "pack", pkg, "--out", workspace, "--json"]);
    const packed = JSON.parse(pack.stdout) as { ok: true; data: { path: string; digest: string } };
    await execaNode([
      "src/cli.ts",
      "install",
      `file:${packed.data.path}`,
      "--dir",
      app,
      "--integrity",
      `sha256-${packed.data.digest}`
    ]);

    const listed = await execaNode(["src/cli.ts", "ls", "--dir", app, "--json"]);
    const listJson = JSON.parse(listed.stdout) as { ok: true; data: { packages: Array<{ name: string }> } };
    expect(listJson.data.packages.map((item) => item.name)).toEqual(["@probe/removable-agent"]);

    const removed = await execaNode(["src/cli.ts", "uninstall", "@probe/removable-agent", "--dir", app, "--json"]);
    const removedJson = JSON.parse(removed.stdout) as { ok: true; data: { removed: boolean } };
    const lockfile = JSON.parse(await readFile(join(app, "nipmod.lock.json"), "utf8"));

    expect(removedJson.data.removed).toBe(true);
    expect(lockfile.packages).toEqual({});
  }, 15_000);

  test("reports outdated installed packages with wanted and latest versions", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-outdated-"));
    const app = join(workspace, "app");
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/outdated-agent`;
    const currentKey = `${canonical}@0.1.0`;
    const registryPath = join(workspace, "registry.json");
    await mkdir(app, { recursive: true });
    await writeFile(
      join(app, "nipmod.lock.json"),
      `${JSON.stringify({
        formatVersion: 2,
        generatedBy: "test",
        packages: {
          [currentKey]: lockfilePackageFixture(owner, "outdated-agent", "0.1.0", "a".repeat(64))
        },
        root: {
          dependencies: {
            "outdated-agent": "^0.1.0"
          },
          devDependencies: {},
          optionalDependencies: {},
          peerDependencies: {}
        },
        snapshots: {
          [currentKey]: emptyLockfileSnapshot()
        }
      })}\n`
    );
    await writeFile(
      registryPath,
      `${JSON.stringify({
        formatVersion: 1,
        packages: [
          searchPackageFixture(owner, "outdated-agent", "skill", 100),
          {
            ...searchPackageFixture(owner, "outdated-agent", "skill", 100),
            digest: "b".repeat(64),
            version: "0.1.3"
          },
          {
            ...searchPackageFixture(owner, "outdated-agent", "skill", 100),
            digest: "c".repeat(64),
            version: "0.2.0"
          }
        ],
        source: "file-test"
      })}\n`
    );

    const text = await execaNode(["src/cli.ts", "outdated", "--dir", app, "--registry", pathToFileURL(registryPath).href]);
    expect(text.stdout).toContain("nipmod outdated - 1 package");
    expect(text.stdout).toContain("outdated-agent");
    expect(text.stdout).toContain("0.1.0");
    expect(text.stdout).toContain("0.1.3");
    expect(text.stdout).toContain("0.2.0");
    expect(text.stdout).toContain("^0.1.0");

    const json = await execaNode([
      "src/cli.ts",
      "outdated",
      "--dir",
      app,
      "--registry",
      pathToFileURL(registryPath).href,
      "--json"
    ]);
    const parsed = JSON.parse(json.stdout) as {
      ok: true;
      data: {
        outdated: Array<{ current: string; latest: string; name: string; spec: string; wanted: string }>;
        summary: { checked: number; outdated: number };
      };
    };
    expect(parsed.data.summary).toMatchObject({ checked: 1, outdated: 1 });
    expect(parsed.data.outdated).toEqual([
      expect.objectContaining({
        current: "0.1.0",
        latest: "0.2.0",
        name: "outdated-agent",
        spec: "^0.1.0",
        wanted: "0.1.3"
      })
    ]);
  });

  test("outdated stays quiet when installed packages are current", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-outdated-current-"));
    const app = join(workspace, "app");
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/fresh-agent`;
    const packageKey = `${canonical}@1.0.0`;
    const registryPath = join(workspace, "registry.json");
    await mkdir(app, { recursive: true });
    await writeFile(
      join(app, "nipmod.lock.json"),
      `${JSON.stringify({
        formatVersion: 2,
        generatedBy: "test",
        packages: {
          [packageKey]: lockfilePackageFixture(owner, "fresh-agent", "1.0.0", "a".repeat(64))
        },
        root: {
          dependencies: {
            "fresh-agent": "latest"
          },
          devDependencies: {},
          optionalDependencies: {},
          peerDependencies: {}
        },
        snapshots: {
          [packageKey]: emptyLockfileSnapshot()
        }
      })}\n`
    );
    await writeFile(
      registryPath,
      `${JSON.stringify({
        formatVersion: 1,
        packages: [searchPackageFixture(owner, "fresh-agent", "skill", 100, "Fresh agent")],
        source: "file-test"
      })}\n`
    );

    const result = await execaNode(["src/cli.ts", "outdated", "--dir", app, "--registry", pathToFileURL(registryPath).href]);
    expect(result.stdout).toBe("all installed packages are current\n");
  });

  test("update reports skipped root dependencies as blocked", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-update-skipped-"));
    const app = join(workspace, "app");
    const registryPath = join(workspace, "registry.json");
    await mkdir(app, { recursive: true });
    await writeFile(
      join(app, "nipmod.lock.json"),
      `${JSON.stringify({
        formatVersion: 2,
        generatedBy: "test",
        packages: {},
        root: {
          dependencies: {
            "missing-agent": "latest"
          },
          devDependencies: {},
          optionalDependencies: {},
          peerDependencies: {}
        },
        snapshots: {}
      })}\n`
    );
    await writeFile(
      registryPath,
      `${JSON.stringify({
        formatVersion: 1,
        packages: [],
        source: "file-test"
      })}\n`
    );

    const failed = await expectCliJsonFailure([
      "src/cli.ts",
      "update",
      "missing-agent",
      "--plan",
      "--registry",
      pathToFileURL(registryPath).href,
      "--allow-custom-roots",
      "--dir",
      app,
      "--json"
    ]);

    expect(failed).toMatchObject({
      data: {
        plan: {
          readyToUpdate: false,
          skipped: [expect.objectContaining({ name: "missing-agent" })]
        }
      },
      exitCode: 7,
      ok: false
    });
  });

  test("update honors registry latest dist tags", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-update-dist-tags-"));
    const app = join(workspace, "app");
    const registryPath = join(workspace, "registry.json");
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/dist-tag-agent`;
    const oldKey = `${canonical}@0.9.0`;
    await mkdir(app, { recursive: true });
    await writeFile(
      join(app, "nipmod.lock.json"),
      `${JSON.stringify({
        formatVersion: 2,
        generatedBy: "test",
        packages: {
          [oldKey]: lockfilePackageFixture(owner, "dist-tag-agent", "0.9.0", "9".repeat(64))
        },
        root: {
          dependencies: {
            "dist-tag-agent": "latest"
          },
          devDependencies: {},
          optionalDependencies: {},
          peerDependencies: {}
        },
        snapshots: {
          [oldKey]: emptyLockfileSnapshot()
        }
      })}\n`
    );
    const registry = cliGraphRegistry([
      {
        canonical,
        digest: "1".repeat(64),
        distTags: { latest: "1.0.0", next: "2.0.0" },
        owner,
        version: "1.0.0"
      },
      {
        canonical,
        digest: "2".repeat(64),
        distTags: { latest: "1.0.0", next: "2.0.0" },
        owner,
        version: "2.0.0"
      }
    ]);
    await writeFile(registryPath, `${JSON.stringify(registry.registry)}\n`);

    const result = await execaNode([
      "src/cli.ts",
      "update",
      "dist-tag-agent",
      "--plan",
      "--registry",
      pathToFileURL(registryPath).href,
      "--allow-custom-roots",
      "--log-id",
      registry.log.treeHead.logId,
      "--witness",
      registry.witness.witness,
      "--dir",
      app,
      "--json"
    ]);
    const parsed = JSON.parse(result.stdout) as {
      ok: true;
      data: { plan: { updates: Array<{ latest: string; wanted: string }> } };
    };

    expect(parsed.data.plan.updates).toEqual([expect.objectContaining({ latest: "1.0.0", wanted: "1.0.0" })]);
  });

  test("update pins the exact wanted version across registry reads", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-update-drift-"));
    const app = join(workspace, "app");
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/drift-agent`;
    const oldKey = `${canonical}@0.1.0`;
    await mkdir(app, { recursive: true });
    await writeFile(
      join(app, "nipmod.lock.json"),
      `${JSON.stringify({
        formatVersion: 2,
        generatedBy: "test",
        packages: {
          [oldKey]: lockfilePackageFixture(owner, "drift-agent", "0.1.0", "1".repeat(64))
        },
        root: {
          dependencies: {
            "drift-agent": "latest"
          },
          devDependencies: {},
          optionalDependencies: {},
          peerDependencies: {}
        },
        snapshots: {
          [oldKey]: emptyLockfileSnapshot()
        }
      })}\n`
    );
    const firstRegistry = cliGraphRegistry([
      {
        canonical,
        digest: "2".repeat(64),
        owner,
        version: "0.2.0"
      }
    ]);
    const secondRegistry = cliGraphRegistry([
      {
        canonical,
        digest: "2".repeat(64),
        owner,
        version: "0.2.0"
      },
      {
        canonical,
        digest: "3".repeat(64),
        owner,
        version: "0.3.0"
      }
    ]);
    let requestCount = 0;
    const server = createServer((_request, response) => {
      requestCount += 1;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(requestCount === 1 ? firstRegistry.registry : secondRegistry.registry));
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("test server did not bind to tcp");
    }

    try {
      const failed = (await expectCliJsonFailure([
        "src/cli.ts",
        "update",
        "drift-agent",
        "--plan",
        "--registry",
        `http://127.0.0.1:${address.port}/registry.json`,
        "--allow-custom-roots",
        "--dir",
        app,
        "--json"
      ])) as {
        data: { plan: { updates: Array<{ plan: { package: { version: string } }; wanted: string }> } };
      };

      expect(failed.data.plan.updates).toEqual([
        expect.objectContaining({
          plan: expect.objectContaining({ package: expect.objectContaining({ version: "0.2.0" }) }),
          wanted: "0.2.0"
        })
      ]);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  });

  test("update executes a dist tag root without lockfile tag metadata", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-update-tag-exec-"));
    const app = join(workspace, "app");
    const pkg = join(workspace, "pkg");
    const registryPath = join(workspace, "registry.json");
    await execaNode(["src/cli.ts", "init", "--name", "tag-update-agent", "--dir", pkg]);

    const manifestPath = join(pkg, "nipmod.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      canonical: string;
      publish: { signingKey: string };
      version: string;
    };
    manifest.version = "0.2.0";
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const pack = JSON.parse((await execaNode(["src/cli.ts", "pack", pkg, "--out", workspace, "--json"])).stdout) as {
      ok: true;
      data: { digest: string; path: string };
    };
    const server = await serveBundle(await readFile(pack.data.path), manifest.canonical, "0.2.0");
    try {
      const oldKey = `${manifest.canonical}@0.1.0`;
      await mkdir(app, { recursive: true });
      await writeFile(
        join(app, "nipmod.lock.json"),
        `${JSON.stringify({
          formatVersion: 2,
          generatedBy: "test",
          packages: {
            [oldKey]: lockfilePackageFixture(manifest.publish.signingKey, "tag-update-agent", "0.1.0", "1".repeat(64))
          },
          root: {
            dependencies: {
              "tag-update-agent": "next"
            },
            devDependencies: {},
            optionalDependencies: {},
            peerDependencies: {}
          },
          snapshots: {
            [oldKey]: emptyLockfileSnapshot()
          }
        })}\n`
      );
      const registry = cliGraphRegistry([
        {
          canonical: manifest.canonical,
          digest: pack.data.digest,
          distTags: { next: "0.2.0" },
          owner: manifest.publish.signingKey,
          resolved: server.resolved,
          sourceRepo: server.sourceRepo,
          version: "0.2.0"
        }
      ]);
      await writeFile(registryPath, `${JSON.stringify(registry.registry)}\n`);

      const result = await execaNode([
        "src/cli.ts",
        "update",
        "tag-update-agent",
        "--registry",
        pathToFileURL(registryPath).href,
        "--allow-custom-roots",
        "--log-id",
        registry.log.treeHead.logId,
        "--witness",
        registry.witness.witness,
        "--dir",
        app,
        "--json"
      ]);
      const parsed = JSON.parse(result.stdout) as {
        ok: true;
        data: { prunedPackageCount: number; updated: number };
      };
      const lockfile = JSON.parse(await readFile(join(app, "nipmod.lock.json"), "utf8"));
      const newKey = `${manifest.canonical}@0.2.0`;

      expect(parsed.data).toMatchObject({ prunedPackageCount: 1, updated: 1 });
      expect(lockfile.root.dependencies).toEqual({ "tag-update-agent": "next" });
      expect(lockfile.packages[oldKey]).toBeUndefined();
      expect(lockfile.packages[newKey].integrity).toBe(`sha256-${pack.data.digest}`);
    } finally {
      await server.close();
    }
  }, 30_000);

  test("validates a manifest and reports normalized publish facts", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-manifest-"));
    const pkg = join(workspace, "pkg");

    await execaNode(["src/cli.ts", "init", "--name", "@probe/manifest-agent", "--dir", pkg]);
    const result = await execaNode(["src/cli.ts", "manifest", "validate", "--dir", pkg, "--json"]);
    const parsed = JSON.parse(result.stdout) as {
      ok: true;
      data: {
        manifest: {
          canonical: string;
          files: string[];
          name: string;
          permissions: { exec: { allowed: false }; postinstall: { allowed: false } };
          publish: { signingKey: string };
          version: string;
        };
      };
    };

    expect(parsed.ok).toBe(true);
    expect(parsed.data.manifest.name).toBe("@probe/manifest-agent");
    expect(parsed.data.manifest.canonical).toMatch(/^pkg:did:key:z[A-Za-z0-9]+\/manifest-agent$/);
    expect(parsed.data.manifest.publish.signingKey).toBe(parsed.data.manifest.canonical.slice("pkg:".length).split("/")[0]);
    expect(parsed.data.manifest.files).toEqual(["README.md", "SKILL.md", "nipmod.json"]);
    expect(parsed.data.manifest.permissions.exec.allowed).toBe(false);
    expect(parsed.data.manifest.permissions.postinstall.allowed).toBe(false);
    expect(result.stdout).not.toContain("privateKey");
  });

  test("creates a Gitlawb repo package draft without requiring a private key", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-package-draft-"));
    const owner = generateIdentity().did;
    const repo = "claimable-agent";
    const outDir = join(workspace, "draft");
    const result = await execaNode([
      "src/cli.ts",
      "package",
      `https://gitlawb.com/${owner.slice(owner.lastIndexOf(":") + 1)}/${repo}`,
      "--dir",
      outDir,
      "--json"
    ]);
    const parsed = JSON.parse(result.stdout) as {
      ok: true;
      data: {
        claimCommand: string;
        draft: {
          canonical: string;
          manifestPath: string;
          repo: string;
          source: string;
        };
      };
    };

    expect(parsed.ok).toBe(true);
    expect(parsed.data.draft).toMatchObject({
      canonical: `pkg:${owner}/${repo}`,
      manifestPath: join(outDir, "nipmod.json"),
      repo,
      source: `gitlawb://${owner}/${repo}`
    });
    expect(parsed.data.claimCommand).toBe(`nipmod publish ${outDir} --dry-run`);
    expect(result.stdout).not.toContain("privateKey");

    const manifest = JSON.parse(await readFile(join(outDir, "nipmod.json"), "utf8"));
    expect(manifest).toMatchObject({
      canonical: `pkg:${owner}/${repo}`,
      name: repo,
      publish: {
        provenance: `gitlawb://${owner}/${repo}`,
        signingKey: owner
      },
      type: "tool-bundle",
      version: "0.1.0"
    });
    expect(manifest.files).toEqual(["README.md", "nipmod.json"]);

    const validated = await execaNode(["src/cli.ts", "manifest", "validate", "--dir", outDir, "--json"]);
    expect(JSON.parse(validated.stdout).ok).toBe(true);
  });

  test("manifest validate rejects unsafe permissions before packing", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-manifest-bad-"));
    const pkg = join(workspace, "pkg");

    await execaNode(["src/cli.ts", "init", "--name", "@probe/bad-manifest", "--dir", pkg]);
    const manifest = JSON.parse(await readFile(join(pkg, "nipmod.json"), "utf8")) as {
      permissions: { env: string[] };
    };
    manifest.permissions.env = ["OPENAI_API_KEY"];
    await writeFile(join(pkg, "nipmod.json"), `${JSON.stringify(manifest, null, 2)}\n`);

    const failed = await expectCliJsonFailure(["src/cli.ts", "manifest", "validate", "--dir", pkg, "--json"]);

    expect(failed).toMatchObject({
      error: {
        message: expect.stringContaining("env permissions must not request secret-like variables")
      },
      exitCode: 1,
      ok: false
    });
  });

  test("publish dry-run reports publish plan without requiring a remote write", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-publish-dry-run-"));
    const pkg = join(workspace, "pkg");
    const binDir = join(workspace, "bin");
    const helperPath = join(binDir, "git-remote-gitlawb");
    const gitPath = join(binDir, "git");

    await execaNode(["src/cli.ts", "init", "--name", "@probe/dry-run-agent", "--dir", pkg]);
    await mkdir(binDir, { recursive: true });
    await writeFile(helperPath, "#!/bin/sh\nexit 0\n");
    await writeFile(gitPath, "#!/bin/sh\nexit 0\n");
    await chmod(helperPath, 0o755);
    await chmod(gitPath, 0o755);
    const server = createServer((_request, response) => {
      response.statusCode = 404;
      response.end("not found");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("test server did not bind to a TCP port");
    }

    try {
      const result = await execaNode(
        [
          "src/cli.ts",
          "publish",
          pkg,
          "--dry-run",
          "--node",
          `http://127.0.0.1:${address.port}`,
          "--json"
        ],
        {
          env: { PATH: `${binDir}:${process.env.PATH ?? ""}` }
        }
      );
      const parsed = JSON.parse(result.stdout) as {
        ok: true;
        data: {
          plan: {
            digest: string;
            helper: { ok: boolean; path: string };
            git: { ok: boolean; path: string };
            package: string;
            ready: boolean;
            releaseEvent: { signature: { keyId: string } };
            repoName: string;
            versionCheck: { status: string };
          };
        };
      };

      expect(parsed.ok).toBe(true);
      expect(parsed.data.plan.ready).toBe(true);
      expect(parsed.data.plan.package).toMatch(/^pkg:did:key:z[A-Za-z0-9]+\/dry-run-agent$/);
      expect(parsed.data.plan.repoName).toBe("dry-run-agent");
      expect(parsed.data.plan.digest).toMatch(/^[a-f0-9]{64}$/);
      expect(parsed.data.plan.helper).toMatchObject({ ok: true, path: helperPath });
      expect(parsed.data.plan.git).toMatchObject({ ok: true, path: gitPath });
      expect(parsed.data.plan.versionCheck.status).toBe("available");
      expect(parsed.data.plan.releaseEvent.signature.keyId).toBe(
        parsed.data.plan.package.slice("pkg:".length).split("/")[0]
      );
      expect(result.stdout).not.toContain("privateKey");
    } finally {
      server.close();
    }
  });

  test("creates signed lifecycle dry-run events without leaking local identity secrets", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-lifecycle-"));
    const pkg = join(workspace, "pkg");

    await execaNode(["src/cli.ts", "init", "--name", "@probe/lifecycle-agent", "--dir", pkg]);
    const manifest = JSON.parse(await readFile(join(pkg, "nipmod.json"), "utf8")) as {
      canonical: string;
      publish: { signingKey: string };
    };

    const distTag = await execaNode([
      "src/cli.ts",
      "dist-tag",
      "add",
      `${manifest.canonical}@0.1.0`,
      "latest",
      "--dir",
      pkg,
      "--dry-run",
      "--json"
    ]);
    const deprecated = await execaNode([
      "src/cli.ts",
      "deprecate",
      `${manifest.canonical}@0.1.0`,
      "Use lifecycle-agent@0.2.0",
      "--dir",
      pkg,
      "--dry-run",
      "--json"
    ]);
    const yanked = await execaNode([
      "src/cli.ts",
      "yank",
      `${manifest.canonical}@0.1.0`,
      "Broken package release",
      "--dir",
      pkg,
      "--dry-run",
      "--json"
    ]);

    const parsedTag = JSON.parse(distTag.stdout) as {
      ok: true;
      data: {
        event: {
          payload: { action: { kind: string; tag: string; version: string }; package: string; publisher: string };
          signature: { keyId: string };
        };
      };
    };
    const parsedDeprecated = JSON.parse(deprecated.stdout) as {
      ok: true;
      data: { event: { payload: { action: { kind: string; reason: string } } } };
    };
    const parsedYanked = JSON.parse(yanked.stdout) as {
      ok: true;
      data: { event: { payload: { action: { kind: string; reason: string } } } };
    };

    expect(parsedTag.data.event.payload).toMatchObject({
      action: { kind: "dist-tag.set", tag: "latest", version: "0.1.0" },
      package: manifest.canonical,
      publisher: manifest.publish.signingKey
    });
    expect(parsedTag.data.event.signature.keyId).toBe(manifest.publish.signingKey);
    expect(parsedDeprecated.data.event.payload.action).toMatchObject({
      kind: "deprecate",
      reason: "Use lifecycle-agent@0.2.0"
    });
    expect(parsedYanked.data.event.payload.action).toMatchObject({
      kind: "yank",
      reason: "Broken package release"
    });
    expect(`${distTag.stdout}${deprecated.stdout}${yanked.stdout}`).not.toContain("privateKey");
  });

  test("rejects file URLs with remote hosts", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-host-"));

    await expect(
      execaNode([
        "src/cli.ts",
        "install",
        "file://example.com/tmp/pkg.nipmod",
        "--dir",
        workspace,
        "--integrity",
        "sha256-2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
      ])
    ).rejects.toThrow(/file URL host/i);
  });

  test("does not mutate local installs when dry-run is requested", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-local-dry-run-"));
    const app = join(workspace, "app");

    const failed = await expectCliJsonFailure([
      "src/cli.ts",
      "install",
      `file:${join(workspace, "missing.nipmod")}`,
      "--dir",
      app,
      "--integrity",
      `sha256-${"a".repeat(64)}`,
      "--dry-run",
      "--json"
    ]);

    expect(failed.error?.message).toContain("install --dry-run only supports registry packages");
    await expect(readFile(join(app, "nipmod.lock.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("rejects unknown install flags instead of mutating", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-install-unknown-flag-"));
    const app = join(workspace, "app");

    const failed = await expectCliJsonFailure([
      "src/cli.ts",
      "install",
      `file:${join(workspace, "missing.nipmod")}`,
      "--dir",
      app,
      "--integrity",
      `sha256-${"a".repeat(64)}`,
      "--definitely-unknown",
      "--json"
    ]);

    expect(failed.error?.message).toContain("install does not accept --definitely-unknown");
    await expect(readFile(join(app, "nipmod.lock.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("install requires explicit opt-in for a custom registry root", async () => {
    const failed = await expectCliJsonFailure([
      "src/cli.ts",
      "install",
      "policy-agent",
      "--registry",
      "https://example.test/registry.json",
      "--json"
    ]);

    expect(failed.error?.message).toContain("install custom trust roots require --allow-custom-roots");
  });

  test("prints machine-readable doctor status without network access", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-doctor-"));
    const binDir = join(workspace, "bin");
    const helperPath = join(binDir, "git-remote-gitlawb");
    await mkdir(binDir, { recursive: true });
    await writeFile(helperPath, "#!/bin/sh\nexit 0\n");
    await chmod(helperPath, 0o755);

    const result = await execaNode(["src/cli.ts", "doctor", "--offline", "--json"], {
      env: { NIPMOD_GITLAWB_HELPER: helperPath }
    });
    const parsed = JSON.parse(result.stdout) as {
      ok: true;
      data: {
        ready: boolean;
        checks: Array<{ id: string; status: string }>;
      };
    };

    expect(parsed.data.ready).toBe(true);
    expect(parsed.data.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "node", status: "ok" }),
        expect.objectContaining({ id: "gitlawb-helper", status: "ok" }),
        expect.objectContaining({ id: "gitlawb-node", status: "warn" })
      ])
    );
  });

  test("does not recommend pipe to shell helper installs", async () => {
    const result = await execaNode(["src/cli.ts", "doctor", "--offline"], {
      env: {
        NIPMOD_GITLAWB_HELPER: "/definitely/missing/git-remote-gitlawb"
      }
    });

    expect(result.stdout).toContain("nipmod ready");
    expect(result.stdout).toContain("WARN Publish helper");
    expect(result.stdout).toContain("Install is ready");
    expect(result.stdout).toContain("verified checksum");
    expect(result.stdout).toContain("Publish needs the Gitlawb helper:");
    expect(result.stdout).not.toContain("nipmod needs setup");
    expect(result.stdout).not.toContain("FAIL Gitlawb helper");
    expect(result.stdout).not.toContain("Then run: nipmod doctor");
    expect(result.stdout).not.toContain("curl -fsSL");
    expect(result.stdout).not.toContain("| sh");
  });

  test("doctor exits non-zero when required online checks fail", async () => {
    const failed = await expectCliJsonFailure([
      "src/cli.ts",
      "doctor",
      "--node",
      "http://127.0.0.1:9",
      "--registry",
      "http://127.0.0.1:9/packages.json",
      "--json"
    ]);

    expect(failed.exitCode).toBe(12);
    expect(failed.data?.ready).toBe(false);
  });

  test("searches a file-backed registry and prints install-ready results", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-search-"));
    const owner = generateIdentity().did;
    const registryPath = join(workspace, "registry.json");
    await writeFile(
      registryPath,
      `${JSON.stringify({
        formatVersion: 1,
        generatedAt: "2026-05-16T07:55:00.000Z",
        packages: [
          {
            canonical: `pkg:${owner}/alpha-agent`,
            description: "Alpha planning skill",
            digest: "a".repeat(64),
            name: "alpha-agent",
            owner,
            permissions: {
              env: 0,
              exec: false,
              filesystem: 0,
              mcpTools: 0,
              network: 0,
              postinstall: false,
              secrets: 0
            },
            trust: { level: "verified", score: 100 },
            type: "skill",
            version: "0.1.0"
          },
          {
            canonical: `pkg:${owner}/beta-tool`,
            description: "Different package",
            digest: "b".repeat(64),
            name: "beta-tool",
            owner,
            permissions: {
              env: 1,
              exec: true,
              filesystem: 2,
              mcpTools: 0,
              network: 3,
              postinstall: false,
              secrets: 0
            },
            trust: { level: "review", score: 40 },
            type: "tool",
            version: "0.2.0"
          }
        ],
        source: "file-test"
      })}\n`
    );

    const result = await execaNode([
      "src/cli.ts",
      "search",
      "alpha",
      "--registry",
      pathToFileURL(registryPath).href,
      "--json"
    ]);
    const parsed = JSON.parse(result.stdout) as {
      ok: true;
      data: {
        query: string;
        total: number;
        packages: Array<{ canonicalInstall: string; install: string; name: string; trust: string }>;
      };
    };

    expect(parsed.data.query).toBe("alpha");
    expect(parsed.data.total).toBe(1);
    expect(parsed.data.packages[0]).toMatchObject({
      canonicalInstall: `nipmod install pkg:${owner}/alpha-agent@0.1.0`,
      install: "nipmod install alpha-agent",
      name: "alpha-agent",
      trust: "verified/100"
    });

    const text = await execaNode(["src/cli.ts", "search", "alpha", "--registry", pathToFileURL(registryPath).href]);
    expect(text.stdout).toContain('nipmod search "alpha" - 1 package');
    expect(text.stdout).toContain("Package");
    expect(text.stdout).toContain("Trust");
    expect(text.stdout).toContain("1. alpha-agent");
    expect(text.stdout).toContain("0.1.0");
    expect(text.stdout).toContain("verified/100");
    expect(text.stdout).toContain("no permissions");
    expect(text.stdout).toContain("install: nipmod install alpha-agent");
    expect(text.stdout).not.toContain(`id: pkg:${owner}/alpha-agent`);
    expect(text.stdout).not.toContain(`security: nipmod install pkg:${owner}/alpha-agent@0.1.0`);

    const detailed = await execaNode([
      "src/cli.ts",
      "search",
      "alpha",
      "--details",
      "--registry",
      pathToFileURL(registryPath).href
    ]);
    expect(detailed.stdout).toContain(`id: pkg:${owner}/alpha-agent`);
  });

  test("search ranking boosts exact agent-native matches", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-search-ranking-"));
    const owner = generateIdentity().did;
    const registryPath = join(workspace, "registry.json");
    await writeFile(
      registryPath,
      `${JSON.stringify({
        formatVersion: 1,
        packages: [
          searchPackageFixture(owner, "policy-sidecar", "tool", 70),
          searchPackageFixture(owner, "zzz", "adapter", 70, "policy helper"),
          searchPackageFixture(owner, "policy", "workflow-pack", 70)
        ],
        source: "file-test"
      })}\n`
    );

    const result = await execaNode([
      "src/cli.ts",
      "search",
      "policy",
      "--registry",
      pathToFileURL(registryPath).href,
      "--json"
    ]);
    const parsed = JSON.parse(result.stdout) as { data: { packages: Array<{ name: string }> } };

    expect(parsed.data.packages.map((pkg) => pkg.name)).toEqual(["policy", "policy-sidecar", "zzz"]);
  });

  test("search total reports all matches even when output is limited", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-search-total-"));
    const owner = generateIdentity().did;
    const registryPath = join(workspace, "registry.json");
    await writeFile(
      registryPath,
      `${JSON.stringify({
        formatVersion: 1,
        packages: [
          searchPackageFixture(owner, "policy-alpha", "skill", 100, "policy helper"),
          searchPackageFixture(owner, "policy-beta", "skill", 100, "policy helper")
        ],
        source: "file-test"
      })}\n`
    );

    const result = await execaNode([
      "src/cli.ts",
      "search",
      "policy",
      "--registry",
      pathToFileURL(registryPath).href,
      "--limit",
      "1",
      "--json"
    ]);
    const parsed = JSON.parse(result.stdout) as { data: { packages: unknown[]; total: number } };

    expect(parsed.data.packages).toHaveLength(1);
    expect(parsed.data.total).toBe(2);
  });

  test("search keeps canonical commands as security detail for duplicate names", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-search-duplicates-"));
    const firstOwner = generateIdentity().did;
    const secondOwner = generateIdentity().did;
    const registryPath = join(workspace, "registry.json");
    await writeFile(
      registryPath,
      `${JSON.stringify({
        formatVersion: 1,
        packages: [
          searchPackageFixture(firstOwner, "duplicate-agent", "tool", 100),
          searchPackageFixture(secondOwner, "duplicate-agent", "tool", 90)
        ],
        source: "file-test"
      })}\n`
    );

    const text = await execaNode([
      "src/cli.ts",
      "search",
      "duplicate-agent",
      "--limit",
      "1",
      "--registry",
      pathToFileURL(registryPath).href
    ]);

    expect(text.stdout.match(/install: nipmod install duplicate-agent/g)?.length).toBe(1);
    expect(text.stdout).toContain(`security: nipmod install pkg:${firstOwner}/duplicate-agent@0.1.0`);
  });

  test("views exact registry package metadata for humans and agents", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-view-"));
    const owner = generateIdentity().did;
    const registryPath = join(workspace, "registry.json");
    await writeFile(
      registryPath,
      `${JSON.stringify({
        formatVersion: 1,
        packages: [
          {
            ...searchPackageFixture(owner, "alpha-agent", "skill", 100, "Alpha planning skill"),
            compatibilityReceipts: [cliCompatibilityReceipt(`pkg:${owner}/alpha-agent`, owner, "a".repeat(64))],
            dependencies: {
              "beta-tool": "^0.2.0"
            }
          }
        ],
        source: "file-test"
      })}\n`
    );

    const text = await execaNode(["src/cli.ts", "view", "alpha-agent", "--registry", pathToFileURL(registryPath).href]);
    expect(text.stdout).toContain("nipmod view alpha-agent@0.1.0");
    expect(text.stdout).toContain(`id: pkg:${owner}/alpha-agent`);
    expect(text.stdout).toContain("kind: skill");
    expect(text.stdout).toContain("trust: verified/100");
    expect(text.stdout).toContain("permissions: no permissions");
    expect(text.stdout).toContain("description: Alpha planning skill");
    expect(text.stdout).toContain("dependencies:");
    expect(text.stdout).toContain("beta-tool: ^0.2.0");
    expect(text.stdout).toContain("compatibility: MCP import");
    expect(text.stdout).toContain(`install: nipmod install pkg:${owner}/alpha-agent@0.1.0`);

    const json = await execaNode([
      "src/cli.ts",
      "view",
      `pkg:${owner}/alpha-agent@0.1.0`,
      "--registry",
      pathToFileURL(registryPath).href,
      "--json"
    ]);
    const parsed = JSON.parse(json.stdout) as {
      ok: true;
      data: {
        package: {
          canonical: string;
          canonicalInstall: string;
          dependencies: Record<string, string>;
          install: string;
          name: string;
          version: string;
        };
      };
    };
    expect(parsed.data.package).toMatchObject({
      canonical: `pkg:${owner}/alpha-agent`,
      canonicalInstall: `nipmod install pkg:${owner}/alpha-agent@0.1.0`,
      dependencies: { "beta-tool": "^0.2.0" },
      install: "nipmod install alpha-agent",
      name: "alpha-agent",
      version: "0.1.0"
    });
  });

  test("view resolves package names through the effective latest dist-tag", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-view-dist-tag-"));
    const owner = generateIdentity().did;
    const registryPath = join(workspace, "registry.json");
    await writeFile(
      registryPath,
      `${JSON.stringify({
        formatVersion: 1,
        packages: [
          {
            ...searchPackageFixture(owner, "tagged-agent", "skill", 100, "Stable tagged release"),
            distTags: { latest: "0.1.0", next: "0.2.0" },
            digest: "a".repeat(64),
            version: "0.1.0"
          },
          {
            ...searchPackageFixture(owner, "tagged-agent", "skill", 100, "Next tagged release"),
            distTags: { latest: "0.1.0", next: "0.2.0" },
            digest: "b".repeat(64),
            version: "0.2.0"
          }
        ],
        source: "file-test"
      })}\n`
    );

    const latest = await execaNode([
      "src/cli.ts",
      "view",
      "tagged-agent",
      "--registry",
      pathToFileURL(registryPath).href,
      "--json"
    ]);
    const next = await execaNode([
      "src/cli.ts",
      "view",
      "tagged-agent@next",
      "--registry",
      pathToFileURL(registryPath).href,
      "--json"
    ]);
    const latestParsed = JSON.parse(latest.stdout) as { data: { package: { version: string } } };
    const nextParsed = JSON.parse(next.stdout) as { data: { package: { version: string } } };

    expect(latestParsed.data.package.version).toBe("0.1.0");
    expect(nextParsed.data.package.version).toBe("0.2.0");
  });

  test("view refuses ambiguous package names", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-view-ambiguous-"));
    const firstOwner = generateIdentity().did;
    const secondOwner = generateIdentity().did;
    const registryPath = join(workspace, "registry.json");
    await writeFile(
      registryPath,
      `${JSON.stringify({
        formatVersion: 1,
        packages: [
          searchPackageFixture(firstOwner, "shared-agent", "skill", 100),
          searchPackageFixture(secondOwner, "shared-agent", "skill", 100)
        ],
        source: "file-test"
      })}\n`
    );

    await expect(
      execaNode(["src/cli.ts", "view", "shared-agent", "--registry", pathToFileURL(registryPath).href])
    ).rejects.toThrow(/ambiguous package name/i);
  });

  test("view refuses ambiguous names beyond the search result limit", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-view-ambiguous-large-"));
    const firstOwner = generateIdentity().did;
    const secondOwner = generateIdentity().did;
    const registryPath = join(workspace, "registry.json");
    const crowdedCanonical = Array.from({ length: 100 }, (_, index) => ({
      ...searchPackageFixture(firstOwner, "shared-agent", "skill", 100),
      digest: index.toString(16).padStart(64, "0"),
      version: `0.0.${index}`
    }));
    await writeFile(
      registryPath,
      `${JSON.stringify({
        formatVersion: 1,
        packages: [
          ...crowdedCanonical,
          {
            ...searchPackageFixture(secondOwner, "shared-agent", "skill", 0),
            digest: "f".repeat(64),
            version: "9.9.9"
          }
        ],
        source: "file-test"
      })}\n`
    );

    await expect(
      execaNode(["src/cli.ts", "view", "shared-agent", "--registry", pathToFileURL(registryPath).href])
    ).rejects.toThrow(/ambiguous package name/i);
  });

  test("searches multiple registry sources and fails on digest conflicts", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-search-multi-"));
    const owner = generateIdentity().did;
    const firstRegistryPath = join(workspace, "registry-a.json");
    const secondRegistryPath = join(workspace, "registry-b.json");
    await writeFile(
      firstRegistryPath,
      `${JSON.stringify({
        formatVersion: 1,
        packages: [searchPackageFixture(owner, "alpha", "skill", 100)],
        source: "registry-a"
      })}\n`
    );
    await writeFile(
      secondRegistryPath,
      `${JSON.stringify({
        formatVersion: 1,
        packages: [searchPackageFixture(owner, "beta", "workflow-pack", 90)],
        source: "registry-b"
      })}\n`
    );

    const result = await execaNode([
      "src/cli.ts",
      "search",
      "a",
      "--registries",
      `${pathToFileURL(firstRegistryPath).href},${pathToFileURL(secondRegistryPath).href}`,
      "--json"
    ]);
    const parsed = JSON.parse(result.stdout) as {
      data: {
        sources: string[];
        packages: Array<{ name: string; sourceRegistry: string }>;
      };
    };

    expect(parsed.data.sources).toHaveLength(2);
    expect(parsed.data.packages.map((pkg) => pkg.name)).toEqual(["alpha", "beta"]);
    expect(parsed.data.packages.map((pkg) => pkg.sourceRegistry)).toEqual([
      pathToFileURL(firstRegistryPath).href,
      pathToFileURL(secondRegistryPath).href
    ]);

    await writeFile(
      secondRegistryPath,
      `${JSON.stringify({
        formatVersion: 1,
        packages: [{ ...searchPackageFixture(owner, "alpha", "skill", 100), digest: "f".repeat(64) }],
        source: "registry-b"
      })}\n`
    );

    await expect(
      execaNode([
        "src/cli.ts",
        "search",
        "alpha",
        "--registries",
        `${pathToFileURL(firstRegistryPath).href},${pathToFileURL(secondRegistryPath).href}`
      ])
    ).rejects.toThrow(/conflicting registry records/i);
  });

  test("search hides quarantined packages unless explicitly included", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-search-quarantine-"));
    const owner = generateIdentity().did;
    const registryPath = join(workspace, "registry.json");
    await writeFile(
      registryPath,
      `${JSON.stringify({
        formatVersion: 1,
        generatedAt: "2026-05-16T10:54:00.000Z",
        packages: [
          {
            canonical: `pkg:${owner}/blocked-agent`,
            description: "Blocked package",
            digest: "a".repeat(64),
            name: "blocked-agent",
            owner,
            permissions: {
              env: 0,
              exec: false,
              filesystem: 0,
              mcpTools: 0,
              network: 0,
              postinstall: false,
              secrets: 0
            },
            quarantine: quarantineFixture(`pkg:${owner}/blocked-agent`, "0.1.0", "a".repeat(64)),
            trust: { level: "verified", score: 100 },
            type: "skill",
            version: "0.1.0"
          }
        ],
        source: "file-test"
      })}\n`
    );

    const hidden = await execaNode([
      "src/cli.ts",
      "search",
      "blocked-agent",
      "--registry",
      pathToFileURL(registryPath).href,
      "--json"
    ]);
    const hiddenParsed = JSON.parse(hidden.stdout) as { data: { packages: unknown[]; total: number } };
    expect(hiddenParsed.data.total).toBe(0);

    const included = await execaNode([
      "src/cli.ts",
      "search",
      "blocked-agent",
      "--registry",
      pathToFileURL(registryPath).href,
      "--include-quarantined",
      "--json"
    ]);
    const includedParsed = JSON.parse(included.stdout) as {
      data: {
        packages: Array<{
          install?: string;
          installBlockedReason?: string;
          name: string;
          quarantined: boolean;
        }>;
        total: number;
      };
    };
    expect(includedParsed.data.total).toBe(1);
    expect(includedParsed.data.packages[0]).toMatchObject({
      installBlockedReason: "NIPMOD-2026-9001: Quarantine dry-run advisory",
      name: "blocked-agent",
      quarantined: true
    });
    expect(includedParsed.data.packages[0]?.install).toBeUndefined();

    const text = await execaNode([
      "src/cli.ts",
      "search",
      "blocked-agent",
      "--registry",
      pathToFileURL(registryPath).href,
      "--include-quarantined"
    ]);
    expect(text.stdout).toContain("blocked: NIPMOD-2026-9001: Quarantine dry-run advisory");
    expect(text.stdout).not.toContain("add: nipmod add");
  });

  test("search hides yanked packages by default and warns for deprecated packages", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-search-lifecycle-"));
    const owner = generateIdentity().did;
    const registryPath = join(workspace, "registry.json");
    await writeFile(
      registryPath,
      `${JSON.stringify({
        formatVersion: 1,
        packages: [
          {
            ...searchPackageFixture(owner, "deprecated-agent", "skill", 100, "Deprecated package"),
            deprecated: {
              active: true,
              package: `pkg:${owner}/deprecated-agent`,
              publishedAt: "2026-05-17T00:00:00.000Z",
              reason: "Use maintained-agent instead",
              type: "dev.nipmod.deprecation.v1",
              version: "0.1.0"
            }
          },
          {
            ...searchPackageFixture(owner, "yanked-agent", "skill", 100, "Yanked package"),
            yanked: {
              active: true,
              package: `pkg:${owner}/yanked-agent`,
              publishedAt: "2026-05-17T00:00:00.000Z",
              reason: "Broken package release",
              type: "dev.nipmod.yank.v1",
              version: "0.1.0"
            }
          }
        ],
        source: "file-test"
      })}\n`
    );

    const deprecated = await execaNode([
      "src/cli.ts",
      "search",
      "deprecated-agent",
      "--registry",
      pathToFileURL(registryPath).href,
      "--json"
    ]);
    const deprecatedParsed = JSON.parse(deprecated.stdout) as {
      data: { packages: Array<{ deprecated: boolean; deprecationReason: string; install: string }> };
    };
    expect(deprecatedParsed.data.packages[0]).toMatchObject({
      deprecated: true,
      deprecationReason: "Use maintained-agent instead",
      install: "nipmod install deprecated-agent"
    });

    const hidden = await execaNode([
      "src/cli.ts",
      "search",
      "yanked-agent",
      "--registry",
      pathToFileURL(registryPath).href,
      "--json"
    ]);
    expect((JSON.parse(hidden.stdout) as { data: { total: number } }).data.total).toBe(0);

    const included = await execaNode([
      "src/cli.ts",
      "search",
      "yanked-agent",
      "--registry",
      pathToFileURL(registryPath).href,
      "--include-yanked",
      "--json"
    ]);
    const includedParsed = JSON.parse(included.stdout) as {
      data: { packages: Array<{ install?: string; installBlockedReason: string; yanked: boolean; yankReason: string }> };
    };
    expect(includedParsed.data.packages[0]).toMatchObject({
      installBlockedReason: "yanked: Broken package release",
      yanked: true,
      yankReason: "Broken package release"
    });
    expect(includedParsed.data.packages[0]?.install).toBeUndefined();
  });

  test("search uses the configured registry without an online flag", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-search-default-registry-"));
    const owner = generateIdentity().did;
    const registryPath = join(workspace, "registry.json");
    await writeFile(
      registryPath,
      `${JSON.stringify({
        formatVersion: 1,
        packages: [searchPackageFixture(owner, "default-agent", "skill", 100, "Default registry agent")],
        source: "file-test"
      })}\n`
    );

    const result = await execaNode(["src/cli.ts", "search", "default-agent", "--json"], {
      env: { NIPMOD_REGISTRY_URLS: pathToFileURL(registryPath).href }
    });
    const parsed = JSON.parse(result.stdout) as { data: { packages: Array<{ name: string }>; total: number } };

    expect(parsed.data.total).toBe(1);
    expect(parsed.data.packages[0]?.name).toBe("default-agent");
  });

  test("search rejects file registries with remote hosts", async () => {
    await expect(
      execaNode(["src/cli.ts", "search", "agent", "--registry", "file://example.com/tmp/registry.json"])
    ).rejects.toThrow(/file URL host/i);
  });

  test("inspects a verified registry package with pinned transparency proof", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-inspect-"));
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/inspect-agent`;
    const digest = "f".repeat(64);
    const registryPath = join(workspace, "registry.json");
    const transparency = cliTransparency(canonical, owner, digest);
    await writeFile(registryPath, `${JSON.stringify(cliRegistry(canonical, owner, digest, transparency))}\n`);

    const result = await execaNode([
      "src/cli.ts",
      "inspect",
      `${canonical}@0.1.0`,
      "--registry",
      pathToFileURL(registryPath).href,
      "--allow-custom-roots",
      "--log-id",
      transparency.log.treeHead.logId,
      "--witness",
      transparency.witness.witness,
      "--json"
    ]);
    const parsed = JSON.parse(result.stdout) as {
      ok: true;
      data: {
        report: {
          canonical: string;
          digest: string;
          evidence: Array<{ id: string; status: string }>;
          installCommand: string;
          publisher: string;
          readyToInstall: boolean;
          trust: { level: string; score: number };
          verdict: string;
          version: string;
        };
      };
    };

    expect(parsed.ok).toBe(true);
    expect(parsed.data.report).toMatchObject({
      canonical,
      digest,
      installCommand: `nipmod install ${canonical}@0.1.0`,
      publisher: owner,
      readyToInstall: true,
      trust: { level: "verified", score: 100 },
      verdict: "verified",
      version: "0.1.0"
    });
    expect(parsed.data.report.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "artifact-digest", status: "pass" }),
        expect.objectContaining({ id: "bundle-signature", status: "pass" }),
        expect.objectContaining({ id: "source-provenance", status: "pass" }),
        expect.objectContaining({ id: "transparency", status: "pass" }),
        expect.objectContaining({ id: "witness", status: "pass" })
      ])
    );
  });

  test("inspects a verified registry package from the configured default registry", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-inspect-default-registry-"));
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/default-inspect-agent`;
    const digest = "a".repeat(64);
    const registryPath = join(workspace, "registry.json");
    const transparency = cliTransparency(canonical, owner, digest);
    await writeFile(registryPath, `${JSON.stringify(cliRegistry(canonical, owner, digest, transparency))}\n`);

    const result = await execaNode(
      [
        "src/cli.ts",
        "inspect",
        `${canonical}@0.1.0`,
        "--allow-custom-roots",
        "--log-id",
        transparency.log.treeHead.logId,
        "--witness",
        transparency.witness.witness,
        "--json"
      ],
      {
        env: { NIPMOD_REGISTRY_URL: pathToFileURL(registryPath).href }
      }
    );
    const parsed = JSON.parse(result.stdout) as { ok: true; data: { report: { canonical: string; verdict: string } } };

    expect(parsed.data.report).toMatchObject({
      canonical,
      verdict: "verified"
    });
  });

  test("inspects valid package ids whose slug contains dots", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-inspect-dot-"));
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/inspect.agent`;
    const digest = "f".repeat(64);
    const registryPath = join(workspace, "registry.json");
    const transparency = cliTransparency(canonical, owner, digest);
    await writeFile(registryPath, `${JSON.stringify(cliRegistry(canonical, owner, digest, transparency))}\n`);

    const result = await execaNode([
      "src/cli.ts",
      "inspect",
      `${canonical}@0.1.0`,
      "--registry",
      pathToFileURL(registryPath).href,
      "--allow-custom-roots",
      "--log-id",
      transparency.log.treeHead.logId,
      "--witness",
      transparency.witness.witness,
      "--json"
    ]);
    const parsed = JSON.parse(result.stdout) as { ok: true; data: { report: { canonical: string; verdict: string } } };

    expect(parsed.data.report).toMatchObject({
      canonical,
      verdict: "verified"
    });
  });

  test("inspect reports compatibility receipts bound to registry evidence", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-inspect-compatibility-"));
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/inspect-compatibility`;
    const digest = "f".repeat(64);
    const registryPath = join(workspace, "registry.json");
    const transparency = cliTransparency(canonical, owner, digest);
    const registry = cliRegistry(canonical, owner, digest, transparency);
    registry.packages[0]!.compatibilityReceipts = [cliCompatibilityReceipt(canonical, owner, digest)];
    await writeFile(registryPath, `${JSON.stringify(registry)}\n`);

    const text = await execaNode([
      "src/cli.ts",
      "inspect",
      `${canonical}@0.1.0`,
      "--registry",
      pathToFileURL(registryPath).href,
      "--allow-custom-roots",
      "--log-id",
      transparency.log.treeHead.logId,
      "--witness",
      transparency.witness.witness
    ]);
    expect(text.stdout).toContain("compatibility: MCP import");

    const json = await execaNode([
      "src/cli.ts",
      "inspect",
      `${canonical}@0.1.0`,
      "--registry",
      pathToFileURL(registryPath).href,
      "--allow-custom-roots",
      "--log-id",
      transparency.log.treeHead.logId,
      "--witness",
      transparency.witness.witness,
      "--json"
    ]);
    const parsed = JSON.parse(json.stdout) as {
      ok: true;
      data: { report: { compatibilityReceipts: Array<{ externalFormat: string; id: string; label: string }> } };
    };

    expect(parsed.data.report.compatibilityReceipts).toEqual([
      expect.objectContaining({
        externalFormat: "mcp-server-json",
        id: "receipt.mcp",
        label: "MCP import"
      })
    ]);
  });

  test("inspect ignores compatibility receipts injected by a noncanonical registry mirror", async () => {
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/inspect-mirror`;
    const digest = "f".repeat(64);
    const transparency = cliTransparency(canonical, owner, digest);
    const registry = cliRegistry(canonical, owner, digest, transparency);
    registry.packages[0]!.compatibilityReceipts = [cliCompatibilityReceipt(canonical, owner, digest)];

    const report = await inspectRegistryPackage({
      allowedLogIds: [transparency.log.treeHead.logId],
      allowedWitnesses: [transparency.witness.witness],
      fetchImpl: async () =>
        new Response(JSON.stringify(registry), {
          headers: {
            "content-type": "application/json"
          }
        }),
      registryUrl: "https://registry-mirror.example/packages.json",
      specifier: `${canonical}@0.1.0`
    });

    expect(report.verdict).toBe("failed");
    expect(report.readyToInstall).toBe(false);
    expect(report.compatibilityReceipts).toBeUndefined();
    expect(report.findings).not.toContain("compatibility receipt does not match package evidence");
    expect(report.findings).toEqual(expect.arrayContaining(["registry cannot prove signed advisory state"]));
  });

  test("inspect refuses custom trust roots unless explicitly enabled", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-inspect-roots-"));
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/inspect-roots`;
    const digest = "f".repeat(64);
    const registryPath = join(workspace, "registry.json");
    const transparency = cliTransparency(canonical, owner, digest);
    await writeFile(registryPath, `${JSON.stringify(cliRegistry(canonical, owner, digest, transparency))}\n`);

    const failed = await expectCliJsonFailure([
      "src/cli.ts",
      "inspect",
      `${canonical}@0.1.0`,
      "--registry",
      pathToFileURL(registryPath).href,
      "--log-id",
      transparency.log.treeHead.logId,
      "--witness",
      transparency.witness.witness,
      "--json"
    ]);

    expect(failed).toMatchObject({
      error: {
        message: "inspect custom trust roots require --allow-custom-roots"
      },
      exitCode: 1,
      ok: false
    });
  });

  test("inspect attaches policy decisions without changing trust exit semantics", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-inspect-policy-"));
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/inspect-policy`;
    const digest = "f".repeat(64);
    const registryPath = join(workspace, "registry.json");
    const transparency = cliTransparency(canonical, owner, digest);
    const registry = cliRegistry(canonical, owner, digest, transparency);
    registry.packages[0]!.permissions = {
      env: 0,
      exec: true,
      filesystem: 0,
      mcpTools: 0,
      network: 0,
      postinstall: false,
      secrets: 0
    };
    await writeFile(registryPath, `${JSON.stringify(registry)}\n`);

    const result = await execaNode([
      "src/cli.ts",
      "inspect",
      `${canonical}@0.1.0`,
      "--registry",
      pathToFileURL(registryPath).href,
      "--allow-custom-roots",
      "--log-id",
      transparency.log.treeHead.logId,
      "--witness",
      transparency.witness.witness,
      "--profile",
      "developer-default",
      "--json"
    ]);
    const parsed = JSON.parse(result.stdout) as {
      ok: true;
      data: {
        policyDecision: { allowed: boolean; profile: string; reasons: string[] };
        report: { verdict: string };
      };
    };

    expect(parsed.ok).toBe(true);
    expect(parsed.data.report.verdict).toBe("verified");
    expect(parsed.data.policyDecision).toMatchObject({
      allowed: false,
      profile: "developer-default"
    });
    expect(parsed.data.policyDecision.reasons).toEqual(
      expect.arrayContaining(["permission exec is blocked by developer-default"])
    );
  });

  test("inspect fails closed when registry trust evidence contradicts verified status", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-inspect-evidence-"));
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/inspect-agent`;
    const digest = "f".repeat(64);
    const registryPath = join(workspace, "registry.json");
    const transparency = cliTransparency(canonical, owner, digest);
    const registry = cliRegistry(canonical, owner, digest, transparency);
    const firstPackage = registry.packages[0] as {
      trust: { evidence: { transparencyLogIncluded: boolean; transparencyLogVerified: boolean } };
    };
    firstPackage.trust.evidence.transparencyLogIncluded = false;
    firstPackage.trust.evidence.transparencyLogVerified = false;
    await writeFile(registryPath, `${JSON.stringify(registry)}\n`);

    await expect(
      execaNode([
        "src/cli.ts",
        "inspect",
        `${canonical}@0.1.0`,
        "--registry",
        pathToFileURL(registryPath).href,
        "--allow-custom-roots",
        "--log-id",
        transparency.log.treeHead.logId,
        "--witness",
        transparency.witness.witness,
        "--json"
      ])
    ).rejects.toThrow(/package is not verified by the public registry/i);
  });

  test("inspect fails closed on duplicate immutable registry records", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-inspect-duplicate-"));
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/inspect-agent`;
    const digest = "f".repeat(64);
    const registryPath = join(workspace, "registry.json");
    const transparency = cliTransparency(canonical, owner, digest);
    const registry = cliRegistry(canonical, owner, digest, transparency);
    registry.packages.push({ ...registry.packages[0], digest: "e".repeat(64) });
    await writeFile(registryPath, `${JSON.stringify(registry)}\n`);

    await expect(
      execaNode([
        "src/cli.ts",
        "inspect",
        `${canonical}@0.1.0`,
        "--registry",
        pathToFileURL(registryPath).href,
        "--allow-custom-roots",
        "--log-id",
        transparency.log.treeHead.logId,
        "--witness",
        transparency.witness.witness,
        "--json"
      ])
    ).rejects.toThrow(/duplicate registry package records/i);
  });

  test("inspect fails closed when a registry package lacks transparency proof", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-inspect-missing-proof-"));
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/inspect-agent`;
    const digest = "f".repeat(64);
    const registryPath = join(workspace, "registry.json");
    const transparency = cliTransparency(canonical, owner, digest);
    const registry = cliRegistry(canonical, owner, digest, transparency);
    delete registry.packages[0]!.proof;
    await writeFile(registryPath, `${JSON.stringify(registry)}\n`);

    const command = [
        "src/cli.ts",
        "inspect",
        `${canonical}@0.1.0`,
        "--registry",
        pathToFileURL(registryPath).href,
        "--allow-custom-roots",
        "--log-id",
        transparency.log.treeHead.logId,
        "--witness",
        transparency.witness.witness,
        "--json"
      ];

    await expect(execaNode(command)).rejects.toThrow(/transparency proof is invalid/i);
    await execaNode(command).catch((error: unknown) => {
      const output = String(error);
      expect(output).not.toContain("installCommand");
      expect(output).not.toContain("nipmod install");
    });
  });

  test("inspects a signed local bundle without claiming registry verification", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-inspect-local-"));
    const pkg = join(workspace, "pkg");
    await execaNode(["src/cli.ts", "init", "--name", "@probe/local-inspect", "--dir", pkg]);
    const pack = await execaNode(["src/cli.ts", "pack", pkg, "--out", workspace, "--json"]);
    const packed = JSON.parse(pack.stdout) as { ok: true; data: { path: string; digest: string } };

    const result = await execaNode([
      "src/cli.ts",
      "inspect",
      `file:${packed.data.path}`,
      "--integrity",
      `sha256-${packed.data.digest}`,
      "--json"
    ]);
    const parsed = JSON.parse(result.stdout) as {
      ok: true;
      data: {
        report: {
          digest: string;
          evidence: Array<{ id: string; status: string }>;
          readyToInstall: boolean;
          verdict: string;
        };
      };
    };

    expect(parsed.data.report).toMatchObject({
      digest: packed.data.digest,
      readyToInstall: false,
      verdict: "signed-local"
    });
    expect(parsed.data.report.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "artifact-digest", status: "pass" }),
        expect.objectContaining({ id: "bundle-signature", status: "pass" }),
        expect.objectContaining({ id: "transparency", status: "missing" })
      ])
    );
  });

  test("plans a verified registry install without mutating the lockfile", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-plan-"));
    const app = join(workspace, "app");
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/plan-agent`;
    const digest = "f".repeat(64);
    const registryPath = join(workspace, "registry.json");
    const transparency = cliTransparency(canonical, owner, digest);
    await writeFile(registryPath, `${JSON.stringify(cliRegistry(canonical, owner, digest, transparency))}\n`);

    const result = await execaNode([
      "src/cli.ts",
      "install",
      "--plan",
      `${canonical}@0.1.0`,
      "--registry",
      pathToFileURL(registryPath).href,
      "--allow-custom-roots",
      "--log-id",
      transparency.log.treeHead.logId,
      "--witness",
      transparency.witness.witness,
      "--dir",
      app,
      "--json"
    ]);
    const parsed = JSON.parse(result.stdout) as {
      ok: true;
      data: {
        plan: {
          action: string;
          integrity: string;
          lockfile: { changed: boolean; path: string };
          package: { canonical: string; version: string };
          readyToInstall: boolean;
        };
      };
    };

    expect(parsed.data.plan).toMatchObject({
      action: "install",
      integrity: `sha256-${digest}`,
      lockfile: {
        changed: true,
        path: join(app, "nipmod.lock.json")
      },
      package: {
        canonical,
        version: "0.1.0"
      },
      readyToInstall: true
    });
    await expect(readFile(join(app, "nipmod.lock.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("plans a verified registry install by short package name", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-plan-short-"));
    const app = join(workspace, "app");
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/plan-agent`;
    const digest = "f".repeat(64);
    const registryPath = join(workspace, "registry.json");
    const transparency = cliTransparency(canonical, owner, digest);
    await writeFile(registryPath, `${JSON.stringify(cliRegistry(canonical, owner, digest, transparency))}\n`);

    const result = await execaNode([
      "src/cli.ts",
      "install",
      "plan-agent",
      "--plan",
      "--registry",
      pathToFileURL(registryPath).href,
      "--allow-custom-roots",
      "--log-id",
      transparency.log.treeHead.logId,
      "--witness",
      transparency.witness.witness,
      "--dir",
      app,
      "--json"
    ]);
    const parsed = JSON.parse(result.stdout) as {
      ok: true;
      data: {
        plan: {
          action: string;
          package: { canonical: string; version: string };
          readyToInstall: boolean;
        };
      };
    };

    expect(parsed.data.plan).toMatchObject({
      action: "install",
      package: {
        canonical,
        version: "0.1.0"
      },
      readyToInstall: true
    });
    await expect(readFile(join(app, "nipmod.lock.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("install plan rejects corrupt installed entries instead of reporting unchanged", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-plan-bad-lock-"));
    const app = join(workspace, "app");
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/plan-agent`;
    const digest = "f".repeat(64);
    const registryPath = join(workspace, "registry.json");
    const transparency = cliTransparency(canonical, owner, digest);
    await mkdir(app, { recursive: true });
    await writeFile(registryPath, `${JSON.stringify(cliRegistry(canonical, owner, digest, transparency))}\n`);
    await writeFile(
      join(app, "nipmod.lock.json"),
      `${JSON.stringify({
        formatVersion: 1,
        generatedBy: "test",
        packages: {
          [`${canonical}@0.1.0`]: {
            integrity: `sha256-${digest}`,
            resolved: `https://node.nipmod.com/api/v1/repos/${owner.slice("did:key:".length)}/plan-agent/blob/releases/0.1.0/bundle.nipmod`
          }
        }
      })}\n`
    );

    await expect(
      execaNode([
        "src/cli.ts",
        "install",
        "--plan",
        `${canonical}@0.1.0`,
        "--registry",
        pathToFileURL(registryPath).href,
        "--allow-custom-roots",
        "--log-id",
        transparency.log.treeHead.logId,
        "--witness",
        transparency.witness.witness,
        "--dir",
        app,
        "--json"
      ])
    ).rejects.toThrow(/lockfile invalid/i);
  });

  test("adds a unique verified registry package by query without a manual integrity flag", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-add-"));
    const pkg = join(workspace, "pkg");
    const app = join(workspace, "app");
    const registryPath = join(workspace, "registry.json");
    await execaNode(["src/cli.ts", "init", "--name", "@probe/add-agent", "--dir", pkg]);
    const pack = await execaNode(["src/cli.ts", "pack", pkg, "--out", workspace, "--json"]);
    const packed = JSON.parse(pack.stdout) as { ok: true; data: { digest: string; path: string } };
    const manifest = JSON.parse(await readFile(join(pkg, "nipmod.json"), "utf8")) as {
      canonical: string;
      publish: { signingKey: string };
      version: string;
    };
    const transparency = cliTransparency(manifest.canonical, manifest.publish.signingKey, packed.data.digest);
    const registry = cliRegistry(manifest.canonical, manifest.publish.signingKey, packed.data.digest, transparency);
    const server = await serveBundle(await readFile(packed.data.path), manifest.canonical, manifest.version);
    try {
      registry.packages[0]!.resolved = server.resolved;
      registry.packages[0]!.sourceRepo = server.sourceRepo;
      await writeFile(registryPath, `${JSON.stringify(registry)}\n`);

      const result = await execaNode([
        "src/cli.ts",
        "add",
        "add-agent",
        "--registry",
        pathToFileURL(registryPath).href,
        "--allow-custom-roots",
        "--log-id",
        transparency.log.treeHead.logId,
        "--witness",
        transparency.witness.witness,
        "--dir",
        app,
        "--json"
      ]);
      const parsed = JSON.parse(result.stdout) as {
        ok: true;
        data: { lockfileChanged: boolean; package: string; version: string };
      };
      const lockfile = JSON.parse(await readFile(join(app, "nipmod.lock.json"), "utf8"));
      const key = `${manifest.canonical}@${manifest.version}`;

      expect(parsed.data).toMatchObject({
        lockfileChanged: true,
        package: manifest.canonical,
        version: manifest.version
      });
      expect(lockfile.packages[key].integrity).toBe(`sha256-${packed.data.digest}`);
      expect(lockfile.packages[key].resolved).toBe(server.resolved);
    } finally {
      await server.close();
    }
  });

  test("installs a unique verified registry package by query without a manual integrity flag", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-install-registry-"));
    const pkg = join(workspace, "pkg");
    const app = join(workspace, "app");
    const registryPath = join(workspace, "registry.json");
    await execaNode(["src/cli.ts", "init", "--name", "@probe/install-agent", "--dir", pkg]);
    const pack = await execaNode(["src/cli.ts", "pack", pkg, "--out", workspace, "--json"]);
    const packed = JSON.parse(pack.stdout) as { ok: true; data: { digest: string; path: string } };
    const manifest = JSON.parse(await readFile(join(pkg, "nipmod.json"), "utf8")) as {
      canonical: string;
      publish: { signingKey: string };
      version: string;
    };
    const transparency = cliTransparency(manifest.canonical, manifest.publish.signingKey, packed.data.digest);
    const registry = cliRegistry(manifest.canonical, manifest.publish.signingKey, packed.data.digest, transparency);
    const server = await serveBundle(await readFile(packed.data.path), manifest.canonical, manifest.version);
    try {
      registry.packages[0]!.resolved = server.resolved;
      registry.packages[0]!.sourceRepo = server.sourceRepo;
      await writeFile(registryPath, `${JSON.stringify(registry)}\n`);

      const result = await execaNode([
        "src/cli.ts",
        "install",
        "install-agent",
        "--registry",
        pathToFileURL(registryPath).href,
        "--allow-custom-roots",
        "--log-id",
        transparency.log.treeHead.logId,
        "--witness",
        transparency.witness.witness,
        "--dir",
        app,
        "--json"
      ]);
      const parsed = JSON.parse(result.stdout) as {
        ok: true;
        data: { lockfileChanged: boolean; package: string; version: string };
      };
      const lockfile = JSON.parse(await readFile(join(app, "nipmod.lock.json"), "utf8"));
      const key = `${manifest.canonical}@${manifest.version}`;

      expect(parsed.data).toMatchObject({
        lockfileChanged: true,
        package: manifest.canonical,
        version: manifest.version
      });
      expect(lockfile.root.dependencies).toEqual({ "install-agent": "latest" });
      expect(lockfile.packages[key].integrity).toBe(`sha256-${packed.data.digest}`);
      expect(lockfile.packages[key].resolved).toBe(server.resolved);
    } finally {
      await server.close();
    }
  });

  test("installs a unique verified registry package from the configured default registry", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-install-default-registry-"));
    const pkg = join(workspace, "pkg");
    const app = join(workspace, "app");
    const registryPath = join(workspace, "registry.json");
    await execaNode(["src/cli.ts", "init", "--name", "@probe/default-install-agent", "--dir", pkg]);
    const pack = await execaNode(["src/cli.ts", "pack", pkg, "--out", workspace, "--json"]);
    const packed = JSON.parse(pack.stdout) as { ok: true; data: { digest: string; path: string } };
    const manifest = JSON.parse(await readFile(join(pkg, "nipmod.json"), "utf8")) as {
      canonical: string;
      publish: { signingKey: string };
      version: string;
    };
    const transparency = cliTransparency(manifest.canonical, manifest.publish.signingKey, packed.data.digest);
    const registry = cliRegistry(manifest.canonical, manifest.publish.signingKey, packed.data.digest, transparency);
    const server = await serveBundle(await readFile(packed.data.path), manifest.canonical, manifest.version);
    try {
      registry.packages[0]!.resolved = server.resolved;
      registry.packages[0]!.sourceRepo = server.sourceRepo;
      await writeFile(registryPath, `${JSON.stringify(registry)}\n`);

      const result = await execaNode(
        [
          "src/cli.ts",
          "install",
          "default-install-agent",
          "--allow-custom-roots",
          "--log-id",
          transparency.log.treeHead.logId,
          "--witness",
          transparency.witness.witness,
          "--dir",
          app,
          "--json"
        ],
        { env: { NIPMOD_REGISTRY_URL: pathToFileURL(registryPath).href } }
      );
      const parsed = JSON.parse(result.stdout) as {
        ok: true;
        data: { lockfileChanged: boolean; package: string; version: string };
      };

      expect(parsed.data).toMatchObject({
        lockfileChanged: true,
        package: manifest.canonical,
        version: manifest.version
      });
    } finally {
      await server.close();
    }
  });

  test("adds a verified registry dependency graph atomically", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-add-graph-"));
    const app = join(workspace, "app");
    const rootDir = join(workspace, "root");
    const depDir = join(workspace, "dep");
    const registryPath = join(workspace, "registry.json");
    await execaNode(["src/cli.ts", "init", "--name", "root-agent", "--dir", rootDir]);
    await execaNode(["src/cli.ts", "init", "--name", "dep-agent", "--dir", depDir]);

    const rootManifestPath = join(rootDir, "nipmod.json");
    const rootManifest = JSON.parse(await readFile(rootManifestPath, "utf8")) as {
      canonical: string;
      dependencies?: Record<string, string>;
      publish: { signingKey: string };
      version: string;
    };
    rootManifest.dependencies = { "dep-agent": "^0.1.0" };
    await writeFile(rootManifestPath, `${JSON.stringify(rootManifest, null, 2)}\n`);

    const rootPack = JSON.parse(
      (await execaNode(["src/cli.ts", "pack", rootDir, "--out", workspace, "--json"])).stdout
    ) as { ok: true; data: { digest: string; path: string } };
    const depPack = JSON.parse(
      (await execaNode(["src/cli.ts", "pack", depDir, "--out", workspace, "--json"])).stdout
    ) as { ok: true; data: { digest: string; path: string } };
    const depManifest = JSON.parse(await readFile(join(depDir, "nipmod.json"), "utf8")) as {
      canonical: string;
      publish: { signingKey: string };
      version: string;
    };
    const rootServer = await serveBundle(await readFile(rootPack.data.path), rootManifest.canonical, rootManifest.version);
    const depServer = await serveBundle(await readFile(depPack.data.path), depManifest.canonical, depManifest.version);
    try {
      const graphRegistry = cliGraphRegistry([
        {
          canonical: rootManifest.canonical,
          dependencies: { "dep-agent": "^0.1.0" },
          digest: rootPack.data.digest,
          owner: rootManifest.publish.signingKey,
          resolved: rootServer.resolved,
          sourceRepo: rootServer.sourceRepo
        },
        {
          canonical: depManifest.canonical,
          digest: depPack.data.digest,
          owner: depManifest.publish.signingKey,
          resolved: depServer.resolved,
          sourceRepo: depServer.sourceRepo
        }
      ]);
      await writeFile(registryPath, `${JSON.stringify(graphRegistry.registry)}\n`);

      const result = await execaNode([
        "src/cli.ts",
        "add",
        "root-agent",
        "--registry",
        pathToFileURL(registryPath).href,
        "--allow-custom-roots",
        "--log-id",
        graphRegistry.log.treeHead.logId,
        "--witness",
        graphRegistry.witness.witness,
        "--dir",
        app,
        "--json"
      ]);
      const parsed = JSON.parse(result.stdout) as {
        ok: true;
        data: { graphPackageCount: number; lockfileChanged: boolean; package: string; version: string };
      };
      const lockfile = JSON.parse(await readFile(join(app, "nipmod.lock.json"), "utf8"));
      const rootKey = `${rootManifest.canonical}@${rootManifest.version}`;
      const depKey = `${depManifest.canonical}@${depManifest.version}`;

      expect(parsed.data).toMatchObject({
        graphPackageCount: 2,
        lockfileChanged: true,
        package: rootManifest.canonical,
        version: rootManifest.version
      });
      expect(lockfile.root.dependencies).toEqual({ "root-agent": "latest" });
      expect(Object.keys(lockfile.packages).sort()).toEqual([depKey, rootKey].sort());
      expect(lockfile.snapshots[rootKey].dependencies).toEqual({ "dep-agent": depKey });
      expect(lockfile.snapshots[depKey].dependencies).toEqual({});
      await expect(readFile(join(app, lockfile.packages[rootKey].storePath))).resolves.toBeTruthy();
      await expect(readFile(join(app, lockfile.packages[depKey].storePath))).resolves.toBeTruthy();
    } finally {
      await rootServer.close();
      await depServer.close();
    }
  }, 30_000);

  test("plans and applies a verified root package update without trusting stale local graph candidates", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-update-"));
    const app = join(workspace, "app");
    const pkg = join(workspace, "pkg");
    const depPkg = join(workspace, "dep");
    const registryPath = join(workspace, "registry.json");
    await execaNode(["src/cli.ts", "init", "--name", "update-agent", "--dir", pkg]);
    await execaNode(["src/cli.ts", "init", "--name", "dep-agent", "--dir", depPkg]);

    const manifestPath = join(pkg, "nipmod.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      canonical: string;
      dependencies?: Record<string, string>;
      publish: { signingKey: string };
      version: string;
    };
    const oldPack = JSON.parse((await execaNode(["src/cli.ts", "pack", pkg, "--out", workspace, "--json"])).stdout) as {
      ok: true;
      data: { digest: string; path: string };
    };
    manifest.version = "0.2.0";
    manifest.dependencies = { "dep-agent": "*" };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const newPack = JSON.parse((await execaNode(["src/cli.ts", "pack", pkg, "--out", workspace, "--json"])).stdout) as {
      ok: true;
      data: { digest: string; path: string };
    };
    const depPack = JSON.parse((await execaNode(["src/cli.ts", "pack", depPkg, "--out", workspace, "--json"])).stdout) as {
      ok: true;
      data: { digest: string; path: string };
    };
    const depManifest = JSON.parse(await readFile(join(depPkg, "nipmod.json"), "utf8")) as {
      canonical: string;
      publish: { signingKey: string };
      version: string;
    };
    const oldServer = await serveBundle(await readFile(oldPack.data.path), manifest.canonical, "0.1.0");
    const newServer = await serveBundle(await readFile(newPack.data.path), manifest.canonical, "0.2.0");
    const depServer = await serveBundle(await readFile(depPack.data.path), depManifest.canonical, depManifest.version);
    try {
      const oldRegistry = cliGraphRegistry([
        {
          canonical: manifest.canonical,
          digest: oldPack.data.digest,
          owner: manifest.publish.signingKey,
          resolved: oldServer.resolved,
          sourceRepo: oldServer.sourceRepo,
          version: "0.1.0"
        }
      ]);
      await writeFile(registryPath, `${JSON.stringify(oldRegistry.registry)}\n`);
      await execaNode([
        "src/cli.ts",
        "add",
        "update-agent",
        "--registry",
        pathToFileURL(registryPath).href,
        "--allow-custom-roots",
        "--log-id",
        oldRegistry.log.treeHead.logId,
        "--witness",
        oldRegistry.witness.witness,
        "--dir",
        app,
        "--json"
      ]);
      const poisonedOwner = generateIdentity().did;
      const poisonedKey = `pkg:${poisonedOwner}/dep-agent@9.9.9`;
      const poisonedLockfile = JSON.parse(await readFile(join(app, "nipmod.lock.json"), "utf8"));
      poisonedLockfile.packages[poisonedKey] = lockfilePackageFixture(poisonedOwner, "dep-agent", "9.9.9", "9".repeat(64));
      poisonedLockfile.snapshots[poisonedKey] = emptyLockfileSnapshot();
      await writeFile(join(app, "nipmod.lock.json"), `${JSON.stringify(poisonedLockfile, null, 2)}\n`);

      const updateRegistry = cliGraphRegistry([
        {
          canonical: manifest.canonical,
          digest: oldPack.data.digest,
          owner: manifest.publish.signingKey,
          resolved: oldServer.resolved,
          sourceRepo: oldServer.sourceRepo,
          version: "0.1.0"
        },
        {
          canonical: manifest.canonical,
          dependencies: { "dep-agent": "*" },
          digest: newPack.data.digest,
          owner: manifest.publish.signingKey,
          resolved: newServer.resolved,
          sourceRepo: newServer.sourceRepo,
          version: "0.2.0"
        },
        {
          canonical: depManifest.canonical,
          digest: depPack.data.digest,
          owner: depManifest.publish.signingKey,
          resolved: depServer.resolved,
          sourceRepo: depServer.sourceRepo,
          version: depManifest.version
        }
      ]);
      await writeFile(registryPath, `${JSON.stringify(updateRegistry.registry)}\n`);
      const beforePlan = await readFile(join(app, "nipmod.lock.json"), "utf8");
      const planResult = await execaNode([
        "src/cli.ts",
        "update",
        "update-agent",
        "--plan",
        "--registry",
        pathToFileURL(registryPath).href,
        "--allow-custom-roots",
        "--log-id",
        updateRegistry.log.treeHead.logId,
        "--witness",
        updateRegistry.witness.witness,
        "--dir",
        app,
        "--json"
      ]);
      const plan = JSON.parse(planResult.stdout) as {
        ok: true;
        data: { plan: { updates: Array<{ current: string; latest: string; plan: { graph?: { packageCount: number } }; wanted: string }> } };
      };
      expect(plan.data.plan.updates).toEqual([
        expect.objectContaining({
          current: "0.1.0",
          latest: "0.2.0",
          plan: expect.objectContaining({ graph: expect.objectContaining({ packageCount: 2 }) }),
          wanted: "0.2.0"
        })
      ]);
      await expect(readFile(join(app, "nipmod.lock.json"), "utf8")).resolves.toBe(beforePlan);

      const updateResult = await execaNode([
        "src/cli.ts",
        "update",
        "update-agent",
        "--registry",
        pathToFileURL(registryPath).href,
        "--allow-custom-roots",
        "--log-id",
        updateRegistry.log.treeHead.logId,
        "--witness",
        updateRegistry.witness.witness,
        "--dir",
        app,
        "--json"
      ]);
      const parsed = JSON.parse(updateResult.stdout) as {
        ok: true;
        data: { lockfileChanged: boolean; prunedPackageCount: number; updated: number };
      };
      const lockfile = JSON.parse(await readFile(join(app, "nipmod.lock.json"), "utf8"));
      const oldKey = `${manifest.canonical}@0.1.0`;
      const newKey = `${manifest.canonical}@0.2.0`;
      const depKey = `${depManifest.canonical}@${depManifest.version}`;

      expect(parsed.data).toMatchObject({
        lockfileChanged: true,
        prunedPackageCount: 2,
        updated: 1
      });
      expect(lockfile.root.dependencies).toEqual({ "update-agent": "latest" });
      expect(lockfile.packages[oldKey]).toBeUndefined();
      expect(lockfile.packages[poisonedKey]).toBeUndefined();
      expect(lockfile.packages[newKey].integrity).toBe(`sha256-${newPack.data.digest}`);
      expect(lockfile.packages[depKey].integrity).toBe(`sha256-${depPack.data.digest}`);
      expect(lockfile.snapshots[newKey].dependencies).toEqual({ "dep-agent": depKey });
      expect(Object.keys(lockfile.packages).sort()).toEqual([depKey, newKey].sort());
    } finally {
      await oldServer.close();
      await newServer.close();
      await depServer.close();
    }
  }, 45_000);

  test("update rolls back the lockfile when a later root update fails", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-update-rollback-"));
    const app = join(workspace, "app");
    const pkg = join(workspace, "pkg");
    const registryPath = join(workspace, "registry.json");
    await execaNode(["src/cli.ts", "init", "--name", "rollback-a", "--dir", pkg]);

    const manifestPath = join(pkg, "nipmod.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      canonical: string;
      publish: { signingKey: string };
      version: string;
    };
    const oldPack = JSON.parse((await execaNode(["src/cli.ts", "pack", pkg, "--out", workspace, "--json"])).stdout) as {
      ok: true;
      data: { digest: string; path: string };
    };
    manifest.version = "0.2.0";
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const newPack = JSON.parse((await execaNode(["src/cli.ts", "pack", pkg, "--out", workspace, "--json"])).stdout) as {
      ok: true;
      data: { digest: string; path: string };
    };
    const failingOwner = generateIdentity().did;
    const failingCanonical = `pkg:${failingOwner}/rollback-b`;
    const failingServer = createServer((_request, response) => {
      response.writeHead(500);
      response.end("failed");
    });
    await new Promise<void>((resolve, reject) => {
      failingServer.once("error", reject);
      failingServer.listen(0, "127.0.0.1", () => {
        failingServer.off("error", reject);
        resolve();
      });
    });
    const failingAddress = failingServer.address();
    if (!failingAddress || typeof failingAddress === "string") {
      throw new Error("test server did not bind to tcp");
    }
    const goodServer = await serveBundle(await readFile(newPack.data.path), manifest.canonical, "0.2.0");
    try {
      await mkdir(app, { recursive: true });
      const oldAKey = `${manifest.canonical}@0.1.0`;
      const oldBKey = `${failingCanonical}@0.1.0`;
      await writeFile(
        join(app, "nipmod.lock.json"),
        `${JSON.stringify({
          formatVersion: 2,
          generatedBy: "test",
          packages: {
            [oldAKey]: lockfilePackageFixture(manifest.publish.signingKey, "rollback-a", "0.1.0", oldPack.data.digest),
            [oldBKey]: lockfilePackageFixture(failingOwner, "rollback-b", "0.1.0", "b".repeat(64))
          },
          root: {
            dependencies: {
              "rollback-a": "latest",
              "rollback-b": "latest"
            },
            devDependencies: {},
            optionalDependencies: {},
            peerDependencies: {}
          },
          snapshots: {
            [oldAKey]: emptyLockfileSnapshot(),
            [oldBKey]: emptyLockfileSnapshot()
          }
        }, null, 2)}\n`
      );
      const beforeUpdate = await readFile(join(app, "nipmod.lock.json"), "utf8");
      const updateRegistry = cliGraphRegistry([
        {
          canonical: manifest.canonical,
          digest: newPack.data.digest,
          owner: manifest.publish.signingKey,
          resolved: goodServer.resolved,
          sourceRepo: goodServer.sourceRepo,
          version: "0.2.0"
        },
        {
          canonical: failingCanonical,
          digest: "f".repeat(64),
          owner: failingOwner,
          resolved: `http://127.0.0.1:${failingAddress.port}/api/v1/repos/${failingOwner.slice("did:key:".length)}/rollback-b/blob/releases/0.2.0/bundle.nipmod`,
          sourceRepo: `http://127.0.0.1:${failingAddress.port}/${failingOwner.slice("did:key:".length)}/rollback-b.git`,
          version: "0.2.0"
        }
      ]);
      await writeFile(registryPath, `${JSON.stringify(updateRegistry.registry)}\n`);

      const failed = await expectCliJsonFailure([
        "src/cli.ts",
        "update",
        "--registry",
        pathToFileURL(registryPath).href,
        "--allow-custom-roots",
        "--log-id",
        updateRegistry.log.treeHead.logId,
        "--witness",
        updateRegistry.witness.witness,
        "--dir",
        app,
        "--json"
      ]);

      expect(failed).toMatchObject({
        exitCode: 1,
        ok: false
      });
      expect(failed.error?.message).toContain("failed to fetch package: 500");
      await expect(readFile(join(app, "nipmod.lock.json"), "utf8")).resolves.toBe(beforeUpdate);
    } finally {
      await goodServer.close();
      await new Promise<void>((resolve, reject) => {
        failingServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  }, 45_000);

  test("add blocks the whole graph when a dependency trust report fails", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-add-graph-block-"));
    const app = join(workspace, "app");
    const owner = generateIdentity().did;
    const depOwner = generateIdentity().did;
    const canonical = `pkg:${owner}/root-agent`;
    const depCanonical = `pkg:${depOwner}/dep-agent`;
    const registryPath = join(workspace, "registry.json");
    const graphRegistry = cliGraphRegistry([
      {
        canonical,
        dependencies: { "dep-agent": "^0.1.0" },
        digest: "a".repeat(64),
        owner
      },
      {
        canonical: depCanonical,
        digest: "b".repeat(64),
        owner: depOwner,
        trustEvidenceOverrides: { bundleSignatureVerified: false }
      }
    ]);
    await writeFile(registryPath, `${JSON.stringify(graphRegistry.registry)}\n`);

    const failed = await expectCliJsonFailure([
      "src/cli.ts",
      "add",
      "root-agent",
      "--registry",
      pathToFileURL(registryPath).href,
      "--allow-custom-roots",
      "--log-id",
      graphRegistry.log.treeHead.logId,
      "--witness",
      graphRegistry.witness.witness,
      "--dir",
      app,
      "--json"
    ]);

    expect(failed).toMatchObject({
      data: {
        plan: {
          graph: {
            packageCount: 2
          },
          readyToInstall: false
        }
      },
      ok: false
    });
    expect(failed.data?.plan?.trustReport.findings).toEqual(expect.arrayContaining(["bundle signature is missing"]));
    await expect(readFile(join(app, "nipmod.lock.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("add rejects dependencies injected by registry metadata but absent from signed manifests", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-add-graph-injected-"));
    const app = join(workspace, "app");
    const rootDir = join(workspace, "root");
    const depDir = join(workspace, "dep");
    const registryPath = join(workspace, "registry.json");
    await execaNode(["src/cli.ts", "init", "--name", "root-agent", "--dir", rootDir]);
    await execaNode(["src/cli.ts", "init", "--name", "dep-agent", "--dir", depDir]);
    const rootPack = JSON.parse(
      (await execaNode(["src/cli.ts", "pack", rootDir, "--out", workspace, "--json"])).stdout
    ) as { ok: true; data: { digest: string; path: string } };
    const depPack = JSON.parse(
      (await execaNode(["src/cli.ts", "pack", depDir, "--out", workspace, "--json"])).stdout
    ) as { ok: true; data: { digest: string; path: string } };
    const rootManifest = JSON.parse(await readFile(join(rootDir, "nipmod.json"), "utf8")) as {
      canonical: string;
      publish: { signingKey: string };
      version: string;
    };
    const depManifest = JSON.parse(await readFile(join(depDir, "nipmod.json"), "utf8")) as {
      canonical: string;
      publish: { signingKey: string };
      version: string;
    };
    const rootServer = await serveBundle(await readFile(rootPack.data.path), rootManifest.canonical, rootManifest.version);
    const depServer = await serveBundle(await readFile(depPack.data.path), depManifest.canonical, depManifest.version);
    try {
      const graphRegistry = cliGraphRegistry([
        {
          canonical: rootManifest.canonical,
          dependencies: { "dep-agent": "^0.1.0" },
          digest: rootPack.data.digest,
          owner: rootManifest.publish.signingKey,
          resolved: rootServer.resolved,
          sourceRepo: rootServer.sourceRepo
        },
        {
          canonical: depManifest.canonical,
          digest: depPack.data.digest,
          owner: depManifest.publish.signingKey,
          resolved: depServer.resolved,
          sourceRepo: depServer.sourceRepo
        }
      ]);
      await writeFile(registryPath, `${JSON.stringify(graphRegistry.registry)}\n`);

      await expect(
        execaNode([
          "src/cli.ts",
          "add",
          "root-agent",
          "--registry",
          pathToFileURL(registryPath).href,
          "--allow-custom-roots",
          "--log-id",
          graphRegistry.log.treeHead.logId,
          "--witness",
          graphRegistry.witness.witness,
          "--dir",
          app,
          "--json"
        ])
      ).rejects.toThrow(/not reachable from signed manifests/i);
      await expect(readFile(join(app, "nipmod.lock.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rootServer.close();
      await depServer.close();
    }
  }, 30_000);

  test("canonical add stores canonical root intent so uninstall cleans it", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-add-canonical-root-"));
    const app = join(workspace, "app");
    const pkg = join(workspace, "pkg");
    const registryPath = join(workspace, "registry.json");
    await execaNode(["src/cli.ts", "init", "--name", "root-agent", "--dir", pkg]);
    const pack = JSON.parse((await execaNode(["src/cli.ts", "pack", pkg, "--out", workspace, "--json"])).stdout) as {
      ok: true;
      data: { digest: string; path: string };
    };
    const manifest = JSON.parse(await readFile(join(pkg, "nipmod.json"), "utf8")) as {
      canonical: string;
      publish: { signingKey: string };
      version: string;
    };
    const server = await serveBundle(await readFile(pack.data.path), manifest.canonical, manifest.version);
    try {
      const graphRegistry = cliGraphRegistry([
        {
          canonical: manifest.canonical,
          digest: pack.data.digest,
          owner: manifest.publish.signingKey,
          resolved: server.resolved,
          sourceRepo: server.sourceRepo
        }
      ]);
      await writeFile(registryPath, `${JSON.stringify(graphRegistry.registry)}\n`);
      await execaNode([
        "src/cli.ts",
        "add",
        `${manifest.canonical}@${manifest.version}`,
        "--registry",
        pathToFileURL(registryPath).href,
        "--allow-custom-roots",
        "--log-id",
        graphRegistry.log.treeHead.logId,
        "--witness",
        graphRegistry.witness.witness,
        "--dir",
        app,
        "--json"
      ]);
      let lockfile = JSON.parse(await readFile(join(app, "nipmod.lock.json"), "utf8"));
      expect(lockfile.root.dependencies).toEqual({ [manifest.canonical]: "0.1.0" });

      await execaNode(["src/cli.ts", "uninstall", manifest.canonical, "--dir", app, "--json"]);
      lockfile = JSON.parse(await readFile(join(app, "nipmod.lock.json"), "utf8"));
      expect(lockfile.root.dependencies).toEqual({});
    } finally {
      await server.close();
    }
  }, 30_000);

  test("add reports dependency policy failures as policy blocks", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-add-graph-policy-"));
    const app = join(workspace, "app");
    const owner = generateIdentity().did;
    const depOwner = generateIdentity().did;
    const canonical = `pkg:${owner}/root-agent`;
    const depCanonical = `pkg:${depOwner}/dep-agent`;
    const registryPath = join(workspace, "registry.json");
    const graphRegistry = cliGraphRegistry([
      {
        canonical,
        dependencies: { "dep-agent": "^0.1.0" },
        digest: "a".repeat(64),
        owner
      },
      {
        canonical: depCanonical,
        digest: "b".repeat(64),
        owner: depOwner,
        permissions: { exec: true }
      }
    ]);
    await writeFile(registryPath, `${JSON.stringify(graphRegistry.registry)}\n`);

    const failed = await expectCliJsonFailure([
      "src/cli.ts",
      "add",
      "root-agent",
      "--registry",
      pathToFileURL(registryPath).href,
      "--allow-custom-roots",
      "--log-id",
      graphRegistry.log.treeHead.logId,
      "--witness",
      graphRegistry.witness.witness,
      "--profile",
      "developer-default",
      "--dir",
      app,
      "--json"
    ]);

    expect(failed).toMatchObject({
      data: {
        plan: {
          policyDecision: {
            allowed: false
          },
          readyToInstall: false
        }
      },
      exitCode: 11,
      ok: false
    });
    expect(failed.data?.plan?.policyDecision?.reasons).toEqual(
      expect.arrayContaining(["permission exec is blocked by developer-default"])
    );
    await expect(readFile(join(app, "nipmod.lock.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("add rechecks signed manifest permissions before graph install", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-add-graph-signed-policy-"));
    const app = join(workspace, "app");
    const rootDir = join(workspace, "root");
    const depDir = join(workspace, "dep");
    const registryPath = join(workspace, "registry.json");
    await execaNode(["src/cli.ts", "init", "--name", "root-agent", "--dir", rootDir]);
    await execaNode(["src/cli.ts", "init", "--name", "dep-agent", "--dir", depDir]);

    const rootManifestPath = join(rootDir, "nipmod.json");
    const rootManifest = JSON.parse(await readFile(rootManifestPath, "utf8")) as {
      canonical: string;
      dependencies?: Record<string, string>;
      publish: { signingKey: string };
      version: string;
    };
    rootManifest.dependencies = { "dep-agent": "^0.1.0" };
    await writeFile(rootManifestPath, `${JSON.stringify(rootManifest, null, 2)}\n`);

    const depManifestPath = join(depDir, "nipmod.json");
    const depManifest = JSON.parse(await readFile(depManifestPath, "utf8")) as {
      canonical: string;
      permissions: { mcpTools: string[] };
      publish: { signingKey: string };
      version: string;
    };
    depManifest.permissions.mcpTools = ["github.search"];
    await writeFile(depManifestPath, `${JSON.stringify(depManifest, null, 2)}\n`);

    const rootPack = JSON.parse(
      (await execaNode(["src/cli.ts", "pack", rootDir, "--out", workspace, "--json"])).stdout
    ) as { ok: true; data: { digest: string; path: string } };
    const depPack = JSON.parse(
      (await execaNode(["src/cli.ts", "pack", depDir, "--out", workspace, "--json"])).stdout
    ) as { ok: true; data: { digest: string; path: string } };
    const rootServer = await serveBundle(await readFile(rootPack.data.path), rootManifest.canonical, rootManifest.version);
    const depServer = await serveBundle(await readFile(depPack.data.path), depManifest.canonical, depManifest.version);
    try {
      const graphRegistry = cliGraphRegistry([
        {
          canonical: rootManifest.canonical,
          dependencies: { "dep-agent": "^0.1.0" },
          digest: rootPack.data.digest,
          owner: rootManifest.publish.signingKey,
          resolved: rootServer.resolved,
          sourceRepo: rootServer.sourceRepo
        },
        {
          canonical: depManifest.canonical,
          digest: depPack.data.digest,
          owner: depManifest.publish.signingKey,
          resolved: depServer.resolved,
          sourceRepo: depServer.sourceRepo
        }
      ]);
      await writeFile(registryPath, `${JSON.stringify(graphRegistry.registry)}\n`);

      const failed = await expectCliJsonFailure([
        "src/cli.ts",
        "add",
        "root-agent",
        "--registry",
        pathToFileURL(registryPath).href,
        "--allow-custom-roots",
        "--log-id",
        graphRegistry.log.treeHead.logId,
        "--witness",
        graphRegistry.witness.witness,
        "--profile",
        "developer-default",
        "--dir",
        app,
        "--json"
      ]);

      expect(failed).toMatchObject({
        data: {
          policyDecision: {
            allowed: false,
            profile: "developer-default"
          }
        },
        exitCode: 11,
        ok: false
      });
      expect(failed.data?.policyDecision?.reasons).toEqual(
        expect.arrayContaining(["permission mcpTools is blocked by developer-default"])
      );
      await expect(readFile(join(app, "nipmod.lock.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rootServer.close();
      await depServer.close();
    }
  }, 30_000);

  test("add plan rejects oversized dependency graphs before trust inspection", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-add-graph-limit-"));
    const registryPath = join(workspace, "registry.json");
    const entries = Array.from({ length: 129 }, (_, index) => {
      const owner = generateIdentity().did;
      const name = `graph-agent-${index}`;
      const nextName = `graph-agent-${index + 1}`;
      return {
        canonical: `pkg:${owner}/${name}`,
        ...(index < 128 ? { dependencies: { [nextName]: "0.1.0" } } : {}),
        digest: `${index.toString(16).padStart(2, "0")}${"a".repeat(62)}`,
        owner
      };
    });
    const graphRegistry = cliGraphRegistry(entries);
    await writeFile(registryPath, `${JSON.stringify(graphRegistry.registry)}\n`);

    await expect(
      execaNode([
        "src/cli.ts",
        "add",
        "graph-agent-0",
        "--registry",
        pathToFileURL(registryPath).href,
        "--allow-custom-roots",
        "--log-id",
        graphRegistry.log.treeHead.logId,
        "--witness",
        graphRegistry.witness.witness,
        "--dir",
        workspace,
        "--json"
      ])
    ).rejects.toThrow(/dependency graph exceeds 128 packages/);
  });

  test("add rejects registry file bundle URLs before mutating the lockfile", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-add-file-resolved-"));
    const pkg = join(workspace, "pkg");
    const app = join(workspace, "app");
    const registryPath = join(workspace, "registry.json");
    await execaNode(["src/cli.ts", "init", "--name", "@probe/file-agent", "--dir", pkg]);
    const pack = await execaNode(["src/cli.ts", "pack", pkg, "--out", workspace, "--json"]);
    const packed = JSON.parse(pack.stdout) as { ok: true; data: { digest: string; path: string } };
    const manifest = JSON.parse(await readFile(join(pkg, "nipmod.json"), "utf8")) as {
      canonical: string;
      publish: { signingKey: string };
    };
    const transparency = cliTransparency(manifest.canonical, manifest.publish.signingKey, packed.data.digest);
    const registry = cliRegistry(manifest.canonical, manifest.publish.signingKey, packed.data.digest, transparency);
    registry.packages[0]!.resolved = pathToFileURL(packed.data.path).href;
    await writeFile(registryPath, `${JSON.stringify(registry)}\n`);

    await expect(
      execaNode([
        "src/cli.ts",
        "add",
        "file-agent",
        "--registry",
        pathToFileURL(registryPath).href,
        "--allow-custom-roots",
        "--log-id",
        transparency.log.treeHead.logId,
        "--witness",
        transparency.witness.witness,
        "--dir",
        app,
        "--json"
      ])
    ).rejects.toThrow(/https or loopback http/i);
    await expect(readFile(join(app, "nipmod.lock.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("add refuses a single fuzzy search hit without mutating the lockfile", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-add-fuzzy-"));
    const app = join(workspace, "app");
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/specific-agent`;
    const digest = "f".repeat(64);
    const registryPath = join(workspace, "registry.json");
    const transparency = cliTransparency(canonical, owner, digest);
    const registry = cliRegistry(canonical, owner, digest, transparency);
    registry.packages[0]!.description = "Browser workflow package";
    await writeFile(registryPath, `${JSON.stringify(registry)}\n`);

    await expect(
      execaNode([
        "src/cli.ts",
        "add",
        "Browser",
        "--registry",
        pathToFileURL(registryPath).href,
        "--allow-custom-roots",
        "--dir",
        app,
        "--json"
      ])
    ).rejects.toThrow(/exact package name/i);
    await expect(readFile(join(app, "nipmod.lock.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("add refuses ambiguous registry queries without mutating the lockfile", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-add-ambiguous-"));
    const app = join(workspace, "app");
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/shared-agent`;
    const digest = "f".repeat(64);
    const registryPath = join(workspace, "registry.json");
    const transparency = cliTransparency(canonical, owner, digest);
    const registry = cliRegistry(canonical, owner, digest, transparency);
    registry.packages.push({
      ...registry.packages[0],
      canonical: `pkg:${owner}/shared-agent-alt`,
      digest: "e".repeat(64),
      name: "shared-agent"
    });
    await writeFile(registryPath, `${JSON.stringify(registry)}\n`);

    await expect(
      execaNode([
        "src/cli.ts",
        "add",
        "shared-agent",
        "--registry",
        pathToFileURL(registryPath).href,
        "--dir",
        app,
        "--json"
      ])
    ).rejects.toThrow(/ambiguous/i);
    await expect(readFile(join(app, "nipmod.lock.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("inspect and add block quarantined registry packages", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-quarantine-block-"));
    const app = join(workspace, "app");
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/blocked-agent`;
    const digest = "d".repeat(64);
    const registryPath = join(workspace, "registry.json");
    const transparency = cliTransparency(canonical, owner, digest);
    const registry = cliRegistry(canonical, owner, digest, transparency);
    registry.packages[0]!.quarantine = quarantineFixture(canonical, "0.1.0", digest);
    await writeFile(registryPath, `${JSON.stringify(registry)}\n`);

    const failedInspect = await expectCliJsonFailure([
      "src/cli.ts",
      "inspect",
      `${canonical}@0.1.0`,
      "--registry",
      pathToFileURL(registryPath).href,
      "--allow-custom-roots",
      "--log-id",
      transparency.log.treeHead.logId,
      "--witness",
      transparency.witness.witness,
      "--json"
    ]);
    expect(failedInspect).toMatchObject({
      data: {
        report: {
          quarantine: {
            active: true,
            advisoryId: "NIPMOD-2026-9001"
          },
          readyToInstall: false,
          verdict: "failed"
        }
      },
      exitCode: 7,
      ok: false
    });
    expect(failedInspect.data?.report).not.toHaveProperty("installCommand");
    expect(failedInspect.data?.report?.findings).toEqual(
      expect.arrayContaining(["package is quarantined: NIPMOD-2026-9001: Quarantine dry-run advisory"])
    );

    const failedPlan = await expectCliJsonFailure([
      "src/cli.ts",
      "install",
      `${canonical}@0.1.0`,
      "--plan",
      "--registry",
      pathToFileURL(registryPath).href,
      "--allow-custom-roots",
      "--log-id",
      transparency.log.treeHead.logId,
      "--witness",
      transparency.witness.witness,
      "--dir",
      app,
      "--json"
    ]);
    expect(failedPlan).toMatchObject({
      data: {
        plan: {
          readyToInstall: false
        }
      },
      exitCode: 7,
      ok: false
    });
    expect(failedPlan.data?.plan?.trustReport.findings).toEqual(
      expect.arrayContaining(["package is quarantined: NIPMOD-2026-9001: Quarantine dry-run advisory"])
    );

    const failedAdd = await expectCliJsonFailure([
      "src/cli.ts",
      "add",
      "blocked-agent",
      "--registry",
      pathToFileURL(registryPath).href,
      "--allow-custom-roots",
      "--log-id",
      transparency.log.treeHead.logId,
      "--witness",
      transparency.witness.witness,
      "--dir",
      app,
      "--json"
    ]);
    expect(failedAdd).toMatchObject({
      data: {
        plan: {
          readyToInstall: false
        }
      },
      exitCode: 7,
      ok: false
    });
    expect(failedAdd.data?.plan?.trustReport.findings).toEqual(
      expect.arrayContaining(["package is quarantined: NIPMOD-2026-9001: Quarantine dry-run advisory"])
    );
    await expect(readFile(join(app, "nipmod.lock.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("policy init writes the default developer policy", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-policy-init-"));

    const result = await execaNode(["src/cli.ts", "policy", "init", "--dir", workspace, "--json"]);
    const parsed = JSON.parse(result.stdout) as {
      ok: true;
      data: {
        path: string;
        policy: {
          formatVersion: number;
          profile: string;
          rules: {
            blockedPermissions: {
              exec: boolean;
              postinstall: boolean;
              secrets: boolean;
            };
            minimumTrustScore: number;
            requireVerified: boolean;
          };
          type: string;
        };
      };
    };
    const policy = JSON.parse(await readFile(join(workspace, "nipmod.policy.json"), "utf8")) as typeof parsed.data.policy;

    expect(parsed.data.path).toBe(join(workspace, "nipmod.policy.json"));
    expect(policy).toMatchObject({
      formatVersion: 1,
      profile: "developer-default",
      rules: {
        blockedPermissions: {
          exec: true,
          postinstall: true,
          secrets: true
        },
        minimumTrustScore: 100,
        requireVerified: true
      },
      type: "dev.nipmod.policy.v1"
    });
  });

  test("policy explain allows a verified package with quiet permissions", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-policy-explain-"));
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/policy-agent`;
    const digest = "f".repeat(64);
    const registryPath = join(workspace, "registry.json");
    const transparency = cliTransparency(canonical, owner, digest);
    await writeFile(registryPath, `${JSON.stringify(cliRegistry(canonical, owner, digest, transparency))}\n`);

    const result = await execaNode([
      "src/cli.ts",
      "policy",
      "explain",
      `${canonical}@0.1.0`,
      "--registry",
      pathToFileURL(registryPath).href,
      "--allow-custom-roots",
      "--log-id",
      transparency.log.treeHead.logId,
      "--witness",
      transparency.witness.witness,
      "--json"
    ]);
    const parsed = JSON.parse(result.stdout) as {
      ok: true;
      data: {
        policyDecision: {
          allowed: boolean;
          profile: string;
          reasons: string[];
        };
        report: {
          canonical: string;
          verdict: string;
        };
      };
    };

    expect(parsed.ok).toBe(true);
    expect(parsed.data.report).toMatchObject({ canonical, verdict: "verified" });
    expect(parsed.data.policyDecision).toMatchObject({
      allowed: true,
      profile: "developer-default",
      reasons: []
    });
  });

  test("policy check blocks installed packages with exec permission", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-policy-check-"));
    const app = join(workspace, "app");
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/installed-exec`;
    await mkdir(app, { recursive: true });
    await writeFile(
      join(app, "nipmod.lock.json"),
      `${JSON.stringify({
        formatVersion: 1,
        generatedBy: "test",
        packages: {
          [`${canonical}@0.1.0`]: {
            canonical,
            files: ["SKILL.md"],
            integrity: `sha256-${"a".repeat(64)}`,
            manifestDigest: "b".repeat(64),
            name: "installed-exec",
            permissions: {
              env: [],
              exec: { allowed: true },
              filesystem: [],
              mcpTools: [],
              network: [],
              postinstall: { allowed: false },
              secrets: []
            },
            publisher: owner,
            resolved: `https://node.nipmod.com/api/v1/repos/${owner.slice("did:key:".length)}/installed-exec/blob/releases/0.1.0/bundle.nipmod`,
            version: "0.1.0"
          }
        }
      })}\n`
    );

    const failed = await expectCliJsonFailure(["src/cli.ts", "policy", "check", "--dir", app, "--json"]);
    expect(failed).toMatchObject({
      data: {
        allowed: false,
        packages: [
          {
            canonical,
            decision: {
              allowed: false,
              profile: "developer-default"
            },
            version: "0.1.0"
          }
        ],
        summary: {
          allow: 0,
          block: 1,
          total: 1
        }
      },
      exitCode: 11,
      ok: false
    });
    expect(failed.data?.packages?.[0]?.decision?.reasons).toEqual(
      expect.arrayContaining(["permission exec is blocked by developer-default"])
    );
  });

  test("policy check blocks unsafe installed permission scopes", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-policy-check-scopes-"));
    const app = join(workspace, "app");
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/installed-scopes`;
    await mkdir(app, { recursive: true });
    await writeFile(
      join(app, "nipmod.lock.json"),
      `${JSON.stringify({
        formatVersion: 1,
        generatedBy: "test",
        packages: {
          [`${canonical}@0.1.0`]: {
            canonical,
            files: ["SKILL.md"],
            integrity: `sha256-${"a".repeat(64)}`,
            manifestDigest: "b".repeat(64),
            name: "installed-scopes",
            permissions: {
              env: ["OPENAI_API_KEY"],
              exec: { allowed: false },
              filesystem: ["read:${project}/**"],
              mcpTools: ["github.*"],
              network: ["*"],
              postinstall: { allowed: false },
              secrets: ["*"]
            },
            publisher: owner,
            resolved: `https://node.nipmod.com/api/v1/repos/${owner.slice("did:key:".length)}/installed-scopes/blob/releases/0.1.0/bundle.nipmod`,
            version: "0.1.0"
          }
        }
      })}\n`
    );

    const failed = await expectCliJsonFailure(["src/cli.ts", "policy", "check", "--dir", app, "--json"]);
    const reasons = failed.data?.packages?.[0]?.decision?.reasons ?? [];
    expect(failed).toMatchObject({
      data: {
        allowed: false,
        summary: {
          allow: 0,
          block: 1,
          total: 1
        }
      },
      exitCode: 11,
      ok: false
    });
    expect(reasons).toEqual(
      expect.arrayContaining([
        "permission filesystem wildcard is blocked by developer-default",
        "permission network wildcard is blocked by developer-default",
        "permission env secret-like variable is blocked by developer-default",
        "permission mcpTools wildcard is blocked by developer-default",
        "permission secrets is blocked by developer-default"
      ])
    );
  });

  test("policy explain blocks a verified package with exec permission", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-policy-block-"));
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/exec-agent`;
    const digest = "f".repeat(64);
    const registryPath = join(workspace, "registry.json");
    const transparency = cliTransparency(canonical, owner, digest);
    const registry = cliRegistry(canonical, owner, digest, transparency);
    registry.packages[0]!.permissions = {
      env: 0,
      exec: true,
      filesystem: 0,
      mcpTools: 0,
      network: 0,
      postinstall: false,
      secrets: 0
    };
    await writeFile(registryPath, `${JSON.stringify(registry)}\n`);

    const failed = await expectCliJsonFailure([
      "src/cli.ts",
      "policy",
      "explain",
      `${canonical}@0.1.0`,
      "--registry",
      pathToFileURL(registryPath).href,
      "--allow-custom-roots",
      "--log-id",
      transparency.log.treeHead.logId,
      "--witness",
      transparency.witness.witness,
      "--json"
    ]);

    expect(failed).toMatchObject({
      data: {
        policyDecision: {
          allowed: false,
          profile: "developer-default"
        }
      },
      exitCode: 11,
      ok: false
    });
    expect(failed.data?.policyDecision?.reasons).toEqual(
      expect.arrayContaining(["permission exec is blocked by developer-default"])
    );
  });

  test("install plan policy blocks registry packages without detailed permission scopes", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-policy-plan-patterns-"));
    const app = join(workspace, "app");
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/network-agent`;
    const digest = "f".repeat(64);
    const registryPath = join(workspace, "registry.json");
    const transparency = cliTransparency(canonical, owner, digest);
    const registry = cliRegistry(canonical, owner, digest, transparency);
    registry.packages[0]!.permissions = {
      env: 0,
      exec: false,
      filesystem: 0,
      mcpTools: 0,
      network: 1,
      postinstall: false,
      secrets: 0
    };
    await writeFile(registryPath, `${JSON.stringify(registry)}\n`);

    const failed = await expectCliJsonFailure([
      "src/cli.ts",
      "install",
      "--plan",
      `${canonical}@0.1.0`,
      "--registry",
      pathToFileURL(registryPath).href,
      "--allow-custom-roots",
      "--log-id",
      transparency.log.treeHead.logId,
      "--witness",
      transparency.witness.witness,
      "--profile",
      "developer-default",
      "--dir",
      app,
      "--json"
    ]);

    expect(failed).toMatchObject({
      data: {
        plan: {
          policyDecision: {
            allowed: false,
            profile: "developer-default"
          },
          readyToInstall: false
        }
      },
      exitCode: 11,
      ok: false
    });
    expect(failed.data?.plan?.policyDecision?.reasons).toEqual(
      expect.arrayContaining(["permission pattern details are required by developer-default"])
    );
    await expect(readFile(join(app, "nipmod.lock.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("install plan policy blocks mcp counts without detailed permission scopes even when mcp is allowed", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-policy-plan-mcp-patterns-"));
    const app = join(workspace, "app");
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/mcp-agent`;
    const digest = "f".repeat(64);
    const registryPath = join(workspace, "registry.json");
    const policyPath = join(workspace, "nipmod.policy.json");
    const transparency = cliTransparency(canonical, owner, digest);
    const registry = cliRegistry(canonical, owner, digest, transparency);
    const policy = developerPolicyFixture();
    policy.rules.blockedPermissions.mcpTools = false;
    registry.packages[0]!.permissions = {
      env: 0,
      exec: false,
      filesystem: 0,
      mcpTools: 1,
      network: 0,
      postinstall: false,
      secrets: 0
    };
    await writeFile(registryPath, `${JSON.stringify(registry)}\n`);
    await writeFile(policyPath, `${JSON.stringify(policy, null, 2)}\n`);

    const failed = await expectCliJsonFailure([
      "src/cli.ts",
      "install",
      "--plan",
      `${canonical}@0.1.0`,
      "--registry",
      pathToFileURL(registryPath).href,
      "--allow-custom-roots",
      "--log-id",
      transparency.log.treeHead.logId,
      "--witness",
      transparency.witness.witness,
      "--policy",
      policyPath,
      "--dir",
      app,
      "--json"
    ]);

    expect(failed).toMatchObject({
      data: {
        plan: {
          policyDecision: {
            allowed: false,
            profile: "developer-default"
          },
          readyToInstall: false
        }
      },
      exitCode: 11,
      ok: false
    });
    expect(failed.data?.plan?.policyDecision?.reasons).toEqual(
      expect.arrayContaining(["permission pattern details are required by developer-default"])
    );
  });

  test("install plan applies policy before mutating a lockfile", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-policy-plan-"));
    const app = join(workspace, "app");
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/exec-agent`;
    const digest = "f".repeat(64);
    const registryPath = join(workspace, "registry.json");
    const policyPath = join(workspace, "nipmod.policy.json");
    const transparency = cliTransparency(canonical, owner, digest);
    const registry = cliRegistry(canonical, owner, digest, transparency);
    registry.packages[0]!.permissions = {
      env: 0,
      exec: true,
      filesystem: 0,
      mcpTools: 0,
      network: 0,
      postinstall: false,
      secrets: 0
    };
    await writeFile(registryPath, `${JSON.stringify(registry)}\n`);
    await writeFile(policyPath, `${JSON.stringify(developerPolicyFixture(), null, 2)}\n`);

    const failed = await expectCliJsonFailure([
      "src/cli.ts",
      "install",
      "--plan",
      `${canonical}@0.1.0`,
      "--registry",
      pathToFileURL(registryPath).href,
      "--allow-custom-roots",
      "--log-id",
      transparency.log.treeHead.logId,
      "--witness",
      transparency.witness.witness,
      "--policy",
      policyPath,
      "--dir",
      app,
      "--json"
    ]);

    expect(failed).toMatchObject({
      data: {
        plan: {
          policyDecision: {
            allowed: false,
            profile: "developer-default"
          },
          readyToInstall: false
        }
      },
      exitCode: 11,
      ok: false
    });
    expect(failed.data?.plan?.policyDecision?.reasons).toEqual(
      expect.arrayContaining(["permission exec is blocked by developer-default"])
    );
    await expect(readFile(join(app, "nipmod.lock.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("audits an installed package against file-backed registry and advisory feeds", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-audit-"));
    const app = join(workspace, "app");
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/cli-audit`;
    const digest = "c".repeat(64);
	    const registryPath = join(workspace, "registry.json");
	    const advisoriesPath = join(workspace, "advisories.json");
	    const advisoriesSignaturePath = `${advisoriesPath}.sig`;
	    const discoveryPath = join(workspace, "discovery.json");
	    const transparency = cliTransparency(canonical, owner, digest);
	    const advisorySigning = advisorySigningKey();
    await mkdir(app, { recursive: true });
    await writeFile(
      join(app, "nipmod.lock.json"),
      `${JSON.stringify({
        formatVersion: 1,
        generatedBy: "test",
        packages: {
          [`${canonical}@0.1.0`]: {
            canonical,
            files: ["SKILL.md"],
            integrity: `sha256-${digest}`,
            manifestDigest: "d".repeat(64),
            name: "cli-audit",
            permissions: {
              env: [],
              exec: { allowed: false },
              filesystem: [],
              mcpTools: [],
              network: [],
              postinstall: { allowed: false },
              secrets: []
            },
            publisher: owner,
            resolved: "https://node.nipmod.com/api/v1/repos/z6Mkcli/cli-audit/blob/releases/0.1.0/bundle.nipmod",
            version: "0.1.0"
          }
        }
      })}\n`
    );
    await writeFile(
      registryPath,
      `${JSON.stringify({
        formatVersion: 1,
        generatedAt: "2026-05-16T03:32:00.000Z",
        packages: [
          {
            canonical,
            digest,
            proof: {
              checkpointUrl: "/transparency/checkpoint.json",
              eventHash: transparency.entry.leaf.eventHash,
              leafHash: transparency.entry.leafHash,
              leafIndex: transparency.entry.leafIndex,
              leafUrl: `/transparency/leaves/${transparency.entry.leafHash}.json`,
              proofUrl: `/transparency/proofs/${transparency.entry.leafHash}.json`,
              rootHash: transparency.log.treeHead.rootHash,
              subject: `${canonical}@0.1.0`,
              treeSize: transparency.log.treeHead.treeSize,
              type: "dev.nipmod.registry.proof.v1",
              witnesses: [transparency.witness.witness],
              witnessUrls: [`/transparency/witnesses/${transparency.witness.witness}.json`]
            },
            publisher: owner,
            trust: {
              evidence: {
                artifactDigestVerified: true,
                bundleSignatureVerified: true,
                immutableSnapshotMatched: true,
                publisherMatchesCanonical: true,
                releaseEventSigned: true,
                sourceProvenanceVerified: true,
                transparencyLogIncluded: true,
                transparencyLogVerified: true
              },
              level: "verified",
              score: 100
            },
            version: "0.1.0"
          }
        ],
        skipped: [],
        source: "https://node.nipmod.com",
        transparencyLog: {
          ...transparency.log,
          witnesses: [transparency.witness]
        }
      })}\n`
    );
	    await writeFile(
	      advisoriesPath,
	      `${JSON.stringify({
	        advisories: [],
	        expiresAt: "2026-06-16T00:00:00.000Z",
	        formatVersion: 1,
	        generatedAt: "2026-05-16T03:32:00.000Z",
	        type: "dev.nipmod.advisories.v1"
	      })}\n`
	    );
	    await writeFile(advisoriesSignaturePath, `${JSON.stringify(signAdvisories(await readFile(advisoriesPath), advisorySigning))}\n`);
    await writeFile(
      discoveryPath,
      `${JSON.stringify({
        advisories: pathToFileURL(advisoriesPath).href,
        formatVersion: 1,
        name: "nipmod",
        registry: {
          url: pathToFileURL(registryPath).href
        },
        transparency: {
          logId: transparency.log.treeHead.logId
        },
        type: "dev.nipmod.discovery.v1",
        witness: {
          did: transparency.witness.witness
        }
      })}\n`
    );

    const result = await execaNode([
      "src/cli.ts",
      "audit",
      "--dir",
      app,
	      "--discovery",
	      pathToFileURL(discoveryPath).href,
	      "--allow-custom-roots",
	      "--log-id",
	      transparency.log.treeHead.logId,
		      "--witness",
		      transparency.witness.witness,
		      "--advisory-key",
		      advisorySigning.publicKeySpkiBase64,
		      "--advisory-key-sha256",
		      advisorySigning.publicKeySpkiSha256,
		      "--online",
      "--json"
    ]);
    const parsed = JSON.parse(result.stdout) as {
      ok: true;
      data: { ready: boolean; summary: { total: number; ok: number; warn: number; fail: number } };
    };

	    expect(parsed.data.ready).toBe(true);
	    expect(parsed.data.summary).toEqual({ fail: 0, ok: 1, total: 1, warn: 0 });

	    const pinnedResult = await execaNode([
	      "src/cli.ts",
	      "audit",
	      "--dir",
	      app,
	      "--registry",
	      pathToFileURL(registryPath).href,
		      "--advisories",
		      pathToFileURL(advisoriesPath).href,
		      "--advisories-signature",
		      pathToFileURL(advisoriesSignaturePath).href,
		      "--advisory-key",
		      advisorySigning.publicKeySpkiBase64,
		      "--advisory-key-sha256",
		      advisorySigning.publicKeySpkiSha256,
		      "--allow-custom-roots",
		      "--log-id",
	      transparency.log.treeHead.logId,
	      "--witness",
	      transparency.witness.witness,
	      "--json"
	    ]);
	    const pinned = JSON.parse(pinnedResult.stdout) as {
	      ok: true;
	      data: { ready: boolean; summary: { total: number; ok: number; warn: number; fail: number } };
	    };

	    expect(pinned.data.ready).toBe(true);
	    expect(pinned.data.summary).toEqual({ fail: 0, ok: 1, total: 1, warn: 0 });
	  });

	  test("inspects an exact package name from the configured default registry", async () => {
	    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-inspect-short-name-"));
	    const owner = generateIdentity().did;
	    const canonical = `pkg:${owner}/short-inspect-agent`;
	    const digest = "b".repeat(64);
	    const registryPath = join(workspace, "registry.json");
	    const transparency = cliTransparency(canonical, owner, digest);
	    await writeFile(registryPath, `${JSON.stringify(cliRegistry(canonical, owner, digest, transparency))}\n`);

	    const result = await execaNode(
	      [
	        "src/cli.ts",
	        "inspect",
	        "short-inspect-agent",
	        "--allow-custom-roots",
	        "--log-id",
	        transparency.log.treeHead.logId,
	        "--witness",
	        transparency.witness.witness,
	        "--json"
	      ],
	      {
	        env: { NIPMOD_REGISTRY_URL: pathToFileURL(registryPath).href }
	      }
	    );
	    const parsed = JSON.parse(result.stdout) as { ok: true; data: { report: { canonical: string; installCommand: string; version: string } } };

	    expect(parsed.data.report).toMatchObject({
	      canonical,
	      installCommand: `nipmod install ${canonical}@0.1.0`,
	      version: "0.1.0"
	    });
	  });

  test("audit refuses implicit network access without explicit online mode", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-audit-offline-"));

    await expect(execaNode(["src/cli.ts", "audit", "--dir", workspace, "--json"])).rejects.toThrow(/--online/);
  });

  test("audit refuses custom trust roots unless explicitly enabled", async () => {
    const fixture = await writeCliCiFixture({ packageName: "cli-audit-roots", prefix: "nipmod-cli-audit-roots-" });

    const failed = await expectCliJsonFailure([
      "src/cli.ts",
      "audit",
      ...fixture.args.filter((arg) => arg !== "--allow-custom-roots"),
      "--json"
    ]);

    expect(failed).toMatchObject({
      error: {
        message: "audit custom trust roots require --allow-custom-roots"
      },
      exitCode: 1,
      ok: false
    });
  });

  test("audit attaches policy check output when requested", async () => {
    const fixture = await writeCliCiFixture({ packageName: "cli-audit-policy", prefix: "nipmod-cli-audit-policy-" });

    const result = await execaNode(["src/cli.ts", "audit", ...fixture.args, "--profile", "developer-default", "--json"]);
    const parsed = JSON.parse(result.stdout) as {
      ok: true;
      data: {
        policyCheck: {
          allowed: boolean;
          policy: { profile: string };
          summary: { allow: number; block: number; total: number };
        };
        ready: boolean;
      };
    };

    expect(parsed.ok).toBe(true);
    expect(parsed.data.ready).toBe(true);
    expect(parsed.data.policyCheck).toMatchObject({
      allowed: true,
      policy: { profile: "developer-default" },
      summary: { allow: 1, block: 0, total: 1 }
    });
  });

  test("ci passes a clean verified lockfile under strict-ci policy", async () => {
    const fixture = await writeCliCiFixture({ packageName: "cli-ci-clean", prefix: "nipmod-cli-ci-clean-" });

    const result = await execaNode(["src/cli.ts", "ci", ...fixture.args, "--json"]);
    const parsed = JSON.parse(result.stdout) as {
      ok: true;
      data: {
        audit: { summary: { fail: number; ok: number; total: number; warn: number } };
        policyCheck: {
          allowed: boolean;
          policy: { profile: string };
          summary: { allow: number; block: number; total: number };
        };
        policyProfile: string;
        ready: boolean;
        violations: Array<{ canonical: string; findings: string[]; status: string; version: string }>;
      };
    };

    expect(parsed.ok).toBe(true);
    expect(parsed.data.ready).toBe(true);
    expect(parsed.data.policyProfile).toBe("strict-ci");
    expect(parsed.data.policyCheck).toMatchObject({
      allowed: true,
      policy: { profile: "strict-ci" },
      summary: { allow: 1, block: 0, total: 1 }
    });
    expect(parsed.data.audit.summary).toEqual({ fail: 0, ok: 1, total: 1, warn: 0 });
    expect(parsed.data.violations).toEqual([]);
  });

  test("ci refuses self-attested trust roots unless explicitly enabled", async () => {
    const fixture = await writeCliCiFixture({ packageName: "cli-ci-roots", prefix: "nipmod-cli-ci-roots-" });

    const failed = await expectCliJsonFailure([
      "src/cli.ts",
      "ci",
      ...fixture.args.filter((arg) => arg !== "--allow-custom-roots"),
      "--json"
    ]);

    expect(failed).toMatchObject({
      error: {
        message: "ci custom trust roots require --allow-custom-roots"
      },
      exitCode: 1,
      ok: false
    });
  });

  test("ci fails when strict policy blocks an otherwise clean audit", async () => {
    const fixture = await writeCliCiFixture({ packageName: "cli-ci-policy-mcp", prefix: "nipmod-cli-policy-mcp-" });
    const dir = fixture.args[fixture.args.indexOf("--dir") + 1]!;
    const lockfilePath = join(dir, "nipmod.lock.json");
    const lockfile = JSON.parse(await readFile(lockfilePath, "utf8")) as {
      packages: Record<string, { permissions: { mcpTools: string[] } }>;
    };
    lockfile.packages[`${fixture.canonical}@0.1.0`]!.permissions.mcpTools = ["github.search"];
    await writeFile(lockfilePath, `${JSON.stringify(lockfile, null, 2)}\n`);

    const failed = await expectCliJsonFailure(["src/cli.ts", "ci", ...fixture.args, "--json"]);
    expect(failed).toMatchObject({
      data: {
        policyCheck: {
          allowed: false
        },
        policyProfile: "strict-ci",
        ready: false
      },
      exitCode: 8,
      ok: false
    });
    expect(failed.data?.policyCheck?.packages?.[0]?.decision?.reasons).toEqual(
      expect.arrayContaining(["permission mcpTools is blocked by strict-ci"])
    );
  });

  test("ci blocks advisory warnings under strict-ci policy", async () => {
    const fixture = await writeCliCiFixture({
      advisorySeverity: "low",
      packageName: "cli-ci-warn",
      prefix: "nipmod-cli-ci-warn-"
    });

    const failed = await expectCliJsonFailure(["src/cli.ts", "ci", ...fixture.args, "--json"]);
    expect(failed).toMatchObject({
      data: {
        policyProfile: "strict-ci",
        ready: false,
        violations: [
          {
            canonical: fixture.canonical,
            status: "warn",
            version: "0.1.0"
          }
        ]
      },
      exitCode: 8,
      ok: false
    });
    expect(failed.data?.message).toContain("strict-ci blocks warnings");
    expect(failed.data?.violations[0]?.findings).toEqual(expect.arrayContaining(["NIPMOD-2026-0001: Test advisory"]));
  });

  test("signed quarantine advisory blocks audit and ci without mutating the public feed", async () => {
    const publicAdvisoriesPath = fileURLToPath(new URL("../../site/public/advisories.json", import.meta.url));
    const beforePublicFeed = await readFile(publicAdvisoriesPath, "utf8");
    const fixture = await writeCliCiFixture({
      advisorySeverity: "critical",
      packageName: "quarantined-package",
      prefix: "nipmod-cli-quarantine-"
    });

    const failedAudit = await expectCliJsonFailure(["src/cli.ts", "audit", ...fixture.args, "--json"]);
    expect(failedAudit).toMatchObject({
      data: {
        ready: false,
        summary: {
          fail: 1,
          ok: 0,
          total: 1,
          warn: 0
        }
      },
      exitCode: 6,
      ok: false
    });
    expect(failedAudit.data?.packages?.[0]?.findings).toEqual(
      expect.arrayContaining(["NIPMOD-2026-0001: Test advisory"])
    );

    const failedCi = await expectCliJsonFailure(["src/cli.ts", "ci", ...fixture.args, "--json"]);
    expect(failedCi).toMatchObject({
      data: {
        policyProfile: "strict-ci",
        ready: false,
        violations: [
          {
            canonical: fixture.canonical,
            status: "fail",
            version: "0.1.0"
          }
        ]
      },
      exitCode: 8,
      ok: false
    });
    expect(failedCi.data?.violations[0]?.findings).toEqual(
      expect.arrayContaining(["NIPMOD-2026-0001: Test advisory"])
    );
    expect(await readFile(publicAdvisoriesPath, "utf8")).toBe(beforePublicFeed);
  });

  test("ci blocks registry digest drift", async () => {
    const fixture = await writeCliCiFixture({
      packageName: "cli-ci-drift",
      prefix: "nipmod-cli-ci-drift-",
      registryDigest: "b".repeat(64)
    });

    const failed = await expectCliJsonFailure(["src/cli.ts", "ci", ...fixture.args, "--json"]);
    expect(failed).toMatchObject({
      data: {
        policyProfile: "strict-ci",
        ready: false,
        violations: [
          {
            canonical: fixture.canonical,
            status: "fail",
            version: "0.1.0"
          }
        ]
      },
      exitCode: 8,
      ok: false
    });
    expect(failed.data?.violations[0]?.findings).toEqual(
      expect.arrayContaining(["registry digest does not match lockfile integrity"])
    );
  });

  test("ci blocks duplicate registry package records", async () => {
    const fixture = await writeCliCiFixture({
      duplicateRegistryPackage: true,
      packageName: "cli-ci-duplicate",
      prefix: "nipmod-cli-ci-duplicate-"
    });

    const failed = await expectCliJsonFailure(["src/cli.ts", "ci", ...fixture.args, "--json"]);
    expect(failed).toMatchObject({
      data: {
        policyProfile: "strict-ci",
        ready: false,
        violations: [
          {
            canonical: fixture.canonical,
            status: "fail",
            version: "0.1.0"
          }
        ]
      },
      exitCode: 8,
      ok: false
    });
    expect(failed.data?.violations[0]?.findings).toEqual(
      expect.arrayContaining(["registry contains duplicate package records"])
    );
  });

  test("ci refuses implicit network access without explicit online mode", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-cli-ci-offline-"));

    await expect(execaNode(["src/cli.ts", "ci", "--dir", workspace, "--json"])).rejects.toThrow(/--online/);
  });
});

function cliTransparency(canonical: string, owner: string, digest: string) {
  const logIdentity = generateIdentity();
  const witnessIdentity = generateIdentity();
  const leaf = {
    artifactSha256: digest,
    eventHash: "e".repeat(64),
    package: canonical,
    publisher: owner,
    version: "0.1.0"
  };
  const log = createTransparencyLogFromLeaves([leaf], logIdentity, "2026-05-16T03:53:00.000Z");
  const witness = signWitnessStatement(log.treeHead, witnessIdentity);
  const entry = log.entries[0];
  if (!entry) {
    throw new Error("missing cli transparency entry");
  }
  return { entry, log, witness };
}

function cliRegistry(
  canonical: string,
  owner: string,
  digest: string,
  transparency: ReturnType<typeof cliTransparency>
): { packages: Array<{ proof?: unknown; [key: string]: unknown }>; [key: string]: unknown } {
  return {
    formatVersion: 1,
    generatedAt: "2026-05-16T03:32:00.000Z",
    packages: [
      {
        canonical,
        description: "Inspectable agent package",
        digest,
        name: canonical.split("/").at(-1),
        owner,
        permissions: {
          env: 0,
          exec: false,
          filesystem: 0,
          mcpTools: 0,
          network: 0,
          postinstall: false,
          secrets: 0
        },
        proof: {
          checkpointUrl: "/transparency/checkpoint.json",
          eventHash: transparency.entry.leaf.eventHash,
          leafHash: transparency.entry.leafHash,
          leafIndex: transparency.entry.leafIndex,
          leafUrl: `/transparency/leaves/${transparency.entry.leafHash}.json`,
          proofUrl: `/transparency/proofs/${transparency.entry.leafHash}.json`,
          rootHash: transparency.log.treeHead.rootHash,
          subject: `${canonical}@0.1.0`,
          treeSize: transparency.log.treeHead.treeSize,
          type: "dev.nipmod.registry.proof.v1",
          witnesses: [transparency.witness.witness],
          witnessUrls: [`/transparency/witnesses/${transparency.witness.witness}.json`]
        },
        publisher: owner,
        resolved: `https://node.nipmod.com/api/v1/repos/${owner.slice("did:key:".length)}/${canonical.split("/").at(-1)}/blob/releases/0.1.0/bundle.nipmod`,
        sourceCommit: "a".repeat(40),
        sourceTag: "v0.1.0",
        sourceRepo: `https://node.nipmod.com/${owner.slice("did:key:".length)}/${canonical.split("/").at(-1)}.git`,
        trust: {
          evidence: {
            artifactDigestVerified: true,
            bundleSignatureVerified: true,
            immutableSnapshotMatched: true,
            publisherMatchesCanonical: true,
            releaseEventSigned: true,
            sourceProvenanceVerified: true,
            transparencyLogIncluded: true,
            transparencyLogVerified: true
          },
          level: "verified",
          score: 100
        },
        type: "skill",
        version: "0.1.0"
      }
    ],
    skipped: [],
    source: "https://node.nipmod.com",
    transparencyLog: {
      ...transparency.log,
      witnesses: [transparency.witness]
    }
  };
}

function cliGraphRegistry(
  entries: Array<{
    canonical: string;
    dependencies?: Record<string, string>;
    digest: string;
    distTags?: Record<string, string>;
    owner: string;
    permissions?: Partial<{
      env: number;
      exec: boolean;
      filesystem: number;
      mcpTools: number;
      network: number;
      postinstall: boolean;
      secrets: number;
    }>;
	    resolved?: string;
	    sourceRepo?: string;
	    trustEvidenceOverrides?: Partial<Record<string, boolean>>;
	    version?: string;
	  }>
	) {
  const logIdentity = generateIdentity();
  const witnessIdentity = generateIdentity();
	  const leaves = entries.map((entry) => ({
	    artifactSha256: entry.digest,
	    eventHash: createHash("sha256").update(`${entry.canonical}@${entry.version ?? "0.1.0"}`).digest("hex"),
	    package: entry.canonical,
	    publisher: entry.owner,
	    version: entry.version ?? "0.1.0"
	  }));
  const log = createTransparencyLogFromLeaves(leaves, logIdentity, "2026-05-16T03:53:00.000Z");
  const witness = signWitnessStatement(log.treeHead, witnessIdentity);
	  const packages = entries.map((entry, index) => {
	    const proofEntry = log.entries[index];
    if (!proofEntry) {
      throw new Error("missing graph transparency entry");
    }
    const name = entry.canonical.split("/").at(-1);
    if (!name) {
      throw new Error("missing graph package name");
    }
	    const ownerSegment = entry.owner.slice("did:key:".length);
	    const version = entry.version ?? "0.1.0";
	    const evidence = {
      artifactDigestVerified: true,
      bundleSignatureVerified: true,
      immutableSnapshotMatched: true,
      publisherMatchesCanonical: true,
      releaseEventSigned: true,
      sourceProvenanceVerified: true,
      transparencyLogIncluded: true,
      transparencyLogVerified: true,
      ...entry.trustEvidenceOverrides
    };
    return {
      canonical: entry.canonical,
      ...(entry.dependencies ? { dependencies: entry.dependencies } : {}),
      description: "Inspectable agent package",
      digest: entry.digest,
      ...(entry.distTags ? { distTags: entry.distTags } : {}),
      name,
      owner: entry.owner,
      permissions: {
        env: 0,
        exec: false,
        filesystem: 0,
        mcpTools: 0,
        network: 0,
        postinstall: false,
        secrets: 0,
        ...entry.permissions
      },
      proof: {
	          checkpointUrl: "/transparency/checkpoint.json",
	          eventHash: proofEntry.leaf.eventHash,
        leafHash: proofEntry.leafHash,
        leafIndex: proofEntry.leafIndex,
        leafUrl: `/transparency/leaves/${proofEntry.leafHash}.json`,
        proofUrl: `/transparency/proofs/${proofEntry.leafHash}.json`,
        rootHash: log.treeHead.rootHash,
	          subject: `${entry.canonical}@${version}`,
        treeSize: log.treeHead.treeSize,
        type: "dev.nipmod.registry.proof.v1",
        witnesses: [witness.witness],
        witnessUrls: [`/transparency/witnesses/${witness.witness}.json`]
      },
      publisher: entry.owner,
	        resolved:
	          entry.resolved ??
	          `https://node.nipmod.com/api/v1/repos/${ownerSegment}/${name}/blob/releases/${version}/bundle.nipmod`,
	        sourceCommit: "a".repeat(40),
	        sourceTag: `v${version}`,
      sourceRepo: entry.sourceRepo ?? `https://node.nipmod.com/${ownerSegment}/${name}.git`,
      trust: {
        evidence,
        level: "verified",
        score: 100
      },
      type: "skill",
	      version
	    };
  });

  return {
    log,
    registry: {
      formatVersion: 1,
      generatedAt: "2026-05-16T03:32:00.000Z",
      packages,
      skipped: [],
      source: "https://node.nipmod.com",
      transparencyLog: {
        ...log,
        witnesses: [witness]
      }
    },
    witness
  };
}

function cliCompatibilityReceipt(canonical: string, owner: string, digest: string): Record<string, unknown> {
  const name = canonical.split("/").at(-1) ?? "package";
  return {
    exampleUrl: "https://nipmod.com/compatibility/examples/mcp-server.json",
    externalFormat: "mcp-server-json",
    externalInputSha256: "b".repeat(64),
    id: "receipt.mcp",
    label: "MCP import",
    package: canonical,
    packageDigest: digest,
    preservedFields: ["name", "command", "args"],
    provenanceLoss: [],
    receiptUrl: "https://nipmod.com/compatibility/receipts.json#receipt.mcp",
    sourceCommit: "a".repeat(40),
    sourceRepo: `https://node.nipmod.com/${owner.slice("did:key:".length)}/${name}.git`,
    sourceTag: "v0.1.0",
    type: "dev.nipmod.compatibility-receipt.v1",
    unsupportedFields: [],
    version: "0.1.0"
  };
}

function advisorySigningKey() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyDer = publicKey.export({ format: "der", type: "spki" });
  return {
    privateKey,
    publicKeySpkiBase64: publicKeyDer.toString("base64"),
    publicKeySpkiSha256: createHash("sha256").update(publicKeyDer).digest("hex")
  };
}

function signAdvisories(bytes: Buffer, signing: ReturnType<typeof advisorySigningKey>) {
  return {
    algorithm: "Ed25519",
    artifact: "advisories.json",
    publicKeySpkiSha256: signing.publicKeySpkiSha256,
    signatureBase64: sign(null, bytes, signing.privateKey).toString("base64"),
    type: "dev.nipmod.advisory.signature.v1"
  };
}

function quarantineFixture(canonical: string, version: string, digest: string) {
  return {
    active: true,
    advisoryId: "NIPMOD-2026-9001",
    artifactSha256: digest,
    package: canonical,
    publishedAt: "2026-05-16T10:54:00.000Z",
    reason: "Quarantine dry-run advisory",
    severity: "high",
    status: "active",
    type: "dev.nipmod.quarantine.v1",
    version
  };
}

function searchPackageFixture(
  owner: string,
  name: string,
  type: string,
  score: number,
  description = `${name} package`
) {
  return {
    canonical: `pkg:${owner}/${name}`,
    description,
    digest: "a".repeat(64),
    name,
    owner,
    permissions: {
      env: 0,
      exec: false,
      filesystem: 0,
      mcpTools: 0,
      network: 0,
      postinstall: false,
      secrets: 0
    },
    trust: { level: "verified", score },
    type,
    version: "0.1.0"
  };
}

function lockfilePackageFixture(owner: string, name: string, version: string, digest: string) {
  return {
    canonical: `pkg:${owner}/${name}`,
    files: ["nipmod.json"],
    integrity: `sha256-${digest}`,
    manifestDigest: digest,
    name,
    permissions: {
      env: [],
      exec: { allowed: false },
      filesystem: [],
      mcpTools: [],
      network: [],
      postinstall: { allowed: false },
      secrets: []
    },
    publisher: owner,
    resolved: `https://node.nipmod.com/api/v1/repos/${owner.slice("did:key:".length)}/${name}/blob/releases/${version}/bundle.nipmod`,
    version
  };
}

function emptyLockfileSnapshot() {
  return {
    dependencies: {},
    devDependencies: {},
    optionalDependencies: {},
    peerDependencies: {}
  };
}

function developerPolicyFixture() {
  return {
    formatVersion: 1,
    profile: "developer-default",
    rules: {
      blockUnknownPermissions: true,
      blockedPermissions: {
        exec: true,
        mcpTools: true,
        postinstall: true,
        secrets: true
      },
      minimumTrustScore: 100,
      requireVerified: true
    },
    type: "dev.nipmod.policy.v1"
  };
}

async function expectCliJsonFailure(args: string[]): Promise<{
  data?: {
    allowed?: boolean;
    message?: string;
    packages?: Array<{
      canonical?: string;
      decision?: { allowed: boolean; profile: string; reasons: string[] };
      findings?: string[];
      version?: string;
    }>;
    plan?: {
      readyToUpdate?: boolean;
      graph?: { packageCount: number };
      policyDecision?: { allowed: boolean; profile: string; reasons: string[] };
      readyToInstall?: boolean;
      skipped?: Array<{ name: string; reason: string }>;
      trustReport: { findings: string[] };
    };
    policyCheck?: {
      allowed: boolean;
      packages?: Array<{
        decision?: { allowed: boolean; profile: string; reasons: string[] };
      }>;
    };
    policyDecision?: { allowed: boolean; profile: string; reasons: string[] };
    policyProfile?: string;
    ready?: boolean;
    report?: {
      findings: string[];
      installCommand?: string;
      quarantine?: { active: boolean; advisoryId: string };
      readyToInstall: boolean;
      verdict: string;
    };
    summary?: { allow?: number; block?: number; fail?: number; ok?: number; total: number; warn?: number };
    violations?: Array<{ canonical: string; findings: string[]; status: string; version: string }>;
  };
  error?: { message: string };
  exitCode: number;
  ok: false;
}> {
  try {
    await execaNode(args);
  } catch (error) {
    const jsonLine = String(error instanceof Error ? error.message : error)
      .split("\n")
      .find((line) => line.startsWith("{") && line.endsWith("}"));
    if (!jsonLine) {
      throw error;
    }
    return JSON.parse(jsonLine) as {
      data?: {
        message?: string;
        policyProfile?: string;
        ready?: boolean;
        violations: Array<{ canonical: string; findings: string[]; status: string; version: string }>;
      };
      error?: { message: string };
      exitCode: number;
      ok: false;
    };
  }

  throw new Error("expected command to fail");
}

async function writeCliCiFixture(options: {
  advisorySeverity?: "low" | "moderate" | "high" | "critical";
  duplicateRegistryPackage?: boolean;
  packageName: string;
  prefix: string;
  registryDigest?: string;
}): Promise<{ args: string[]; canonical: string }> {
  const workspace = await mkdtemp(join(tmpdir(), options.prefix));
  const app = join(workspace, "app");
  const owner = generateIdentity().did;
  const canonical = `pkg:${owner}/${options.packageName}`;
  const lockDigest = "c".repeat(64);
  const registryDigest = options.registryDigest ?? lockDigest;
  const registryPath = join(workspace, "registry.json");
  const advisoriesPath = join(workspace, "advisories.json");
  const advisoriesSignaturePath = `${advisoriesPath}.sig`;
  const transparency = cliTransparency(canonical, owner, registryDigest);
  const advisorySigning = advisorySigningKey();
  const generatedAt = new Date(Date.now() - 1_000).toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000).toISOString();

  await mkdir(app, { recursive: true });
  await writeFile(
    join(app, "nipmod.lock.json"),
    `${JSON.stringify({
      formatVersion: 1,
      generatedBy: "test",
      packages: {
        [`${canonical}@0.1.0`]: {
          canonical,
          files: ["SKILL.md"],
          integrity: `sha256-${lockDigest}`,
          manifestDigest: "d".repeat(64),
          name: options.packageName,
          permissions: {
            env: [],
            exec: { allowed: false },
            filesystem: [],
            mcpTools: [],
            network: [],
            postinstall: { allowed: false },
            secrets: []
          },
          publisher: owner,
          resolved: `https://node.nipmod.com/api/v1/repos/${owner.slice("did:key:".length)}/${options.packageName}/blob/releases/0.1.0/bundle.nipmod`,
          version: "0.1.0"
        }
      }
    })}\n`
  );
  const registry = cliRegistry(canonical, owner, registryDigest, transparency);
  if (options.duplicateRegistryPackage) {
    registry.packages.push({
      ...registry.packages[0],
      digest: "b".repeat(64)
    });
  }
  await writeFile(registryPath, `${JSON.stringify(registry)}\n`);
  await writeFile(
    advisoriesPath,
    `${JSON.stringify({
      advisories: options.advisorySeverity
        ? [
            {
              id: "NIPMOD-2026-0001",
              package: canonical,
              severity: options.advisorySeverity,
              status: "active",
              title: "Test advisory",
              versions: ["0.1.0"]
            }
          ]
        : [],
      expiresAt,
      formatVersion: 1,
      generatedAt,
      type: "dev.nipmod.advisories.v1"
    })}\n`
  );
  await writeFile(advisoriesSignaturePath, `${JSON.stringify(signAdvisories(await readFile(advisoriesPath), advisorySigning))}\n`);

  return {
    args: [
      "--dir",
      app,
      "--registry",
      pathToFileURL(registryPath).href,
      "--advisories",
      pathToFileURL(advisoriesPath).href,
      "--advisories-signature",
      pathToFileURL(advisoriesSignaturePath).href,
      "--allow-custom-roots",
      "--advisory-key",
      advisorySigning.publicKeySpkiBase64,
      "--advisory-key-sha256",
      advisorySigning.publicKeySpkiSha256,
      "--log-id",
      transparency.log.treeHead.logId,
      "--witness",
      transparency.witness.witness
    ],
    canonical
  };
}

async function serveBundle(bytes: Buffer, canonical: string, version: string): Promise<{
  close: () => Promise<void>;
  resolved: string;
  sourceRepo: string;
}> {
  const owner = canonical.slice("pkg:did:key:".length, canonical.indexOf("/"));
  const name = canonical.split("/").at(-1);
  if (!name) {
    throw new Error("missing package name");
  }
  const bundlePath = `/api/v1/repos/${owner}/${name}/blob/releases/${version}/bundle.nipmod`;
  const server = createServer((request, response) => {
    if (request.url !== bundlePath) {
      response.writeHead(404);
      response.end("not found");
      return;
    }
    response.writeHead(200, {
      "content-length": String(bytes.byteLength),
      "content-type": "application/octet-stream"
    });
    response.end(bytes);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server did not bind to tcp");
  }
  const origin = `http://127.0.0.1:${address.port}`;
  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
    resolved: `${origin}${bundlePath}`,
    sourceRepo: `${origin}/${owner}/${name}.git`
  };
}
