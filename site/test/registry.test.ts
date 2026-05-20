import { describe, expect, test } from "vitest";
import {
  assertImmutableDigests,
  deriveTrust,
  installCommand,
  compatibilityHighlights,
  homepagePackages,
  permissionHighlights,
  registryTrustSummary,
  registryStats,
  safeSourceRepoHref,
  searchPackages,
  type RegistryIndex,
  type RegistryPackage
} from "../lib/registry";
import registryData from "../app/registry-data.json";

const currentRegistry = registryData as RegistryIndex;

const baseEvidence = {
  artifactDigestVerified: true,
  bundleSignatureVerified: true,
  immutableSnapshotMatched: true,
  publisherMatchesCanonical: true,
  releaseEventSigned: false,
  sourceProvenanceVerified: false,
  transparencyLogIncluded: false,
  transparencyLogVerified: false
};

describe("registry data", () => {
  test("never marks unsigned release metadata as verified", () => {
    const trust = deriveTrust(baseEvidence, emptyPermissions());

    expect(trust.level).toBe("review");
    expect(trust.score).toBe(75);
    expect(trust.warnings).toContain("Release event missing or invalid");
  });

  test("marks complete signed evidence as signed until transparency log inclusion exists", () => {
    const trust = deriveTrust(
      { ...baseEvidence, releaseEventSigned: true, sourceProvenanceVerified: true },
      emptyPermissions()
    );

    expect(trust.level).toBe("signed");
    expect(trust.score).toBe(90);
    expect(trust.evidence.bundleSignatureVerified).toBe(true);
    expect(trust.evidence.releaseEventSigned).toBe(true);
    expect(trust.warnings).toContain("Witnessed checkpoint pending");
  });

  test("keeps static log inclusion under review until source provenance and a witnessed checkpoint exist", () => {
    const trust = deriveTrust(
      { ...baseEvidence, releaseEventSigned: true, transparencyLogIncluded: true, transparencyLogVerified: true },
      emptyPermissions()
    );
    const verified = deriveTrust(
      {
        ...baseEvidence,
        releaseEventSigned: true,
        sourceProvenanceVerified: true,
        transparencyLogIncluded: true,
        transparencyLogVerified: true
      },
      emptyPermissions()
    );

    expect(trust.level).toBe("review");
    expect(trust.warnings).toContain("Source tag missing or invalid");
    expect(verified.level).toBe("verified");
    expect(verified.score).toBe(100);
  });

  test("summarizes verified trust posture for the public trust page", () => {
    const pkg = packageFixture({
      name: "verified",
      releaseEventSigned: true,
      trust: deriveTrust(
        {
          ...baseEvidence,
          releaseEventSigned: true,
          sourceProvenanceVerified: true,
          transparencyLogIncluded: true,
          transparencyLogVerified: true
        },
        emptyPermissions()
      )
    });
    const summary = registryTrustSummary(
      indexFixture([pkg], {
        transparencyLog: {
          entries: [{ leafHash: "a".repeat(64), leafIndex: 0 }],
          formatVersion: 1,
          treeHead: {
            generatedAt: "2026-05-15T00:00:00.000Z",
            logId: "did:key:z6Mklog",
            rootHash: "b".repeat(64),
            treeSize: 1
          },
          witnesses: [
            {
              formatVersion: 1,
              signature: {
                algorithm: "Ed25519",
                keyId: "did:key:z6Mkwitness",
                signatureBase64: "signed"
              },
              treeHead: {
                formatVersion: 1,
                generatedAt: "2026-05-15T00:00:00.000Z",
                logId: "did:key:z6Mklog",
                rootHash: "b".repeat(64),
                treeSize: 1
              },
              type: "dev.nipmod.transparency.witness.v1",
              witness: "did:key:z6Mkwitness"
            }
          ]
        }
      })
    );

    expect(summary.ready).toBe(true);
    expect(summary.cards.map((card) => card.label)).toEqual(["Packages", "Quorum", "Witnesses", "Root hash", "Quarantine", "Yanked"]);
    expect(summary.checks.every((check) => check.ok)).toBe(true);
  });

  test("blocks public trust readiness when a high severity quarantine is active", () => {
    const pkg = packageFixture({
      name: "blocked-agent",
      releaseEventSigned: true,
      trust: deriveTrust(
        {
          ...baseEvidence,
          releaseEventSigned: true,
          sourceProvenanceVerified: true,
          transparencyLogIncluded: true,
          transparencyLogVerified: true
        },
        emptyPermissions()
      )
    });
    pkg.quarantine = quarantineFixture("blocked-agent");
    pkg.quarantine.package = pkg.canonical;
    pkg.quarantine.version = pkg.version;
    pkg.quarantine.artifactSha256 = pkg.digest;

    const summary = registryTrustSummary(
      indexFixture([pkg], {
        transparencyLog: {
          entries: [{ leafHash: "a".repeat(64), leafIndex: 0 }],
          formatVersion: 1,
          treeHead: {
            generatedAt: "2026-05-15T00:00:00.000Z",
            logId: "did:key:z6Mklog",
            rootHash: "b".repeat(64),
            treeSize: 1
          },
          witnesses: [
            {
              formatVersion: 1,
              signature: {
                algorithm: "Ed25519",
                keyId: "did:key:z6Mkwitness",
                signatureBase64: "signed"
              },
              treeHead: {
                formatVersion: 1,
                generatedAt: "2026-05-15T00:00:00.000Z",
                logId: "did:key:z6Mklog",
                rootHash: "b".repeat(64),
                treeSize: 1
              },
              type: "dev.nipmod.transparency.witness.v1",
              witness: "did:key:z6Mkwitness"
            }
          ]
        }
      })
    );

    expect(summary.ready).toBe(false);
    expect(summary.cards).toContainEqual({ label: "Quarantine", value: "1" });
    expect(summary.checks).toContainEqual({
      label: "No active quarantine",
      ok: false,
      text: "High risk advisories and yanked releases block public readiness."
    });
  });

  test("search filters direct package fields and sorts by trust score", () => {
    const low = packageFixture({ name: "beta", description: "policy helper", score: 20 });
    const high = packageFixture({ name: "alpha", description: "agent policy", score: 90 });

    expect(searchPackages([low, high], "policy").map((pkg) => pkg.name)).toEqual(["alpha", "beta"]);
    expect(searchPackages([low, high], "pkg:did:key").length).toBe(2);
  });

  test("search ranking boosts exact names and agent-native package types", () => {
    const exactWorkflow = packageFixture({
      name: "policy",
      description: "policy helper",
      score: 70,
      type: "workflow-pack"
    });
    const broadTool = packageFixture({
      name: "policy-sidecar",
      description: "policy helper",
      score: 70,
      type: "tool"
    });
    const unrelated = packageFixture({
      name: "zzz",
      description: "policy helper",
      score: 70,
      type: "adapter"
    });

    expect(searchPackages([broadTool, unrelated, exactWorkflow], "policy").map((pkg) => pkg.name)).toEqual([
      "policy",
      "policy-sidecar",
      "zzz"
    ]);
  });

  test("search hides active quarantined packages by default", () => {
    const safe = packageFixture({ name: "safe-agent" });
    const blocked = packageFixture({
      name: "blocked-agent",
      quarantine: quarantineFixture("blocked-agent")
    });

    expect(searchPackages([blocked, safe], "").map((pkg) => pkg.name)).toEqual(["safe-agent"]);
    expect(searchPackages([blocked, safe], "blocked")).toEqual([]);
    expect(searchPackages([blocked, safe], "blocked", { includeQuarantined: true }).map((pkg) => pkg.name)).toEqual([
      "blocked-agent"
    ]);
  });

  test("keeps probe artifacts out of the homepage package list", () => {
    const real = packageFixture({ name: "gitlawb-repo-reader" });
    const probe = packageFixture({ name: "source-bound-probe-123" });
    const blocked = packageFixture({ name: "blocked-agent", quarantine: quarantineFixture("blocked-agent") });

    expect(homepagePackages([probe, blocked, real]).map((pkg) => pkg.name)).toEqual(["gitlawb-repo-reader"]);
  });

  test("builds verified add commands", () => {
    const pkg = packageFixture({ name: "alpha" });

    expect(installCommand(pkg)).toBe("nipmod install alpha");
  });

  test("does not build normal add commands for quarantined packages", () => {
    const pkg = packageFixture({ name: "blocked-agent", quarantine: quarantineFixture("blocked-agent") });

    expect(installCommand(pkg)).toBe("Install blocked: NIPMOD-2026-9001: Quarantine dry-run advisory");
  });

  test("renders clone repo URLs as Gitlawb web source links", () => {
    expect(safeSourceRepoHref("https://node.nipmod.com/zalpha/alpha.git")).toBe("https://gitlawb.com/node/repos/zalpha/alpha");
    expect(safeSourceRepoHref("https://node.gitlawb.com/zalpha/alpha.git")).toBe("https://gitlawb.com/node/repos/zalpha/alpha");
    expect(safeSourceRepoHref("https://gitlawb.com/zalpha/alpha.git")).toBe("https://gitlawb.com/node/repos/zalpha/alpha");
    expect(safeSourceRepoHref("javascript:alert(1)")).toBeNull();
    expect(safeSourceRepoHref("https://example.test/zalpha/alpha.git")).toBeNull();
    expect(safeSourceRepoHref("https://node.nipmod.com/zalpha/alpha.git/info/refs")).toBeNull();
  });

  test("current package source links are browser safe Gitlawb URLs", () => {
    expect(currentRegistry.packages.map((pkg) => safeSourceRepoHref(pkg.sourceRepo))).toEqual(
      currentRegistry.packages.map((pkg) => `https://gitlawb.com/node/repos/${pkg.owner.split(":").at(-1)}/${pkg.repo}`)
    );
  });

  test("surfaces dangerous permission details instead of only counts", () => {
    const pkg = packageFixture({
      name: "networked",
      permissionDetails: {
        env: ["GITHUB_TOKEN"],
        filesystem: [],
        mcpTools: ["browser"],
        network: ["api.github.com"],
        secrets: []
      }
    });

    expect(permissionHighlights(pkg)).toEqual(["Network: api.github.com", "Env: GITHUB_TOKEN", "MCP: browser"]);
  });

  test("blocks version digest rewrites between index generations", () => {
    const previous = indexFixture([packageFixture({ name: "alpha", digest: "a".repeat(64) })]);
    const next = indexFixture([packageFixture({ name: "alpha", digest: "b".repeat(64) })]);

    expect(() => assertImmutableDigests(previous, next)).toThrow("immutable digest changed");
  });

  test("summarizes package, verified, and publisher counts", () => {
    const verified = packageFixture({
      name: "verified",
      releaseEventSigned: true,
      trust: deriveTrust(
        {
      ...baseEvidence,
      releaseEventSigned: true,
      sourceProvenanceVerified: true,
      transparencyLogIncluded: true,
      transparencyLogVerified: true
        },
        emptyPermissions()
      )
    });
    const unsigned = packageFixture({ name: "unsigned" });

    expect(registryStats(indexFixture([verified, unsigned]))).toEqual([
      { label: "Packages", value: "2" },
      { label: "Verified", value: "1" },
      { label: "Quorum", value: "0" },
      { label: "Publishers", value: "2" }
    ]);
  });

  test("formats compatibility receipt badges without hiding provenance loss", () => {
    const pkg = packageFixture({
      compatibilityReceipts: [
        compatibilityReceiptFixture({ externalFormat: "mcp-server-json", label: "MCP import" }),
        compatibilityReceiptFixture({ externalFormat: "git-source-provenance", label: "Git source" })
      ]
    });

    expect(compatibilityHighlights(pkg)).toEqual(["MCP import", "Git source"]);
  });
});

