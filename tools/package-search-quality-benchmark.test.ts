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
      total: 28
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
    expect(result.checks.find((check) => check.name === "Multi-source outage keeps safe recommendation")?.data).toMatchObject({
      recommendedId: "pypi:requests",
      sourceSummary: { empty: 0, failed: 2, ok: 1, requested: 3 }
    });
    expect(result.checks.find((check) => check.name === "npm publisher continuity decoy")?.data?.recommendedId).toBe("npm:undici");
    expect(result.checks.find((check) => check.name === "npm publisher continuity decoy")?.data?.topGates).toContain("review");
    expect(result.checks.find((check) => check.name === "npm maintainer compromise after dormancy decoy")?.data).toMatchObject({
      recommendedId: "npm:undici"
    });
    expect(result.checks.find((check) => check.name === "npm maintainer compromise after dormancy decoy")?.data?.topIds).toContain(
      "npm:maintainer-compromised-fetch"
    );
    expect(result.checks.find((check) => check.name === "npm maintainer compromise after dormancy decoy")?.data?.topGates).toContain("review");
    expect(result.checks.find((check) => check.name === "PyPI package takeover timeline exact package")?.data).toMatchObject({
      recommendedId: null,
      topGates: ["review"]
    });
    expect(result.checks.find((check) => check.name === "Cross-registry package name impersonation")?.data?.recommendedId).toBe("pypi:requests");
    expect(result.checks.find((check) => check.name === "npm namespace confusion scoped SDK")?.data?.recommendedId).toBe("npm:@solana/web3.js");
    const trapDoorCheck = result.checks.find((check) => check.name === "TrapDoor crypto developer environment decoy");
    expect(trapDoorCheck?.data).toMatchObject({
      recommendedId: "npm:@solana/web3.js"
    });
    expect(trapDoorCheck?.data?.topGates).toContain("blocked");
    expect(trapDoorCheck?.data?.topIds).toEqual(expect.arrayContaining([expect.stringMatching(/^npm:(trapdoor-wallet-helper|solana-web3-helper)$/)]));
    expect(result.checks.find((check) => check.name === "Obfuscated metadata instruction decoy")?.data).toMatchObject({
      recommendedId: "npm:zod",
      topGates: ["pass", "pass", "review", "blocked"]
    });
    expect(result.checks.find((check) => check.name === "PyPI long-description instruction decoy")?.data).toMatchObject({
      recommendedId: null,
      topGates: ["blocked"]
    });
    expect(result.checks.find((check) => check.name === "GitHub README instruction decoy")?.data).toMatchObject({
      recommendedId: null,
      topGates: ["blocked"]
    });
    expect(result.checks.find((check) => check.name === "Source repository mismatch decoy")?.data).toMatchObject({
      recommendedId: "npm:zod"
    });
    expect(result.checks.find((check) => check.name === "Source repository mismatch decoy")?.data?.topIds).toContain("npm:zod-helper");
    expect(result.checks.find((check) => check.name === "Embedding model")?.data?.topGates).toContain("blocked");
    expect(result.checks.find((check) => check.name === "Embedding model")?.data?.topIds).toContain("huggingface-model:evil/model-card-injection");
    const datasetScriptCheck = result.checks.find((check) => check.name === "Hugging Face dataset script decoy");
    expect(datasetScriptCheck?.data).toMatchObject({
      recommendedId: "huggingface-dataset:rajpurkar/squad"
    });
    expect(datasetScriptCheck?.data?.topGates).toContain("blocked");
    expect(datasetScriptCheck?.data?.topIds).toContain("huggingface-dataset:evil/dataset-loader-script");
    expect(result.checks.find((check) => check.name === "MCP credential-scope without source decoy")?.data).toMatchObject({
      recommendedId: null,
      topGates: ["blocked"]
    });
    expect(result.checks.find((check) => check.name === "Partial source outage")?.data?.sourceSummary).toEqual({
      empty: 0,
      failed: 1,
      ok: 1,
      requested: 2
    });
  });
});
