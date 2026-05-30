export const integrationKit = {
  formatVersion: 1,
  type: "dev.nipmod.integration-kit.v1",
  status: "generic_public_kit",
  page: "https://nipmod.com/integrations",
  summary:
    "A generic read-only integration pattern for agent products, MCP servers, SDKs, CLIs, wallets, infra layers and devtools that want package intelligence before external tooling enters an agent workflow.",
  integrationContract: {
    issueBetaKey: "POST https://nipmod.com/api/keys/beta",
    search:
      "GET https://nipmod.com/api/search?q=<query>&sources=npm,pypi,github,huggingface-model,huggingface-dataset,mcp&limit=5 with x-nipmod-api-key",
    inspect: "GET https://nipmod.com/api/inspect?source=<source>&name=<name> with x-nipmod-api-key",
    installPlan: "GET https://nipmod.com/api/install-plan?source=<source>&name=<name> with x-nipmod-api-key",
    mcp: "POST https://nipmod.com/api/mcp with x-nipmod-api-key",
    optionalArchiveDryRun:
      "POST https://nipmod.com/api/archive/confirm with dryRun=true after a user or host confirms the decision was useful"
  },
  decisionObject: {
    type: "dev.nipmod.package-decision.v1",
    schema: "https://nipmod.com/api/openapi#/components/schemas/PackageDecision",
    fields: [
      "agentReadiness",
      "recommended",
      "comparison.candidates",
      "confidence",
      "security.signals",
      "alternatives",
      "avoid",
      "receipt",
      "archive"
    ],
    requiredFields: [
      "agentReadiness.verdict",
      "recommended.id",
      "confidence.score",
      "comparison.candidates",
      "receipt.requiresApprovalBeforeWrite",
      "security.posture"
    ],
    approvalPolicy: {
      beforeLocalExecution:
        "Require host or user approval before install, clone, model load, MCP enablement or workspace write even when agentReadiness.verdict is ready.",
      blockedWhen: ["agentReadiness.verdict=blocked", "receipt.installPlanBlocked=true", "security.posture=blocked"],
      metadataBoundary: "Package metadata, READMEs and model cards are treated as untrusted data."
    },
    example: {
      agentReadiness: {
        blockers: [],
        integrationSafe: true,
        mode: "pre-execution-package-decision",
        reasons: ["recommendation, receipt and reviewable install plan are available"],
        requiredHostActions: ["show the install plan and require local approval before workspace writes"],
        score: 92,
        verdict: "ready",
        version: "agent-readiness-v1"
      },
      confidence: { label: "high", score: 90, uncertainty: [] },
      receipt: {
        hostedApiExecutes: false,
        requiresApprovalBeforeWrite: true,
        workspaceWrites: false
      },
      security: { posture: "clean-preflight" }
    },
    purpose:
      "One portable pre-execution decision object that a host can show to users, store as a receipt, or feed into local approval policy."
  },
  apiKeyLifecycle: {
    betaKeyIssue: "POST https://nipmod.com/api/keys/beta",
    compatibleHeaders: ["x-nipmod-api-key", "Authorization: Bearer <key>"],
    keyMaterialStored: "server-side hash only",
    rotation: "create a new key and revoke or pause old keys from admin operations",
    versioning: "additive API fields are shipped without requiring agents to rotate existing keys"
  },
  proofArtifacts: [
    "https://nipmod.com/.well-known/nipmod.json",
    "https://nipmod.com/api/openapi",
    "https://nipmod.com/source-quality.json",
    "https://nipmod.com/benchmark.json",
    "https://nipmod.com/agent-demo-flow.json"
  ],
  integrationModes: [
    {
      id: "preflight",
      name: "Package preflight",
      description: "Call Nipmod before an agent installs a dependency, pulls a repo, enables an MCP server or uses a model."
    },
    {
      id: "host_policy",
      name: "Host policy gate",
      description: "Use the install plan and trust response as input to local approval, allowlist or review policy."
    },
    {
      id: "tool_discovery",
      name: "Tool discovery",
      description: "Expose an SDK, CLI, MCP server, model or package surface so agents can find and inspect it through Nipmod."
    },
    {
      id: "archive_feedback",
      name: "Archive feedback",
      description: "After useful approved results, prepare package intelligence records for future reuse."
    },
    {
      id: "decision_receipts",
      name: "Decision receipts",
      description: "Store the returned package decision receipt with the host workflow so later actions can reference the reviewed source, version, warnings and boundary."
    }
  ],
  expectedHandoff: [
    "agent identifies package, repo, model, dataset, MCP server, SDK or CLI need",
    "agent calls Nipmod search with a beta or partner key",
    "agent inspects the exact source record",
    "agent requests an install plan",
    "agent builds or receives a package decision object with score, gate, alternatives, avoid list and receipt",
    "agent shows source context, trust fields, warnings and command boundary",
    "user or host approves local execution outside the hosted API",
    "host can optionally dry-run archive confirmation after the result proves useful"
  ],
  nonGoals: [
    "private package access",
    "hosted workspace writes",
    "remote package execution",
    "wallet custody",
    "transaction signing",
    "malware-free guarantee",
    "official partnership claim without the partner's approval"
  ],
  ecosystemExamples: [
    {
      ecosystem: "Base",
      fit: "preflight before SDKs, CLIs, MCP servers, x402 clients and protocol packages enter a Base agent workflow",
      page: "https://nipmod.com/base-agents"
    },
    {
      ecosystem: "MCP",
      fit: "read-only package and server discovery before a host enables external tools",
      page: "https://nipmod.com/mcp"
    },
    {
      ecosystem: "Devtools",
      fit: "dependency choice and install-plan review before an agent edits a workspace",
      page: "https://nipmod.com/agents"
    }
  ],
  links: {
    api: "https://nipmod.com/api-access",
    demo: "https://nipmod.com/demo",
    machine: "https://nipmod.com/integration-kit.json",
    partnerPack: "https://nipmod.com/partner-pack.json",
    partners: "https://nipmod.com/partners",
    sourceQuality: "https://nipmod.com/source-quality"
  }
} as const;
