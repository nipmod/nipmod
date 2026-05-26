import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const siteRoot = join(import.meta.dirname, "..");
const integration = JSON.parse(readFileSync(join(siteRoot, "public", "base-agent-integration.json"), "utf8"));
const demo = JSON.parse(readFileSync(join(siteRoot, "public", "base-agent-demo-flow.json"), "utf8"));

describe("Base agent integration artifacts", () => {
  test("publishes an integration outline without official Base claims", () => {
    expect(integration).toMatchObject({
      formatVersion: 1,
      status: "outline_not_official_listing",
      type: "dev.nipmod.base-agent-integration-outline.v1"
    });
    expect(integration.links).toMatchObject({
      demo: "https://nipmod.com/base-agents/demo",
      demoSpec: "https://nipmod.com/base-agent-demo-flow.json",
      page: "https://nipmod.com/base-agents/integration",
      preflightSpec: "https://nipmod.com/base-agent-preflight.json"
    });
    expect(integration.calls).toMatchObject({
      inspect: "GET https://nipmod.com/api/inspect?source=<source>&name=<name> with x-nipmod-api-key",
      installPlan: "GET https://nipmod.com/api/install-plan?source=<source>&name=<name> with x-nipmod-api-key",
      search: "GET https://nipmod.com/api/search?q=<tooling-query>&sources=npm,pypi,github,huggingface-model,huggingface-dataset,mcp&limit=5 with x-nipmod-api-key"
    });
    expect(integration.baseBuilderCode).toMatchObject({
      appendedByHostedApi: false,
      builderCode: "bc_vu9r71xi",
      registered: true
    });
    expect(integration.nonGoals).toContain("official Base listing claim");
    expect(integration.nonGoals).toContain("hosted workspace writes");
  });

  test("publishes a demo flow with approval-gated handoff", () => {
    expect(demo).toMatchObject({
      formatVersion: 1,
      status: "public_demo_flow",
      type: "dev.nipmod.base-agent-demo-flow.v1"
    });
    expect(demo.links).toMatchObject({
      integrationOutline: "https://nipmod.com/base-agents/integration",
      integrationSpec: "https://nipmod.com/base-agent-integration.json",
      page: "https://nipmod.com/base-agents/demo"
    });
    expect(demo.steps.map((step: { id: string }) => step.id)).toEqual([
      "issue_key",
      "search",
      "inspect",
      "install_plan",
      "approval",
      "handoff"
    ]);
    expect(demo.passCriteria).toContain("no install, clone, enablement or paid request setup happens before approval");
    expect(demo.expectedAgentOutput.mustNotInclude).toContain("official Base integration claim");
    expect(demo.expectedAgentOutput.mustNotInclude).toContain("transaction attribution claim");
  });
});
