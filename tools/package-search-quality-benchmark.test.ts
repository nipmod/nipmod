import { describe, expect, test } from "vitest";
import { runPackageSearchQualityBenchmark } from "./package-search-quality-benchmark";

describe("package search quality benchmark", () => {
  test("keeps package search ranking measurable against offline fixtures", async () => {
    const result = await runPackageSearchQualityBenchmark();

    expect(result.type).toBe("dev.nipmod.package-search-quality-benchmark.v1");
    expect(result.ok).toBe(true);
    expect(result.summary).toMatchObject({
      blockedRecommendedCount: 0,
      fail: 0,
      missingExpectedIntentReasonCount: 0,
      recallAt3: 1,
      total: 17
    });
    expect(result.summary.meanReciprocalRank).toBeGreaterThanOrEqual(0.85);
    expect(result.summary.recallAt1).toBeGreaterThanOrEqual(0.75);
    expect(result.checks.find((check) => check.name === "Unsafe popular decoy")?.data?.recommendedId).toBe("npm:zod");
    expect(result.checks.find((check) => check.name === "Dependency confusion private-looking package")?.data).toMatchObject({
      recommendedId: null,
      topGates: ["review"]
    });
    expect(result.checks.find((check) => check.name === "PyPI confusion alias")?.data?.recommendedId).toBe("pypi:pillow");
    expect(result.checks.find((check) => check.name === "Crypto wallet drainer decoy")?.data?.recommendedId).toBe("npm:ethers");
    expect(result.checks.find((check) => check.name === "PyPI typo-squat HTTP client")?.data?.recommendedId).toBe("pypi:requests");
    expect(result.checks.find((check) => check.name === "Deprecated npm HTTP client decoy")?.data?.recommendedId).toBe("npm:undici");
    expect(result.checks.find((check) => check.name === "npm namespace confusion scoped SDK")?.data?.recommendedId).toBe("npm:@solana/web3.js");
    expect(result.checks.find((check) => check.name === "Obfuscated metadata instruction decoy")?.data).toMatchObject({
      recommendedId: "npm:zod",
      topGates: ["pass", "pass", "review", "blocked"]
    });
    expect(result.checks.find((check) => check.name === "Embedding model")?.data?.topGates).toContain("blocked");
    expect(result.checks.find((check) => check.name === "Partial source outage")?.data?.sourceSummary).toEqual({
      empty: 0,
      failed: 1,
      ok: 1,
      requested: 2
    });
  });
});
