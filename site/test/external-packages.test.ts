import { afterEach, describe, expect, test, vi } from "vitest";
import { GET as inspectGet } from "../app/api/inspect/route";
import { GET as installPlanGet, POST as installPlanPost } from "../app/api/install-plan/route";
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
    expect(searchBody.records[0]).toMatchObject({
      archive: { status: "external_indexed" },
      id: "npm:node-telegram-bot-api",
      source: "npm"
    });
    expect(searchBody.archivePolicy.ownership).toContain("Original package owners");

    const inspect = await inspectGet(new Request("https://nipmod.com/api/inspect?source=npm&name=node-telegram-bot-api"));
    const inspectBody = await inspect.json();
    expect(inspectBody.record.id).toBe("npm:node-telegram-bot-api");

    const plan = await installPlanGet(new Request("https://nipmod.com/api/install-plan?source=npm&name=node-telegram-bot-api"));
    const planBody = await plan.json();
    expect(planBody.plan.commands).toEqual(["npm install node-telegram-bot-api"]);

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
