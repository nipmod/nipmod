import { EXTERNAL_PACKAGE_SOURCES, externalSourceQualityProfile } from "./external-packages";

export const sourceQualityBenchmark = {
  formatVersion: 1,
  type: "dev.nipmod.source-quality-benchmark.v1",
  status: "public_benchmark_snapshot",
  generatedFrom: "pnpm search:benchmark",
  generatedAt: "2026-05-27T16:55:00.000Z",
  summary: {
    blockedRecommendedCount: 0,
    fail: 0,
    meanReciprocalRank: 1,
    missingExpectedIntentReasonCount: 0,
    pass: 26,
    recallAt1: 1,
    recallAt3: 1,
    total: 26
  },
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
    "TrapDoor-style crypto developer environment decoys are blocked before recommendation"
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
