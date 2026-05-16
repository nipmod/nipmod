export const homeContent = {
  brand: "nipmod",
  headline: "Verifiable packages for agents",
  lead: "Built on Gitlawb. Used from terminal, Codex, or any agent runtime.",
  links: {
    install: "/install.sh",
    x: "https://x.com/nipmod"
  },
  primaryAction: "Install",
  secondaryAction: "X",
  commands: [
    "curl -fL https://nipmod.com/install.sh -o install.sh",
    "curl -fL https://nipmod.com/install.sh.sha256 -o install.sh.sha256",
    "shasum -a 256 -c install.sh.sha256",
    "bash install.sh",
    "nipmod doctor",
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
  repoToPackage: {
    headline: "Turn a Gitlawb repo into an agent package",
    lead: "Paste a public Gitlawb repo. Get a package draft, manifest, trust checklist and publish preflight.",
    inputLabel: "Gitlawb repo",
    inputPlaceholder: "gitlawb://did:key:z6Mk.../repo",
    outputTitle: "Draft output",
    outputCommand: "nipmod init --name repo --dir repo\nnipmod manifest validate --dir repo\nnipmod publish repo --dry-run",
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
