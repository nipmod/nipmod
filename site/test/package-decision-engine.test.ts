import { describe, expect, test } from "vitest";
import { createExternalInstallPlan, type ExternalPackageRecord, type ExternalPackageSource } from "../lib/external-packages";
import { buildPackageDecision, formatPackageDecisionAnswer, planPackageDecisionQuery } from "../lib/package-decision-engine";

describe("package decision engine", () => {
  test("plans broad German web-design requests without losing source boundaries", () => {
    const plan = planPackageDecisionQuery("was sind gute standard pakete für websitedesign in react");

    expect(plan).toMatchObject({
      intent: "find-package",
      language: "de",
      type: "dev.nipmod.package-decision-query-plan.v1"
    });
    expect(plan.ecosystems).toContain("npm");
    expect(plan.searchQueries).toContain("website design react ui component library css tailwind icons animation");
    expect(plan.criteria.map((criterion) => criterion.id)).toEqual(
      expect.arrayContaining(["task-fit", "source-identity", "security", "install-boundary"])
    );
    expect(plan.clarification.needed).toBe(false);
  });

  test("does not treat generic backend server requests as MCP", () => {
    const plan = planPackageDecisionQuery("best package for a python api server");

    expect(plan.intent).toBe("find-package");
    expect(plan.ecosystems).toContain("pypi");
    expect(plan.ecosystems).not.toEqual(["mcp"]);
  });

  test("plans Base trading package requests around onchain SDKs", () => {
    const plan = planPackageDecisionQuery("find mir das betse package für base coins zu traden");

    expect(plan).toMatchObject({
      intent: "find-package",
      language: "de"
    });
    expect(plan.ecosystems).toEqual(["npm", "github", "mcp"]);
    expect(plan.constraints).toContain("onchain-transaction-sensitive");
    expect(plan.constraints).toContain("financial-action-sensitive");
    expect(plan.searchQueries).toContain("base onchain token trading swap sdk viem wagmi uniswap coinbase onchainkit");
  });

  test("plans stock trading and security searches without forcing every trading query into EVM", () => {
    const trading = planPackageDecisionQuery("best python package for stock trading backtesting");
    const security = planPackageDecisionQuery("security packages for node api auth and rate limit");

    expect(trading.ecosystems).toEqual(["pypi", "github", "npm"]);
    expect(trading.constraints).toContain("financial-action-sensitive");
    expect(trading.searchQueries).toContain("python trading backtesting exchange api quant finance ccxt vectorbt backtrader");
    expect(security.searchQueries).toEqual(
      expect.arrayContaining([
        "node api security auth jwt validation rate limiting helmet jose zod express-rate-limit",
        "python security auth validation dependency audit cryptography pyjwt bandit pip-audit"
      ])
    );
  });

  test("creates an agent-readable receipt with alternatives and avoid candidates", () => {
    const selected = packageRecord({
      description: "Utility-first CSS framework.",
      displayName: "tailwindcss",
      name: "tailwindcss",
      sourceDepthScore: 92
    });
    const alternative = packageRecord({
      description: "Icon package.",
      displayName: "lucide-react",
      name: "lucide-react",
      sourceDepthScore: 86
    });
    const avoid = packageRecord({
      decision: "avoid",
      displayName: "tailwindcss-next-free",
      name: "tailwindcss-next-free",
      risk: "high",
      score: 18,
      sourceDepthScore: 45,
      warnings: ["Possible typosquat or package confusion risk."]
    });
    const installPlan = createExternalInstallPlan(selected);

    const decision = buildPackageDecision({
      generatedAt: "2026-05-30T12:00:00.000Z",
      installPlan,
      originalQuery: "best package for website design in React",
      records: [selected, alternative, avoid],
      searchQuery: "website design react ui component library css tailwind icons animation",
      selected,
      sourceSummary: { empty: 0, failed: 0, ok: 1, requested: 1 }
    });

    expect(decision).toMatchObject({
      confidence: {
        label: "high"
      },
      receipt: {
        archiveConfirm: {
          confirmable: true,
          dryRunEndpoint: "POST /api/archive/confirm",
          required: false
        },
        hostedApiExecutes: false,
        installCommand: "npm install tailwindcss",
        requiresApprovalBeforeWrite: true,
        workspaceWrites: false
      },
      recommended: {
        decisionScore: expect.any(Number),
        gate: "pass",
        id: "npm:tailwindcss"
      },
      agentReadiness: {
        integrationSafe: true,
        mode: "pre-execution-package-decision",
        verdict: "ready",
        version: "agent-readiness-v1"
      },
      security: {
        posture: "clean-preflight"
      },
      type: "dev.nipmod.package-decision.v1"
    });
    expect(decision.comparison).toMatchObject({
      version: "package-decision-comparison-v2"
    });
    expect(decision.comparison.candidates.map((candidate) => candidate.id)).toEqual(
      expect.arrayContaining(["npm:tailwindcss", "npm:lucide-react", "npm:tailwindcss-next-free"])
    );
    expect(decision.archive).toMatchObject({
      confirmable: true,
      dryRunEndpoint: "POST /api/archive/confirm",
      required: false
    });
    expect(decision.agentReadiness.requiredHostActions.join(" ")).toContain("require local approval");
    expect(decision.alternatives.map((candidate) => candidate.id)).toEqual(["npm:lucide-react"]);
    expect(decision.avoid.map((candidate) => candidate.id)).toEqual(["npm:tailwindcss-next-free"]);
  });

  test("marks agent readiness as review when broad queries require clarification", () => {
    const selected = packageRecord({
      displayName: "ccxt",
      name: "ccxt",
      source: "pypi",
      sourceDepthScore: 90
    });
    const decision = buildPackageDecision({
      installPlan: createExternalInstallPlan(selected),
      originalQuery: "trading",
      records: [selected],
      searchQuery: "trading",
      selected,
      sourceSummary: { empty: 0, failed: 0, ok: 1, requested: 1 }
    });

    expect(decision.plan.clarification.needed).toBe(true);
    expect(decision.agentReadiness.verdict).toBe("review");
    expect(decision.agentReadiness.integrationSafe).toBe(false);
    expect(decision.agentReadiness.blockers).toContain("query too broad for a strong package decision");
    expect(decision.agentReadiness.requiredHostActions[0]).toContain("Which stack or use case");
  });

  test("formats German fallback answers from the structured decision", () => {
    const selected = packageRecord({
      displayName: "zod",
      name: "zod",
      sourceDepthScore: 90
    });
    const decision = buildPackageDecision({
      installPlan: createExternalInstallPlan(selected),
      originalQuery: "welches paket für schema validation",
      records: [selected],
      searchQuery: "schema validation",
      selected,
      sourceSummary: { empty: 0, failed: 0, ok: 1, requested: 1 }
    });

    const answer = formatPackageDecisionAnswer(decision);

    expect(answer).toContain("Ich würde zod");
    expect(answer).toContain("Hosted Nipmod bleibt read-only");
    expect(answer).toContain("npm install zod");
  });
});

