#!/usr/bin/env node
import { fileURLToPath } from "node:url";

type CandidateDecision =
  | "preferred_worker_candidate"
  | "evaluate_service_boundary"
  | "external_service_only"
  | "reference_only"
  | "verification_or_fallback_only"
  | "lightweight_parser_candidate"
  | "license_review_required";

type CandidateRole =
  | "crawler-worker"
  | "llm-extraction-service"
  | "hosted-ai-crawler"
  | "crawler-reference"
  | "browser-automation"
  | "html-parser"
  | "html-to-markdown"
  | "dom-parser"
  | "headless-browser-service";

export interface CandidateDefinition {
  readonly repo: string;
  readonly role: CandidateRole;
  readonly stack: "typescript" | "javascript" | "python" | "service";
}

interface GitHubRepoMetadata {
  readonly description?: string | null;
  readonly forks_count?: number;
  readonly homepage?: string | null;
  readonly html_url?: string;
  readonly license?: {
    readonly name?: string | null;
    readonly spdx_id?: string | null;
  } | null;
  readonly name?: string;
  readonly stargazers_count?: number;
  readonly updated_at?: string;
}

interface CandidateAssessment {
  readonly decision: CandidateDecision;
  readonly description: string | null;
  readonly directDependencyAllowed: boolean;
  readonly license: {
    readonly name: string;
    readonly spdxId: string;
  };
  readonly notes: string[];
  readonly repo: string;
  readonly role: CandidateRole;
  readonly score: number;
  readonly stack: CandidateDefinition["stack"];
  readonly stats: {
    readonly forks: number;
    readonly stars: number;
    readonly updatedAt: string | null;
  };
  readonly url: string;
}

export const CANDIDATES: CandidateDefinition[] = [
  { repo: "apify/crawlee", role: "crawler-worker", stack: "typescript" },
  { repo: "unclecode/crawl4ai", role: "llm-extraction-service", stack: "python" },
  { repo: "firecrawl/firecrawl", role: "hosted-ai-crawler", stack: "service" },
  { repo: "scrapy/scrapy", role: "crawler-reference", stack: "python" },
  { repo: "microsoft/playwright", role: "browser-automation", stack: "typescript" },
  { repo: "cheeriojs/cheerio", role: "html-parser", stack: "javascript" },
  { repo: "mixmark-io/turndown", role: "html-to-markdown", stack: "javascript" },
  { repo: "jsdom/jsdom", role: "dom-parser", stack: "javascript" },
  { repo: "browserless/browserless", role: "headless-browser-service", stack: "service" }
];

const USER_AGENT = "nipmod-source-crawler-candidate-audit/1.2.7 (+https://nipmod.com)";
const PERMISSIVE_LICENSES = new Set(["Apache-2.0", "MIT", "BSD-3-Clause", "BSD-2-Clause", "ISC"]);
const DIRECT_BLOCK_LICENSES = new Set(["AGPL-3.0", "GPL-3.0", "GPL-2.0"]);

export async function runCrawlerCandidateAudit({
  candidates = CANDIDATES,
  fetchFn = fetch,
  now = new Date()
}: {
  candidates?: CandidateDefinition[];
  fetchFn?: typeof fetch;
  now?: Date;
} = {}) {
  const assessments: CandidateAssessment[] = [];
  const failures: Array<{ error: string; repo: string }> = [];

  for (const candidate of candidates) {
    try {
      const metadata = await fetchRepoMetadata(candidate.repo, fetchFn);
      assessments.push(classifyCandidate(candidate, metadata, now));
    } catch (error) {
      failures.push({
        error: error instanceof Error ? error.message : String(error),
        repo: candidate.repo
      });
    }
  }

  const preferred = assessments.filter((item) => item.decision === "preferred_worker_candidate");
  const directBlocked = assessments.filter((item) => !item.directDependencyAllowed);
  const ok = failures.length === 0 && preferred.length > 0;

  return {
    assessments,
    checkedAt: now.toISOString(),
    failures,
    formatVersion: 1,
    ok,
    summary: {
      directBlocked: directBlocked.length,
      evaluated: assessments.length,
      failed: failures.length,
      preferred: preferred.length
    },
    type: "dev.nipmod.source-crawler-candidate-audit.v1"
  };
}

