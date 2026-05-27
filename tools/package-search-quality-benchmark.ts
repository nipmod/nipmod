#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import {
  resetExternalSourceRuntimeStateForTests,
  searchExternalPackages,
  type ExternalPackageSource
} from "../site/lib/external-packages.ts";
import { packageSearchQualityFetch } from "./package-search-quality-fixtures.ts";

interface BenchmarkCase {
  expectedGate?: "blocked" | "pass" | "review";
  expectedId?: string;
  expectedPartial?: boolean;
  expectedRecommendedId?: string | null;
  expectedSourceSummary?: {
    empty: number;
    failed: number;
    ok: number;
    requested: number;
  };
  forbiddenRecommendedIds?: string[];
  limit: number;
  maxRank: number;
  name: string;
  query: string;
  requiredIntentReason?: string;
  sources: ExternalPackageSource[];
  useHuggingFaceOutage?: boolean;
  useNpmOutage?: boolean;
}

interface BenchmarkCheck {
  data?: {
    expectedId: string | null;
    intentReasonFound: boolean;
    partial: boolean;
    rank: number | null;
    recommendedId: string | null;
    reciprocalRank: number;
    sourceSummary: unknown;
    topGates: string[];
    topIds: string[];
  };
  error?: string;
  name: string;
  query: string;
  sources: ExternalPackageSource[];
  status: "pass" | "fail";
}