function emptyPermissions() {
  return {
    env: 0,
    exec: false,
    filesystem: 0,
    mcpTools: 0,
    network: 0,
    postinstall: false,
    secrets: 0
  };
}

function quarantineFixture(name: string): NonNullable<RegistryPackage["quarantine"]> {
  const canonical = `pkg:did:key:z${name.padEnd(48, "x")}/${name}`;
  return {
    active: true,
    advisoryId: "NIPMOD-2026-9001",
    artifactSha256: "a".repeat(64),
    package: canonical,
    publishedAt: "2026-05-16T10:54:00.000Z",
    reason: "Quarantine dry-run advisory",
    severity: "high",
    status: "active",
    type: "dev.nipmod.quarantine.v1",
    version: "0.1.0"
  };
}

function packageFixture(
  overrides: Partial<
    RegistryPackage & {
      score: number;
      releaseEventSigned: boolean;
    }
  > = {}
): RegistryPackage {
  const name = overrides.name ?? "alpha";
  const permissionDetails = overrides.permissionDetails ?? {
    env: [],
    filesystem: [],
    mcpTools: [],
    network: [],
    secrets: []
  };
  const permissions = {
    env: permissionDetails.env.length,
    exec: false,
    filesystem: permissionDetails.filesystem.length,
    mcpTools: permissionDetails.mcpTools.length,
    network: permissionDetails.network.length,
    postinstall: false,
    secrets: permissionDetails.secrets.length
  };
  const trust = deriveTrust(
    {
      ...baseEvidence,
      releaseEventSigned: overrides.releaseEventSigned ?? baseEvidence.releaseEventSigned,
      transparencyLogIncluded: overrides.proof ? true : baseEvidence.transparencyLogIncluded
    },
    permissions
  );

  return {
    artifactPath: "releases/0.1.0/bundle.nipmod",
    artifactSha256: overrides.digest ?? "a".repeat(64),
    canonical: `pkg:did:key:z${name.padEnd(48, "x")}/${name}`,
    cloneUrl: `https://node.nipmod.com/z${name}/${name}.git`,
    description: overrides.description ?? "agent package",
    digest: overrides.digest ?? "a".repeat(64),
    name,
    owner: `did:key:z${name.padEnd(48, "x")}`,
    permissionDetails,
    permissions,
    publisher: overrides.publisher ?? `did:key:z${name.padEnd(48, "x")}`,
    releasePath: "releases/0.1.0/release.json",
    repo: name,
    resolved: `https://node.nipmod.com/api/v1/repos/z${name}/${name}/blob/releases/0.1.0/bundle.nipmod`,
    sourceCommit: null,
    sourceRepo: `https://node.nipmod.com/z${name}/${name}.git`,
    sourceTag: null,
    stars: 0,
    trust: overrides.score === undefined ? trust : { ...trust, score: overrides.score },
    type: "skill",
    updatedAt: "2026-05-15T00:00:00.000Z",
    version: "0.1.0",
    ...overrides
  };
}

