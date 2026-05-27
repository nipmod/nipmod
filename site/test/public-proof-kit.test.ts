import { describe, expect, test } from "vitest";
import { GET as getAgentDemoFlow } from "../app/agent-demo-flow.json/route";
import { GET as getIntegrationKit } from "../app/integration-kit.json/route";
import { GET as getSourceQuality } from "../app/source-quality.json/route";
import { agentDemoFlow } from "../lib/agent-demo-flow";
import { integrationKit } from "../lib/integration-kit";
import { publicSourceQualityReport, sourceQualityBenchmark } from "../lib/source-quality-public";

describe("public agent proof kit", () => {
  test("publishes a generic preflight demo without hosted writes", () => {
    expect(agentDemoFlow).toMatchObject({
      status: "public_agent_demo",
      type: "dev.nipmod.agent-demo-flow.v1"
    });
    expect(agentDemoFlow.steps).toHaveLength(5);
    expect(agentDemoFlow.steps.slice(0, 4).every((step) => step.writesWorkspace === false)).toBe(true);
    expect(agentDemoFlow.passCriteria).toContain("hosted API does not install, clone, execute or write");
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
    expect(integrationKit.nonGoals).toContain("hosted workspace writes");
    expect(integrationKit.nonGoals).toContain("official partnership claim without the partner's approval");
    expect(integrationKit.expectedHandoff).toContain("user or host approves local execution outside the hosted API");
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
      pass: 10,
      total: 10
    });
    expect(sourceQualityBenchmark.notClaimed).toContain("malware-free guarantee");
    expect(sourceQualityBenchmark.notClaimed).toContain("full registry crawl");
  });

  test("serves machine-readable JSON routes for agents", async () => {
    const [demo, kit, quality] = await Promise.all([
      getAgentDemoFlow().json(),
      getIntegrationKit().json(),
      getSourceQuality().json()
    ]);

    expect(demo.type).toBe("dev.nipmod.agent-demo-flow.v1");
    expect(kit.type).toBe("dev.nipmod.integration-kit.v1");
    expect(quality.type).toBe("dev.nipmod.source-quality-report.v1");
  });
});
