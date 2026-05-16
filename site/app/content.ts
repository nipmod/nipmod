export const homeContent = {
  brand: "nipmod",
  headline: "Verifiable packages for agents",
  lead: "Built on Gitlawb. Used from terminal, Codex, or any agent runtime.",
  links: {
    install: "/quickstart#install",
    x: "https://x.com/Nipmod"
  },
  primaryAction: "Install",
  secondaryAction: "X",
  commands: [
    "curl -fL https://nipmod.com/install.sh -o install.sh",
    "curl -fL https://nipmod.com/install.sh.sha256 -o install.sh.sha256",
    "shasum -a 256 -c install.sh.sha256",
    "bash install.sh",
    "nipmod doctor",
    "nipmod package gitlawb://did:key:z6Mk.../repo --dir repo",
    "nipmod search skill --online",
    "nipmod add pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0 --online",
    "nipmod audit --online",
    "nipmod publish . --dry-run"
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
      text: "Fetch the installer and verify the checksum first.",
      command: "bash install.sh"
    },
    {
      label: "Check",
      text: "Confirm the CLI, Gitlawb helper, node and registry are reachable.",
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
      text: "Write the verified package into the workspace lockfile.",
      command: "nipmod add gitlawb-repo-reader --online"
    },
    {
      label: "Audit",
      text: "Verify the lockfile against current trust and advisory data.",
      command: "nipmod audit --online"
    },
    {
      label: "Publish",
      text: "Run the author preflight before any public write.",
      command: "nipmod publish . --dry-run"
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
      "We built nipmod, decentralized npm for Gitlawb agents. It turns Gitlawb repos into signed agent packages with digest, DID signature, release event, transparency and witness proof. Source and live installer are public.",
    dm:
      "Could you sanity check whether nipmod fits Gitlawb as a package layer for agents? Code, proof and the live CLI are public."
  },
  demoFlow: [
    {
      label: "Convert",
      text: "Create a package draft from a Gitlawb repo URL or DID path.",
      command: "nipmod package gitlawb://did:key:z6Mk.../repo --dir repo"
    },
    {
      label: "Preflight",
      text: "Validate manifest, permissions and the registry candidate before a public write.",
      command: "nipmod publish repo --dry-run --json"
    },
    {
      label: "Verify",
      text: "Inspect digest, signer, source commit, witness and transparency evidence.",
      command: "nipmod inspect repo --online"
    },
    {
      label: "Install",
      text: "Pin the verified package in the workspace lockfile.",
      command: "nipmod add repo --online"
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
