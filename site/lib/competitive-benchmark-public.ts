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
  tracks: Array<{
    name: string;
    score: number;
    sourceCoveragePct: number;
  }>;
  title: string;
};

export const competitiveBenchmarkReport = {
  categoryBreakdown: [
    {
      description: "Can the system resolve the right upstream object and return enough source context before an agent moves toward install?",
      dimensions: "search, identity, version, metadata, source depth, multi-source scope",
      key: "source-resolution",
      title: "Source resolution",
      tracks: [
        { name: "Nipmod", score: 97, sourceCoveragePct: 100 },
        { name: "Native registries", score: 50, sourceCoveragePct: 100 },
        { name: "deps.dev", score: 25, sourceCoveragePct: 57 },
        { name: "OSV", score: 17, sourceCoveragePct: 57 },
        { name: "Raw agent", score: 13, sourceCoveragePct: 100 },
        { name: "OpenSSF Scorecard", score: 3, sourceCoveragePct: 14 },
        { name: "Socket", score: 0, sourceCoveragePct: 57 },
        { name: "Snyk", score: 0, sourceCoveragePct: 57 }
      ]
    },
    {
      description: "Can the system return security evidence beyond a name match: advisories, provenance, repository posture and package behavior?",
      dimensions: "advisories, provenance, repository posture, package behavior",
      key: "security-evidence",
      title: "Security evidence",
      tracks: [
        { name: "Nipmod", score: 83, sourceCoveragePct: 100 },
        { name: "deps.dev", score: 33, sourceCoveragePct: 57 },
        { name: "Native registries", score: 26, sourceCoveragePct: 100 },
        { name: "OSV", score: 17, sourceCoveragePct: 57 },
        { name: "OpenSSF Scorecard", score: 3, sourceCoveragePct: 14 },
        { name: "Raw agent", score: 0, sourceCoveragePct: 100 },
        { name: "Socket", score: 0, sourceCoveragePct: 57 },
        { name: "Snyk", score: 0, sourceCoveragePct: 57 }
      ]
    },
    {
      description: "Can the system describe what would run, keep hosted checks read-only and expose the execution boundary before workspace writes?",
      dimensions: "install plan, read-only boundary, package behavior, prompt boundary",
      key: "execution-preflight",
      title: "Execution preflight",
      tracks: [
        { name: "Nipmod", score: 100, sourceCoveragePct: 100 },
        { name: "Native registries", score: 2, sourceCoveragePct: 100 },
        { name: "Raw agent", score: 0, sourceCoveragePct: 100 },
        { name: "deps.dev", score: 0, sourceCoveragePct: 57 },
        { name: "OSV", score: 0, sourceCoveragePct: 57 },
        { name: "Socket", score: 0, sourceCoveragePct: 57 },
        { name: "Snyk", score: 0, sourceCoveragePct: 57 },
        { name: "OpenSSF Scorecard", score: 0, sourceCoveragePct: 14 }
      ]
    },
    {
      description: "Can an agent consume the result as an action-ready decision object, not just a generic API response or human page?",
      dimensions: "agent decision JSON, install boundary, source evidence, machine output",
      key: "agent-readiness",
      title: "Agent readiness",
      tracks: [
        { name: "Nipmod", score: 100, sourceCoveragePct: 100 },
        { name: "Native registries", score: 10, sourceCoveragePct: 100 },
        { name: "deps.dev", score: 6, sourceCoveragePct: 57 },
        { name: "OSV", score: 6, sourceCoveragePct: 57 },
        { name: "Socket", score: 2, sourceCoveragePct: 57 },
        { name: "Snyk", score: 2, sourceCoveragePct: 57 },
        { name: "OpenSSF Scorecard", score: 1, sourceCoveragePct: 14 },
        { name: "Raw agent", score: 0, sourceCoveragePct: 100 }
      ]
    }
  ] satisfies CompetitiveBenchmarkCategory[],
  checkedAt: "2026-05-27T13:09:11.674Z",
  command: "pnpm benchmark:competitive",
  claimBoundary: [
    "This is an agent package-decision benchmark, not a malware-free guarantee.",
    "Nipmod is measured at the pre-install moment: search, inspect, evidence, warnings and install-plan output.",
    "OSV, deps.dev, Socket, Snyk, OpenSSF Scorecard and native registries are measured by the dimensions they actually expose.",
    "The headline score is coverage-adjusted across all benchmark cases; specialized evidence feeds keep their own applicable depth score.",
    "No package install, repository clone, artifact unpacking, model execution or workspace write is performed."
  ],
  headline: {
    installPlanEvidence: "7/7",
    liveChecks: "7/7",
    medianLatencyMs: 2177,
    score: 95
  },
  publishableClaims: [
    "Nipmod score: 95/100 across the current production agent-preflight benchmark.",
    "Nipmod completed 7/7 live source cases and returned 7/7 read-only install-plan evidence.",
    "Socket and Snyk were authenticated, but package-depth endpoints were rate-limited or plan-limited in this run; do not use this snapshot for a direct Socket or Snyk depth claim."
  ],
  tracks: [
    {
      applicable: 7,
      coveragePct: 100,
      depthScore: 90,
      latencyMs: 2177,
      name: "Nipmod",
      note: "Search, inspect, source evidence, warnings, read-only install-plan output and agent JSON.",
      pass: 7,
      role: "Agent preflight layer",
      score: 95,
      sourceCoveragePct: 100,
      status: "pass",
      warn: 0
    },
    {
      applicable: 4,
      coveragePct: 100,
      depthScore: 35,
      latencyMs: 44,
      name: "deps.dev",
      note: "Package metadata, licenses, advisory and provenance context for supported ecosystems.",
      pass: 4,
      role: "Package metadata and advisory evidence",
      score: 16,
      sourceCoveragePct: 57,
      status: "pass",
      warn: 0
    },
    {
      applicable: 7,
      coveragePct: 100,
      depthScore: 27,
      latencyMs: 171,
      name: "Native registries",
      note: "Source-of-truth metadata from npm, PyPI, GitHub, Hugging Face and MCP.",
      pass: 7,
      role: "Upstream source metadata",
      score: 22,
      sourceCoveragePct: 100,
      status: "pass",
      warn: 0
    },
    {
      applicable: 4,
      coveragePct: 100,
      depthScore: 24,
      latencyMs: 359,
      name: "OSV",
      note: "Vulnerability lookup for package and version pairs.",
      pass: 4,
      role: "Vulnerability evidence feed",
      score: 10,
      sourceCoveragePct: 57,
      status: "pass",
      warn: 0
    },
    {
      applicable: 1,
      coveragePct: 100,
      depthScore: 17,
      latencyMs: 57,
      name: "OpenSSF Scorecard",
      note: "Repository posture for GitHub projects. It is not a package install-plan layer.",
      pass: 1,
      role: "Repository posture baseline",
      score: 2,
      sourceCoveragePct: 14,
      status: "pass",
      warn: 0
    },
    {
      applicable: 4,
      coveragePct: 0,
      depthScore: 4,
      latencyMs: 492,
      name: "Socket",
      note: "Authenticated PURL endpoint was available, but package-depth lookups were rate-limited in this run.",
      pass: 0,
      role: "Supply-chain package evidence",
      score: 1,
      sourceCoveragePct: 57,
      status: "warn",
      warn: 4
    },
    {
      applicable: 4,
      coveragePct: 0,
      depthScore: 4,
      latencyMs: 248,
      name: "Snyk",
      note: "Authentication worked, but package-health depth was unavailable on the current token or plan.",
      pass: 0,
      role: "Package health and security evidence",
      score: 1,
      sourceCoveragePct: 57,
      status: "warn",
      warn: 4
    },
    {
      applicable: 7,
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
      warn: 7
    }
  ] satisfies CompetitiveBenchmarkTrack[],
  type: "dev.nipmod.competitive-benchmark-public.v1"
};
