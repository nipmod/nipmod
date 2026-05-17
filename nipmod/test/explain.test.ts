import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { generateIdentity } from "../src/identity.js";
import { execaNode } from "./helpers/process.js";

describe("nipmod explain", () => {
  test("explains why a transitive package is installed", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-explain-"));
    const appOwner = generateIdentity().did;
    const depOwner = generateIdentity().did;
    const appCanonical = `pkg:${appOwner}/workflow-runner`;
    const depCanonical = `pkg:${depOwner}/agent-logger`;
    const appKey = `${appCanonical}@0.1.0`;
    const depKey = `${depCanonical}@1.2.0`;
    await mkdir(workspace, { recursive: true });
    await writeFile(
      join(workspace, "nipmod.lock.json"),
      `${JSON.stringify({
        formatVersion: 2,
        generatedBy: "test",
        packages: {
          [appKey]: lockfilePackage(appOwner, "workflow-runner", appCanonical, "0.1.0", "a".repeat(64)),
          [depKey]: lockfilePackage(depOwner, "agent-logger", depCanonical, "1.2.0", "b".repeat(64))
        },
        root: {
          dependencies: {
            "workflow-runner": "latest"
          },
          devDependencies: {},
          optionalDependencies: {},
          peerDependencies: {}
        },
        snapshots: {
          [appKey]: {
            dependencies: {
              "agent-logger": depKey
            },
            devDependencies: {},
            optionalDependencies: {},
            peerDependencies: {}
          },
          [depKey]: emptySnapshot()
        }
      })}\n`
    );

    const json = await execaNode(["src/cli.ts", "explain", "agent-logger", "--dir", workspace, "--json"]);
    const parsed = JSON.parse(json.stdout) as {
      ok: true;
      data: {
        matches: Array<{
          dependents: Array<{ dependencyKind: string; dependencyName: string; name: string }>;
          name: string;
          paths: Array<{ nodes: Array<{ name: string }> }>;
          pathsTruncated: boolean;
          root: boolean;
        }>;
        summary: { packageCount: number };
        type: string;
      };
    };
    const human = await execaNode(["src/cli.ts", "explain", "agent-logger", "--dir", workspace]);
    const versioned = await execaNode(["src/cli.ts", "explain", "agent-logger@1.2.0", "--dir", workspace, "--json"]);
    const versionedParsed = JSON.parse(versioned.stdout) as { data: { summary: { packageCount: number } } };

    expect(parsed.data.type).toBe("dev.nipmod.explain.v1");
    expect(parsed.data.summary.packageCount).toBe(1);
    expect(versionedParsed.data.summary.packageCount).toBe(1);
    expect(parsed.data.matches[0]).toMatchObject({
      dependents: [
        {
          dependencyKind: "dependencies",
          dependencyName: "agent-logger",
          name: "workflow-runner"
        }
      ],
      name: "agent-logger",
      pathsTruncated: false,
      root: false
    });
    expect(parsed.data.matches[0]?.paths[0]?.nodes.map((node) => node.name)).toEqual(["workflow-runner", "agent-logger"]);
    expect(human.stdout).toContain("nipmod explain: 1 package");
    expect(human.stdout).toContain("agent-logger@1.2.0");
    expect(human.stdout).toContain("required by workflow-runner@0.1.0 via dependencies.agent-logger");
    expect(human.stdout).toContain("path: workflow-runner@0.1.0 > agent-logger@1.2.0");
  }, 15_000);

  test("reports an empty explanation for packages that are not installed", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-explain-empty-"));

    const result = await execaNode(["src/cli.ts", "explain", "missing-agent", "--dir", workspace, "--json"]);
    const parsed = JSON.parse(result.stdout) as { ok: true; data: { matches: unknown[]; summary: { packageCount: number } } };

    expect(parsed.data.matches).toEqual([]);
    expect(parsed.data.summary.packageCount).toBe(0);
  });

  test("accepts the package argument after boolean flags", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-explain-flags-"));

    const result = await execaNode(["src/cli.ts", "explain", "--json", "missing-agent", "--dir", workspace]);
    const parsed = JSON.parse(result.stdout) as { ok: true; data: { query: string } };

    expect(parsed.data.query).toBe("missing-agent");
  });

  test("does not mark every installed version as root", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-explain-versions-"));
    const owner = generateIdentity().did;
    const canonical = `pkg:${owner}/workflow-runner`;
    const rootKey = `${canonical}@0.1.0`;
    const newerKey = `${canonical}@0.2.0`;
    await writeFile(
      join(workspace, "nipmod.lock.json"),
      `${JSON.stringify({
        formatVersion: 2,
        generatedBy: "test",
        packages: {
          [rootKey]: lockfilePackage(owner, "workflow-runner", canonical, "0.1.0", "c".repeat(64)),
          [newerKey]: lockfilePackage(owner, "workflow-runner", canonical, "0.2.0", "d".repeat(64))
        },
        root: {
          dependencies: {
            "workflow-runner": "0.1.0"
          },
          devDependencies: {},
          optionalDependencies: {},
          peerDependencies: {}
        },
        snapshots: {
          [rootKey]: emptySnapshot(),
          [newerKey]: emptySnapshot()
        }
      })}\n`
    );

    const result = await execaNode(["src/cli.ts", "explain", "workflow-runner", "--dir", workspace, "--json"]);
    const parsed = JSON.parse(result.stdout) as {
      data: { matches: Array<{ packageKey: string; root: boolean; orphan: boolean }> };
    };

    expect(parsed.data.matches).toEqual([
      expect.objectContaining({ orphan: false, packageKey: rootKey, root: true }),
      expect.objectContaining({ orphan: true, packageKey: newerKey, root: false })
    ]);
  });

  test("caps explain paths for dense lockfiles", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-explain-cap-"));
    const depOwner = generateIdentity().did;
    const depCanonical = `pkg:${depOwner}/agent-logger`;
    const depKey = `${depCanonical}@1.0.0`;
    const rootPackages = Array.from({ length: 33 }, (_, index) => {
      const owner = generateIdentity().did;
      const name = `workflow-runner-${index}`;
      const canonical = `pkg:${owner}/${name}`;
      return {
        canonical,
        name,
        owner,
        packageKey: `${canonical}@0.1.0`
      };
    });
    await writeFile(
      join(workspace, "nipmod.lock.json"),
      `${JSON.stringify({
        formatVersion: 2,
        generatedBy: "test",
        packages: {
          [depKey]: lockfilePackage(depOwner, "agent-logger", depCanonical, "1.0.0", "e".repeat(64)),
          ...Object.fromEntries(
            rootPackages.map((pkg, index) => [
              pkg.packageKey,
              lockfilePackage(pkg.owner, pkg.name, pkg.canonical, "0.1.0", (index + 1).toString(16).padStart(64, "0"))
            ])
          )
        },
        root: {
          dependencies: Object.fromEntries(rootPackages.map((pkg) => [pkg.name, "latest"])),
          devDependencies: {},
          optionalDependencies: {},
          peerDependencies: {}
        },
        snapshots: {
          [depKey]: emptySnapshot(),
          ...Object.fromEntries(
            rootPackages.map((pkg) => [
              pkg.packageKey,
              {
                dependencies: {
                  "agent-logger": depKey
                },
                devDependencies: {},
                optionalDependencies: {},
                peerDependencies: {}
              }
            ])
          )
        }
      })}\n`
    );

    const result = await execaNode(["src/cli.ts", "explain", "agent-logger", "--dir", workspace, "--json"]);
    const parsed = JSON.parse(result.stdout) as { data: { matches: Array<{ paths: unknown[]; pathsTruncated: boolean }> } };

    expect(parsed.data.matches[0]?.paths).toHaveLength(32);
    expect(parsed.data.matches[0]?.pathsTruncated).toBe(true);
  }, 15_000);
});

function lockfilePackage(owner: string, name: string, canonical: string, version: string, digest: string) {
  return {
    canonical,
    files: ["README.md", "SKILL.md", "nipmod.json"],
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
    storePath: `.nipmod/store/sha256/${digest}/bundle.nipmod`,
    version
  };
}

function emptySnapshot() {
  return {
    dependencies: {},
    devDependencies: {},
    optionalDependencies: {},
    peerDependencies: {}
  };
}