export function classifyCandidate(
  candidate: CandidateDefinition,
  metadata: GitHubRepoMetadata,
  now = new Date()
): CandidateAssessment {
  const spdxId = metadata.license?.spdx_id ?? "NOASSERTION";
  const licenseName = metadata.license?.name ?? "Unknown";
  const stars = Number.isFinite(metadata.stargazers_count) ? Number(metadata.stargazers_count) : 0;
  const forks = Number.isFinite(metadata.forks_count) ? Number(metadata.forks_count) : 0;
  const updatedAt = metadata.updated_at ?? null;
  const daysSinceUpdate = updatedAt === null ? Number.POSITIVE_INFINITY : Math.max(0, (now.getTime() - new Date(updatedAt).getTime()) / 86_400_000);
  const notes: string[] = [];

  const licenseScore = licenseScoreFor(spdxId);
  const stackScore = stackScoreFor(candidate);
  const maintenanceScore = daysSinceUpdate <= 90 ? 20 : daysSinceUpdate <= 365 ? 12 : 4;
  const adoptionScore = stars >= 50_000 ? 20 : stars >= 10_000 ? 16 : stars >= 1_000 ? 10 : 4;
  const score = Math.max(0, Math.min(100, licenseScore + stackScore + maintenanceScore + adoptionScore));

  if (PERMISSIVE_LICENSES.has(spdxId)) {
    notes.push(`Permissive license detected: ${spdxId}.`);
  } else if (DIRECT_BLOCK_LICENSES.has(spdxId)) {
    notes.push(`Copyleft license detected: ${spdxId}; do not add as a direct public API runtime dependency without legal review.`);
  } else {
    notes.push(`License requires review: ${licenseName}.`);
  }

  if (daysSinceUpdate <= 90) {
    notes.push("Repository has recent maintenance activity.");
  } else {
    notes.push("Repository maintenance freshness is limited or unknown.");
  }

  const decision = decisionFor(candidate, spdxId);
  const directDependencyAllowed =
    decision !== "external_service_only" && decision !== "reference_only" && decision !== "license_review_required";

  if (candidate.repo === "apify/crawlee") {
    notes.push("Best fit for a future worker-side crawler because it is TypeScript-native and supports HTTP, Cheerio, JSDOM and browser crawlers.");
  }
  if (candidate.repo === "unclecode/crawl4ai") {
    notes.push("Strong LLM extraction candidate, but should run behind a service boundary instead of inside the Next.js request path.");
  }
  if (candidate.repo === "firecrawl/firecrawl") {
    notes.push("Useful market reference, but AGPL makes direct runtime adoption unsuitable for Nipmod's public API path.");
  }

  return {
    decision,
    description: metadata.description ?? null,
    directDependencyAllowed,
    license: {
      name: licenseName,
      spdxId
    },
    notes,
    repo: candidate.repo,
    role: candidate.role,
    score,
    stack: candidate.stack,
    stats: {
      forks,
      stars,
      updatedAt
    },
    url: metadata.html_url ?? `https://github.com/${candidate.repo}`
  };
}

async function fetchRepoMetadata(repo: string, fetchFn: typeof fetch): Promise<GitHubRepoMetadata> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": USER_AGENT
  };
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetchFn(`https://api.github.com/repos/${repo}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub metadata request failed for ${repo}: ${response.status}`);
  }
  return (await response.json()) as GitHubRepoMetadata;
}

function decisionFor(candidate: CandidateDefinition, spdxId: string): CandidateDecision {
  if (DIRECT_BLOCK_LICENSES.has(spdxId)) {
    return "external_service_only";
  }
  if (!PERMISSIVE_LICENSES.has(spdxId)) {
    return candidate.role === "browser-automation" ? "verification_or_fallback_only" : "license_review_required";
  }
  switch (candidate.role) {
    case "crawler-worker":
      return "preferred_worker_candidate";
    case "llm-extraction-service":
      return "evaluate_service_boundary";
    case "crawler-reference":
      return "reference_only";
    case "browser-automation":
      return "verification_or_fallback_only";
    case "html-parser":
    case "html-to-markdown":
    case "dom-parser":
      return "lightweight_parser_candidate";
    case "headless-browser-service":
    case "hosted-ai-crawler":
      return "external_service_only";
  }
}

function licenseScoreFor(spdxId: string): number {
  if (PERMISSIVE_LICENSES.has(spdxId)) {
    return 35;
  }
  if (DIRECT_BLOCK_LICENSES.has(spdxId)) {
    return 4;
  }
  return 10;
}

function stackScoreFor(candidate: CandidateDefinition): number {
  if (candidate.stack === "typescript") {
    return 25;
  }
  if (candidate.stack === "javascript") {
    return 21;
  }
  if (candidate.stack === "python") {
    return 12;
  }
  return 8;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await runCrawlerCandidateAudit();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}
