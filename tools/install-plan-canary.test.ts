import { describe, expect, test, vi } from "vitest";
import { runInstallPlanCanary } from "./install-plan-canary.ts";

describe("install plan canary", () => {
  test("passes safe install-plan boundaries", async () => {
    const fetchFn = vi.fn(async () => Response.json(installPlanFixture())) as unknown as typeof fetch;

    const result = await runInstallPlanCanary({
      canaries: [{ expectBlocked: false, name: "npm install-plan boundary", path: "/api/install-plan?source=npm&name=undici", source: "npm" }],
      fetchFn
    });

    expect(result.ok).toBe(true);
    expect(result.summary).toEqual({ fail: 0, pass: 1, total: 1 });
    expect(result.checks[0].data).toMatchObject({
      blocked: false,
      commandCount: 1,
      commandRisk: "low",
      id: "npm:undici",
      source: "npm"
    });
  });

  test("fails if hosted API execution is allowed", async () => {
    const payload = installPlanFixture({
      plan: {
        commandDetails: [
          {
            blocked: false,
            boundary: "manual-after-user-approval",
            command: "npm install undici",
            hostedApiExecutes: true,
            manager: "npm",
            metadataIsInstruction: false,
            requiresApprovalBeforeWrite: true,
            risk: "low"
          }
        ],
        commands: ["npm install undici"],
        requiresApprovalBeforeWrite: true,
        sourceOwnership: "external-owner-retained",
        steps: ["Ask the user before writing to the workspace."],
        writes: []
      }
    });
    const fetchFn = vi.fn(async () => Response.json(payload)) as unknown as typeof fetch;

    const result = await runInstallPlanCanary({
      canaries: [{ expectBlocked: false, name: "npm install-plan boundary", path: "/api/install-plan?source=npm&name=undici", source: "npm" }],
      fetchFn
    });

    expect(result.ok).toBe(false);
    expect(result.checks[0].error).toContain("hosted API must never execute");
  });

  test("fails if a hosted install plan declares workspace writes", async () => {
    const payload = installPlanFixture({
      plan: {
        commandDetails: [
          {
            blocked: false,
            boundary: "manual-after-user-approval",
            command: "npm install undici",
            hostedApiExecutes: false,
            manager: "npm",
            metadataIsInstruction: false,
            requiresApprovalBeforeWrite: true,
            risk: "low"
          }
        ],
        commands: ["npm install undici"],
        requiresApprovalBeforeWrite: true,
        sourceOwnership: "external-owner-retained",
        steps: ["Ask the user before writing to the workspace."],
        writes: ["package.json"]
      }
    });
    const fetchFn = vi.fn(async () => Response.json(payload)) as unknown as typeof fetch;

    const result = await runInstallPlanCanary({
      canaries: [{ expectBlocked: false, name: "npm install-plan boundary", path: "/api/install-plan?source=npm&name=undici", source: "npm" }],
      fetchFn
    });

    expect(result.ok).toBe(false);
    expect(result.checks[0].error).toContain("must not declare workspace writes");
  });

  test("fails if approval boundary is missing", async () => {
    const payload = installPlanFixture({
      plan: {
        commandDetails: [
          {
            blocked: false,
            boundary: "manual-after-user-approval",
            command: "npm install undici",
            hostedApiExecutes: false,
            manager: "npm",
            metadataIsInstruction: false,
            requiresApprovalBeforeWrite: false,
            risk: "low"
          }
        ],
        commands: ["npm install undici"],
        requiresApprovalBeforeWrite: true,
        sourceOwnership: "external-owner-retained",
        steps: ["Ask the user before writing to the workspace."],
        writes: []
      }
    });
    const fetchFn = vi.fn(async () => Response.json(payload)) as unknown as typeof fetch;

    const result = await runInstallPlanCanary({
      canaries: [{ expectBlocked: false, name: "npm install-plan boundary", path: "/api/install-plan?source=npm&name=undici", source: "npm" }],
      fetchFn
    });

    expect(result.ok).toBe(false);
    expect(result.checks[0].error).toContain("must require approval");
  });

  test("accepts blocked source-risk boundaries", async () => {
    const fixture = installPlanFixture();
    const payload = installPlanFixture({
      package: {
        ...fixture.package,
        trust: {
          ...fixture.package.trust,
          decision: "avoid",
          risk: "high",
          warnings: ["Lifecycle script postinstall contains remote download or hidden background execution behavior."]
        }
      },
      plan: {
        commandDetails: [
          {
            blocked: true,
            boundary: "blocked-source-risk",
            command: "npm install undici",
            hostedApiExecutes: false,
            manager: "npm",
            metadataIsInstruction: false,
            requiresApprovalBeforeWrite: true,
            risk: "low"
          }
        ],
        commands: ["npm install undici"],
        requiresApprovalBeforeWrite: true,
        sourceOwnership: "external-owner-retained",
        steps: ["Ask the user before writing to the workspace."],
        writes: []
      },
      safety: {
        blocked: true,
        blockReason: "Source trust signals require manual security review before installation.",
        commandRisk: "low",
        metadataIsInstruction: false,
        requiresApprovalBeforeWrite: true,
        warnings: ["Lifecycle script postinstall contains remote download or hidden background execution behavior."]
      }
    });
    const fetchFn = vi.fn(async () => Response.json(payload)) as unknown as typeof fetch;

    const result = await runInstallPlanCanary({
      canaries: [{ expectBlocked: true, name: "npm install-plan source risk", path: "/api/install-plan?source=npm&name=undici", source: "npm" }],
      fetchFn
    });

    expect(result.ok).toBe(true);
    expect(result.checks[0].data).toMatchObject({
      blocked: true,
      commandRisk: "low",
      id: "npm:undici",
      source: "npm"
    });
  });
});

