export const partnerIntegrationPack = {
  access: {
    authHeader: "x-nipmod-api-key",
    betaKeyIssue: {
      body: { label: "partner-name-or-agent-host" },
      endpoint: "POST https://nipmod.com/api/keys/beta",
      note: "Self-serve beta keys are free and rate limited. Use partner keys for sustained integration traffic."
    },
    coreApi: "key_required",
    publicSurfaces: [
      "https://nipmod.com",
      "https://nipmod.com/partners",
      "https://nipmod.com/integrations",
      "https://nipmod.com/benchmark",
      "https://nipmod.com/stats"
    ]
  },
  contact: {
    email: "info@nipmod.com",
    github: "https://github.com/nipmod/nipmod",
    telegram: "https://t.me/nipmod",
    x: "https://x.com/Nipmod"
  },
  endpoints: [
    {
      method: "GET",
      path: "/api/search",
      purpose: "Find package, repo, model, dataset and MCP candidates across supported sources.",
      example:
        "https://nipmod.com/api/search?q=<query>&sources=npm,pypi,github,huggingface-model,huggingface-dataset,mcp&limit=5"
    },
    {
      method: "GET",
      path: "/api/inspect",
      purpose: "Inspect one exact upstream object and return source context, trust signals and warnings.",
      example: "https://nipmod.com/api/inspect?source=npm&name=undici"
    },
    {
      method: "GET",
      path: "/api/install-plan",
      purpose: "Return a read-only install plan and command boundary before local approval.",
      example: "https://nipmod.com/api/install-plan?source=npm&name=undici"
    },
    {
      method: "POST",
      path: "/api/mcp",
      purpose: "Expose the same read-only package intelligence flow through a hosted MCP endpoint.",
      example: "https://nipmod.com/api/mcp"
    },
    {
      method: "GET",
      path: "/api/archive/prepare",
      purpose: "Preview a reusable package intelligence record after useful approved results.",
      example: "https://nipmod.com/api/archive/prepare?source=npm&name=undici"
    }
  ],
  formatVersion: 1,
  integrationSequence: [
    "Agent identifies a package, repo, model, dataset, MCP server, SDK or CLI it wants to use.",
    "Agent calls /api/search with a beta or partner key.",
    "Agent chooses one candidate and calls /api/inspect for the exact record.",
    "Agent calls /api/install-plan and shows trust signals, warnings and command boundary.",
    "User or local host approves any install, clone, enablement, paid API setup or transaction handoff outside the hosted API.",
    "If the result was useful, the host can prepare archive context for future reuse."
  ],
  limits: {
    note: "Default limits are per key and route before any partner multiplier. Partner keys can be raised for real integrations.",
    routes: [
      { limit: "120/min", path: "/api/search" },
      { limit: "120/min", path: "/api/inspect" },
      { limit: "90/min", path: "/api/install-plan" },
      { limit: "240/min", path: "/api/mcp" },
      { limit: "60/min", path: "/api/archive/prepare" },
      { limit: "240/min", path: "/api/openapi" },
      { limit: "240/min", path: "/api/sources/health" }
    ]
  },
  nonGoals: [
    "hosted workspace writes",
    "hosted package installation",
    "repository cloning inside the hosted API",
    "artifact unpacking or model execution",
    "wallet custody or transaction signing",
    "private package access",
    "official partnership claims without approval"
  ],
  outputContract: {
    inspectIncludes: ["source record", "sourceEvidence", "trust fields", "warnings", "agentRecommendation"],
    installPlanIncludes: ["plan", "safety", "commandDetails", "writes", "approval boundary"],
    searchIncludes: ["records", "selection", "sources", "archivePolicy"]
  },
  privacy: {
    doesNotStore: ["raw API keys", "raw IP addresses", "raw user agents", "raw queries", "workspace paths", "prompts"],
    usageStores: ["route", "method", "status", "access tier", "key id", "client hash", "query hash", "package hash", "source", "duration"],
    workspaceDataRequired: false
  },
  readinessChecklist: [
    "Core calls use x-nipmod-api-key.",
    "The integration treats package metadata and model cards as untrusted input.",
    "The agent does not execute commands returned by /api/install-plan without local approval.",
    "The host logs whether a package was accepted, rejected or escalated for review.",
    "The partner does not claim official Nipmod or platform approval until both sides approve wording."
  ],
  status: "public_partner_pack",
  supportedSources: ["npm", "pypi", "github", "huggingface-model", "huggingface-dataset", "mcp"],
  type: "dev.nipmod.partner-integration-pack.v1"
} as const;
