import { describe, expect, test } from "vitest";
import {
  auditSummaryForPackage,
  newPackages,
  packageQuality,
  packageQualityStats,
  trendingPackages
} from "../lib/package-quality";
import type { RegistryPackage } from "../lib/registry";

describe("package quality", () => {
  test("scores installable verified packages from trust, permission and provenance signals", () => {
    const pkg = packageFixture();

    expect(packageQuality(pkg)).toEqual({
      checks: [
        { label: "Verified trust", ok: true },
        { label: "Quiet permissions", ok: true },
        { label: "Source linked", ok: true },
        { label: "No active advisory", ok: true },
        { label: "Agent typed", ok: true }
      ],
      label: "Excellent",
      score: 100
    });
  });

  test("penalizes packages with permissions and active advisories", () => {
    const pkg = packageFixture({
      name: "risky",
      permissions: { env: 1, exec: true, filesystem: 0, mcpTools: 0, network: 1, postinstall: false, secrets: 0 },
      quarantine: {
        active: true,
        advisoryId: "NPM-1",
        package: "pkg:did:key:z6Mkowner/risky",
        publishedAt: "2026-05-18T00:00:00.000Z",
        reason: "unsafe network behavior",
        severity: "high",
        status: "active",
        type: "dev.nipmod.quarantine.v1",
        version: "0.1.0"
      },
      trust: {
        ...baseTrust,
        level: "review",
        score: 55
      },
      type: "adapter"
    });

    expect(packageQuality(pkg)).toMatchObject({
      label: "Review",
      score: 50
    });
    expect(packageQuality(pkg).checks).toContainEqual({ label: "Quiet permissions", ok: false });
    expect(packageQuality(pkg).checks).toContainEqual({ label: "No active advisory", ok: false });
  });

  test("recognizes every first-class registry type as agent-native", () => {
    const packageTypes = ["adapter", "agent-profile", "eval-pack", "mcp-server", "policy-pack", "skill", "tool-bundle", "workflow-pack"];

    for (const type of packageTypes) {
      const quality = packageQuality(packageFixture({ type }));

      expect(quality.score).toBe(100);
      expect(quality.checks).toContainEqual({ label: "Agent typed", ok: true });
    }
  });

  test("ignores advisory records that do not match the package release", () => {
    const quality = packageQuality(
      packageFixture({
        quarantine: {
          active: true,
          advisoryId: "NPM-2",
          artifactSha256: "different-digest",
          package: "pkg:did:key:z6Mkowner/other",
          publishedAt: "2026-05-18T00:00:00.000Z",
          reason: "stale advisory",
          severity: "critical",
          status: "active",
          type: "dev.nipmod.quarantine.v1",
          version: "9.9.9"
        },
        yanked: {
          active: true,
          package: "pkg:did:key:z6Mkowner/other",
          publishedAt: "2026-05-18T00:00:00.000Z",
          reason: "wrong release",
          type: "dev.nipmod.yank.v1",
          version: "9.9.9"
        }
      })
    );

    expect(quality.score).toBe(100);
    expect(quality.checks).toContainEqual({ label: "No active advisory", ok: true });
  });

  test("returns catalog quality stats", () => {
    const packages = [
      packageFixture({ name: "one" }),
      packageFixture({
        name: "two",
        permissions: { env: 0, exec: true, filesystem: 0, mcpTools: 0, network: 1, postinstall: false, secrets: 0 },
        sourceCommit: null,
        sourceTag: null,
        trust: { ...baseTrust, evidence: { ...baseTrust.evidence, transparencyLogVerified: false }, level: "signed", score: 60 },
        type: "adapter"
      })
    ];

    expect(packageQualityStats(packages)).toEqual([
      { label: "Quality avg", value: "75" },
      { label: "Excellent", value: "1" },
      { label: "Needs review", value: "1" }
    ]);
  });

  test("orders trending and new package lists without mutating input", () => {
    const oldHighTrust = packageFixture({ name: "old-high", stars: 0, trust: { ...baseTrust, score: 100 }, updatedAt: "2026-05-16T00:00:00.000Z" });
    const newLowTrust = packageFixture({ name: "new-low", stars: 0, trust: { ...baseTrust, score: 50 }, updatedAt: "2026-05-18T00:00:00.000Z" });
    const starred = packageFixture({ name: "starred", stars: 4, trust: { ...baseTrust, score: 80 }, updatedAt: "2026-05-17T00:00:00.000Z" });
    const packages = [oldHighTrust, newLowTrust, starred];

    expect(trendingPackages(packages, 2).map((pkg) => pkg.name)).toEqual(["starred", "old-high"]);
    expect(newPackages(packages, 2).map((pkg) => pkg.name)).toEqual(["new-low", "starred"]);
    expect(packages.map((pkg) => pkg.name)).toEqual(["old-high", "new-low", "starred"]);
  });

  test("builds an audit summary for package pages", () => {
    const summary = auditSummaryForPackage(packageFixture());

    expect(summary.status).toBe("Ready");
    expect(summary.command).toBe(
      "nipmod inspect pkg:did:key:z6Mkowner/ready@0.1.0 --json\nnipmod install --plan pkg:did:key:z6Mkowner/ready@0.1.0 --json"
    );
    expect(summary.items).toContainEqual({ label: "Trust", value: "verified/100" });
    expect(summary.items).toContainEqual({ label: "Quality", value: "100/100" });
  });
});

const baseTrust: RegistryPackage["trust"] = {
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
  score: 100,
  signals: [],
  warnings: []
};

function packageFixture(overrides: Partial<RegistryPackage> = {}): RegistryPackage {
  const name = overrides.name ?? "ready";
  const canonical = overrides.canonical ?? `pkg:did:key:z6Mkowner/${name}`;
  return {
    artifactPath: `/registry/packages/${name}/0.1.0.json`,
    artifactSha256: "abc",
    canonical,
    cloneUrl: `https://node.nipmod.com/z6Mkowner/${name}.git`,
    description: "Ready package",
    digest: "abc",
    name,
    owner: "z6Mkowner",
    permissionDetails: { env: [], filesystem: [], mcpTools: [], network: [], secrets: [] },
    permissions: { env: 0, exec: false, filesystem: 0, mcpTools: 0, network: 0, postinstall: false, secrets: 0 },
    publisher: "did:key:z6Mkowner",
    releasePath: `releases/${name}`,
    repo: name,
    resolved: `https://node.nipmod.com/api/v1/repos/z6Mkowner/${name}/blob/releases/0.1.0/bundle.nipmod`,
    sourceCommit: "abc123",
    sourceRepo: `https://node.nipmod.com/z6Mkowner/${name}.git`,
    sourceTag: "v0.1.0",
    stars: 0,
    trust: baseTrust,
    type: "tool-bundle",
    updatedAt: "2026-05-18T00:00:00.000Z",
    version: "0.1.0",
    ...overrides
  };
}
