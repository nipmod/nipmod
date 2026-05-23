import { describe, expect, test } from "vitest";
import { GET, OPTIONS } from "../app/api/openapi/route";

describe("OpenAPI route", () => {
  test("publishes the agent package API contract", async () => {
    const response = await GET(new Request("https://nipmod.com/api/openapi"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("content-type")).toContain("application/openapi+json");
    expect(body.openapi).toBe("3.1.0");
    expect(body.info.title).toBe("Nipmod API");
    expect(body.components.securitySchemes.NipmodApiKey.name).toBe("x-nipmod-api-key");
    expect(body.security).toContainEqual({});
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
    expect(body.paths["/api/archive/prepare"].post.summary).toContain("posted external package");
    expect(body.paths["/api/archive/confirm"].post.summary).toContain("authorized archive writer");
    expect(body.paths["/api/install-plan"].post.summary).toContain("posted external package record");
    expect(body.components.schemas.ExternalPackageRecord.required).toEqual(
      expect.arrayContaining(["formatVersion", "displayName", "registryUrl", "sourceKind", "metrics"])
    );
    expect(body.components.schemas.ExternalPackageRecord.properties.trust.required).toContain("checkedAt");
    expect(body.components.schemas.ExternalPackageRecord.properties.trust.required).toContain("dimensions");
    expect(body.components.schemas.ExternalTrustDimensions.required).toEqual([
      "popularitySignal",
      "provenanceStatus",
      "qualityScore",
      "securityConfidence"
    ]);
    expect(body.components.schemas.ExternalSourceReport.required).toContain("resolver");
    expect(body.components.schemas.ExternalSourceReport.required).toContain("circuit");
    expect(body.components.schemas.ExternalSourceCircuitReport.required).toEqual([
      "failureCount",
      "lastErrorCode",
      "lastFailureAt",
      "openedUntil",
      "status"
    ]);
    expect(body.components.schemas.ExternalSourceResolverProfile.required).toContain("normalization");
    expect(body.paths["/api/search"].get.responses["200"].content["application/json"].schema.$ref).toBe(
      "#/components/schemas/ExternalSearchResult"
    );
    expect(body.paths["/api/archive/search"].get.parameters[1].schema.maximum).toBe(100);
    expect(body.paths["/api/archive/confirm"].post.responses["422"].description).toContain("validation failed");
  });

  test("supports CORS preflight", () => {
    const response = OPTIONS(new Request("https://nipmod.com/api/openapi"));

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-methods")).toContain("GET");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });
});