const DEFAULT_CASES: BenchmarkCase[] = [
  {
    expectedId: "npm:zod",
    expectedRecommendedId: "npm:zod",
    limit: 3,
    maxRank: 1,
    name: "TypeScript schema validation",
    query: "schema validation",
    requiredIntentReason: "query intent match: TypeScript schema validation fit",
    sources: ["npm"],
    forbiddenRecommendedIds: ["npm:metadata-injection", "npm:zod-helper"]
  },
  {
    expectedId: "pypi:pydantic",
    expectedRecommendedId: "pypi:pydantic",
    limit: 3,
    maxRank: 1,
    name: "Python schema validation",
    query: "json schema validation for python api",
    requiredIntentReason: "query intent match: Python schema validation fit",
    sources: ["pypi"]
  },
  {
    expectedId: "npm:undici",
    expectedRecommendedId: "npm:undici",
    limit: 3,
    maxRank: 1,
    name: "Node HTTP client",
    query: "http client for node fetch",
    requiredIntentReason: "query intent match: Node HTTP client fit",
    sources: ["npm"]
  },
  {
    expectedId: "pypi:requests",
    expectedRecommendedId: "pypi:requests",
    limit: 3,
    maxRank: 2,
    name: "Python HTTP client",
    query: "http client",
    requiredIntentReason: "query intent match: Python HTTP client fit",
    sources: ["pypi"]
  },
  {
    expectedId: "pypi:pillow",
    expectedRecommendedId: "pypi:pillow",
    limit: 3,
    maxRank: 1,
    name: "Image rendering Python",
    query: "graphic design image rendering",
    requiredIntentReason: "query intent match: Python image processing fit",
    sources: ["pypi"]
  },
  {
    expectedId: "npm:playwright",
    limit: 4,
    maxRank: 2,
    name: "Browser automation cross-source",
    query: "browser automation",
    requiredIntentReason: "query intent match: browser automation fit",
    sources: ["npm", "pypi"]
  },
  {
    expectedId: "huggingface-model:sentence-transformers/all-MiniLM-L6-v2",
    forbiddenRecommendedIds: ["huggingface-model:evil/embedding-wallet-drainer", "huggingface-model:evil/model-card-injection"],
    limit: 5,
    maxRank: 2,
    name: "Embedding model",
    query: "semantic search embeddings model",
    requiredIntentReason: "query intent match: embedding model fit",
    sources: ["huggingface-model", "pypi"]
  },
  {
    expectedId: "mcp:ac.tandem/docs-mcp",
    expectedRecommendedId: "mcp:ac.tandem/docs-mcp",
    limit: 3,
    maxRank: 1,
    name: "MCP docs server",
    query: "tandem docs mcp server",
    sources: ["mcp"]
  },
  {
    expectedId: "npm:zod",
    expectedRecommendedId: "npm:zod",
    forbiddenRecommendedIds: ["npm:metadata-injection", "npm:risky-lifecycle", "npm:zod-helper"],
    limit: 3,
    maxRank: 1,
    name: "Unsafe popular decoy",
    query: "schema validation",
    requiredIntentReason: "query intent match: TypeScript schema validation fit",
    sources: ["npm"]
  },
  {
    expectedId: "pypi:requests",
    expectedPartial: true,
    expectedRecommendedId: "pypi:requests",
    expectedSourceSummary: { empty: 0, failed: 1, ok: 1, requested: 2 },
    limit: 3,
    maxRank: 1,
    name: "Partial source outage",
    query: "http client",
    requiredIntentReason: "query intent match: Python HTTP client fit",
    sources: ["npm", "pypi"],
    useNpmOutage: true
  },
  {
    expectedId: "pypi:requests",
    expectedPartial: true,
    expectedRecommendedId: "pypi:requests",
    expectedSourceSummary: { empty: 0, failed: 2, ok: 1, requested: 3 },
    limit: 3,
    maxRank: 1,
    name: "Multi-source outage keeps safe recommendation",
    query: "http client",
    requiredIntentReason: "query intent match: Python HTTP client fit",
    sources: ["npm", "pypi", "huggingface-model"],
    useHuggingFaceOutage: true,
    useNpmOutage: true
  },
  {
    expectedGate: "review",
    expectedId: "npm:company-payments-sdk",
    expectedRecommendedId: null,
    limit: 3,
    maxRank: 1,
    name: "Dependency confusion private-looking package",
    query: "internal payments sdk",
    sources: ["npm"]
  },
  {
    expectedId: "pypi:pillow",
    expectedRecommendedId: "pypi:pillow",
    forbiddenRecommendedIds: ["pypi:pil"],
    limit: 3,
    maxRank: 1,
    name: "PyPI confusion alias",
    query: "pil",
    requiredIntentReason: "query intent match: Python image processing fit",
    sources: ["pypi"]
  },
  {
    expectedId: "npm:ethers",
    expectedRecommendedId: "npm:ethers",
    forbiddenRecommendedIds: ["npm:wallet-connect-helper"],
    limit: 4,
    maxRank: 1,
    name: "Crypto wallet drainer decoy",
    query: "ethereum wallet sdk",
    requiredIntentReason: "query intent match: Ethereum wallet library fit",
    sources: ["npm"]
  },
  {
    expectedId: "pypi:requests",
    expectedRecommendedId: "pypi:requests",
    forbiddenRecommendedIds: ["pypi:reqeusts"],
    limit: 3,
    maxRank: 1,
    name: "PyPI typo-squat HTTP client",
    query: "reqeusts",
    sources: ["pypi"]
  },
  {
    expectedId: "npm:undici",
    expectedRecommendedId: "npm:undici",
    forbiddenRecommendedIds: ["npm:request"],
    limit: 4,
    maxRank: 1,
    name: "Deprecated npm HTTP client decoy",
    query: "http client",
    requiredIntentReason: "query intent match: Node HTTP client fit",
    sources: ["npm"]
  },
  {
    expectedId: "npm:undici",
    expectedRecommendedId: "npm:undici",
    forbiddenRecommendedIds: ["npm:drifted-http-client"],
    limit: 4,
    maxRank: 1,
    name: "npm publisher continuity decoy",
    query: "http client",
    requiredIntentReason: "query intent match: Node HTTP client fit",
    sources: ["npm"]
  },
  {
    expectedId: "pypi:requests",
    expectedRecommendedId: "pypi:requests",
    forbiddenRecommendedIds: ["npm:requests"],
    limit: 5,
    maxRank: 1,
    name: "Cross-registry package name impersonation",
    query: "python requests http client",
    requiredIntentReason: "query intent match: Python HTTP client fit",
    sources: ["npm", "pypi"]
  },
  {
    expectedId: "npm:@solana/web3.js",
    expectedRecommendedId: "npm:@solana/web3.js",
    forbiddenRecommendedIds: ["npm:solana-web3-helper"],
    limit: 4,
    maxRank: 1,
    name: "npm namespace confusion scoped SDK",
    query: "solana web3 sdk",
    requiredIntentReason: "query intent match: Solana JavaScript SDK fit",
    sources: ["npm"]
  },
  {
    expectedId: "npm:zod",
    expectedRecommendedId: "npm:zod",
    forbiddenRecommendedIds: ["npm:metadata-obfuscated", "npm:zod-helper"],
    limit: 4,
    maxRank: 1,
    name: "Obfuscated metadata instruction decoy",
    query: "schema validation",
    requiredIntentReason: "query intent match: TypeScript schema validation fit",
    sources: ["npm"]
  },
  {
    expectedGate: "blocked",
    expectedId: "pypi:schema-description-injection",
    expectedRecommendedId: null,
    limit: 3,
    maxRank: 1,
    name: "PyPI long-description instruction decoy",
    query: "schema-description-injection",
    sources: ["pypi"]
  },
  {
    expectedGate: "blocked",
    expectedId: "github:evil/readme-injection",
    expectedRecommendedId: null,
    limit: 3,
    maxRank: 1,
    name: "GitHub README instruction decoy",
    query: "readme injection tool",
    sources: ["github"]
  },
  {
    expectedId: "npm:zod",
    expectedRecommendedId: "npm:zod",
    forbiddenRecommendedIds: ["npm:zod-helper"],
    limit: 5,
    maxRank: 1,
    name: "Source repository mismatch decoy",
    query: "schema validation",
    requiredIntentReason: "query intent match: TypeScript schema validation fit",
    sources: ["npm"]
  }
];

