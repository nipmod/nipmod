import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { packProject } from "../src/bundle.js";
import { generateIdentity } from "../src/identity.js";
import { installPackageGraph } from "../src/install.js";
import { type Manifest } from "../src/protocol.js";
import { execaNode } from "./helpers/process.js";

describe("nipmod sbom", () => {
  test("prints a verified agent capability SBOM from the lockfile and local store", async () => {
    const dependency = await createSignedPackage({ name: "agent-logger", slug: "agent-logger", version: "1.2.0" });
    const app = await createSignedPackage({
      dependencies: { "agent-logger": "^1.0.0" },
      name: "workflow-runner",
      permissions: {
        mcpTools: ["github.search"],
        network: ["https://api.example.com"]
      },
      slug: "workflow-runner",
      version: "0.1.0"
    });
    const depBundle = await packProject(dependency.dir, {
      signingPrivateKeyPem: dependency.identity.privateKeyPem
    });
    const appBundle = await packProject(app.dir, {
      signingPrivateKeyPem: app.identity.privateKeyPem
    });
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-sbom-"));

    await installPackageGraph(
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
      workspace
    );

    const result = await execaNode(["src/cli.ts", "sbom", "--dir", workspace, "--json"]);
    const parsed = JSON.parse(result.stdout) as {
      ok: true;
      data: {
        packages: Array<{
          dependencies: {
            dependencies: Array<{ name: string; packageKey: string }>;
          };
          manifest: { exports: Record<string, Record<string, string>>; type: string } | null;
          name: string;
          permissions: { mcpTools: string[]; network: string[] };
        }>;
        summary: {
          dependencyEdges: number;
          packageCount: number;
          permissions: { mcpTools: number; network: number };
        };
        type: string;
      };
    };
    const human = await execaNode(["src/cli.ts", "sbom", "--dir", workspace]);

    expect(parsed.ok).toBe(true);
    expect(parsed.data.type).toBe("dev.nipmod.sbom.v1");
    expect(parsed.data.summary).toMatchObject({
      dependencyEdges: 1,
      packageCount: 2,
      permissions: {
        mcpTools: 1,
        network: 1
      }
    });
    expect(parsed.data.packages.find((pkg) => pkg.name === "workflow-runner")).toMatchObject({
      dependencies: {
        dependencies: [
          {
            name: "agent-logger"
          }
        ]
      },
      manifest: {
        exports: {
          ".": {
            skill: "./SKILL.md"
          }
        },
        type: "skill"
      },
      permissions: {
        mcpTools: ["github.search"],
        network: ["https://api.example.com"]
      }
    });
    expect(human.stdout).toContain("nipmod sbom: 2 packages");
    expect(human.stdout).toContain("workflow-runner@0.1.0");
    expect(human.stdout).toContain("dependencies: 1");
  }, 15_000);

  test("prints an empty SBOM for a workspace without a lockfile", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-sbom-empty-"));

    const result = await execaNode(["src/cli.ts", "sbom", "--dir", workspace, "--json"]);
    const parsed = JSON.parse(result.stdout) as {
      ok: true;
      data: { packages: unknown[]; summary: { packageCount: number } };
    };

    expect(parsed.data).toMatchObject({
      packages: [],
      summary: {
        packageCount: 0
      }
    });
  });
});

async function createSignedPackage(options: {
  dependencies?: Record<string, string>;
  name: string;
  permissions?: Partial<Manifest["permissions"]>;
  slug: string;
  version: string;
}) {
  const dir = await mkdtemp(join(tmpdir(), "nipmod-sbom-package-"));
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
      secrets: [],
      ...options.permissions
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
