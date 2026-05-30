import { describe, expect, test } from "vitest";
import { GET as getAgentDemoFlow } from "../app/agent-demo-flow.json/route";
import { GET as getBenchmark } from "../app/benchmark.json/route";
import { GET as getIntegrationKit } from "../app/integration-kit.json/route";
import { GET as getPartnerPack } from "../app/partner-pack.json/route";
import { GET as getSourceQuality } from "../app/source-quality.json/route";
import { agentDemoFlow } from "../lib/agent-demo-flow";
import { competitiveBenchmarkReport } from "../lib/competitive-benchmark-public";
import { integrationKit } from "../lib/integration-kit";
import { partnerIntegrationPack } from "../lib/partner-integration-pack";
import { publicSourceQualityReport, sourceQualityBenchmark } from "../lib/source-quality-public";

describe("public agent proof kit", () => {
  test("publishes a generic preflight demo without hosted writes", () => {
    expect(agentDemoFlow).toMatchObject({
      status: "public_agent_demo",
      type: "dev.nipmod.agent-demo-flow.v1"
    });
    expect(agentDemoFlow.steps).toHaveLength(7);
    expect(agentDemoFlow.steps.filter((step) => step.id !== "approval").every((step) => step.writesWorkspace === false)).toBe(true);
    expect(agentDemoFlow.passCriteria).toContain("hosted API does not install, clone, execute or write");
    expect(agentDemoFlow.passCriteria).toContain("decision receipt is available before execution");
    expect(agentDemoFlow.passCriteria).toContain("local approval is required before workspace changes");
    expect(agentDemoFlow.privacy).toContain("does not ask for prompts, workspace paths, secrets or private package names");
  });

  test("defines a generic integration contract without claiming partner approval", () => {
    expect(integrationKit).toMatchObject({
      status: "generic_public_kit",
      type: "dev.nipmod.integration-kit.v1"
    });
    expect(integrationKit.integrationContract.issueBetaKey).toBe("POST https://nipmod.com/api/keys/beta");
    expect(integrationKit.integrationContract.search).toContain("x-nipmod-api-key");
    expect(integrationKit.integrationContract.optionalArchiveDryRun).toContain("/api/archive/confirm");
    expect(integrationKit.decisionObject.fields).toEqual(expect.arrayContaining(["comparison.candidates", "security.signals", "receipt", "archive"]));
    expect(integrationKit.nonGoals).toContain("hosted workspace writes");
    expect(integrationKit.nonGoals).toContain("official partnership claim without the partner's approval");
    expect(integrationKit.expectedHandoff).toContain("user or host approves local execution outside the hosted API");
    expect(integrationKit.links.partnerPack).toBe("https://nipmod.com/partner-pack.json");
  });

  test("publishes a partner integration pack with key-gated core calls", () => {
    expect(partnerIntegrationPack).toMatchObject({
      status: "public_partner_pack",
      type: "dev.nipmod.partner-integration-pack.v1"
    });
    expect(partnerIntegrationPack.access.coreApi).toBe("key_required");
    expect(partnerIntegrationPack.access.betaKeyIssue.endpoint).toBe("POST https://nipmod.com/api/keys/beta");
    expect(partnerIntegrationPack.endpoints.map((endpoint) => endpoint.path)).toEqual(expect.arrayContaining([
      "/api/search",
      "/api/inspect",
      "/api/install-plan",
      "/api/mcp"
    ]));
    expect(partnerIntegrationPack.nonGoals).toContain("hosted workspace writes");
    expect(partnerIntegrationPack.nonGoals).toContain("official partnership claims without approval");
    expect(partnerIntegrationPack.privacy.workspaceDataRequired).toBe(false);
    expect(partnerIntegrationPack.readinessChecklist.join(" ")).toContain("x-nipmod-api-key");
  });

  test("publishes source quality with honest limits and all six sources", () => {
    const report = publicSourceQualityReport();
    expect(report.type).toBe("dev.nipmod.source-quality-report.v1");
    expect(report.profiles.map((profile) => profile.source)).toEqual([
      "npm",
      "pypi",
      "github",
      "huggingface-model",
      "huggingface-dataset",
      "mcp"
    ]);
    expect(sourceQualityBenchmark.summary).toMatchObject({
      blockedRecommendedCount: 0,
      fail: 0,
      pass: 36,
      total: 36
    });
    expect(sourceQualityBenchmark.summary.meanReciprocalRank).toBeGreaterThanOrEqual(0.95);
    expect(sourceQualityBenchmark.scope.unit).toBe("search result and pre-install source selection");
    expect(sourceQualityBenchmark.sourceCoverage.map((item) => item.source)).toEqual([
      "npm",
      "pypi",
      "github",
      "huggingface-model",
      "huggingface-dataset",
      "mcp"
    ]);
    expect(sourceQualityBenchmark.scenarioCoverage.map((item) => item.label).join(" ")).toContain("credential-scope");
    expect(sourceQualityBenchmark.notClaimed).toContain("malware-free guarantee");
    expect(sourceQualityBenchmark.notClaimed).toContain("full registry crawl");
  });

  test("publishes a visual competitive benchmark snapshot without unsafe claims", () => {
    expect(competitiveBenchmarkReport.type).toBe("dev.nipmod.competitive-benchmark-public.v1");
    expect(competitiveBenchmarkReport.headline).toMatchObject({
      installPlanEvidence: "8/8",
      liveChecks: "8/8",
      score: 95
    });
    expect(competitiveBenchmarkReport.tracks.map((track) => track.name)).toContain("Nipmod");
    expect(competitiveBenchmarkReport.tracks.find((track) => track.name === "Nipmod")?.score).toBeGreaterThan(80);
    expect(competitiveBenchmarkReport.categoryBreakdown.map((category) => category.key)).toEqual([
      "source-resolution",
      "security-evidence",
      "execution-preflight",
      "agent-readiness"
    ]);
    expect(competitiveBenchmarkReport.categoryBreakdown.find((category) => category.key === "execution-preflight")?.tracks[0]).toMatchObject({
      name: "Nipmod",
      score: 100
    });
    expect(competitiveBenchmarkReport.cases).toHaveLength(8);
    expect(competitiveBenchmarkReport.cases.map((testCase) => testCase.id)).toContain("hf-dataset-squad");
    expect(competitiveBenchmarkReport.rubric).toHaveLength(4);
    expect(competitiveBenchmarkReport.categoryWeights).toHaveLength(4);
    expect(competitiveBenchmarkReport.categoryWeights.find((category) => category.category === "Execution preflight")?.weights.find((weight) => weight.dimension === "install plan")?.weight).toBe(32);
    expect(competitiveBenchmarkReport.scoreAccounting).toHaveLength(5);
    expect(competitiveBenchmarkReport.marketContext.map((item) => item.name)).toEqual([
      "Nipmod",
      "Native registries",
      "OSV",
      "deps.dev",
      "Socket",
      "Snyk",
      "OpenSSF Scorecard",
      "Raw agent"
    ]);
    expect(competitiveBenchmarkReport.marketContext.find((item) => item.name === "Snyk")?.benchmarkBoundary).toContain("authenticated REST package API");
    expect(competitiveBenchmarkReport.marketContext.find((item) => item.name === "Socket")?.scaleContext).toContain("$1B");
    expect(competitiveBenchmarkReport.fairnessControls.join(" ")).toContain("coverage-adjusted");
    expect(competitiveBenchmarkReport.limitations.join(" ")).toContain("not a guarantee");
    expect(competitiveBenchmarkReport.reviewerAssessment.academicGrade).toContain("not sufficient");
    expect(competitiveBenchmarkReport.claimBoundary.join(" ")).toContain("not a malware-free guarantee");
    expect(JSON.stringify(competitiveBenchmarkReport)).not.toMatch(/Surplus|cost-market|cost_market/i);
    expect(competitiveBenchmarkReport.publishableClaims.join(" ")).not.toMatch(/safer than every competitor|guarantees package safety/i);
    expect(competitiveBenchmarkReport.unsafeClaims.join(" ")).toMatch(/Socket or Snyk/);
  });

  test("serves machine-readable JSON routes for agents", async () => {
    const [benchmark, demo, kit, partner, quality] = await Promise.all([
      getBenchmark().json(),
      getAgentDemoFlow().json(),
      getIntegrationKit().json(),
      getPartnerPack().json(),
      getSourceQuality().json()
    ]);

    expect(benchmark.type).toBe("dev.nipmod.competitive-benchmark-public.v1");
    expect(demo.type).toBe("dev.nipmod.agent-demo-flow.v1");
    expect(kit.type).toBe("dev.nipmod.integration-kit.v1");
    expect(partner.type).toBe("dev.nipmod.partner-integration-pack.v1");
    expect(quality.type).toBe("dev.nipmod.source-quality-report.v1");
  });
});