export async function runPackageSearchQualityBenchmark(cases: BenchmarkCase[] = DEFAULT_CASES) {
  const checks: BenchmarkCheck[] = [];

  for (const testCase of cases) {
    resetExternalSourceRuntimeStateForTests();
    try {
      const result = await searchExternalPackages(testCase.query, {
        fetchImpl: packageSearchQualityFetch({
          huggingFaceOutage: testCase.useHuggingFaceOutage,
          npmOutage: testCase.useNpmOutage
        }),
        limit: testCase.limit,
        sources: testCase.sources
      });
      const topIds = result.selection.candidates.map((candidate) => candidate.id);
      const topGates = result.selection.candidates.map((candidate) => candidate.gate);
      const rankIndex = testCase.expectedId ? topIds.indexOf(testCase.expectedId) : -1;
      const rank = rankIndex >= 0 ? rankIndex + 1 : null;
      const expectedCandidate = testCase.expectedId
        ? result.selection.candidates.find((candidate) => candidate.id === testCase.expectedId)
        : undefined;
      const intentReasonFound =
        !testCase.requiredIntentReason || Boolean(expectedCandidate?.reasons.some((reason) => reason === testCase.requiredIntentReason));
      const reciprocalRank = rank ? 1 / rank : 0;
      const errors = [
        ...(testCase.expectedId && rank === null ? [`expected ${testCase.expectedId} was not returned`] : []),
        ...(rank !== null && rank > testCase.maxRank ? [`expected ${testCase.expectedId} rank ${rank} exceeded max ${testCase.maxRank}`] : []),
        ...(testCase.expectedRecommendedId !== undefined && result.selection.recommendedId !== testCase.expectedRecommendedId
          ? [`recommendedId ${String(result.selection.recommendedId)} did not match ${testCase.expectedRecommendedId}`]
          : []),
        ...(testCase.expectedGate && expectedCandidate?.gate !== testCase.expectedGate
          ? [`expected ${testCase.expectedId} gate ${String(expectedCandidate?.gate)} did not match ${testCase.expectedGate}`]
          : []),
        ...((testCase.forbiddenRecommendedIds ?? []).includes(result.selection.recommendedId ?? "")
          ? [`forbidden candidate was recommended: ${String(result.selection.recommendedId)}`]
          : []),
        ...(result.selection.recommendedId &&
        result.selection.candidates.find((candidate) => candidate.id === result.selection.recommendedId)?.gate === "blocked"
          ? [`blocked candidate was recommended: ${result.selection.recommendedId}`]
          : []),
        ...(intentReasonFound ? [] : [`missing required intent reason: ${testCase.requiredIntentReason}`]),
        ...(typeof testCase.expectedPartial === "boolean" && result.partial !== testCase.expectedPartial
          ? [`partial ${result.partial} did not match ${testCase.expectedPartial}`]
          : []),
        ...(testCase.expectedSourceSummary && JSON.stringify(result.sourceSummary) !== JSON.stringify(testCase.expectedSourceSummary)
          ? [`sourceSummary ${JSON.stringify(result.sourceSummary)} did not match ${JSON.stringify(testCase.expectedSourceSummary)}`]
          : [])
      ];

      checks.push({
        data: {
          expectedId: testCase.expectedId,
          intentReasonFound,
          partial: result.partial,
          rank,
          recommendedId: result.selection.recommendedId,
          reciprocalRank,
          sourceSummary: result.sourceSummary,
          topGates,
          topIds
        },
        error: errors.length ? errors.join("; ") : undefined,
        name: testCase.name,
        query: testCase.query,
        sources: testCase.sources,
        status: errors.length ? "fail" : "pass"
      });
    } catch (error) {
      checks.push({
        error: error instanceof Error ? error.message : String(error),
        name: testCase.name,
        query: testCase.query,
        sources: testCase.sources,
        status: "fail"
      });
    }
  }

  const summary = benchmarkSummary(checks);
  const ok =
    summary.fail === 0 &&
    summary.meanReciprocalRank >= 0.85 &&
    summary.recallAt1 >= 0.75 &&
    summary.recallAt3 === 1 &&
    summary.blockedRecommendedCount === 0 &&
    summary.missingExpectedIntentReasonCount === 0;

  return {
    checks,
    formatVersion: 1,
    ok,
    summary,
    type: "dev.nipmod.package-search-quality-benchmark.v1"
  };
}

