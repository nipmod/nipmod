import { describe, expect, test, vi } from "vitest";
import { runSourceDepthCanary } from "./source-depth-canary.ts";

describe("source depth canary", () => {
  test("passes when every live source exposes depth signals", async () => {
    const fetchFn = vi.fn(async (input: string | URL | Request) => sourceResponse(String(input))) as unknown as typeof fetch;

    const result = await runSourceDepthCanary({ baseUrl: "https://nipmod.test", fetchFn });

    expect(result.ok).toBe(true);
    expect(result.summary).toEqual({ fail: 0, pass: 6, total: 6 });
    expect(result.checks.map((check) => check.name)).toEqual([
      "npm package depth",
      "PyPI package depth",
      "GitHub repository depth",
      "Hugging Face model depth",
      "Hugging Face dataset depth",
      "MCP registry depth"
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(6);
  });

  test("fails the source whose required signal disappears", async () => {
    const fetchFn = vi.fn(async (input: string | URL | Request) => {
      const response = await sourceResponse(String(input));
      if (String(input).includes("source=npm")) {
        const body = await response.json();
        body.record.trust.signals = body.record.trust.signals.filter((signal: string) => !signal.includes("npm registry signature"));
        return Response.json(body);
      }
      return response;
    }) as unknown as typeof fetch;

    const result = await runSourceDepthCanary({ baseUrl: "https://nipmod.test", fetchFn });

    expect(result.ok).toBe(false);
    expect(result.summary).toEqual({ fail: 1, pass: 5, total: 6 });
    expect(result.checks.find((check) => check.name === "npm package depth")).toMatchObject({
      error: expect.stringContaining("missing depth signal"),
      status: "fail"
    });
  });

  test("fails when a source regresses to a shallow trust dimension", async () => {
    const fetchFn = vi.fn(async (input: string | URL | Request) => {
      const response = await sourceResponse(String(input));
      if (String(input).includes("source=pypi")) {
        const body = await response.json();
        body.record.trust.dimensions.provenanceStatus = "unknown";
        return Response.json(body);
      }
      return response;
    }) as unknown as typeof fetch;

    const result = await runSourceDepthCanary({ baseUrl: "https://nipmod.test", fetchFn });

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === "PyPI package depth")).toMatchObject({
      error: expect.stringContaining("dimension provenanceStatus mismatch"),
      status: "fail"
    });
  });
});

async function sourceResponse(url: string): Promise<Response> {
  if (url.includes("source=npm")) {
    return inspectResponse({
      dimensions: { popularitySignal: "high", provenanceStatus: "signature", qualityScore: 80, securityConfidence: "high" },
      id: "npm:undici",
      signals: [
        "Latest tarball integrity metadata is present.",
        "npm registry signature metadata is present.",
        "Latest npm tarball host: registry.npmjs.org.",
        "Latest npm release file count: 412.",
        "npm returned 3 maintainer records.",
        "npm package declares Node engine: >=22."
      ],
      source: "npm"
    });
  }
  if (url.includes("source=pypi")) {
    return inspectResponse({
      dimensions: { popularitySignal: "none", provenanceStatus: "integrity", qualityScore: 85, securityConfidence: "medium" },
      id: "pypi:requests",
      signals: [
        "PyPI returned no vulnerabilities for the latest release.",
        "PyPI latest release files returned: 2.",
        "PyPI latest release files with digest metadata: 2.",
        "PyPI latest release file types: bdist_wheel, sdist.",
        "PyPI latest release files are not marked yanked.",
        "PyPI requires-python: >=3.10."
      ],
      source: "pypi"
    });
  }
  if (url.includes("source=github")) {
    return inspectResponse({
      dimensions: { popularitySignal: "high", provenanceStatus: "source-only", qualityScore: 78, securityConfidence: "medium" },
      id: "github:vercel/next.js",
      signals: [
        "Default branch: canary.",
        "Open issues returned by GitHub: 3926.",
        "GitHub forks returned: 31114.",
        "GitHub package manifests found: package.json.",
        "GitHub package.json declares 0 dependency entries.",
        "GitHub security files found: SECURITY.md, .github/dependabot.yml.",
        "GitHub lockfiles found: pnpm-lock.yaml.",
        "GitHub package.json package manager: pnpm@10.33.0."
      ],
      source: "github"
    });
  }
  if (url.includes("source=huggingface-model")) {
    return inspectResponse({
      dimensions: { popularitySignal: "high", provenanceStatus: "integrity", qualityScore: 75, securityConfidence: "medium" },
      id: "huggingface-model:google-bert/bert-base-uncased",
      signals: [
        "Hugging Face repository files returned: 16.",
        "Hugging Face README/model card file is present.",
        "Hugging Face config metadata file is present.",
        "Hugging Face safetensors weight file is present.",
        "Hugging Face commit digest metadata is present.",
        "Hugging Face gated access flag is not enabled for this model."
      ],
      source: "huggingface-model"
    });
  }
  if (url.includes("source=huggingface-dataset")) {
    return inspectResponse({
      dimensions: { popularitySignal: "medium", provenanceStatus: "integrity", qualityScore: 75, securityConfidence: "medium" },
      id: "huggingface-dataset:rajpurkar/squad",
      signals: [
        "Hugging Face repository files returned: 4.",
        "Hugging Face commit digest metadata is present.",
        "Hugging Face gated access flag is not enabled for this dataset."
      ],
      source: "huggingface-dataset"
    });
  }
  if (url.includes("source=mcp")) {
    return inspectResponse({
      dimensions: { popularitySignal: "none", provenanceStatus: "source-only", qualityScore: 70, securityConfidence: "medium" },
      id: "mcp:ac.tandem/docs-mcp",
      signals: [
        "MCP Registry status: active.",
        "Remote MCP endpoints returned: 1.",
        "MCP server did not declare environment requirements.",
        "Source repository is present."
      ],
      source: "mcp"
    });
  }
  return Response.json({ error: "not found" }, { status: 404 });
}

function inspectResponse({
  dimensions,
  id,
  signals,
  source
}: {
  dimensions: Record<string, unknown>;
  id: string;
  signals: string[];
  source: string;
}): Response {
  return Response.json({
    record: {
      id,
      source,
      trust: {
        decision: "recommended",
        dimensions,
        factors: [
          {
            category: "install",
            evidence: "Install command risk: low. Hosted API returns a plan only.",
            impact: "positive",
            label: "Install plan boundary"
          }
        ],
        score: dimensions.qualityScore,
        signals
      },
      type: "dev.nipmod.external-package.v1"
    },
    type: "dev.nipmod.external-inspect.v1"
  });
}
