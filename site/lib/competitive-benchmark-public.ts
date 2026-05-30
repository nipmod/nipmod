export type CompetitiveBenchmarkTrack = {
  applicable: number;
  coveragePct: number;
  depthScore: number;
  latencyMs: number | null;
  name: string;
  note: string;
  pass: number;
  role: string;
  score: number;
  sourceCoveragePct: number;
  status: "pass" | "warn";
  warn: number;
};

export type CompetitiveBenchmarkCategory = {
  description: string;
  dimensions: string;
  key: string;
  rubric: string;
  tracks: Array<{
    name: string;
    score: number;
    sourceCoveragePct: number;
  }>;
  title: string;
};

export type CompetitiveBenchmarkCategoryWeight = {
  category: string;
  weights: Array<{
    dimension: string;
    weight: number;
  }>;
};

export type CompetitiveBenchmarkCase = {
  expected: string;
  id: string;
  reason: string;
  source: string;
  task: string;
};

export type CompetitiveBenchmarkRubric = {
  category: string;
  fullCredit: string;
  noCredit: string;
  partialCredit: string;
  whyItMatters: string;
};

export type CompetitiveBenchmarkScoreAccounting = {
  explanation: string;
  label: string;
  value: string;
};

export type CompetitiveBenchmarkMarketReference = {
  benchmarkBoundary: string;
  benchmarkRole: string;
  name: string;
  scaleContext: string;
  sourceLabel: string;
  sourceUrl: string;
};

