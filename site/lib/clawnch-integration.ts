export const clawnchIntegrationDraft = {
  formatVersion: 1,
  type: "dev.nipmod.partner-integration-draft.v1",
  name: "Nipmod Clawnch integration draft",
  status: "draft_for_partner_review",
  updatedAt: "2026-05-27",
  generatedFrom: [
    "https://www.clawn.ch",
    "https://www.clawn.ch/docs",
    "https://www.clawn.ch/skill",
    "https://www.clawn.ch/memory"
  ],
  partner: {
    name: "Clawnch",
    site: "https://www.clawn.ch",
    docs: "https://www.clawn.ch/docs",
    skill: "https://www.clawn.ch/skill",
    approval: "not_claimed"
  },
  summary:
    "A read-only Nipmod preflight outline for public Clawnch SDK, CLI, MCP and memory surfaces. Nipmod resolves and inspects tooling before an agent installs or enables it. Clawnch keeps ownership of its products, docs, packages and onchain flows.",
  surfaces: [
    {
      id: "clawnch-sdk",
      name: "@clawnch/sdk",
      kind: "typescript_sdk",
      source: "npm",
      candidateInstall: "npm install @clawnch/sdk",
      publicReference: "https://www.clawn.ch/docs",
      reviewStatus: "needs_partner_confirmation"
    },
    {
      id: "clawncher-sdk",
      name: "@clawnch/clawncher-sdk",
      kind: "programmatic_launch_sdk",
      source: "npm",
      candidateInstall: "npm install @clawnch/clawncher-sdk viem",
      publicReference: "https://www.clawn.ch/skill",
      reviewStatus: "needs_partner_confirmation"
    },
    {
      id: "clawncher-cli",
      name: "clawncher",
      kind: "cli",
      source: "npm",
      candidateInstall: "npm install -g clawncher",
      publicReference: "https://www.clawn.ch/skill",
      reviewStatus: "needs_partner_confirmation"
    },
    {
      id: "clawnch-mcp-server",
      name: "clawnch-mcp-server",
      kind: "mcp_server",
      source: "npm",
      candidateInstall: "npx clawnch-mcp-server",
      publicReference: "https://www.clawn.ch/skill",
      reviewStatus: "needs_partner_confirmation"
    },
    {
      id: "clawtomaton",
      name: "@clawnch/clawtomaton",
      kind: "agent_tooling",
      source: "npm",
      candidateInstall: "npm install @clawnch/clawtomaton",
      publicReference: "https://www.clawn.ch/docs",
      reviewStatus: "needs_partner_confirmation"
    },
    {
      id: "claws-memory",
      name: "@clawnch/memory",
      kind: "agent_memory_sdk",
      source: "npm",
      candidateInstall: "npm install @clawnch/memory",
      publicReference: "https://www.clawn.ch/memory",
      reviewStatus: "needs_partner_confirmation"
    },
    {
      id: "claws-memory-mcp",
      name: "@clawnch/memory-mcp-server",
      kind: "mcp_memory_server",
      source: "npm",
      candidateInstall: "npx @clawnch/memory-mcp-server",
      publicReference: "https://www.clawn.ch/skill",
      reviewStatus: "needs_partner_confirmation"
    },
    {
      id: "clawmes",
      name: "clawmes",
      kind: "chat_launch_plugin",
      source: "pypi",
      candidateInstall: "pip install clawmes",
      publicReference: "https://www.clawn.ch",
      reviewStatus: "needs_partner_confirmation"
    }
  ],
  proposedFlow: [
    {
      id: "discover",
      label: "Discover",
      description: "The agent asks for Clawnch, token launch tooling, an MCP server, a memory surface or a related SDK."
    },
    {
      id: "resolve",
      label: "Resolve",
      description: "Nipmod searches public sources and resolves the exact package, repo or MCP candidate before any install command is trusted."
    },
    {
      id: "inspect",
      label: "Inspect",
      description: "Nipmod returns source metadata, trust signals, warnings, package evidence and source limitations for the selected candidate."
    },
    {
      id: "plan",
      label: "Plan",
      description: "Nipmod returns the install boundary, script risk and command shape so the host can review what would happen locally."
    },
    {
      id: "approve",
      label: "Approve",
      description: "The user or agent host approves local installation, MCP enablement or any external action outside the hosted Nipmod API."
    },
    {
      id: "handoff",
      label: "Handoff",
      description: "After approval, the local agent environment can continue to Clawnch-owned flows such as token launching, trading, liquidity management, memory or agent matching."
    }
  ],
  requiredChecks: [
    "canonical package names",
    "canonical product names",
    "preferred docs links",
    "surfaces that should be indexed",
    "surfaces that should not be indexed",
    "wording before any public announcement",
    "install commands that should be changed or removed"
  ],
  boundaries: [
    "no partnership or approval claim before Clawnch approves the wording",
    "no private key handling",
    "no wallet custody",
    "no transaction signing",
    "no token launch execution",
    "no trading or liquidity action",
    "no credential collection",
    "no hosted workspace writes",
    "no hosted package execution",
    "no guarantee that a package is malware-free"
  ],
  calls: {
    issueBetaKey: "POST https://nipmod.com/api/keys/beta",
    search:
      "GET https://nipmod.com/api/search?q=clawnch%20agent%20token%20tooling&sources=npm,pypi,github,mcp&limit=5 with x-nipmod-api-key",
    inspect: "GET https://nipmod.com/api/inspect?source=npm&name=@clawnch/sdk with x-nipmod-api-key",
    installPlan: "GET https://nipmod.com/api/install-plan?source=npm&name=@clawnch/sdk with x-nipmod-api-key",
    remoteMcpResolve: "POST https://nipmod.com/api/mcp tools/call nipmod.resolve with x-nipmod-api-key"
  },
  links: {
    page: "https://nipmod.com/integrations/clawnch",
    machine: "https://nipmod.com/clawnch-integration.json",
    nipmodApi: "https://nipmod.com/api-access",
    nipmodIntegrations: "https://nipmod.com/integrations",
    clawnchSite: "https://www.clawn.ch",
    clawnchDocs: "https://www.clawn.ch/docs",
    clawnchSkill: "https://www.clawn.ch/skill",
    clawnchMemory: "https://www.clawn.ch/memory"
  }
} as const;
