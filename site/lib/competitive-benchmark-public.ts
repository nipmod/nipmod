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

export const competitiveBenchmarkReport = {
  checkedAt: "2026-05-27T10:55:05.080Z",
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
    medianLatencyMs: 2049,
    score: 89
  },
  publishableClaims: [
    "Nipmod returned read-only install-plan evidence for 7/7 benchmark source cases.",
    "Nipmod live track passed 7/7 applicable checks with median latency 2049 ms.",
    "OSV and deps.dev are useful evidence feeds, but they do not produce agent install plans by themselves."
  ],
  tracks: [
    {
      applicable: 7,
      coveragePct: 100,
      latencyMs: 2049,
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
      latencyMs: 43,
      name: "deps.dev",
      note: "Strong package metadata, licenses, advisory and provenance context for supported ecosystems.",
      pass: 4,
      score: 35,
      status: "pass",
      warn: 0
    },
    {
      applicable: 7,
      coveragePct: 100,
      latencyMs: 281,
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
      latencyMs: 336,
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
      latencyMs: 82,
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
      latencyMs: 973,
      name: "Surplus",
      note: "Agent marketplace and cost-market context, included as an adjacent agent-infra track.",
      pass: 2,
      score: 32,
      status: "pass",
      warn: 0
    },
    {
      applicable: 4,
      coveragePct: 25,
      latencyMs: 2349,
      name: "Socket",
      note: "Authenticated lookup was available for one package case; current token or plan limits affected the rest.",
      pass: 1,
      score: 12,
      status: "warn",
      warn: 3
    },
    {
      applicable: 4,
      coveragePct: 0,
      latencyMs: 260,
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
