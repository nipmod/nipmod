export const agentDemoFlow = {
  formatVersion: 1,
  type: "dev.nipmod.agent-demo-flow.v1",
  status: "public_agent_demo",
  page: "https://nipmod.com/demo",
  purpose:
    "Show the complete hosted Nipmod preflight: issue beta key, search public sources, inspect one exact record, request an install plan and stop before workspace writes.",
  privacy:
    "Use non-private package tasks only. The demo keeps the issued key in browser memory and does not ask for prompts, workspace paths, secrets or private package names.",
  steps: [
    {
      id: "issue_key",
      endpoint: "POST https://nipmod.com/api/keys/beta",
      output: "free beta key returned once",
      writesWorkspace: false
    },
    {
      id: "search",
      endpoint:
        "GET https://nipmod.com/api/search?q=<query>&sources=npm,pypi,github,huggingface-model,huggingface-dataset,mcp&limit=5",
      output: "candidate set, source reports and agent-selection recommendation",
      writesWorkspace: false
    },
    {
      id: "inspect",
      endpoint: "GET https://nipmod.com/api/inspect?source=<source>&name=<name>",
      output: "exact source record, trust fields, warnings and source evidence",
      writesWorkspace: false
    },
    {
      id: "install_plan",
      endpoint: "GET https://nipmod.com/api/install-plan?source=<source>&name=<name>",
      output: "commands as review data, safety warnings and approval boundary",
      writesWorkspace: false
    },
    {
      id: "approval",
      endpoint: "local host or user policy",
      output: "manual decision before install, clone, enablement or file edits",
      writesWorkspace: "outside hosted API only after approval"
    }
  ],
  passCriteria: [
    "API calls use x-nipmod-api-key",
    "search happens before package selection",
    "inspect targets the exact selected source record",
    "install plan is shown as review data",
    "package metadata is treated as untrusted data",
    "hosted API does not install, clone, execute or write",
    "local approval is required before workspace changes"
  ],
  links: {
    api: "https://nipmod.com/api-access",
    demo: "https://nipmod.com/demo",
    integrationKit: "https://nipmod.com/integrations",
    machine: "https://nipmod.com/agent-demo-flow.json",
    sourceQuality: "https://nipmod.com/source-quality"
  }
} as const;
