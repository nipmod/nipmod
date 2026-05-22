export const homeContent = {
  brand: "Nipmod",
  headline: "One package API for agents.",
  lead: "Tell your agent what you need. The agent calls Nipmod for package options, trust context and a safe install plan.",
  links: {
    api: "/api-access",
    bankrCoin: "https://token.nipmod.com",
    docs: "/quickstart#docs",
    github: "https://github.com/nipmod/nipmod",
    gitlawbProfile: "https://gitlawb.com/z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R",
    gitlawbSource: "https://gitlawb.com/node/repos/z6Mkwbud/nipmod",
    install: "/api-access",
    sources: "/sources",
    telegram: "https://t.me/nipmod",
    x: "https://x.com/Nipmod"
  },
  primaryAction: "Get API access",
  secondaryAction: "X",
  commands: ["curl 'https://nipmod.com/api/resolve?q=package%20for%20http%20requests&limit=3'"],
  terminalOutput: [
    "Searching npm, PyPI, GitHub, Hugging Face and MCP",
    "Returning source records, trust signals and install plans",
    "Public beta is free with rate limits",
    "No workspace write happens from the hosted API"
  ],
  usage: [
    {
      label: "Resolve",
      text: "Search package sources through one hosted API."
    },
    {
      label: "Check",
      text: "Return source, license, repository, trust signals and warnings."
    },
    {
      label: "Plan",
      text: "Give agents the install command only as a plan that still needs approval."
    }
  ],
  platformRoadmap: {
    headline: "Source coverage",
    lead:
      "Agents do not need a native integration per platform. They call the API and get package intelligence back.",
    note: "External packages remain owned by their original source. Nipmod adds search, trust context and install plans.",
    items: [
      {
        name: "npm",
        status: "Live",
        label: "package registry",
        text: "JavaScript packages.",
        href: "/sources",
        cta: "View source"
      },
      {
        name: "PyPI",
        status: "Live",
        label: "package registry",
        text: "Python packages.",
        href: "/sources",
        cta: "View source"
      },
      {
        name: "GitHub",
        status: "Live",
        label: "source repo",
        text: "Source repositories.",
        href: "/sources",
        cta: "View source"
      },
      {
        name: "Hugging Face",
        status: "Live",
        label: "model and dataset hub",
        text: "models and datasets.",
        href: "/sources",
        cta: "View source"
      },
      {
        name: "MCP",
        status: "Live",
        label: "tool registry",
        text: "Tool servers.",
        href: "/sources",
        cta: "View source"
      },
      {
        name: "Nipmod archive",
        status: "Live",
        label: "confirmed records",
        text: "Confirmed records.",
        href: "/packages",
        cta: "Open archive"
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
      title: "Use the API",
      text: "Let your agent search, inspect and plan before install.",
      href: "/api-access"
    },
    {
      title: "View sources",
      text: "See the public sources Nipmod can resolve.",
      href: "/sources"
    },
    {
      title: "Read status",
      text: "Check archive mode, public endpoints and readiness receipts.",
      href: "/status"
    }
  ],
  quickstartSteps: [
    {
      label: "Search API",
      text: "Search sources through Nipmod.",
      command: "curl 'https://nipmod.com/api/resolve?q=package%20for%20http%20requests&sources=npm,pypi,github,huggingface-model,mcp&limit=5'"
    },
    {
      label: "Inspect API",
      text: "Inspect an exact source package.",
      command: "curl 'https://nipmod.com/api/inspect?source=npm&name=undici'"
    },
    {
      label: "Install plan API",
      text: "Ask for the safe plan before any workspace write.",
      command: "curl 'https://nipmod.com/api/install-plan?source=npm&name=undici'"
    },
    {
      label: "Prepare archive",
      text: "Create a record that can be stored after useful confirmed use.",
      command: "curl 'https://nipmod.com/api/archive/prepare?source=npm&name=undici'"
    },
    {
      label: "Archive status",
      text: "Check whether durable archive writes are enabled.",
      command: "curl 'https://nipmod.com/api/archive/status'"
    },
    {
      label: "Local CLI",
      text: "Install only when a workspace needs local writes.",
      command: "curl https://nipmod.com/i|bash"
    },
    {
      label: "Inspect",
      text: "Read digest, signer, source, witness and permissions.",
      command: "nipmod inspect <package-specifier> --json"
    },
    {
      label: "Plan install",
      text: "Preview the verified dependency graph before the lockfile changes.",
      command: "nipmod install --plan <package-specifier> --json"
    },
    {
      label: "Install package",
      text: "Create a demo workspace first so the first lockfile mutation is isolated.",
      command: "mkdir -p nipmod-demo\ncd nipmod-demo\nnipmod install <package-specifier>"
    },
    {
      label: "Add alias",
      text: "Use add only when you want the short alias for install.",
      command: "nipmod add <package-specifier> --online"
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
      command: "nipmod explain <package-name> --json"
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
      text: "Manifest, advisory feed, release signature and verification rules are public."
    },
    {
      label: "API access",
      text: "Any agent or app can use the hosted API for search, inspect and install plans without a native integration."
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
      command: "nipmod search <query> --online"
    },
    {
      label: "Inspect",
      text: "Read digest, signer, source, witness and transparency evidence.",
      command: "nipmod inspect <package-specifier> --json"
    },
    {
      label: "Install",
      text: "Pin the verified package in the workspace lockfile.",
      command: "nipmod install <package-specifier>"
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
  ecosystemPackages: [] as Array<{ command: string; name: string; text: string }>,
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
