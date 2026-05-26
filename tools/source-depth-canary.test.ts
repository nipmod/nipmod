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
        "npm latest publish age hours: 240.",
        "OSV returned no known vulnerabilities for this npm package/version.",
        "npm returned 3 maintainer records.",
        "npm package declares Node engine: >=22."
      ],
      source: "npm"
    });
  }
  if (url.includes("source=pypi")) {
    return inspectResponse({
      dimensions: { popularitySignal: "none", provenanceStatus: "attested", qualityScore: 85, securityConfidence: "medium" },
      id: "pypi:requests",
      signals: [
        "PyPI returned no vulnerabilities for the latest release.",
        "OSV returned no known vulnerabilities for this PyPI package/version.",
        "PyPI latest release files returned: 2.",
        "PyPI latest release files with digest metadata: 2.",
        "PyPI simple API provenance links returned for 2 latest release file(s).",
        "PyPI simple API core metadata hashes returned for 1 latest release file(s).",
        "PyPI latest release file types: bdist_wheel, sdist.",
        "PyPI latest release files are not marked yanked.",
        "PyPI requires-python: >=3.10.",
        "PyPI latest publish age hours: 240."
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
        "GitHub workflow/Dockerfile risk scan found no high-risk patterns in probed files.",
        "GitHub latest release asset count: 2.",
        "GitHub latest default-branch commit date: 2026-05-01T00:00:00.000Z.",
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
        "Hugging Face pickle/binary weight files were not returned.",
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
        "MCP schema URL returned: https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json.",
        "Remote MCP endpoints returned: 1.",
        "MCP remote endpoint HTTPS count: 1; non-HTTPS count: 0; host count: 1.",
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
      sourceEvidence: {
        checks: sourceEvidenceIds(source).map((checkId) => ({
          evidence: `fixture evidence for ${checkId}`,
          id: checkId,
          label: checkId,
          status: "pass"
        })),
        depthScore: 95,
        generatedAt: "2026-05-26T00:00:00.000Z",
        limitations: [],
        version: "source-evidence-v1"
      },
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

function sourceEvidenceIds(source: string): string[] {
  switch (source) {
    case "npm":
      return [
        "npm.manifest.latest",
        "npm.tarball.integrity",
        "npm.registry.signature",
        "npm.packument.versions",
        "npm.dist_tags",
        "npm.version_intelligence",
        "npm.osv",
        "npm.artifact_shape",
        "npm.lifecycle"
      ];
    case "pypi":
      return [
        "pypi.project.json",
        "pypi.vulnerabilities",
        "pypi.osv",
        "pypi.release.files",
        "pypi.file.digests",
        "pypi.simple.provenance",
        "pypi.core_metadata",
        "pypi.release_shape",
        "pypi.yanked",
        "pypi.requires_python",
        "pypi.version_intelligence",
        "pypi.release_history"
      ];
    case "github":
      return [
        "github.repo.metadata",
        "github.activity",
        "github.default_branch",
        "github.manifests",
        "github.lockfiles",
        "github.security",
        "github.content_risk",
        "github.release_assets",
        "github.default_branch_commit"
      ];
    case "huggingface-model":
      return ["hf.card_data", "hf.files", "hf.readme", "hf.config", "hf.safetensors", "hf.file_shape", "hf.remote_code", "hf.commit", "hf.gated"];
    case "huggingface-dataset":
      return [
        "hf.card_data",
        "hf.dataset_info",
        "hf.dataset_features",
        "hf.dataset_splits",
        "hf.files",
        "hf.dataset_files",
        "hf.readme",
        "hf.commit",
        "hf.gated",
        "hf.script_files"
      ];
    case "mcp":
      return [
        "mcp.registry.status",
        "mcp.schema",
        "mcp.remote_endpoints",
        "mcp.endpoint_security",
        "mcp.env_requirements",
        "mcp.credential_scope",
        "mcp.source_repo",
        "mcp.transport"
      ];
    default:
      return [];
  }
}
