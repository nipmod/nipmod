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

    expect(response.status).toBe(502);
    expect(body).toMatchObject({
      code: "all_sources_failed",
      retryable: true,
      source: null,
      status: 502,
      type: "dev.nipmod.api-error.v1"
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

  return jsonResponse({ error: "not found" }, 404);
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}