export const competitiveBenchmarkReport = {
  categoryBreakdown: [
    {
      description: "Can the system resolve the right upstream object and return enough source context before an agent moves toward install?",
      dimensions: "search, identity, version, metadata, source depth, multi-source scope",
      key: "source-resolution",
      rubric: "Full credit requires a resolved source object with identity, version where applicable, useful metadata, source depth and broad source coverage. Advisory-only feeds receive credit only when they can identify the package/version they are asked about.",
      title: "Source resolution",
      tracks: [
        { name: "Nipmod", score: 96, sourceCoveragePct: 100 },
        { name: "Native registries", score: 49, sourceCoveragePct: 100 },
        { name: "deps.dev", score: 22, sourceCoveragePct: 50 },
        { name: "Socket", score: 22, sourceCoveragePct: 50 },
        { name: "OSV", score: 15, sourceCoveragePct: 50 },
        { name: "Raw agent", score: 13, sourceCoveragePct: 100 },
        { name: "OpenSSF Scorecard", score: 2, sourceCoveragePct: 13 },
        { name: "Snyk", score: 0, sourceCoveragePct: 50 }
      ]
    },
    {
      description: "Can the system return security evidence beyond a name match: advisories, provenance, repository posture and package behavior?",
      dimensions: "advisories, provenance, repository posture, package behavior",
      key: "security-evidence",
      rubric: "Full credit requires more than a known-vulnerability lookup: advisory context, provenance or source links, repository posture when relevant, and package-behavior signals. Vulnerability feeds get credit for advisory evidence even if they do not provide install-plan context.",
      title: "Security evidence",
      tracks: [
        { name: "Nipmod", score: 82, sourceCoveragePct: 100 },
        { name: "Socket", score: 31, sourceCoveragePct: 50 },
        { name: "deps.dev", score: 29, sourceCoveragePct: 50 },
        { name: "Native registries", score: 28, sourceCoveragePct: 100 },
        { name: "OSV", score: 15, sourceCoveragePct: 50 },
        { name: "OpenSSF Scorecard", score: 2, sourceCoveragePct: 13 },
        { name: "Raw agent", score: 0, sourceCoveragePct: 100 },
        { name: "Snyk", score: 0, sourceCoveragePct: 50 }
      ]
    },
    {
      description: "Can the system describe what would run, keep hosted checks read-only and expose the execution boundary before workspace writes?",
      dimensions: "install plan, read-only boundary, package behavior, prompt boundary",
      key: "execution-preflight",
      rubric: "Full credit requires a structured install plan, explicit hosted read-only behavior, and enough package-behavior context for an agent or host to review execution before workspace writes. Tools that only report metadata or advisories are shown as not designed for this layer, not as broken tools.",
      title: "Execution preflight",
      tracks: [
        { name: "Nipmod", score: 100, sourceCoveragePct: 100 },
        { name: "Socket", score: 7, sourceCoveragePct: 50 },
        { name: "Native registries", score: 4, sourceCoveragePct: 100 },
        { name: "Raw agent", score: 0, sourceCoveragePct: 100 },
        { name: "deps.dev", score: 0, sourceCoveragePct: 50 },
        { name: "OSV", score: 0, sourceCoveragePct: 50 },
        { name: "Snyk", score: 0, sourceCoveragePct: 50 },
        { name: "OpenSSF Scorecard", score: 0, sourceCoveragePct: 13 }
      ]
    },
    {
      description: "Can an agent consume the result as an action-ready decision object, not just a generic API response or human page?",
      dimensions: "agent decision JSON, install boundary, source evidence, machine output",
      key: "agent-readiness",
      rubric: "Full credit requires structured, action-ready output that combines source evidence, warnings, trust context and install boundary. Generic JSON earns limited credit because an agent would still need to assemble the preflight decision itself.",
      title: "Agent readiness",
      tracks: [
        { name: "Nipmod", score: 100, sourceCoveragePct: 100 },
        { name: "Native registries", score: 10, sourceCoveragePct: 100 },
        { name: "deps.dev", score: 5, sourceCoveragePct: 50 },
        { name: "OSV", score: 5, sourceCoveragePct: 50 },
        { name: "Socket", score: 5, sourceCoveragePct: 50 },
        { name: "Snyk", score: 2, sourceCoveragePct: 50 },
        { name: "OpenSSF Scorecard", score: 1, sourceCoveragePct: 13 },
        { name: "Raw agent", score: 0, sourceCoveragePct: 100 }
      ]
    }
  ] satisfies CompetitiveBenchmarkCategory[],
  categoryWeights: [
    {
      category: "Source resolution",
      weights: [
        { dimension: "source depth", weight: 22 },
        { dimension: "identity", weight: 18 },
        { dimension: "search", weight: 18 },
        { dimension: "multi-source coverage", weight: 16 },
        { dimension: "metadata", weight: 14 },
        { dimension: "version", weight: 12 }
      ]
    },
    {
      category: "Security evidence",
      weights: [
        { dimension: "advisory", weight: 24 },
        { dimension: "package behavior", weight: 24 },
        { dimension: "provenance", weight: 20 },
        { dimension: "repository posture", weight: 18 },
        { dimension: "metadata", weight: 8 },
        { dimension: "version", weight: 6 }
      ]
    },
    {
      category: "Execution preflight",
      weights: [
        { dimension: "install plan", weight: 32 },
        { dimension: "read-only boundary", weight: 28 },
        { dimension: "prompt boundary", weight: 18 },
        { dimension: "package behavior", weight: 14 },
        { dimension: "agent JSON", weight: 8 }
      ]
    },
    {
      category: "Agent readiness",
      weights: [
        { dimension: "agent JSON", weight: 34 },
        { dimension: "install plan", weight: 22 },
        { dimension: "prompt boundary", weight: 14 },
        { dimension: "read-only boundary", weight: 12 },
        { dimension: "source depth", weight: 8 },
        { dimension: "machine-readable output", weight: 6 },
        { dimension: "identity", weight: 4 }
      ]
    }
  ] satisfies CompetitiveBenchmarkCategoryWeight[],
  checkedAt: "2026-05-29T12:39:59.575Z",
  command: "pnpm benchmark:competitive",
  marketContext: [
    {
      benchmarkBoundary: "Measured through Nipmod's live search, inspect and install-plan API. Nipmod owns the benchmark and is therefore treated with explicit claim limits.",
      benchmarkRole: "Agent package intelligence layer",
      name: "Nipmod",
      scaleContext: "Live beta product. No valuation claim.",
      sourceLabel: "Nipmod benchmark methodology",
      sourceUrl: "https://github.com/nipmod/nipmod/blob/main/docs/competitive-benchmark.md"
    },
    {
      benchmarkBoundary: "Measured through public npm, PyPI, GitHub, Hugging Face and MCP metadata endpoints. They are source-of-truth registries, not install-plan layers.",
      benchmarkRole: "Upstream source metadata baseline",
      name: "Native registries",
      scaleContext: "Official package/model/repository sources.",
      sourceLabel: "Benchmark source list",
      sourceUrl: "https://nipmod.com/benchmark.json"
    },
    {
      benchmarkBoundary: "Measured as a vulnerability lookup feed for package/version cases. It is not expected to return an agent install plan.",
      benchmarkRole: "Open vulnerability database and API",
      name: "OSV",
      scaleContext: "Open source vulnerability infrastructure backed by the OSV ecosystem.",
      sourceLabel: "OSV API docs",
      sourceUrl: "https://google.github.io/osv.dev/api/"
    },
    {
      benchmarkBoundary: "Measured as package metadata, dependency, license, advisory and provenance context where the API supports the ecosystem.",
      benchmarkRole: "Package metadata and advisory evidence",
      name: "deps.dev",
      scaleContext: "Open Source Insights data service developed by Google.",
      sourceLabel: "deps.dev API docs",
      sourceUrl: "https://docs.deps.dev/api/v3/"
    },
    {
      benchmarkBoundary: "Measured through authenticated PURL package lookup. The benchmark does not test Socket Firewall, CLI, GitHub app, browser extension or paid enterprise workflows.",
      benchmarkRole: "Supply-chain package evidence",
      name: "Socket",
      scaleContext: "Commercial supply-chain security product. Company size is not a scoring input.",
      sourceLabel: "Socket API docs",
      sourceUrl: "https://docs.socket.dev/reference/batchpackagefetchbyorg"
    },
    {
      benchmarkBoundary: "Measured through authenticated REST package API access. The benchmark does not test Snyk CLI, SCM imports, full platform project scanning, IaC, container or code analysis.",
      benchmarkRole: "Developer security and package health evidence",
      name: "Snyk",
      scaleContext: "Commercial developer security product. Company size is not a scoring input.",
      sourceLabel: "Snyk API docs",
      sourceUrl: "https://docs.snyk.io/snyk-api/reference/package"
    },
    {
      benchmarkBoundary: "Measured only for the GitHub repository posture case. It is not expected to search npm, PyPI, Hugging Face or MCP.",
      benchmarkRole: "Repository security posture baseline",
      name: "OpenSSF Scorecard",
      scaleContext: "OpenSSF project for automated open source repository security posture scoring.",
      sourceLabel: "OpenSSF Scorecard",
      sourceUrl: "https://openssf.org/scorecard/"
    },
    {
      benchmarkBoundary: "Measured as the control path where an agent has no independent package intelligence layer before moving toward installation or reuse.",
      benchmarkRole: "No independent package intelligence layer",
      name: "Raw agent",
      scaleContext: "Control baseline. No company or product valuation.",
      sourceLabel: "Benchmark methodology",
      sourceUrl: "https://github.com/nipmod/nipmod/blob/main/docs/competitive-benchmark.md"
    }
  ] satisfies CompetitiveBenchmarkMarketReference[],
  excludedComparisons: [
    {
      name: "Dependabot and Renovate",
      reason: "They operate mainly on existing repositories, manifests and update pull requests. They belong in a project-maintenance benchmark, not this hosted preflight API benchmark."
    },
    {
      name: "npm audit and pip-audit",
      reason: "They analyze dependency trees or package advisories from a local project or manifest context. This benchmark does not install packages or inspect a user workspace."
    },
    {
      name: "Snyk CLI and SCM integrations",
      reason: "They can be stronger than Snyk API-only checks for project snapshots, but they require local code, manifests or repository integration. This run intentionally measures hosted read-only API preflight only."
    },
    {
      name: "Install firewalls and sandbox execution systems",
      reason: "They operate at runtime or install interception. Nipmod's hosted API is deliberately before that boundary and does not execute or unpack artifacts."
    }
  ],
  fairnessControls: [
    "The benchmark has one narrow question: what evidence is available before an agent moves toward external code execution.",
    "Tracks are described by role, so OSV, deps.dev, Socket, Snyk, OpenSSF Scorecard and native registries are not presented as failed versions of Nipmod.",
    "The headline score is coverage-adjusted across all cases, while applicable depth remains visible for specialized feeds.",
    "Token, rate-limit and plan limitations are marked as limitations in the snapshot instead of being hidden.",
    "No package install, clone, artifact unpacking, model execution, paid inference call or workspace write is performed.",
    "Machine-readable summary JSON is published so the public page can be checked against the public snapshot."
  ],
  limitations: [
    "The benchmark has 8 public cases across all six Nipmod source surfaces. It is a focused preflight benchmark, not a full registry-wide or malware-corpus evaluation.",
    "Weights are authored by Nipmod and should be reviewed by outside maintainers before being treated as independent proof.",
    "Socket and Snyk API tracks were limited by the token, plan or rate limits available in this run; direct claims against those products should not be made from this snapshot.",
    "Local project scanners, CLI tools, SCM integrations and install-time firewalls are excluded because they require manifests, repositories, local code or runtime interception.",
    "The hosted API does not execute code, unpack artifacts or clone repositories, so this benchmark does not measure sandbox malware detection.",
    "A high score means stronger preflight evidence at this boundary. It is not a guarantee that a package, model, repository or MCP server is safe."
  ],
  claimBoundary: [
    "This is an agent package-decision benchmark, not a malware-free guarantee.",
    "Nipmod is measured at the pre-install moment: search, inspect, evidence, warnings and install-plan output.",
    "OSV, deps.dev, Socket, Snyk, OpenSSF Scorecard and native registries are measured by the dimensions they actually expose.",
    "The headline score is coverage-adjusted across all benchmark cases; specialized evidence feeds keep their own applicable depth score.",
    "No package install, repository clone, artifact unpacking, model execution or workspace write is performed."
  ],
  scoreAccounting: [
    {
      explanation: "The case list is fixed for the public snapshot so the page is not cherry-picking a different sample after seeing a result.",
      label: "Case set",
      value: "8 source cases"
    },
    {
      explanation: "Each provider/case observation records concrete dimensions such as identity, version, metadata, advisory, provenance, repository posture, package behavior, install plan, read-only boundary and agent JSON.",
      label: "Observation unit",
      value: "provider x case x dimension"
    },
    {
      explanation: "pass rows keep their computed score, warn rows are discounted, fail and skip rows score zero in the coverage-adjusted headline.",
      label: "Status treatment",
      value: "pass full, warn discounted, fail/skip zero"
    },
    {
      explanation: "Each category has explicit weights. Category scores are averaged across all 8 cases, so narrow evidence feeds keep their applicable depth visible but do not receive full-source coverage credit.",
      label: "Category score",
      value: "weighted dimensions across all cases"
    },
    {
      explanation: "The public score is the average of source resolution, security evidence, execution preflight and agent readiness. This is why the page is called an agent preflight benchmark, not a universal security ranking.",
      label: "Headline score",
      value: "mean of 4 public categories"
    }
  ] satisfies CompetitiveBenchmarkScoreAccounting[],
  cases: [
    {
      expected: "zod@3.25.76",
      id: "npm-schema-zod",
      reason: "Common npm selection task where an agent asks for a TypeScript schema validation package.",
      source: "npm",
      task: "TypeScript schema validation"
    },
    {
      expected: "lodash@4.17.20",
      id: "npm-vulnerable-lodash",
      reason: "Known vulnerable package/version case to verify advisory context, not just popularity or name resolution.",
      source: "npm",
      task: "Known vulnerable npm package"
    },
    {
      expected: "requests@2.32.5",
      id: "pypi-http-requests",
      reason: "Common PyPI selection task where an agent asks for a Python HTTP client.",
      source: "PyPI",
      task: "Python HTTP client"
    },
    {
      expected: "pydantic@2.11.0",
      id: "pypi-schema-pydantic",
      reason: "PyPI schema-validation task to test source normalization across ecosystems.",
      source: "PyPI",
      task: "Python schema validation"
    },
    {
      expected: "sentence-transformers/all-MiniLM-L6-v2",
      id: "hf-embedding-model",
      reason: "Model reuse case where package-style safety needs file shape, license, card and model metadata.",
      source: "Hugging Face model",
      task: "Embedding model"
    },
    {
      expected: "rajpurkar/squad",
      id: "hf-dataset-squad",
      reason: "Dataset reuse case where package-style safety needs dataset metadata and file-shape context.",
      source: "Hugging Face dataset",
      task: "Question answering dataset"
    },
    {
      expected: "ac.tandem/docs-mcp",
      id: "mcp-docs-server",
      reason: "MCP server discovery case where agents need tool metadata, repository links and install/use boundaries.",
      source: "MCP",
      task: "MCP docs server"
    },
    {
      expected: "vercel/next.js",
      id: "github-nextjs",
      reason: "Repository posture case where an agent may reuse a GitHub project rather than install a registry package.",
      source: "GitHub",
      task: "GitHub repository security posture"
    }
  ] satisfies CompetitiveBenchmarkCase[],
  headline: {
    installPlanEvidence: "8/8",
    liveChecks: "8/8",
    medianLatencyMs: 3059,
    score: 95
  },
  publishableClaims: [
    "In this authored 8-case preflight snapshot, Nipmod returned live source evidence and read-only install-plan output for 8/8 cases; the 95/100 score is a rubric view of that narrow boundary.",
    "Nipmod completed 8/8 live source cases and returned 8/8 read-only install-plan evidence with 3059 ms median latency in this snapshot.",
    "Socket was authenticated and returned package-depth evidence in 4/4 applicable package checks.",
    "Snyk authentication worked, but package-health depth was unavailable on the current token or plan; do not use this snapshot for a direct Snyk depth claim."
  ],
  reviewerAssessment: {
    academicGrade: "not sufficient as an academic security benchmark",
    productGrade: "usable as a public product benchmark with explicit scope and limits",
    reason: "The case set is intentionally small and maintained by Nipmod, so it should not be sold as independent proof. It is useful for one scoped product question: whether a hosted API returns action-ready agent preflight evidence without writing to a workspace."
  },
  unsafeClaims: [
    "Nipmod is safer than every competitor.",
    "Nipmod guarantees package safety.",
    "Nipmod replaces OSV, deps.dev, Socket, Snyk, OpenSSF Scorecard or native registries.",
    "Socket or Snyk were beaten on their full paid/local products in this snapshot."
  ],
  rubric: [
    {
      category: "Source resolution",
      fullCredit: "Correct source object, package/repo/model/server identity, version where applicable, useful metadata and source depth.",
      noCredit: "No source lookup for the case or only a generic page/result unrelated to the expected object.",
      partialCredit: "Can identify a package/version in one ecosystem but does not cover the rest of the agent source set.",
      whyItMatters: "An agent cannot evaluate safety if it has not resolved the exact upstream object it might use."
    },
    {
      category: "Security evidence",
      fullCredit: "Advisories, provenance/source links, repository posture and package-behavior signals when relevant.",
      noCredit: "No useful security, provenance or posture evidence for the decision.",
      partialCredit: "One evidence type only, such as vulnerability lookup without install or behavior context.",
      whyItMatters: "Agents need evidence they can show before approval, not only package popularity."
    },
    {
      category: "Execution preflight",
      fullCredit: "Structured install plan, read-only hosted boundary, package behavior and prompt/tool boundary context.",
      noCredit: "No description of what would run or whether hosted checks can write/execute.",
      partialCredit: "Some package behavior or metadata, but no complete install-plan boundary.",
      whyItMatters: "The dangerous transition is moving from recommendation to execution."
    },
    {
      category: "Agent readiness",
      fullCredit: "Action-ready JSON that combines source evidence, warnings, trust context and install boundary.",
      noCredit: "Human-only output or no independent package-intelligence layer.",
      partialCredit: "Machine-readable API output that still leaves the agent to assemble the decision itself.",
      whyItMatters: "Agents need structured decisions, not documents they must scrape."
    }
  ] satisfies CompetitiveBenchmarkRubric[],
  tracks: [
    {
      applicable: 8,
      coveragePct: 100,
      depthScore: 93,
      latencyMs: 3059,
      name: "Nipmod",
      note: "Search, inspect, source evidence, warnings, read-only install-plan output and agent JSON.",
      pass: 8,
      role: "Agent preflight layer",
      score: 95,
      sourceCoveragePct: 100,
      status: "pass",
      warn: 0
    },
    {
      applicable: 4,
      coveragePct: 100,
      depthScore: 37,
      latencyMs: 109,
      name: "deps.dev",
      note: "Package metadata, licenses, advisory and provenance context for supported ecosystems.",
      pass: 4,
      role: "Package metadata and advisory evidence",
      score: 14,
      sourceCoveragePct: 50,
      status: "pass",
      warn: 0
    },
    {
      applicable: 8,
      coveragePct: 100,
      depthScore: 29,
      latencyMs: 406,
      name: "Native registries",
      note: "Source-of-truth metadata from npm, PyPI, GitHub, Hugging Face and MCP.",
      pass: 8,
      role: "Upstream source metadata",
      score: 23,
      sourceCoveragePct: 100,
      status: "pass",
      warn: 0
    },
    {
      applicable: 4,
      coveragePct: 100,
      depthScore: 25,
      latencyMs: 444,
      name: "OSV",
      note: "Vulnerability lookup for package and version pairs.",
      pass: 4,
      role: "Vulnerability evidence feed",
      score: 9,
      sourceCoveragePct: 50,
      status: "pass",
      warn: 0
    },
    {
      applicable: 1,
      coveragePct: 100,
      depthScore: 18,
      latencyMs: 233,
      name: "OpenSSF Scorecard",
      note: "Repository posture for GitHub projects. It is not a package install-plan layer.",
      pass: 1,
      role: "Repository posture baseline",
      score: 1,
      sourceCoveragePct: 13,
      status: "pass",
      warn: 0
    },
    {
      applicable: 4,
      coveragePct: 100,
      depthScore: 38,
      latencyMs: 513,
      name: "Socket",
      note: "Authenticated PURL lookup returned package-depth evidence for 4/4 applicable package checks.",
      pass: 4,
      role: "Supply-chain package evidence",
      score: 16,
      sourceCoveragePct: 50,
      status: "pass",
      warn: 0
    },
    {
      applicable: 4,
      coveragePct: 0,
      depthScore: 4,
      latencyMs: 288,
      name: "Snyk",
      note: "Authentication worked, but package-health depth was unavailable on the current token or plan.",
      pass: 0,
      role: "Package health and security evidence",
      score: 1,
      sourceCoveragePct: 50,
      status: "warn",
      warn: 4
    },
    {
      applicable: 8,
      coveragePct: 0,
      depthScore: 4,
      latencyMs: null,
      name: "Raw agent",
      note: "Baseline for direct install or pull behavior without a package intelligence layer.",
      pass: 0,
      role: "No independent package intelligence layer",
      score: 3,
      sourceCoveragePct: 100,
      status: "warn",
      warn: 8
    }
  ] satisfies CompetitiveBenchmarkTrack[],
  type: "dev.nipmod.competitive-benchmark-public.v1"
};
