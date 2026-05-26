import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const siteRoot = join(import.meta.dirname, "..");
const preflight = JSON.parse(readFileSync(join(siteRoot, "public", "base-agent-preflight.json"), "utf8"));

describe("Base agent preflight spec", () => {
  test("publishes a machine-readable Base agent workflow without official-listing claims", () => {
    expect(preflight).toMatchObject({
      formatVersion: 1,
      name: "Nipmod package preflight for Base agents",
      status: "integration_path_not_official_listing",
      type: "dev.nipmod.base-agent-preflight.v1"
    });
    expect(preflight.links).toMatchObject({
      agentPrompts: "https://nipmod.com/agent-prompts.json",
      baseAgents: "https://www.base.org/agents",
      baseBuilderCodes: "https://docs.base.org/apps/builder-codes/builder-codes",
      baseCustomPlugins: "https://docs.base.org/ai-agents/plugins/custom-plugins",
      baseMcpQuickstart: "https://docs.base.org/ai-agents/quickstart",
      llms: "https://nipmod.com/llms.txt",
      page: "https://nipmod.com/base-agents",
      remoteMcp: "https://nipmod.com/api/mcp"
    });
    expect(preflight.claims).toMatchObject({
      appendsBuilderCodes: false,
      createsWalletApprovalLinks: false,
      hostedExecution: false,
      officialBaseListing: false,
      transactionSigning: false,
      walletCustody: false,
      workspaceWritesFromHostedApi: false
    });
    expect(preflight.workflow).toEqual([
      "issue_or_load_nipmod_api_key",
      "search_for_tooling",
      "inspect_exact_source_record",
      "request_install_plan",
      "show_trust_signals_warnings_and_command_boundary",
      "wait_for_user_or_host_approval",
      "continue_to_base_mcp_x402_or_protocol_workflow_after_approval"
    ]);
    expect(preflight.agentInstruction).toContain("Do not install, clone, run, enable or pay");
  });
});
