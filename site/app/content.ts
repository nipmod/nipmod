export const homeContent = {
  brand: "nipmod",
  headline: "Verifiable packages for agents",
  lead: "Built on Gitlawb. Used from terminal, Codex, or any agent runtime.",
  links: {
    install: "/quickstart#install",
    x: "https://x.com/Nipmod"
  },
  primaryAction: "Install",
  secondaryAction: "Updates on X",
  commands: [
    "curl -fsSLO https://nipmod.com/install.sh && bash install.sh",
    "nipmod doctor --online",
    "mkdir -p nipmod-demo && cd nipmod-demo",
    "nipmod inspect pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0 --online",
    "nipmod add gitlawb-repo-reader --online",
    "nipmod install",
    "nipmod sbom --json",
    "nipmod audit --online"
  ],
  usage: [
    {
      label: "Terminal",
      text: "Install and pin packages."
    },
    {
      label: "Website",
      text: "Find packages and inspect trust."
    },
    {
      label: "Codex",
      text: "Run nipmod inside a workspace."
    }
  ],
  quickstartSteps: [
    {
      label: "Install",
      text: "Run the short installer.",
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
      label: "Find",
      text: "Search the public registry for a useful agent package.",
      command: "nipmod search gitlawb --online"
    },
    {
      label: "Inspect",
      text: "Read the digest, signer, source, witness and permissions.",
      command: "nipmod inspect pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0 --online"
    },
    {
      label: "Add",
      text: "Create a demo workspace first so the first lockfile mutation is isolated.",
      command: "mkdir -p nipmod-demo\ncd nipmod-demo\nnipmod add gitlawb-repo-reader --online"
    },
    {
      label: "Restore",
      text: "Restore the local store from the lockfile or confirm it is current.",
      command: "nipmod install"
    },
    {
      label: "SBOM",
      text: "Export the lockfile, permissions and dependency graph for agents.",
      command: "nipmod sbom --json"
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
        "nipmod init --name gitlawb-demo-package --dir gitlawb-demo-package\nnipmod publish gitlawb-demo-package --dry-run"
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
      text: "MCP, APM and source provenance receipts let existing agent formats map into nipmod proof."
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
      text: "Signed advisories and quarantine metadata can block install surfaces without owning publishing rights."
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
      "Gitlawb gives agents decentralized source. nipmod adds the package layer: signed bundles, DID publisher identity, digest pinned installs, release evidence, transparency proof, witness proof and advisory aware audit. Public demo: https://nipmod.com/launch Source: https://gitlawb.com/z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R/nipmod",
    dm:
      "We built nipmod as a package layer for Gitlawb agents. It does not control Gitlawb publishing; it verifies signed packages over Gitlawb content so agents can inspect, add, lock and audit before trusting code. Could you sanity check whether this model fits Gitlawb's direction?"
  },
  demoFlow: [
    {
      label: "Find",
      text: "Search the public registry without a nipmod account.",
      command: "nipmod search gitlawb --online"
    },
    {
      label: "Inspect",
      text: "Read digest, signer, source, witness and transparency evidence.",
      command: "nipmod inspect pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0 --online"
    },
    {
      label: "Add",
      text: "Pin the verified package in the workspace lockfile.",
      command: "nipmod add gitlawb-repo-reader --online"
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
      command: "nipmod add gitlawb-repo-reader --online"
    },
    {
      name: "gitlawb-release-review",
      text: "Review immutable tags, signed release events and registry readiness.",
      command: "nipmod add gitlawb-release-review --online"
    },
    {
      name: "repo-readme-audit",
      text: "Audit repository README content for package clarity and untrusted instruction risk.",
      command: "nipmod add repo-readme-audit --online"
    },
    {
      name: "dependency-risk-review",
      text: "Review dependency manifests, permissions and lockfiles before install.",
      command: "nipmod add dependency-risk-review --online"
    },
    {
      name: "prompt-injection-scan",
      text: "Scan package text and prompts for instruction injection risk.",
      command: "nipmod add prompt-injection-scan --online"
    },
    {
      name: "strict-ci-policy",
      text: "Run strict install policy gates for automated agent workspaces.",
      command: "nipmod add strict-ci-policy --online"
    },
    {
      name: "developer-default-policy",
      text: "Apply a practical default policy for trying packages safely before production use.",
      command: "nipmod add developer-default-policy --online"
    },
    {
      name: "nipmod-audit-ci",
      text: "Turn audit and policy output into CI decisions agents can explain and enforce.",
      command: "nipmod add nipmod-audit-ci --online"
    },
    {
      name: "github-issue-triage",
      text: "Triage GitHub issues from untrusted issue text without package permissions.",
      command: "nipmod add github-issue-triage --online"
    },
    {
      name: "mcp-server-import-example",
      text: "Map MCP server metadata into nipmod compatibility receipts.",
      command: "nipmod add mcp-server-import-example --online"
    },
    {
      name: "apm-import-example",
      text: "Map an APM package listing into nipmod trust metadata.",
      command: "nipmod add apm-import-example --online"
    },
    {
      name: "malicious-skill-fixtures",
      text: "Provide safe negative test fixtures for scanners and policy reviewers.",
      command: "nipmod add malicious-skill-fixtures --online"
    },
    {
      name: "gitlawb-diff-summarizer",
      text: "Summarize Gitlawb repository diffs with provenance, risk and next action clarity.",
      command: "nipmod add gitlawb-diff-summarizer --online"
    },
    {
      name: "release-notes-drafter",
      text: "Draft release notes from verified package, Gitlawb tag and changelog evidence.",
      command: "nipmod add release-notes-drafter --online"
    },
    {
      name: "security-advisory-triage",
      text: "Triage package security reports into advisory, quarantine and user action decisions.",
      command: "nipmod add security-advisory-triage --online"
    },
    {
      name: "agent-permission-review",
      text: "Review agent package permissions for least privilege before install or publish.",
      command: "nipmod add agent-permission-review --online"
    },
    {
      name: "mcp-tool-risk-review",
      text: "Review MCP server tools and manifests before agents expose them to package workflows.",
      command: "nipmod add mcp-tool-risk-review --online"
    },
    {
      name: "package-onboarding-checklist",
      text: "Guide new package authors through a clean nipmod publish candidate.",
      command: "nipmod add package-onboarding-checklist --online"
    },
    {
      name: "registry-mirror-compare",
      text: "Compare registry mirrors and fail closed on digest, root, witness or advisory drift.",
      command: "nipmod add registry-mirror-compare --online"
    },
    {
      name: "package-evidence-brief",
      text: "Turn package proof into a short human review brief.",
      command: "nipmod add package-evidence-brief --online"
    },
    {
      name: "agent-runtime-compat-check",
      text: "Check whether an agent host is ready for install, audit and MCP flows.",
      command: "nipmod add agent-runtime-compat-check --online"
    },
    {
      name: "external-review-packet",
      text: "Prepare an external reviewer handoff from proof and gate output.",
      command: "nipmod add external-review-packet --online"
    },
    {
      name: "first-user-onboarding",
      text: "Guide a new user through install, inspect, add, audit and publish dry run.",
      command: "nipmod add first-user-onboarding --online"
    },
    {
      name: "package-migration-planner",
      text: "Plan a Gitlawb, MCP or APM source migration into a package candidate.",
      command: "nipmod add package-migration-planner --online"
    },
    {
      name: "readonly-registry-mcp-server",
      text: "Expose read only registry search and inspect tools through MCP.",
      command: "nipmod add readonly-registry-mcp-server --online"
    },
    {
      name: "launch-strict-policy-pack",
      text: "Apply launch strict install policy for verified agent packages.",
      command: "nipmod add launch-strict-policy-pack --online"
    },
    {
      name: "package-safety-eval-pack",
      text: "Evaluate scanners against unsafe agent package fixtures.",
      command: "nipmod add package-safety-eval-pack --online"
    },
    {
      name: "gitlawb-review-tool-bundle",
      text: "Bundle Gitlawb repo review, diff summary and release review guidance.",
      command: "nipmod add gitlawb-review-tool-bundle --online"
    }
  ],
  repoToPackage: {
    headline: "Turn a Gitlawb repo into an agent package",
    lead: "Paste a public Gitlawb repo. Get a package draft, manifest, trust checklist and publish preflight.",
    inputLabel: "Gitlawb repo",
    inputPlaceholder: "gitlawb://did:key:z6Mk.../repo",
    outputTitle: "Draft output",
    outputCommand: "nipmod package gitlawb://did:key:z6Mk.../repo --dir repo\nnipmod manifest validate --dir repo\nnipmod publish repo --dry-run",
    steps: [
      {
        label: "Paste",
        text: "Humans and agents start with a public Gitlawb repo URL or DID path."
      },
      {
        label: "Draft",
        text: "nipmod creates a package manifest, permissions checklist and install preview."
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