function packageRecord(input: {
  decision?: ExternalPackageRecord["trust"]["decision"];
  description?: string;
  displayName: string;
  name: string;
  risk?: ExternalPackageRecord["trust"]["risk"];
  score?: number;
  source?: ExternalPackageSource;
  sourceDepthScore?: number;
  warnings?: string[];
}): ExternalPackageRecord {
  const source = input.source ?? "npm";
  const score = input.score ?? 92;
  const risk = input.risk ?? "low";
  const decision = input.decision ?? "recommended";
  const warnings = input.warnings ?? [];
  return {
    agentRecommendation: {
      action: decision === "avoid" ? "avoid" : "consider",
      installPlanRequired: true,
      nextSteps: ["Request an install plan before workspace writes."],
      summary: "Test recommendation.",
      version: "agent-recommendation-v1",
      workspaceWriteAllowed: false
    },
    archive: {
      firstSeenReason: "test fixture",
      persistence: "ephemeral",
      status: "external_indexed"
    },
    description: input.description ?? "Package fixture.",
    displayName: input.displayName,
    formatVersion: 1,
    id: `${source}:${input.name}`,
    install: {
      command: source === "npm" ? `npm install ${input.name}` : `python -m pip install ${input.name}`,
      manager: source === "npm" ? "npm" : "pip",
      notes: []
    },
    license: "MIT",
    metrics: {
      downloads: 100_000,
      stars: 1000
    },
    name: input.name,
    originalUrl: `https://example.com/${input.name}`,
    owner: "fixture",
    registryUrl: "https://registry.npmjs.org",
    repo: `https://github.com/example/${input.name}`,
    riskSignals: [],
    source,
    sourceEvidence: {
      checks: [
        {
          evidence: "Fixture identity returned.",
          id: "source.identity",
          label: "Source identity",
          status: "pass"
        }
      ],
      depthScore: input.sourceDepthScore ?? 82,
      generatedAt: "2026-05-30T12:00:00.000Z",
      limitations: [],
      version: "source-evidence-v1"
    },
    sourceKind: source === "github" ? "source-repo" : "package-registry",
    trust: {
      checkedAt: "2026-05-30T12:00:00.000Z",
      decision,
      dimensions: {
        popularitySignal: "high",
        provenanceStatus: "integrity",
        qualityScore: score,
        securityConfidence: risk === "low" ? "high" : "low"
      },
      factors: [],
      policy: {
        summary: "Fixture policy.",
        thresholds: {
          recommended: 75,
          usableWithWarning: 50
        },
        version: "external-v2"
      },
      risk,
      score,
      signals: ["fixture signal"],
      warnings
    },
    type: "dev.nipmod.external-package.v1",
    updatedAt: "2026-05-30T12:00:00.000Z",
    version: "1.0.0"
  };
}
