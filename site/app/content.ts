export const homeContent = {
  brand: "Nipmod",
  headline: "Package layer for agent built software",
  lead: "Nipmod makes agent code installable, verifiable and reusable. It starts with Gitlawb source and gives humans and agents a clean package workflow.",
  links: {
    bankrCoin: "https://bankr.bot/launches/0x5155Eaa3B5784B829DeAD78189Eb4Bf69359dbA3",
    docs: "/quickstart#docs",
    github: "https://github.com/nipmod/nipmod",
    gitlawbProfile: "https://gitlawb.com/z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R",
    gitlawbSource: "https://gitlawb.com/node/repos/z6Mkwbud/nipmod",
    install: "/quickstart#install",
    x: "https://x.com/Nipmod"
  },
  primaryAction: "Install CLI",
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
      text: "Find agent packages and package candidates without a Nipmod account."
    },
    {
      label: "Verify",
      text: "Check identity, source, claims, signatures and audit evidence before install."
    },
    {
      label: "Install",
      text: "Pin exact package bytes in a workspace lockfile for humans and agents."
    }
  ],
  comparison: [
    {
      label: "Human package tools",
      title: "Developer workflows",
      text: "Fast installs, familiar package names and public distribution for human maintained projects.",
      points: ["package names and versions", "developer first", "human publisher accounts"]
    },
    {
      label: "Nipmod",
      title: "Agent package layer",
      text: "Agent owned code, signed source history, package claims, audit data and safe agent installs.",
      points: ["source identity", "DID ownership claims", "agent readable trust metadata"]
    }
  ],
  gitlawbReason: {
    headline: "Why Gitlawb first?",
    text: "Gitlawb already gives agents source identity, signed pushes and public provenance. Nipmod adds the installable package layer on top.",
    facts: [
      "source history stays on Gitlawb",
      "package truth is verified from signed evidence",
      "the same model can cover more agent code platforms over time"
    ]
  },
  platformRoadmap: {
    headline: "Platform status",
    lead:
      "Gitlawb is live. Bankr is under review. Agent hosts are now MCP ready through one local server with controlled install.",
    note: "Statuses describe Nipmod integration work, not partner approval.",
    items: [
      {
        name: "Gitlawb",
        status: "Live",
        label: "source network",
        text: "Nipmod source, package drafts and DID ownership checks already run on Gitlawb repos.",
        href: "/candidates",
        cta: "View candidates"
      },
      {
        name: "Bankr",
        status: "PR open",
        label: "agent skill",
        text: "The Bankr skill and agent workflow are ready for review. Agents can read, inspect and plan without wallet actions.",
        href: "/bankr",
        cta: "View Bankr path"
      },
      {
        name: "Agent hosts",
        status: "MCP ready",
        label: "Codex, Claude Code, OpenCode",
        text: "Codex, Claude Code and OpenCode can use Nipmod through MCP for package discovery, trust inspection, install planning and controlled install.",
        href: "/mcp",
        cta: "View MCP setup"
      }
    ]
  },
  claimFlow: {
    headline: "Found your repo? Claim the package.",
    lead: "Nipmod can prepare a package path, but the repo owner keeps control.",
    steps: [
      {
        label: "Discover",
        text: "Scout finds public Gitlawb repos that can become packages."
      },
      {
        label: "Draft",
        text: "Nipmod prepares the manifest, install path and trust checklist."
      },
      {
        label: "Claim",
        text: "The repo owner signs the claim with the Gitlawb DID."
      },
      {
        label: "Use",
        text: "Agents can search, inspect, install and audit the verified package."
      }
    ]
  },
  faq: [
    {
      question: "Is this only for Gitlawb?",
      answer:
        "Gitlawb is the first canonical source network. The package layer is designed to cover more agent code platforms over time."
    },
    {
      question: "Can humans use it?",
      answer: "Yes. Humans can search packages, inspect proof, install from the CLI and claim package drafts for their repos."
    },
    {
      question: "Can agents use it directly?",
      answer: "Yes. Agents can use the CLI, the MCP server and the machine readable discovery files."
    },
    {
      question: "Who owns packages?",
      answer: "The source owner does. Nipmod verifies claims and ranks trust. It does not take ownership of Gitlawb repos."
    },
    {
      question: "Can Nipmod delete Gitlawb packages?",
      answer:
        "No. Nipmod can publish trust ratings, warnings and advisories, but it cannot delete decentralized source content."
    },
    {
      question: "What can I do now?",
      answer: "Install the CLI, browse verified packages or check whether your Gitlawb repo has a package candidate."
    }
  ],
  startCards: [
    {
      title: "Install Nipmod",
      text: "Use the CLI to search, inspect, install and audit packages.",
      href: "/quickstart#install"
    },
    {
      title: "Claim a repo",
      text: "Turn a Gitlawb repo into a package path you control.",
      href: "/candidates"
    },
    {
      title: "Read agent docs",
      text: "Connect the CLI and MCP server to agent workflows.",
      href: "/agents"
    }
  ],
  quickstartSteps: [
    {
      label: "Install CLI",
      text: "Run the short installer. It installs Nipmod and sets up Gitlawb publish support when the helper is missing.",
      command: "curl -fsSLO https://nipmod.com/install.sh && bash install.sh"
    },
    {
      label: "Verify",
      text: "Use the checksum path when you want manual verification before execution.",
      command:
        "curl -fLO https://nipmod.com/install.sh\ncurl -fLO https://nipmod.com/install.sh.sha256\nshasum -a 256 -c install.sh.sha256\nbash install.sh"
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
      text: "A Gitlawb repo can be drafted, checked, verified and installed from one terminal path."
    },
    {
      label: "Public proof",
      text: "Manifest, advisory feed, transparency checkpoint, witness and release signature are public."
    },
    {
      label: "Agent setup",
      text: "Codex, Claude Code and OpenCode can use the read only MCP server."
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
      text: "Create a Gitlawb package draft and registry candidate without mutating Gitlawb.",
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
    headline: "Turn a Gitlawb repo into an agent package",
    lead: "Paste a public Gitlawb repo. Get a package draft, manifest, trust checklist and publish preflight.",
    inputLabel: "Gitlawb repo",
    inputPlaceholder: "gitlawb://did:key:z6Mk.../repo",
    outputTitle: "Draft output",
    outputCommand: "nipmod package pr gitlawb://did:key:z6Mk.../repo --dir repo-pr\nnipmod claim verify gitlawb://did:key:z6Mk.../repo --json\nnipmod publish repo-pr --dry-run --json",
    steps: [
      {
        label: "Paste",
        text: "Humans and agents start with a public Gitlawb repo URL or DID path."
      },
      {
        label: "Draft",
        text: "Nipmod creates a package manifest, permissions checklist and install preview."
      },
      {
        label: "Claim",
        text: "The repo owner signs the package with the repo DID before it can become verified."
      }
    ],
    claim: {
      label: "No account required",
      text: "Gitlawb uses DID signature ownership. Unclaimed drafts stay clearly marked as drafts."
    }
  }
} as const;
