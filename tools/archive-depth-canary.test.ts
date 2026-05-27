import { describe, expect, test } from "vitest";
import { runArchiveDepthCanary } from "./archive-depth-canary.ts";

describe("archive depth canary", () => {
  test("verifies dry-run archive confirmations across source records", async () => {
    const calls: string[] = [];
    const result = await runArchiveDepthCanary({
      baseUrl: "https://nipmod.test",
      fetchFn: async (url, init) => {
        calls.push(`${init?.method ?? "GET"} ${url.toString()}`);
        if (url.toString().endsWith("/api/archive/status")) {
          return Response.json({
            configured: true,
            mode: "durable-archive-enabled",
            rateLimits: { driver: "supabase-rest" },
            type: "dev.nipmod.archive-status.v1",
            usage: { driver: "supabase-rest" },
            writeBoundary: "Durable package intelligence writes require the configured server-side archive store and an authorized server writer."
          });
        }
        const body = JSON.parse(String(init?.body ?? "{}"));
        return Response.json(archiveConfirmFixture(body.source ?? "npm", body.name ?? "react"));
      },
      requireDurable: true,
      targets: [
        { name: "react", requiredSource: "npm", source: "npm" },
        { name: "requests", requiredSource: "pypi", source: "pypi" }
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.summary).toEqual({ fail: 0, pass: 3, total: 3 });
    expect(calls).toContain("GET https://nipmod.test/api/archive/status");
    expect(calls.filter((call) => call === "POST https://nipmod.test/api/archive/confirm")).toHaveLength(2);
  });

  test("fails when durable archive mode is required but not active", async () => {
    const result = await runArchiveDepthCanary({
      baseUrl: "https://nipmod.test",
      fetchFn: async (url, init) => {
        if (url.toString().endsWith("/api/archive/status")) {
          return Response.json({
            configured: false,
            mode: "resolver-only-safe-mode",
            type: "dev.nipmod.archive-status.v1",
            writeBoundary: "Durable package intelligence writes require the configured server-side archive store and an authorized server writer."
          });
        }
        const body = JSON.parse(String(init?.body ?? "{}"));
        return Response.json(archiveConfirmFixture(body.source ?? "npm", body.name ?? "react"));
      },
      requireDurable: true,
      targets: [{ name: "react", requiredSource: "npm", source: "npm" }]
    });

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === "archive_status")).toMatchObject({
      status: "fail"
    });
  });

  test("fails when an archive record lacks install-plan boundaries", async () => {
    const result = await runArchiveDepthCanary({
      baseUrl: "https://nipmod.test",
      fetchFn: async (url, init) => {
        if (url.toString().endsWith("/api/archive/status")) {
          return Response.json({
            configured: true,
            mode: "durable-archive-enabled",
            type: "dev.nipmod.archive-status.v1",
            writeBoundary: "Durable package intelligence writes require the configured server-side archive store and an authorized server writer."
          });
        }
        const body = JSON.parse(String(init?.body ?? "{}"));
        const fixture = archiveConfirmFixture(body.source ?? "npm", body.name ?? "react");
        fixture.record.installPlan.plan.commandDetails[0].hostedApiExecutes = true;
        return Response.json(fixture);
      },
      targets: [{ name: "react", requiredSource: "npm", source: "npm" }]
    });

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === "npm:react")).toMatchObject({
      error: expect.stringContaining("hosted API must not execute install commands"),
      status: "fail"
    });
  });

  test("fails when archive source drift evidence is missing", async () => {
    const result = await runArchiveDepthCanary({
      baseUrl: "https://nipmod.test",
      fetchFn: async (url, init) => {
        if (url.toString().endsWith("/api/archive/status")) {
          return Response.json({
            configured: true,
            mode: "durable-archive-enabled",
            type: "dev.nipmod.archive-status.v1",
            writeBoundary: "Durable package intelligence writes require the configured server-side archive store and an authorized server writer."
          });
        }
        const body = JSON.parse(String(init?.body ?? "{}"));
        const fixture = archiveConfirmFixture(body.source ?? "npm", body.name ?? "react");
        delete fixture.record.evidence.sourceDrift;
        return Response.json(fixture);
      },
      targets: [{ name: "react", requiredSource: "npm", source: "npm" }]
    });

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === "npm:react")).toMatchObject({
      error: expect.stringContaining("archive source drift marker missing"),
      status: "fail"
    });
  });
});

function archiveConfirmFixture(source: string, name: string) {
  const digest = "a".repeat(64);
  const record = {
    archive: {
      confirmationCount: 1,
      firstSeenAt: "2026-05-23T00:00:00.000Z",
      firstSeenReason: "Confirmed package use through the Nipmod archive API.",
      persistence: "database",
      status: "agent_confirmed",
      updatedAt: "2026-05-23T00:00:00.000Z"
    },
    evidence: {
      archivePolicy: "agent-confirmed-source-owned-v1",
      generatedFrom: "server-reinspected-source",
      installPlanDigest: digest,
      sourceDrift: {
        baselineSourceRecordDigest: digest,
        changed: false,
        checkedAt: "2026-05-23T00:00:00.000Z",
        currentSourceRecordDigest: digest,
        status: "fresh",
        version: "source-drift-v1"
      },
      sourceRecordDigest: digest,
      sourceSnapshotDigest: digest,
      trustDigest: digest
    },
    formatVersion: 1,
    id: `pkgintel_${name.replace(/[^a-z0-9]/gi, "").slice(0, 12)}`,
    installPlan: {
      plan: {
        commandDetails: [
          {
            boundary: "manual-after-user-approval",
            command: `${source === "pypi" ? "pip install" : "npm install"} ${name}`,
            hostedApiExecutes: false,
            requiresApprovalBeforeWrite: true,
            risk: "low"
          }
        ]
      },
      safety: {
        metadataIsInstruction: false,
        requiresApprovalBeforeWrite: true
      }
    },
    name,
    ownership: {
      claimRequiredForVerified: true,
      originalOwner: "source-owner",
      originalUrl: `https://example.test/${source}/${name}`,
      retainedByOriginalSource: true
    },
    source,
    trust: {
      decision: "recommended",
      factors: [
        { category: "source", evidence: "Source metadata normalized.", impact: "positive", label: "Source resolver" },
        { category: "metadata", evidence: "License metadata present.", impact: "positive", label: "License present" },
        { category: "install", evidence: "Hosted API returns a plan only.", impact: "positive", label: "Install plan boundary" }
      ],
      policy: { thresholds: { recommended: 75, usableWithWarning: 50 }, version: "external-v2" },
      score: 91
    },
    type: "dev.nipmod.package-intelligence-record.v1"
  };

  return {
    dryRun: true,
    eligibility: { ok: true, type: "dev.nipmod.package-intelligence-eligibility.v1" },
    receipt: {
      dryRun: true,
      evidenceDigest: digest,
      recordId: record.id,
      stored: false,
      type: "dev.nipmod.package-intelligence-receipt.v1"
    },
    record,
    stored: false,
    type: "dev.nipmod.archive-confirm.v1",
    validation: { ok: true }
  };
}
