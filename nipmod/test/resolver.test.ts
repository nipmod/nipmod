import { describe, expect, test } from "vitest";
import {
  dependencyEntriesFromManifest,
  resolveDependencyClosure,
  resolveDependencyGraph,
  versionSatisfies
} from "../src/resolver.js";
import { type Manifest } from "../src/protocol.js";

const baseManifest: Manifest = {
  formatVersion: 2,
  name: "agent-suite",
  canonical: "pkg:did:key:z6Mkowner/agent-suite",
  version: "0.1.0",
  type: "workflow-pack",
  exports: {
    ".": {
      workflow: "./README.md"
    }
  },
  files: ["README.md", "nipmod.json"],
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
    signingKey: "did:key:z6Mkowner"
  }
};

describe("agent dependency resolver", () => {
  test("checks exact, caret, tilde, wildcard and tag ranges", () => {
    expect(versionSatisfies("1.2.3", "1.2.3")).toBe(true);
    expect(versionSatisfies("1.4.0", "^1.2.3")).toBe(true);
    expect(versionSatisfies("2.0.0", "^1.2.3")).toBe(false);
    expect(versionSatisfies("1.2.9", "~1.2.3")).toBe(true);
    expect(versionSatisfies("1.3.0", "~1.2.3")).toBe(false);
    expect(versionSatisfies("9.9.9", "*")).toBe(true);
    expect(versionSatisfies("0.1.0", "latest", { latest: "0.1.0" })).toBe(true);
  });

  test("extracts dependency entries from every supported manifest dependency map", () => {
    const entries = dependencyEntriesFromManifest({
      ...baseManifest,
      dependencies: { "gitlawb-repo-reader": "^0.1.0" },
      devDependencies: { "malicious-skill-fixtures": "~0.1.0" },
      optionalDependencies: { "package-safety-eval-pack": "stable" },
      peerDependencies: { "readonly-registry-mcp-server": "latest" },
      peerDependenciesMeta: {
        "readonly-registry-mcp-server": {
          optional: true
        }
      }
    });

    expect(entries.map((entry) => `${entry.kind}:${entry.name}@${entry.spec}`)).toEqual([
      "dependencies:gitlawb-repo-reader@^0.1.0",
      "devDependencies:malicious-skill-fixtures@~0.1.0",
      "optionalDependencies:package-safety-eval-pack@stable",
      "peerDependencies:readonly-registry-mcp-server@latest"
    ]);
    expect(entries.filter((entry) => entry.optional).map((entry) => entry.name)).toEqual([
      "package-safety-eval-pack",
      "readonly-registry-mcp-server"
    ]);
  });

  test("resolves highest compatible verified package and dist tags", () => {
    const result = resolveDependencyGraph({
      requests: [
        { kind: "dependencies", name: "gitlawb-repo-reader", spec: "^1.0.0" },
        { kind: "dependencies", name: "policy", spec: "stable" }
      ],
      packages: [
        registryPackage("pkg:did:key:z6Mka/gitlawb-repo-reader", "gitlawb-repo-reader", "1.0.0"),
        registryPackage("pkg:did:key:z6Mka/gitlawb-repo-reader", "gitlawb-repo-reader", "1.2.0"),
        registryPackage("pkg:did:key:z6Mka/gitlawb-repo-reader", "gitlawb-repo-reader", "2.0.0"),
        registryPackage("pkg:did:key:z6Mkb/policy", "policy", "0.1.0", { stable: "0.1.0" })
      ]
    });

    expect(result.unresolved).toEqual([]);
    expect(result.resolved.map((entry) => `${entry.name}@${entry.version}`)).toEqual([
      "gitlawb-repo-reader@1.2.0",
      "policy@0.1.0"
    ]);
  });

  test("fails closed on ambiguous package names", () => {
    const result = resolveDependencyGraph({
      requests: [{ kind: "dependencies", name: "shared-name", spec: "0.1.0" }],
      packages: [
        registryPackage("pkg:did:key:z6Mka/shared-name", "shared-name", "0.1.0"),
        registryPackage("pkg:did:key:z6Mkb/shared-name", "shared-name", "0.1.0")
      ]
    });

    expect(result.resolved).toEqual([]);
    expect(result.unresolved[0]?.reason).toMatch(/ambiguous/i);
  });

  test("resolves transitive dependency closure deterministically", () => {
    const result = resolveDependencyClosure({
      requests: [{ kind: "dependencies", name: "workflow-runner", spec: "latest" }],
      packages: [
        registryPackage("pkg:did:key:z6Mka/workflow-runner", "workflow-runner", "0.1.0", { latest: "0.1.0" }, {
          "agent-logger": "^1.0.0"
        }),
        registryPackage("pkg:did:key:z6Mkb/agent-logger", "agent-logger", "1.2.0", {}, {
          dependencies: {
            "safe-format": "~0.3.0"
          },
          devDependencies: {
            "fixture-only": "0.1.0"
          }
        }),
        registryPackage("pkg:did:key:z6Mkc/safe-format", "safe-format", "0.3.7"),
        registryPackage("pkg:did:key:z6Mkd/fixture-only", "fixture-only", "0.1.0")
      ]
    });

    expect(result.unresolved).toEqual([]);
    expect(result.resolved.map((entry) => `${entry.name}@${entry.version}`)).toEqual([
      "workflow-runner@0.1.0",
      "agent-logger@1.2.0",
      "safe-format@0.3.7"
    ]);
  });
});

function registryPackage(
  canonical: string,
  name: string,
  version: string,
  distTags: Record<string, string> = {},
  dependencyOptions: Record<string, string> | {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  } = {}
) {
  const dependencies = "dependencies" in dependencyOptions || "devDependencies" in dependencyOptions
    ? dependencyOptions.dependencies ?? {}
    : dependencyOptions;
  const devDependencies = "dependencies" in dependencyOptions || "devDependencies" in dependencyOptions
    ? dependencyOptions.devDependencies ?? {}
    : {};
  return {
    canonical,
    dependencies,
    devDependencies,
    digest: "a".repeat(64),
    distTags,
    name,
    trustScore: 100,
    version
  };
}