function compatibilityReceiptFixture(
  overrides: Partial<NonNullable<RegistryPackage["compatibilityReceipts"]>[number]> = {}
): NonNullable<RegistryPackage["compatibilityReceipts"]>[number] {
  return {
    exampleUrl: "https://nipmod.com/compatibility/examples/mcp-server.json",
    externalFormat: "mcp-server-json",
    externalInputSha256: "b".repeat(64),
    id: "receipt.mcp",
    label: "MCP import",
    package: "pkg:did:key:zalpha/alpha",
    packageDigest: "a".repeat(64),
    preservedFields: ["name"],
    provenanceLoss: [],
    receiptUrl: "https://nipmod.com/compatibility/receipts.json#receipt.mcp",
    sourceCommit: "c".repeat(40),
    sourceRepo: "https://node.nipmod.com/zalpha/alpha.git",
    sourceTag: "v0.1.0",
    type: "dev.nipmod.compatibility-receipt.v1",
    unsupportedFields: [],
    version: "0.1.0",
    ...overrides
  };
}

function indexFixture(packages: RegistryPackage[], overrides: Partial<RegistryIndex> = {}): RegistryIndex {
  return {
    formatVersion: 1,
    generatedAt: "2026-05-15T00:00:00.000Z",
    packages,
    skipped: [],
    source: "https://node.nipmod.com",
    ...overrides
  };
}