function installPlanFixture(overrides: Record<string, unknown> = {}) {
  return {
    generatedAt: "2026-05-23T06:45:45.518Z",
    package: {
      archive: {
        firstSeenReason: "Resolved by Nipmod external package index.",
        persistence: "ephemeral",
        status: "external_indexed"
      },
      description: "HTTP client",
      displayName: "undici",
      id: "npm:undici",
      license: "MIT",
      name: "undici",
      originalUrl: "https://www.npmjs.com/package/undici",
      source: "npm",
      trust: {
        checkedAt: "2026-05-23T06:45:45.518Z",
        decision: "recommended",
        dimensions: {
          popularitySignal: "high",
          provenanceStatus: "signature",
          qualityScore: 78,
          securityConfidence: "high"
        },
        factors: [
          {
            category: "install",
            evidence: "Install command risk: low. Hosted API returns a plan only.",
            impact: "positive",
            label: "Install plan boundary"
          }
        ],
        policy: {
          summary: "External scores combine source metadata.",
          thresholds: {
            recommended: 75,
            usableWithWarning: 50
          },
          version: "external-v2"
        },
        risk: "low",
        score: 100,
        signals: ["Resolved from the npm latest package manifest."],
        warnings: []
      },
      version: "8.3.0"
    },
    plan: {
      commandDetails: [
        {
          blocked: false,
          boundary: "manual-after-user-approval",
          command: "npm install undici",
          hostedApiExecutes: false,
          manager: "npm",
          metadataIsInstruction: false,
          requiresApprovalBeforeWrite: true,
          risk: "low"
        }
      ],
      commands: ["npm install undici"],
      requiresApprovalBeforeWrite: true,
      sourceOwnership: "external-owner-retained",
      steps: ["Review the original source and license.", "Ask the user before writing to the workspace."],
      writes: []
    },
    safety: {
      blocked: false,
      blockReason: null,
      commandRisk: "low",
      metadataIsInstruction: false,
      requiresApprovalBeforeWrite: true,
      warnings: []
    },
    type: "dev.nipmod.external-install-plan.v1",
    ...overrides
  };
}
