import { describe, expect, test } from "vitest";
import { GET, OPTIONS } from "../app/api/sources/health/route";

describe("source health route", () => {
  test("publishes source capability metadata without secrets or workspace writes", async () => {
    const response = GET(new Request("https://nipmod.com/api/sources/health", { headers: { "x-request-id": "source-health-test" } }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("x-nipmod-request-id")).toBe("source-health-test");
    expect(body).toMatchObject({
      summary: {
        workspaceWritesFromHostedApi: false
      },
      type: "dev.nipmod.source-health.v1"
    });
    expect(body.sources.map((source: { source: string }) => source.source)).toEqual([
      "npm",
      "pypi",
      "github",
      "huggingface-model",
      "huggingface-dataset",
      "mcp"
    ]);
    expect(body.sources.every((source: { installPlanWritesWorkspace: boolean }) => source.installPlanWritesWorkspace === false)).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/secret|service-role|bearer|publishable-key/i);
  });

  test("supports CORS preflight", () => {
    const response = OPTIONS(new Request("https://nipmod.com/api/sources/health"));

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-methods")).toContain("GET");
  });
});
