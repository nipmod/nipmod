import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execaNode } from "./helpers/process.js";
import { describe, expect, test } from "vitest";
import { generateIdentity } from "../src/identity.js";
import { inspectRegistryPackage } from "../src/trust-report.js";
import { createTransparencyLogFromLeaves, signWitnessStatement } from "../src/transparency.js";

describe("nipmod CLI", () => {
  test("prints stable help with exit codes for humans and agents", async () => {
    const text = await execaNode(["src/cli.ts", "help"]);
    expect(text.stdout).toContain("usage: nipmod <command>");
    expect(text.stdout).toContain("exit codes:");
    expect(text.stdout).toContain("0 ok");
    expect(text.stdout).toContain("7 trust or advisory block");

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
      expect.arrayContaining(["inspect", "add", "ci", "publish", "package", "manifest", "mcp"])
    );
    expect(parsed.data.exitCodes).toEqual(
      expect.arrayContaining([
        { code: 0, meaning: "ok" },
        { code: 7, meaning: "trust or advisory block" },
        { code: 12, meaning: "preflight not ready" }
      ])
    );
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

    expect(result.stdout).toContain("verified checksum");
    expect(result.stdout).not.toContain("curl -fsSL");
    expect(result.stdout).not.toContain("| sh");
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
        packages: Array<{ install: string; name: string; trust: string }>;
      };
    };

    expect(parsed.data.query).toBe("alpha");
    expect(parsed.data.total).toBe(1);
    expect(parsed.data.packages[0]).toMatchObject({
      install: `nipmod add pkg:${owner}/alpha-agent@0.1.0 --online`,
      name: "alpha-agent",
      trust: "verified/100"
    });

    const text = await execaNode(["src/cli.ts", "search", "alpha", "--registry", pathToFileURL(registryPath).href]);
    expect(text.stdout).toContain("alpha-agent 0.1.0 verified/100");
    expect(text.stdout).toContain("no permissions");
    expect(text.stdout).toContain(`nipmod add pkg:${owner}/alpha-agent@0.1.0 --online`);
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
    expect(text.stdout).not.toContain("install: nipmod add");
  });

  test("search refuses implicit network access without online mode", async () => {
    await expect(execaNode(["src/cli.ts", "search", "agent"])).rejects.toThrow(/--online/);
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
      installCommand: `nipmod add ${canonical}@0.1.0 --online`,
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

    expect(report.verdict).toBe("verified");
    expect(report.compatibilityReceipts).toBeUndefined();
    expect(report.findings).not.toContain("compatibility receipt does not match package evidence");
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
      policyDecision?: { allowed: boolean; profile: string; reasons: string[] };
      readyToInstall: boolean;
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
