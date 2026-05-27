import { describe, expect, test } from "vitest";
import { createPackageIntelligenceRecord } from "../site/lib/package-intelligence";
import type { ExternalPackageRecord } from "../site/lib/external-packages";
import { runArchiveDriftReview } from "./archive-drift-review.ts";

describe("archive drift review", () => {
  test("reports fresh archive records without writing", async () => {
    const record = createPackageIntelligenceRecord(externalRecord);
    const result = await runArchiveDriftReview({
      apiKey: "test-key",
      baseUrl: "https://nipmod.test",
      fetchFn: archiveSearchFetch([record]),
      inspectFn: async () => externalRecord,
      limit: 10
    });

    expect(result.ok).toBe(true);
    expect(result.readOnly).toBe(true);
    expect(result.summary).toMatchObject({ changed: 0, failed: 0, fresh: 1, reviewed: 1 });
    expect(result.results[0]).toMatchObject({
      changed: false,
      name: "left-pad",
      source: "npm",
      status: "fresh",
      validationOk: true
    });
  });

  test("reports changed source digests without failing by default", async () => {
    const record = createPackageIntelligenceRecord(externalRecord);
    const changedRecord = {
      ...externalRecord,
      license: "MIT"
    };
    const result = await runArchiveDriftReview({
      apiKey: "test-key",
      baseUrl: "https://nipmod.test",
      fetchFn: archiveSearchFetch([record]),
      inspectFn: async () => changedRecord,
      limit: 10
    });

    expect(result.ok).toBe(true);
    expect(result.summary).toMatchObject({ changed: 1, failed: 0, fresh: 0, reviewed: 1 });
    expect(result.results[0]).toMatchObject({
      changed: true,
      status: "changed"
    });
  });

  test("can fail when changed records should gate a release", async () => {
    const record = createPackageIntelligenceRecord(externalRecord);
    const result = await runArchiveDriftReview({
      apiKey: "test-key",
      baseUrl: "https://nipmod.test",
      failOnChanged: true,
      fetchFn: archiveSearchFetch([record]),
      inspectFn: async () => ({ ...externalRecord, license: "MIT" }),
      limit: 10
    });

    expect(result.ok).toBe(false);
    expect(result.summary.changed).toBe(1);
  });

  test("sanitizes inspect failures", async () => {
    const record = createPackageIntelligenceRecord(externalRecord);
    const result = await runArchiveDriftReview({
      apiKey: "test-key",
      baseUrl: "https://nipmod.test",
      fetchFn: archiveSearchFetch([record]),
      inspectFn: async () => {
        throw new Error("upstream response included private payload that should not be copied");
      },
      limit: 10
    });

    expect(result.ok).toBe(true);
    expect(result.summary.failed).toBe(1);
    expect(result.results[0]).toMatchObject({
      error: {
        code: "archive_drift_review_error",
        status: 500
      },
      status: "failed"
    });
    expect(JSON.stringify(result)).not.toContain("private payload");
  });

  test("can fail when inspect failures should gate a release", async () => {
    const record = createPackageIntelligenceRecord(externalRecord);
    const result = await runArchiveDriftReview({
      apiKey: "test-key",
      baseUrl: "https://nipmod.test",
      failOnFailed: true,
      fetchFn: archiveSearchFetch([record]),
      inspectFn: async () => {
        throw new Error("transient upstream failure");
      },
      limit: 10
    });

    expect(result.ok).toBe(false);
    expect(result.summary.failed).toBe(1);
  });
});

function archiveSearchFetch(records: unknown[]): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    expect(url).toContain("/api/archive/search");
    return Response.json({
      configured: true,
      records,
      store: { configured: true },
      total: records.length,
      type: "dev.nipmod.package-intelligence-search.v1"
    });
  }) as typeof fetch;
}

const externalRecord: ExternalPackageRecord = {
  archive: {
    firstSeenReason: "Resolved by Nipmod external package index.",
    persistence: "ephemeral",
    status: "external_indexed"
  },
  description: "Tiny string padding package.",
  displayName: "left-pad",
  formatVersion: 1,
  id: "npm:left-pad",
  install: {
    command: "npm install left-pad",
    manager: "npm",
    notes: ["Install from the original npm registry."]
  },
  license: "WTFPL",
  metrics: { downloads: 1_000_000 },
  name: "left-pad",
  originalUrl: "https://www.npmjs.com/package/left-pad",
  owner: "azer",
  registryUrl: "https://registry.npmjs.org/left-pad",
  repo: "https://github.com/azer/left-pad",
  source: "npm",
  sourceKind: "package-registry",
  trust: {
    checkedAt: "2026-05-27T00:00:00.000Z",
    decision: "recommended",
    factors: [
      { category: "source", evidence: "Source metadata normalized.", impact: "positive", label: "Source resolver" },
      { category: "metadata", evidence: "License metadata present.", impact: "positive", label: "License present" },
      { category: "install", evidence: "Hosted API returns a plan only.", impact: "positive", label: "Install plan boundary" }
    ],
    policy: {
      summary: "External scores combine public source metadata and warnings.",
      thresholds: { recommended: 75, usableWithWarning: 50 },
      version: "external-v2"
    },
    risk: "low",
    score: 92,
    signals: ["Package resolves from npm."],
    warnings: []
  },
  type: "dev.nipmod.external-package.v1",
  updatedAt: "2026-05-27T00:00:00.000Z",
  version: "1.3.0"
};
