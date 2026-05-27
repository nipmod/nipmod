import { EXTERNAL_PACKAGE_SOURCES, externalSourceQualityProfile } from "./external-packages";

export const sourceQualityBenchmark = {
  formatVersion: 1,
  type: "dev.nipmod.source-quality-benchmark.v1",
  status: "public_benchmark_snapshot",
  generatedFrom: "pnpm search:benchmark",
  generatedAt: "2026-05-27T14:12:48.097Z",
  summary: {
    blockedRecommendedCount: 0,
    fail: 0,
    meanReciprocalRank: 0.962,
    missingExpectedIntentReasonCount: 0,
    pass: 13,
    recallAt1: 0.923,
    recallAt3: 1,
    total: 13
  },
  gates: [
    "expected package appears within max rank",
    "recommended candidate is not blocked",
    "unsafe decoys are not recommended",
    "query intent reason is present where required",
    "partial source outage is surfaced without hiding returned records"
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
