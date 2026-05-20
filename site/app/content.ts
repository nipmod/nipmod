export const homeContent = {
  brand: "Nipmod",
  headline: "Package layer for agents",
  lead: "Search, inspect and install verified agent packages from one shared archive.",
  links: {
    bankrCoin: "https://bankr.bot/launches/0x5155Eaa3B5784B829DeAD78189Eb4Bf69359dbA3",
    docs: "/quickstart#docs",
    github: "https://github.com/nipmod/nipmod",
    gitlawbProfile: "https://gitlawb.com/z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R",
    gitlawbSource: "https://gitlawb.com/node/repos/z6Mkwbud/nipmod",
    install: "/setup",
    telegram: "https://t.me/nipmod",
    x: "https://x.com/Nipmod"
  },
  primaryAction: "Setup Nipmod",
  secondaryAction: "X",
  commands: [
    "nipmod search gitlawb --online",
    "nipmod inspect gitlawb-repo-reader",
    "nipmod install gitlawb-repo-reader",
    "nipmod audit --online"
  ],
  usage: [
    {
      label: "Search",
      text: "Find packages from the public archive without a Nipmod account."
    },
    {
      label: "Verify",
      text: "Check source, signatures, permissions and trust evidence before install."
    },
    {
      label: "Install",
      text: "Plan first, then pin exact package bytes in a workspace lockfile."
    }
  ],
  platformRoadmap: {
    headline: "Platform status",
    lead:
      "Live means Nipmod controls the path. MCP ready means agents can connect locally.",
    note: "Only live and MCP ready paths are shown here. The full proof matrix stays public.",
    items: [
      {
        name: "Gitlawb",
        status: "Live",
        label: "source network",
        text: "Nipmod source, package publishing and DID ownership checks already run on Gitlawb repos.",
        href: "/package",
        cta: "Create package"
      },
      {
        name: "GitHub",
        status: "Live",
        label: "public review",
        text: "The public repo, CI, docs and connection kits are inspectable from GitHub.",
        href: "https://github.com/nipmod/nipmod",
        cta: "Open GitHub"
      },
      {
        name: "MCP",
        status: "MCP ready",
        label: "agent runtime",
        text: "One local MCP server exposes search, inspect, install planning, audit and SBOM tools.",
        href: "/mcp",
        cta: "View MCP"
      },
      {
        name: "Codex",
        status: "MCP ready",
        label: "agent host",
        text: "Codex can register Nipmod as a local stdio MCP server through the Nipmod setup command.",
        href: "/setup",
        cta: "Setup Codex"
      },
      {
        name: "Claude Code",
        status: "MCP ready",
        label: "agent host",
        text: "Claude Code can load the project MCP config and connect to the local Nipmod MCP server.",
        href: "/setup",
        cta: "Setup Claude Code"
      },
      {
        name: "Cursor",
        status: "MCP ready",
        label: "agent IDE",
        text: "Cursor can load the project MCP config and connect to the local Nipmod MCP server.",
        href: "/cursor",
        cta: "Setup Cursor"
      },
      {
        name: "OpenCode",
        status: "MCP ready",
        label: "agent host",
        text: "OpenCode can load the project config and connect to the local Nipmod MCP server.",
        href: "/setup",
        cta: "Setup OpenCode"
      },
      {
        name: "Hermes",
        status: "MCP ready",
        label: "agent host",
        text: "Hermes can load Nipmod MCP and a local /nipmod skill bundle.",
        href: "/setup",
        cta: "Setup Hermes"
      }
    ]
  },
  claimFlow: {
    headline: "Publish your repo as a package.",
    lead: "The source owner runs the package flow. Nipmod verifies the claim and never takes ownership.",
    steps: [
      {
        label: "Prepare",
        text: "Start from your own Gitlawb repo and run the package preflight locally."
      },
      {
        label: "Verify",
        text: "Check manifest, source, permissions, evidence and DID ownership."
      },
      {
        label: "Publish",
        text: "The repo owner signs and publishes only after the dry run is clean."
      },
      {
        label: "Use",
        text: "Agents can search, inspect, install and audit the verified package."
      }
    ]
  },
  startCards: [
    {
      title: "Setup Nipmod",
      text: "Connect Codex, Claude Code, Cursor, OpenCode or Hermes.",
      href: "/setup"
    },
    {
      title: "Run demo",
      text: "Search, inspect, plan and write an install receipt from one package path.",
      href: "/demo"
    },
    {
      title: "Read status",
      text: "Check system and platform receipts before repeating a claim.",
      href: "/status"
    }
  ],
  quickstartSteps: [
    {
      label: "Install CLI",
      text: "Paste one command.",
      command: "curl https://nipmod.com/i|bash"
    },
    {
      label: "Check",
      text: "Confirm the CLI, registry and any publish setup.",
      command: "nipmod doctor --online"
    },
    {
      label: "Setup publish",
      text: "Repair or install the Gitlawb publish helper without piping remote shell scripts.",
      command: "nipmod setup gitlawb\nnipmod doctor --online"
    },
    {
      label: "Find",
      text: "Search the public registry.",
      command: "nipmod search gitlawb --online"
    },
    {
      label: "Inspect",
      text: "Read digest, signer, source, witness and permissions.",
      command: "nipmod inspect pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0"
    },
    {
      label: "Plan install",
      text: "Preview the verified dependency graph before the lockfile changes.",
      command: "nipmod install --plan pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0 --json"
    },
    {
      label: "Install package",
      text: "Create a demo workspace first so the first lockfile mutation is isolated.",
      command: "mkdir -p nipmod-demo\ncd nipmod-demo\nnipmod install gitlawb-repo-reader"
    },
    {
      label: "Add alias",
      text: "Use add only when you want the short alias for install.",
      command: "nipmod add gitlawb-repo-reader --online"
    },
    {
      label: "Restore",
      text: "Restore the local store from the lockfile or confirm it is current.",
      command: "nipmod install"
    },
    {
      label: "Update",
      text: "Check for verified root package updates and apply them when available.",
      command: "nipmod update --plan\nnipmod update"
    },
    {
      label: "SBOM",
      text: "Export the lockfile, permissions and dependency graph for agents.",
      command: "nipmod sbom --json"
    },
    {
      label: "Explain",
      text: "Show why a package exists in the lockfile.",
      command: "nipmod explain gitlawb-repo-reader --json"
    },
    {
      label: "Audit",
      text: "Verify the lockfile against current trust and advisory data.",
      command: "nipmod audit --online\nnipmod ci --online"
    },
    {
      label: "Publish",
      text: "Run the author preflight before any public write.",
      command:
        "nipmod setup gitlawb\nnipmod init --name gitlawb-demo-package --dir gitlawb-demo-package\ncd gitlawb-demo-package\nnipmod manifest validate --dir . --json\nnipmod publish . --dry-run --json"
    }
  ],
  packageUseCases: [
    {
      label: "Read",
      text: "Repo readers, release reviewers and dependency review packages help agents understand code before editing."
    },
    {
      label: "Guard",
      text: "Policy, audit and prompt injection packages block risky capabilities before they enter a workspace."
    },
    {
      label: "Connect",
      text: "MCP, APM and source provenance receipts let existing agent formats map into Nipmod proof."
    }
  ],
  operatorChecks: [
    {
      label: "Monitor",
      text: "Site, discovery, registry, advisories, node, witness and deploy drift run on a live synthetic check."
    },
    {
      label: "Restore",
      text: "Node data, witness state and Fly Postgres have passed disposable restore drills."
    },
    {
      label: "Respond",
      text: "Advisories and quarantine metadata can block install surfaces without owning publishing rights."
    }
  ],
  launchReadiness: [
    {
      label: "Founder review",
      text: "A short public ask, a direct message and the Gitlawb source link are ready."
    },
    {
      label: "Demo flow",
      text: "A repo owner can prepare, check, verify and dry run a package from one terminal path."
    },
    {
      label: "Public proof",
      text: "Manifest, advisory feed, transparency checkpoint, witness and release signature are public."
    },
    {
      label: "Agent setup",
      text: "Codex, Claude Code, Cursor, OpenCode and Hermes can use the read only MCP server path. Hermes also has a /nipmod bundle."
    }
  ],
  founderOutreach: {
    post:
      "Gitlawb gives agents decentralized source. Nipmod is the package layer: signed bundles, DID publisher identity, pinned installs, public advisories and witness backed audit. Independent project asking for Gitlawb review, not claiming endorsement. Public demo: https://nipmod.com/launch Source: https://gitlawb.com/node/repos/z6Mkwbud/nipmod",
    dm:
      "We built Nipmod as an independent package layer for Gitlawb agents. It does not control Gitlawb publishing; it verifies signed packages over Gitlawb content so agents can inspect, install, lock and audit before trusting code. Could you sanity check whether this model fits Gitlawb's direction?"
  },
  demoFlow: [
    {
      label: "Find",
      text: "Search the public registry without a Nipmod account.",
      command: "nipmod search gitlawb --online"
    },
    {
      label: "Inspect",
      text: "Read digest, signer, source, witness and transparency evidence.",
      command: "nipmod inspect pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0"
    },
    {
      label: "Install",
      text: "Pin the verified package in the workspace lockfile.",
      command: "nipmod install gitlawb-repo-reader"
    },
    {
      label: "Restore",
      text: "Restore the package store from the lockfile.",
      command: "nipmod install"
    },
    {
      label: "Publish dry run",
      text: "Create local package files and a registry candidate without mutating Gitlawb.",
      command:
        "nipmod init --name gitlawb-demo-package --dir gitlawb-demo-package\ncd gitlawb-demo-package\nnipmod manifest validate --dir .\nnipmod publish . --dry-run --json"
    }
  ],
  ecosystemPackages: [
    {
      name: "gitlawb-repo-reader",
      text: "Read a public Gitlawb repo and return a provenance focused summary.",
      command: "nipmod install gitlawb-repo-reader"
    },
    {
      name: "gitlawb-release-review",
      text: "Review immutable tags, signed release events and registry readiness.",
      command: "nipmod install gitlawb-release-review"
    },
    {
      name: "repo-readme-audit",
      text: "Audit repository README content for package clarity and untrusted instruction risk.",
      command: "nipmod install repo-readme-audit"
    },
    {
      name: "dependency-risk-review",
      text: "Review dependency manifests, permissions and lockfiles before install.",
      command: "nipmod install dependency-risk-review"
    },
    {
      name: "prompt-injection-scan",
      text: "Scan package text and prompts for instruction injection risk.",
      command: "nipmod install prompt-injection-scan"
    },
    {
      name: "strict-ci-policy",
      text: "Run strict install policy gates for automated agent workspaces.",
      command: "nipmod install strict-ci-policy"
    },
    {
      name: "developer-default-policy",
      text: "Apply a practical default policy for trying packages safely before production use.",
      command: "nipmod install developer-default-policy"
    },
    {
      name: "nipmod-audit-ci",
      text: "Turn audit and policy output into CI decisions agents can explain and enforce.",
      command: "nipmod install nipmod-audit-ci"
    },
    {
      name: "github-issue-triage",
      text: "Triage GitHub issues from untrusted issue text without package permissions.",
      command: "nipmod install github-issue-triage"
    },
    {
      name: "mcp-server-import-example",
      text: "Map MCP server metadata into Nipmod compatibility receipts.",
      command: "nipmod install mcp-server-import-example"
    },
    {
      name: "apm-import-example",
      text: "Map an APM package listing into Nipmod trust metadata.",
      command: "nipmod install apm-import-example"
    },
    {
      name: "malicious-skill-fixtures",
      text: "Provide safe negative test fixtures for scanners and policy reviewers.",
      command: "nipmod install malicious-skill-fixtures"
    },
    {
      name: "gitlawb-diff-summarizer",
      text: "Summarize Gitlawb repository diffs with provenance, risk and next action clarity.",
      command: "nipmod install gitlawb-diff-summarizer"
    },
    {
      name: "release-notes-drafter",
      text: "Draft release notes from verified package, Gitlawb tag and changelog evidence.",
      command: "nipmod install release-notes-drafter"
    },
    {
      name: "security-advisory-triage",
      text: "Triage package security reports into advisory, quarantine and user action decisions.",
      command: "nipmod install security-advisory-triage"
    },
    {
      name: "agent-permission-review",
      text: "Review agent package permissions for least privilege before install or publish.",
      command: "nipmod install agent-permission-review"
    },
    {
      name: "mcp-tool-risk-review",
      text: "Review MCP server tools and manifests before agents expose them to package workflows.",
      command: "nipmod install mcp-tool-risk-review"
    },
    {
      name: "package-onboarding-checklist",
      text: "Guide new package authors through a clean Nipmod publish candidate.",
      command: "nipmod install package-onboarding-checklist"
    },
    {
      name: "registry-mirror-compare",
      text: "Compare registry mirrors and fail closed on digest, root, witness or advisory drift.",
      command: "nipmod install registry-mirror-compare"
    },
    {
      name: "package-evidence-brief",
      text: "Turn package proof into a short human review brief.",
      command: "nipmod install package-evidence-brief"
    },
    {
      name: "agent-runtime-compat-check",
      text: "Check whether an agent host is ready for install, audit and MCP flows.",
      command: "nipmod install agent-runtime-compat-check"
    },
    {
      name: "external-review-packet",
      text: "Prepare an external reviewer handoff from proof and gate output.",
      command: "nipmod install external-review-packet"
    },
    {
      name: "first-user-onboarding",
      text: "Guide a new user through setup, inspect, package install, audit and publish dry run.",
      command: "nipmod install first-user-onboarding"
    },
    {
      name: "package-migration-planner",
      text: "Plan a Gitlawb, MCP or APM source migration into a package candidate.",
      command: "nipmod install package-migration-planner"
    },
    {
      name: "readonly-registry-mcp-server",
      text: "Expose read only registry search and inspect tools through MCP.",
      command: "nipmod install readonly-registry-mcp-server"
    },
    {
      name: "launch-strict-policy-pack",
      text: "Apply launch strict install policy for verified agent packages.",
      command: "nipmod install launch-strict-policy-pack"
    },
    {
      name: "package-safety-eval-pack",
      text: "Evaluate scanners against unsafe agent package fixtures.",
      command: "nipmod install package-safety-eval-pack"
    },
    {
      name: "gitlawb-review-tool-bundle",
      text: "Bundle Gitlawb repo review, diff summary and release review guidance.",
      command: "nipmod install gitlawb-review-tool-bundle"
    }
  ],
  repoToPackage: {
    headline: "Publish your Gitlawb repo as an agent package",
    lead: "Use this flow for a repo you own or maintain. It gives you local checks, owner verification and a publish dry run.",
    inputLabel: "Your Gitlawb repo",
    inputPlaceholder: "gitlawb://did:key:z6Mk.../your-repo",
    outputTitle: "Package output",
    outputCommand: "nipmod package doctor gitlawb://did:key:z6Mk.../your-repo --json\nnipmod package pr gitlawb://did:key:z6Mk.../your-repo --dir your-repo-pr\nnipmod claim verify gitlawb://did:key:z6Mk.../your-repo --json\nnipmod publish your-repo-pr --dry-run --json",
    steps: [
      {
        label: "Choose",
        text: "Start with a Gitlawb repo you control."
      },
      {
        label: "Check",
        text: "Run local package checks, permissions review, owner claim check and publish dry run."
      },
      {
        label: "Publish",
        text: "Sign and publish only when the evidence is clean."
      }
    ],
    claim: {
      label: "Owner controlled",
      text: "Gitlawb uses DID signature ownership. Nipmod does not claim repos for other people."
    }
  }
} as const;
