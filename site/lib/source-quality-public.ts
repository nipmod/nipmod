import { EXTERNAL_PACKAGE_SOURCES, externalSourceQualityProfile } from "./external-packages";

export const sourceQualityBenchmark = {
  formatVersion: 1,
  type: "dev.nipmod.source-quality-benchmark.v1",
  status: "public_benchmark_snapshot",
  generatedFrom: "pnpm search:benchmark",
  generatedAt: "2026-05-29T22:42:07.000Z",
  summary: {
    blockedRecommendedCount: 0,
    fail: 0,
    meanReciprocalRank: 1,
    missingExpectedIntentReasonCount: 0,
    pass: 36,
    recallAt1: 1,
    recallAt3: 1,
    total: 36
  },
  scope: {
    countingNote: "Source coverage counts benchmark cases where the source was requested; multi-source cases count toward each requested source.",
    question: "Can Nipmod choose a useful package, model, repo, dataset or MCP server before an agent moves toward external code execution?",
    scenarioNote: "Scenario groups are overlapping by design; one benchmark case can exercise more than one risk class.",
    unit: "search result and pre-install source selection"
  },
  sourceCoverage: [
    { pass: 21, requestedCases: 21, source: "npm" },
    { pass: 15, requestedCases: 15, source: "pypi" },
    { pass: 1, requestedCases: 1, source: "github" },
    { pass: 2, requestedCases: 2, source: "huggingface-model" },
    { pass: 1, requestedCases: 1, source: "huggingface-dataset" },
    { pass: 2, requestedCases: 2, source: "mcp" }
  ],
  scenarioCoverage: [
    { cases: 16, label: "baseline package, model, repo or MCP selection" },
    { cases: 8, label: "daily developer package tasks" },
    { cases: 2, label: "partial or multi-source outage behavior" },
    { cases: 6, label: "typo, namespace, dependency confusion or source impersonation" },
    { cases: 5, label: "install, lifecycle, wallet, dataset script or credential-scope risk" },
    { cases: 5, label: "package metadata, README, long-description or model-card instruction risk" },
    { cases: 4, label: "deprecation, publisher continuity or takeover timeline risk" }
  ],
  gates: [
    "expected package appears within max rank",
    "recommended candidate is not blocked",
    "unsafe decoys are not recommended",
    "query intent reason is present where required",
    "partial source outage is surfaced without hiding returned records",
    "namespace-confusion decoys do not beat expected scoped SDKs",
    "obfuscated package metadata instructions are treated as untrusted data",
    "publisher-continuity warnings can force npm candidates into review",
    "maintainer-compromise after dormancy decoys do not beat canonical packages",
    "package takeover timelines force exact-name PyPI candidates into review",
    "runtime/source intent prevents cross-registry name impersonation from winning",
    "model-card instruction decoys are blocked as untrusted metadata",
    "multi-source outages remain partial when at least one safe source returns records",
    "PyPI long-description instruction decoys are blocked as untrusted metadata",
    "GitHub README instruction decoys are blocked as untrusted metadata",
    "source-repository mismatch decoys do not beat canonical packages",
    "TrapDoor-style crypto developer environment decoys are blocked before recommendation",
    "Hugging Face dataset script decoys are blocked before recommendation",
    "MCP credential-scope decoys without source repositories are blocked before recommendation"
  ],
  notClaimed: [
    "malware-free guarantee",
    "full registry crawl",
    "private source visibility",
    "model behavior evaluation",
    "legal approval for license or dataset use"
  ]
} as const;

export function publicSourceQualityReport() {
  return {
    benchmark: sourceQualityBenchmark,
    formatVersion: 1,
    profiles: EXTERNAL_PACKAGE_SOURCES.map((source) => ({
      source,
      ...externalSourceQualityProfile(source)
    })),
    type: "dev.nipmod.source-quality-report.v1"
  };
}
