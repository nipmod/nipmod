import { describe, expect, test } from "vitest";
import { GET, OPTIONS } from "../app/api/openapi/route";

describe("OpenAPI route", () => {
  test("publishes the agent package API contract", async () => {
    const response = GET(new Request("https://nipmod.com/api/openapi"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("content-type")).toContain("application/openapi+json");
    expect(body.openapi).toBe("3.1.0");
    expect(body.info.title).toBe("Nipmod API");
    expect(Object.keys(body.paths)).toEqual([
      "/api/archive/prepare",
      "/api/archive/confirm",
      "/api/archive/search",
      "/api/archive/status",
      "/api/inspect",
      "/api/install-plan",
      "/api/mcp",
      "/api/resolve",
      "/api/search",
      "/api/sources/health"
    ]);
    expect(body.paths["/api/search"].get.summary).toContain("Search external package sources");
    expect(body.paths["/api/archive/prepare"].get.responses["200"].description).toContain("does not persist");
    expect(body.paths["/api/archive/confirm"].post.summary).toContain("authorized archive writer");
  });

  test("supports CORS preflight", () => {
    const response = OPTIONS(new Request("https://nipmod.com/api/openapi"));

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-methods")).toContain("GET");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });
});