function benchmarkSummary(checks: BenchmarkCheck[]) {
  const total = checks.length;
  const pass = checks.filter((check) => check.status === "pass").length;
  const fail = total - pass;
  const data = checks.map((check) => check.data).filter((item): item is NonNullable<BenchmarkCheck["data"]> => Boolean(item));
  const meanReciprocalRank = roundMetric(data.reduce((sum, item) => sum + item.reciprocalRank, 0) / Math.max(total, 1));
  const recallAt1 = roundMetric(data.filter((item) => item.rank === 1).length / Math.max(total, 1));
  const recallAt3 = roundMetric(data.filter((item) => item.rank !== null && item.rank <= 3).length / Math.max(total, 1));
  const blockedRecommendedCount = data.filter((item) => {
    const index = item.topIds.indexOf(item.recommendedId ?? "");
    return index >= 0 && item.topGates[index] === "blocked";
  }).length;
  const missingExpectedIntentReasonCount = data.filter((item) => !item.intentReasonFound).length;

  return {
    blockedRecommendedCount,
    fail,
    meanReciprocalRank,
    missingExpectedIntentReasonCount,
    pass,
    recallAt1,
    recallAt3,
    total
  };
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

async function main(): Promise<void> {
  const result = await runPackageSearchQualityBenchmark();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}

const isDirectRun = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (isDirectRun) {
  await main();
}
