import { describe, expect, test, vi } from "vitest";
import { classifyCandidate, runCrawlerCandidateAudit, type CandidateDefinition } from "./source-crawler-candidate-audit.ts";

const NOW = new Date("2026-05-23T00:00:00.000Z");

describe("source crawler candidate audit", () => {
  test("classifies Crawlee as the preferred TypeScript worker candidate", () => {
    const result = classifyCandidate(
      { repo: "apify/crawlee", role: "crawler-worker", stack: "typescript" },
      repoMetadata("apify/crawlee", "Apache-2.0", 23000),
      NOW
    );

    expect(result.decision).toBe("preferred_worker_candidate");
    expect(result.directDependencyAllowed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.notes.join(" ")).toContain("TypeScript-native");
  });

  test("blocks AGPL crawler runtimes from direct public API dependency use", () => {
    const result = classifyCandidate(
      { repo: "firecrawl/firecrawl", role: "hosted-ai-crawler", stack: "service" },
      repoMetadata("firecrawl/firecrawl", "AGPL-3.0", 120000),
      NOW
    );

    expect(result.decision).toBe("external_service_only");
    expect(result.directDependencyAllowed).toBe(false);
    expect(result.notes.join(" ")).toContain("AGPL");
  });

  test("keeps off-stack crawler frameworks as references or service-boundary candidates", () => {
    const crawl4ai = classifyCandidate(
      { repo: "unclecode/crawl4ai", role: "llm-extraction-service", stack: "python" },
      repoMetadata("unclecode/crawl4ai", "Apache-2.0", 65000),
      NOW
    );
    const scrapy = classifyCandidate(
      { repo: "scrapy/scrapy", role: "crawler-reference", stack: "python" },
      repoMetadata("scrapy/scrapy", "BSD-3-Clause", 61000),
      NOW
    );

    expect(crawl4ai.decision).toBe("evaluate_service_boundary");
    expect(scrapy.decision).toBe("reference_only");
    expect(scrapy.directDependencyAllowed).toBe(false);
  });

  test("runs the full candidate audit from GitHub metadata", async () => {
    const candidates: CandidateDefinition[] = [
      { repo: "apify/crawlee", role: "crawler-worker", stack: "typescript" },
      { repo: "firecrawl/firecrawl", role: "hosted-ai-crawler", stack: "service" },
      { repo: "cheeriojs/cheerio", role: "html-parser", stack: "javascript" }
    ];
    const fetchFn = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const repo = url.replace("https://api.github.com/repos/", "");
      const license = repo === "firecrawl/firecrawl" ? "AGPL-3.0" : "MIT";
      return Response.json(repoMetadata(repo, license, repo === "apify/crawlee" ? 23000 : 12000));
    }) as unknown as typeof fetch;

    const result = await runCrawlerCandidateAudit({ candidates, fetchFn, now: NOW });

    expect(result.ok).toBe(true);
    expect(result.summary).toMatchObject({ directBlocked: 1, evaluated: 3, failed: 0, preferred: 1 });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
});

function repoMetadata(repo: string, spdxId: string, stars: number) {
  return {
    description: `${repo} description`,
    forks_count: Math.round(stars / 8),
    html_url: `https://github.com/${repo}`,
    license: {
      name: spdxId === "NOASSERTION" ? "Unknown" : `${spdxId} License`,
      spdx_id: spdxId
    },
    stargazers_count: stars,
    updated_at: "2026-05-20T00:00:00.000Z"
  };
}
