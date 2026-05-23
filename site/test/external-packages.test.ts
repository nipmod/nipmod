import { afterEach, describe, expect, test, vi } from "vitest";
import { GET as inspectGet } from "../app/api/inspect/route";
import { GET as installPlanGet, POST as installPlanPost } from "../app/api/install-plan/route";
import { GET as resolveGet } from "../app/api/resolve/route";
import { GET as searchGet } from "../app/api/search/route";
import {
  createExternalInstallPlan,
  inspectExternalPackage,
  searchExternalPackages,
  type ExternalPackageRecord
} from "../lib/external-packages";

describe("external package resolver", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("normalizes external source results into agent-readable records", async () => {
    const result = await searchExternalPackages("telegram bot", {
      fetchImpl: mockFetch,
      limit: 4,
      sources: ["npm", "huggingface-model"]
    });

    expect(result.type).toBe("dev.nipmod.external-search.v1");
    expect(result.records.map((record) => record.id)).toContain("npm:node-telegram-bot-api");
    expect(result.records.map((record) => record.id)).toContain("huggingface-model:IlyaGusev/rut5_base_headline_gen_telegram");
    expect(result.records.every((record) => record.archive.status === "external_indexed")).toBe(true);
    expect(result.records.every((record) => record.archive.persistence === "ephemeral")).toBe(true);
    expect(result.partial).toBe(false);
    expect(result.sourceSummary).toMatchObject({ failed: 0, ok: 2, requested: 2 });
    expect(result.sourceReports.map((report) => report.source)).toEqual(["npm", "huggingface-model"]);
    expect(result.sourceReports.every((report) => report.durationMs >= 0)).toBe(true);

    const npmRecord = result.records.find((record) => record.id === "npm:node-telegram-bot-api");
    expect(npmRecord?.trust.dimensions).toMatchObject({
      popularitySignal: "high",
      provenanceStatus: "source-only",
      securityConfidence: "medium"
    });
  });

  test("reports partial source failures without hiding successful records", async () => {
    const result = await searchExternalPackages("telegram bot", {
      fetchImpl: mockFetch,
      limit: 4,
      sources: ["npm", "github"]
    });

    expect(result.partial).toBe(true);
    expect(result.records.map((record) => record.id)).toContain("npm:node-telegram-bot-api");
    expect(result.sourceSummary).toMatchObject({ failed: 1, ok: 1, requested: 2 });
    expect(result.sourceReports.find((report) => report.source === "github")).toMatchObject({
      error: { code: "source_not_found", retryable: false, status: 404 },
      recordCount: 0,
      status: "failed"
    });
  });

  test("inspects exact packages and creates safe install plans", async () => {
    const record = await inspectExternalPackage("npm", "node-telegram-bot-api", { fetchImpl: mockFetch });
    const plan = createExternalInstallPlan(record);

    expect(record.originalUrl).toBe("https://www.npmjs.com/package/node-telegram-bot-api");
    expect(record.install.command).toBe("npm install node-telegram-bot-api");
    expect(plan.type).toBe("dev.nipmod.external-install-plan.v1");
    expect(plan.plan.requiresApprovalBeforeWrite).toBe(true);
    expect(plan.plan.sourceOwnership).toBe("external-owner-retained");
    expect(plan.plan.commands).toEqual(["npm install node-telegram-bot-api"]);
  });

  test("uses compact npm latest manifests for popular packages", async () => {
    const requestedUrls: string[] = [];
    const fetchImpl = async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      requestedUrls.push(url);
      if (url === "https://registry.npmjs.org/react") {
        return new Response("x".repeat(2_500_000), {
          headers: { "content-type": "application/json" },
          status: 200
        });
      }
      if (url === "https://registry.npmjs.org/react/latest") {
        return jsonResponse({
          _npmUser: { name: "react-bot" },
          description: "React is a JavaScript library for building user interfaces.",
          dist: {
            integrity: "sha512-test",
            signatures: [{ keyid: "SHA256:test", sig: "test" }]
          },
          license: "MIT",
          name: "react",
          repository: { url: "git+https://github.com/facebook/react.git" },
          version: "19.2.6"
        });
      }
      if (url === "https://api.npmjs.org/downloads/point/last-month/react") {
        return jsonResponse({ downloads: 561_906_819, package: "react" });
      }
      return jsonResponse({ error: "not found" }, 404);
    };

    const record = await inspectExternalPackage("npm", "react", { fetchImpl });
    const plan = createExternalInstallPlan(record);

    expect(requestedUrls).toContain("https://registry.npmjs.org/react/latest");
    expect(requestedUrls).not.toContain("https://registry.npmjs.org/react");
    expect(record.id).toBe("npm:react");
    expect(record.metrics.downloads).toBe(561_906_819);
    expect(record.trust.policy.version).toBe("external-v2");
    expect(record.trust.dimensions).toMatchObject({
      popularitySignal: "high",
      provenanceStatus: "signature",
      securityConfidence: "high"
    });
    expect(record.trust.dimensions.qualityScore).toBeGreaterThanOrEqual(70);
    expect(record.trust.factors.map((factor) => factor.label)).toContain("Install plan boundary");
    expect(record.trust.factors.some((factor) => factor.category === "security" && factor.evidence.includes("integrity"))).toBe(true);
    expect(record.trust.signals).toContain("Latest tarball integrity metadata is present.");
    expect(record.trust.signals).toContain("npm registry signature metadata is present.");
    expect(plan.plan.commands).toEqual(["npm install react"]);
  });

  test("normalizes current MCP registry server records", async () => {
    const result = await searchExternalPackages("tandem docs", {
      fetchImpl: mockFetch,
      limit: 3,
      sources: ["mcp"]
    });
    const record = await inspectExternalPackage("mcp", "ac.tandem/docs-mcp", { fetchImpl: mockFetch });

    expect(result.records.map((item) => item.id)).toContain("mcp:ac.tandem/docs-mcp");
    expect(result.records.map((item) => item.version)).toContain("0.3.1");
    expect(result.records.map((item) => item.version)).not.toContain("0.3.0");
    expect(record).toMatchObject({
      displayName: "Tandem docs",
      id: "mcp:ac.tandem/docs-mcp",
      originalUrl: "https://github.com/frumu-ai/tandem",
      repo: "https://github.com/frumu-ai/tandem",
      source: "mcp",
      version: "0.3.1"
    });
    expect(record.trust.signals).toContain("MCP Registry status: active.");
  });

  test("keeps known MCP results available when the live registry is unavailable", async () => {
    const result = await searchExternalPackages("tandem", {
      fetchImpl: async () => {
        throw new TypeError("network unavailable");
      },
      limit: 3,
      sources: ["mcp"],
      timeoutMs: 20
    });

    expect(result.partial).toBe(false);
    expect(result.records[0]).toMatchObject({
      id: "mcp:ac.tandem/docs-mcp",
      source: "mcp",
      version: "0.3.2"
    });
    expect(result.records[0]?.trust.warnings.join(" ")).toContain("pinned public registry snapshot");
  });

  test("publishes search, inspect and install-plan API routes", async () => {
    vi.stubGlobal("fetch", mockFetch);

    const search = await searchGet(new Request("https://nipmod.com/api/search?q=telegram&sources=npm&limit=2"));
    const searchBody = await search.json();
    expect(search.status).toBe(200);
    expect(search.headers.get("access-control-allow-origin")).toBe("*");
    expect(search.headers.get("x-nipmod-api-version")).toBe("2026-05-22");
    expect(search.headers.get("x-nipmod-request-id")).toBeTruthy();
    expect(searchBody.records[0]).toMatchObject({
      archive: { status: "external_indexed" },
      id: "npm:node-telegram-bot-api",
      source: "npm"
    });
    expect(searchBody.sourceReports[0]).toMatchObject({ source: "npm", status: "ok" });
    expect(searchBody.archivePolicy.ownership).toContain("Original package owners");

    const resolve = await resolveGet(new Request("https://nipmod.com/api/resolve?q=telegram&sources=npm&limit=2"));
    const resolveBody = await resolve.json();
    expect(resolve.status).toBe(200);
    expect(resolveBody.records[0]).toMatchObject({ id: "npm:node-telegram-bot-api", source: "npm" });

    const inspect = await inspectGet(new Request("https://nipmod.com/api/inspect?source=npm&name=node-telegram-bot-api"));
    const inspectBody = await inspect.json();
    expect(inspectBody.record.id).toBe("npm:node-telegram-bot-api");

    const plan = await installPlanGet(new Request("https://nipmod.com/api/install-plan?source=npm&name=node-telegram-bot-api"));
    const planBody = await plan.json();
    expect(planBody.plan.commands).toEqual(["npm install node-telegram-bot-api"]);
    expect(planBody.safety).toMatchObject({
      commandRisk: "low",
      metadataIsInstruction: false,
      requiresApprovalBeforeWrite: true
    });

    const postPlan = await installPlanPost(
      new Request("https://nipmod.com/api/install-plan", {
        body: JSON.stringify({ record: inspectBody.record as ExternalPackageRecord }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    );
    const postPlanBody = await postPlan.json();
    expect(postPlanBody.package.id).toBe("npm:node-telegram-bot-api");
  });

  test("strictly validates posted external records before creating install plans", async () => {
    vi.stubGlobal("fetch", mockFetch);

    const inspect = await inspectGet(new Request("https://nipmod.com/api/inspect?source=npm&name=node-telegram-bot-api"));
    const inspectBody = await inspect.json();
    const record = inspectBody.record as ExternalPackageRecord;

    const unsafeUrl = await installPlanPost(
      new Request("https://nipmod.com/api/install-plan", {
        body: JSON.stringify({ record: { ...record, originalUrl: "file:///etc/passwd" } }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    );
    const unsafeUrlBody = await unsafeUrl.json();
    expect(unsafeUrl.status).toBe(400);
    expect(unsafeUrlBody).toMatchObject({
      code: "invalid_record",
      status: 400,
      type: "dev.nipmod.api-error.v1"
    });
    expect(unsafeUrlBody.error).toContain("originalUrl");

    const incomplete = await installPlanPost(
      new Request("https://nipmod.com/api/install-plan", {
        body: JSON.stringify({ record: { id: "npm:broken", type: "dev.nipmod.external-package.v1" } }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    );
    const incompleteBody = await incomplete.json();
    expect(incomplete.status).toBe(400);
    expect(incompleteBody.code).toBe("invalid_record");
  });

  test("returns structured API errors when all requested sources fail", async () => {
    vi.stubGlobal("fetch", mockFetch);

    const response = await searchGet(new Request("https://nipmod.com/api/search?q=missing&sources=github&limit=2"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toMatchObject({
      code: "source_not_found",
      retryable: false,
      source: "github",
      status: 404,
      type: "dev.nipmod.api-error.v1"
    });
  });

  test("preserves timeout status when every requested source times out", async () => {
    const response = await searchExternalPackages("timeout", {
      fetchImpl: async () => {
        throw new DOMException("aborted", "AbortError");
      },
      sources: ["npm", "github"],
      timeoutMs: 1
    }).catch((error) => error);

    expect(response).toMatchObject({
      code: "all_sources_timeout",
      retryable: true,
      status: 504
    });
  });

  test("treats reported vulnerabilities as negative trust evidence", async () => {
    const record = await inspectExternalPackage("pypi", "risky-package", {
      fetchImpl: async () =>
        jsonResponse({
          info: {
            classifiers: ["License :: OSI Approved :: MIT License"],
            name: "risky-package",
            package_url: "https://pypi.org/project/risky-package/",
            project_urls: { Source: "https://github.com/example/risky-package" },
            summary: "Risk fixture.",
            version: "1.0.0"
          },
          releases: { "1.0.0": [{ upload_time_iso_8601: "2026-05-01T00:00:00.000Z" }] },
          vulnerabilities: [{ id: "PYSEC-test" }]
        })
    });

    expect(record.trust.warnings).toContain("PyPI reports 1 known vulnerabilities for the latest release.");
    expect(record.trust.dimensions).toMatchObject({
      popularitySignal: "none",
      provenanceStatus: "source-only",
      securityConfidence: "low"
    });
    expect(record.trust.factors).toContainEqual(
      expect.objectContaining({
        category: "security",
        evidence: "PyPI returned vulnerability records.",
        impact: "negative"
      })
    );
  });

  test("aborts oversized source bodies before full buffering", async () => {
    const chunk = new Uint8Array(1_100_000).fill(120);
    const error = await inspectExternalPackage("npm", "oversized", {
      fetchImpl: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              controller.enqueue(chunk);
              controller.enqueue(chunk);
              controller.close();
            }
          }),
          { headers: { "content-type": "application/json" }, status: 200 }
        )
    }).catch((caught) => caught);

    expect(error).toMatchObject({
      code: "source_response_too_large",
      status: 502
    });
  });

  test("rejects invalid source and limit parameters instead of silently widening search", async () => {
    const badSource = await searchGet(new Request("https://nipmod.com/api/search?q=http&sources=npm,bad-source&limit=2"));
    const badSourceBody = await badSource.json();
    expect(badSource.status).toBe(400);
    expect(badSourceBody).toMatchObject({
      code: "invalid_source",
      retryable: false,
      status: 400,
      type: "dev.nipmod.api-error.v1"
    });

    const badLimit = await searchGet(new Request("https://nipmod.com/api/search?q=http&sources=npm&limit=two"));
    const badLimitBody = await badLimit.json();
    expect(badLimit.status).toBe(400);
    expect(badLimitBody).toMatchObject({
      code: "invalid_limit",
      retryable: false,
      status: 400,
      type: "dev.nipmod.api-error.v1"
    });

    const tooLargeLimit = await searchGet(new Request("https://nipmod.com/api/search?q=http&sources=npm&limit=51"));
    const tooLargeLimitBody = await tooLargeLimit.json();
    expect(tooLargeLimit.status).toBe(400);
    expect(tooLargeLimitBody.code).toBe("invalid_limit");
  });
});

async function mockFetch(input: string | URL | Request): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

  if (url.includes("registry.npmjs.org/-/v1/search")) {
    return jsonResponse({
      objects: [
        {
          dependents: "652",
          downloads: { monthly: 1_018_117, weekly: 247_635 },
          flags: { insecure: 0 },
          package: {
            date: "2025-12-13T02:21:02.338Z",
            description: "Telegram Bot API",
            license: "MIT",
            links: {
              npm: "https://www.npmjs.com/package/node-telegram-bot-api",
              repository: "git+https://github.com/yagop/node-telegram-bot-api.git"
            },
            name: "node-telegram-bot-api",
            publisher: { username: "gochomugo" },
            version: "0.67.0"
          },
          score: { detail: { maintenance: 1, popularity: 1, quality: 1 } },
          updated: "2026-05-21T08:43:37.654Z"
        }
      ]
    });
  }

  if (url.includes("registry.npmjs.org/node-telegram-bot-api")) {
    return jsonResponse({
      description: "Telegram Bot API",
      "dist-tags": { latest: "0.67.0" },
      name: "node-telegram-bot-api",
      time: {
        "0.67.0": "2025-12-13T02:21:02.338Z",
        modified: "2026-05-21T08:43:37.654Z"
      },
      versions: {
        "0.67.0": {
          description: "Telegram Bot API",
          homepage: "https://github.com/yagop/node-telegram-bot-api",
          license: "MIT",
          repository: { url: "git+https://github.com/yagop/node-telegram-bot-api.git" }
        }
      }
    });
  }

  if (url.includes("huggingface.co/api/models")) {
    return jsonResponse([
      {
        createdAt: "2022-03-02T23:29:04.000Z",
        downloads: 630_472,
        id: "IlyaGusev/rut5_base_headline_gen_telegram",
        likes: 9,
        modelId: "IlyaGusev/rut5_base_headline_gen_telegram",
        pipeline_tag: "summarization",
        tags: ["transformers", "license:apache-2.0"]
      }
    ]);
  }

  if (url.includes("registry.modelcontextprotocol.io/v0.1/servers")) {
    return jsonResponse({
      servers: [
        {
          _meta: {
            "io.modelcontextprotocol.registry/official": {
              isLatest: false,
              status: "active",
              updatedAt: "2026-04-02T11:22:40.005Z"
            }
          },
          server: {
            description: "Remote MCP server for Tandem docs.",
            name: "ac.tandem/docs-mcp",
            repository: { source: "github", url: "https://github.com/frumu-ai/tandem" },
            title: "Tandem docs",
            version: "0.3.0"
          }
        },
        {
          _meta: {
            "io.modelcontextprotocol.registry/official": {
              isLatest: true,
              status: "active",
              updatedAt: "2026-04-04T11:22:40.005Z"
            }
          },
          server: {
            description: "Remote MCP server for Tandem docs, install guides, SDKs and workflows.",
            name: "ac.tandem/docs-mcp",
            remotes: [{ type: "streamable-http", url: "https://tandem.ac/mcp" }],
            repository: { source: "github", url: "https://github.com/frumu-ai/tandem" },
            title: "Tandem docs",
            version: "0.3.1"
          }
        }
      ]
    });
  }

  return jsonResponse({ error: "not found" }, 404);
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}
