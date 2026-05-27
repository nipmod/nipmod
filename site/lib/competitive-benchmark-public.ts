export type CompetitiveBenchmarkTrack = {
  applicable: number;
  coveragePct: number;
  latencyMs: number | null;
  name: string;
  note: string;
  pass: number;
  score: number;
  status: "pass" | "warn";
  warn: number;
};

export type CompetitiveBenchmarkCategory = {
  description: string;
  dimensions: string;
  key: string;
  tracks: Array<{
    name: string;
    score: number;
  }>;
  title: string;
};

export const competitiveBenchmarkReport = {
  categoryBreakdown: [
    {
      description: "Can the system identify the right package, source, version and source depth before an agent moves toward install?",
      dimensions: "search, identity, version, metadata, source depth, multi-source coverage",
      key: "source-discovery",
      title: "Source discovery",
      tracks: [
        { name: "Nipmod", score: 96 },
        { name: "Native registries", score: 52 },
        { name: "deps.dev", score: 47 },
        { name: "Socket", score: 47 },
        { name: "OSV", score: 30 },
        { name: "OpenSSF Scorecard", score: 17 },
        { name: "Raw agent", score: 12 },
        { name: "Snyk", score: 0 }
      ]
    },
    {
      description: "Can the system return vulnerability, provenance and repository posture context for the package decision?",
      dimensions: "advisories, provenance, repository posture",
      key: "advisory-provenance",
      title: "Advisory and provenance",
      tracks: [
        { name: "Nipmod", score: 71 },
        { name: "deps.dev", score: 71 },
        { name: "OSV", score: 43 },
        { name: "Socket", score: 43 },
        { name: "OpenSSF Scorecard", score: 29 },
        { name: "Native registries", score: 16 },
        { name: "Snyk", score: 0 },
        { name: "Raw agent", score: 0 }
      ]
    },
    {
      description: "Can the system describe what would run and keep the hosted API outside the workspace execution boundary?",
      dimensions: "package behavior, prompt boundary, install plan, read-only boundary",
      key: "install-boundary",
      title: "Install boundary",
      tracks: [
        { name: "Nipmod", score: 100 },
        { name: "Socket", score: 23 },
        { name: "Native registries", score: 3 },
        { name: "deps.dev", score: 0 },
        { name: "OSV", score: 0 },
        { name: "OpenSSF Scorecard", score: 0 },
        { name: "Snyk", score: 0 },
        { name: "Raw agent", score: 0 }
      ]
    },
    {
      description: "Can an agent consume the result as structured machine output instead of scraping a human page?",
      dimensions: "machine-readable output, agent JSON",
      key: "agent-output",
      title: "Agent output",
      tracks: [
        { name: "Nipmod", score: 100 },
        { name: "deps.dev", score: 47 },
        { name: "Native registries", score: 47 },
        { name: "OSV", score: 47 },
        { name: "OpenSSF Scorecard", score: 47 },
        { name: "Socket", score: 47 },
        { name: "Snyk", score: 33 },
        { name: "Raw agent", score: 0 }
      ]
    }
  ] satisfies CompetitiveBenchmarkCategory[],
  checkedAt: "2026-05-27T12:30:18.295Z",
  command: "pnpm benchmark:competitive",
  claimBoundary: [
    "This is an agent package-decision benchmark, not a malware-free guarantee.",
    "Nipmod is measured at the pre-install moment: search, inspect, evidence, warnings and install-plan output.",
    "OSV, deps.dev, Socket, Snyk, OpenSSF Scorecard and native registries are measured by the dimensions they actually expose.",
    "No package install, repository clone, artifact unpacking, model execution or workspace write is performed."
  ],
  headline: {
    installPlanEvidence: "7/7",
    liveChecks: "7/7",
    medianLatencyMs: 2312,
    score: 89
  },
  publishableClaims: [
    "Nipmod score: 89/100 across the current production agent-preflight benchmark.",
    "Nipmod completed 7/7 live source cases and returned 7/7 read-only install-plan evidence.",
    "Next measured track score: Socket at 37/100. Current score gap: +52."
  ],
  tracks: [
    {
      applicable: 7,
      coveragePct: 100,
      latencyMs: 2312,
      name: "Nipmod",
      note: "Search, inspect, source evidence, warnings, read-only install-plan output and agent JSON.",
      pass: 7,
      score: 89,
      status: "pass",
      warn: 0
    },
    {
      applicable: 4,
      coveragePct: 100,
      latencyMs: 46,
      name: "deps.dev",
      note: "Package metadata, licenses, advisory and provenance context for supported ecosystems.",
      pass: 4,
      score: 35,
      status: "pass",
      warn: 0
    },
    {
      applicable: 7,
      coveragePct: 100,
      latencyMs: 289,
      name: "Native registries",
      note: "Source-of-truth metadata from npm, PyPI, GitHub, Hugging Face and MCP.",
      pass: 7,
      score: 27,
      status: "pass",
      warn: 0
    },
    {
      applicable: 4,
      coveragePct: 100,
      latencyMs: 364,
      name: "OSV",
      note: "Vulnerability lookup for package and version pairs.",
      pass: 4,
      score: 24,
      status: "pass",
      warn: 0
    },
    {
      applicable: 1,
      coveragePct: 100,
      latencyMs: 80,
      name: "OpenSSF Scorecard",
      note: "Repository posture for GitHub projects. It is not a package install-plan layer.",
      pass: 1,
      score: 17,
      status: "pass",
      warn: 0
    },
    {
      applicable: 2,
      coveragePct: 100,
      latencyMs: 960,
      name: "Surplus",
      note: "Agent marketplace and cost-market context, included as an adjacent agent-infra track.",
      pass: 2,
      score: 32,
      status: "pass",
      warn: 0
    },
    {
      applicable: 4,
      coveragePct: 100,
      latencyMs: 712,
      name: "Socket",
      note: "Authenticated PURL lookup returned package evidence for the applicable package cases in this run.",
      pass: 4,
      score: 37,
      status: "pass",
      warn: 0
    },
    {
      applicable: 4,
      coveragePct: 0,
      latencyMs: 258,
      name: "Snyk",
      note: "Authentication worked, but package-health depth was unavailable on the current token or plan.",
      pass: 0,
      score: 4,
      status: "warn",
      warn: 4
    },
    {
      applicable: 7,
      coveragePct: 0,
      latencyMs: null,
      name: "Raw agent",
      note: "Baseline for direct install or pull behavior without a package intelligence layer.",
      pass: 0,
      score: 4,
      status: "warn",
      warn: 7
    }
  ] satisfies CompetitiveBenchmarkTrack[],
  type: "dev.nipmod.competitive-benchmark-public.v1"
};
