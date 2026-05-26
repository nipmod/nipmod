import { afterEach, describe, expect, test, vi } from "vitest";
import { GET, OPTIONS } from "../app/api/openapi/route";
import { apiKeyHeaders, stubApiKeyAuth } from "./api-key-test-helper";

describe("OpenAPI route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("publishes the agent package API contract", async () => {
    stubApiKeyAuth();
    const response = await GET(new Request("https://nipmod.com/api/openapi", { headers: apiKeyHeaders() }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("content-type")).toContain("application/openapi+json");
    expect(body.openapi).toBe("3.1.0");
    expect(body.info.title).toBe("Nipmod API");
    expect(body.info.contact.email).toBe("info@nipmod.com");
    expect(body.components.securitySchemes.NipmodApiKey.name).toBe("x-nipmod-api-key");
    expect(body.security).not.toContainEqual({});
    expect(body["x-nipmod-agent-flow"]).toEqual([
      "search",
      "inspect",
      "install-plan",
      "optional-local-deep-scan",
      "host-approval",
      "optional-archive-confirm"
    ]);
    expect(body["x-nipmod-local-tools"].deepScan).toMatchObject({
      command: "nipmod deep-scan <path> --json",
      mcpTool: "nipmod.deep_scan",
      remoteMcpExposed: false
    });
    expect(body["x-nipmod-safety-boundary"]).toMatchObject({
      hostedApiRunsDeepScan: false,
      hostedApiExecutesCommands: false,
      hostedApiUnpacksArtifacts: false,
      hostedApiWritesCallerWorkspace: false,
      installPlanRequiresHostApproval: true,
      localDeepScanReadsExistingFilesOnly: true,
      packageMetadataIsInstruction: false,
      searchScoreIsInstallPermission: false
    });
    expect(Object.keys(body.paths)).toEqual([
      "/api/openapi",
      "/api/admin/summary",
      "/api/admin/keys",
      "/api/keys/beta",
      "/api/archive/prepare",
      "/api/archive/confirm",
      "/api/archive/search",
      "/api/archive/status",
      "/api/inspect",
      "/api/install-plan",
      "/api/mcp",
      "/api/resolve",
      "/api/search",
      "/api/stats",
      "/api/sources/health",
      "/api/usage/stats"
    ]);
    expect(body.paths["/api/openapi"].get.operationId).toBe("getOpenApiContract");
    expect(body.paths["/api/openapi"].get.responses["200"].content["application/openapi+json"].schema.$ref).toBe(
      "#/components/schemas/OpenApiDocument"
    );
    expect(body.paths["/api/admin/summary"].get.operationId).toBe("getAdminSummary");
    expect(body.paths["/api/admin/keys"].post.operationId).toBe("manageAdminApiKeys");
    expect(body.paths["/api/admin/keys"].post.responses["200"].content["application/json"].schema.$ref).toBe(
      "#/components/schemas/AdminKeyActionResponse"
    );
    expect(body.paths["/api/keys/beta"].post.operationId).toBe("issueBetaApiKey");
    expect(body.paths["/api/keys/beta"].post.security).toEqual([{}]);
    expect(body.paths["/api/keys/beta"].post.responses["200"].content["application/json"].schema.$ref).toBe(
      "#/components/schemas/BetaApiKeyIssueResponse"
    );
    expect(body.paths["/api/search"].get.summary).toContain("Search external package sources");
    expect(body.paths["/api/search"].get["x-nipmod-agent-step"]).toBe("search");
    expect(body.paths["/api/inspect"].get["x-nipmod-agent-step"]).toBe("inspect");
    expect(body.paths["/api/install-plan"].get["x-nipmod-agent-step"]).toBe("install-plan");
    expect(body.paths["/api/archive/prepare"].get.responses["200"].description).toContain("does not persist");
    expect(body.paths["/api/archive/prepare"].post.summary).toContain("posted external package");
    expect(body.paths["/api/archive/confirm"].post.summary).toContain("authorized archive writer");
    expect(body.paths["/api/install-plan"].post.summary).toContain("posted external package record");
    expect(body.components.schemas.ExternalPackageRecord.required).toEqual(
      expect.arrayContaining(["formatVersion", "displayName", "registryUrl", "sourceKind", "metrics"])
    );
    expect(body.components.schemas.ExternalPackageRecord.properties.archive.required).toContain("firstSeenReason");
    expect(body.components.schemas.ExternalPackageRecord.properties.metrics.$ref).toBe("#/components/schemas/ExternalPackageMetrics");
    expect(body.components.schemas.ExternalPackageRecord.properties.sourceEvidence.$ref).toBe("#/components/schemas/ExternalSourceEvidence");
    expect(body.components.schemas.ExternalPackageRecord.required).not.toContain("sourceEvidence");
    expect(body.components.schemas.ExternalPackageRecord.properties.agentRecommendation.$ref).toBe("#/components/schemas/PackageAgentRecommendation");
    expect(body.components.schemas.ExternalPackageRecord.properties.artifactIntelligence.$ref).toBe("#/components/schemas/PackageArtifactIntelligence");
    expect(body.components.schemas.ExternalPackageRecord.properties.sourceGraph.$ref).toBe("#/components/schemas/PackageSourceGraph");
    expect(body.components.schemas.ExternalPackageRecord.properties.trustTimeline.$ref).toBe("#/components/schemas/PackageTrustTimeline");
    expect(body.components.schemas.ExternalPackageRecord.required).not.toContain("agentRecommendation");
    expect(body.components.schemas.ExternalSourceEvidence.required).toEqual(["checks", "depthScore", "generatedAt", "limitations", "version"]);
    expect(body.components.schemas.ExternalSearchResult.required).toContain("agentRecommendation");
    expect(body.components.schemas.PackageAgentRecommendation.required).toEqual([
      "action",
      "installPlanRequired",
      "nextSteps",
      "summary",
      "version",
      "workspaceWriteAllowed"
    ]);
    expect(body.components.schemas.ExternalPackageRecord.properties.trust.$ref).toBe("#/components/schemas/ExternalPackageTrust");
    expect(body.components.schemas.ExternalPackageTrust.required).toContain("checkedAt");
    expect(body.components.schemas.ExternalPackageTrust.required).toContain("dimensions");
    expect(body.components.schemas.ExternalTrustDimensions.required).toEqual([
      "popularitySignal",
      "provenanceStatus",
      "qualityScore",
      "securityConfidence"
    ]);
    expect(body.components.schemas.ExternalSourceReport.required).toContain("resolver");
    expect(body.components.schemas.ExternalSourceReport.required).toContain("circuit");
    expect(body.components.schemas.ExternalSourceReport.required).toContain("recovery");
    expect(body.components.schemas.ExternalSourceCapability.required).toContain("quality");
    expect(body.components.schemas.ExternalSourceQualityProfile.required).toEqual([
      "assessmentVersion",
      "bestFor",
      "coverage",
      "depthScore",
      "inspectDepth",
      "limitations",
      "notClaimed",
      "searchDepth",
      "strengths",
      "targetDepthScore"
    ]);
    expect(body.components.schemas.ExternalSourceCircuitReport.required).toEqual([
      "failureCount",
      "lastErrorCode",
      "lastFailureAt",
      "openedUntil",
      "status"
    ]);
    expect(body.components.schemas.ExternalSourceResolverProfile.required).toContain("normalization");
    expect(body.components.schemas.ExternalInstallPlan.required).toEqual(["generatedAt", "package", "plan", "safety", "type"]);
    expect(body.components.schemas.ExternalInstallPlan.properties.plan.required).toContain("commandDetails");
    expect(body.components.schemas.ExternalInstallPlan.properties.safety.required).toContain("blocked");
    expect(body.components.schemas.PackageIntelligenceRecord.required).toEqual(
      expect.arrayContaining(["archive", "installPlan", "ownership", "security", "sourceRecord", "trust"])
    );
    expect(body.components.schemas.PackageIntelligenceValidation.required).toContain("eligibility");
    expect(body.components.schemas.ArchivePrepareResponse.required).toEqual([
      "eligibility",
      "next",
      "preparedOnly",
      "receiptPreview",
      "record",
      "store",
      "stored",
      "type",
      "validation"
    ]);
    expect(body.components.schemas.ArchiveConfirmResponse.required).toEqual(["eligibility", "receipt", "record", "stored", "type", "validation"]);
    expect(body.components.schemas.SourceHealthResponse.required).toEqual([
      "apiAccess",
      "archive",
      "generatedAt",
      "probe",
      "rateLimit",
      "sources",
      "summary",
      "type",
      "usage"
    ]);
    expect(body.components.schemas.SourceHealthResponse.properties.apiAccess.required).toContain("keyRequired");
    expect(body.paths["/api/search"].get.responses["200"].content["application/json"].schema.$ref).toBe(
      "#/components/schemas/ExternalSearchResult"
    );
    expect(body.paths["/api/inspect"].get.responses["200"].content["application/json"].schema.$ref).toBe(
      "#/components/schemas/ExternalInspectResponse"
    );
    expect(body.paths["/api/install-plan"].get.responses["200"].content["application/json"].schema.$ref).toBe(
      "#/components/schemas/ExternalInstallPlan"
    );
    expect(body.paths["/api/archive/search"].get.responses["200"].content["application/json"].schema.$ref).toBe(
      "#/components/schemas/ArchiveSearchResponse"
    );
    expect(body.paths["/api/archive/status"].get.responses["200"].content["application/json"].schema.$ref).toBe(
      "#/components/schemas/ArchiveStatusResponse"
    );
    expect(body.paths["/api/sources/health"].get.responses["200"].content["application/json"].schema.$ref).toBe(
      "#/components/schemas/SourceHealthResponse"
    );
    expect(body.paths["/api/stats"].get.operationId).toBe("getPublicStats");
    expect(body.paths["/api/stats"].get.responses["200"].content["application/json"].schema.$ref).toBe(
      "#/components/schemas/PublicStatsResponse"
    );
    expect(body.components.schemas.PublicStatsResponse.required).toContain("external");
    expect(body.paths["/api/usage/stats"].get.responses["200"].content["application/json"].schema.$ref).toBe(
      "#/components/schemas/ApiUsageMetrics"
    );
    expect(body.components.schemas.ApiUsageMetrics.required).toContain("trustDecisions");
    expect(body.components.schemas.ApiUsageMetrics.required).toContain("installPlans");
    expect(body.components.schemas.ApiUsageMetrics.required).toContain("archiveWrites");
    expect(body.components.schemas.ApiUsageMetrics.required).toContain("trafficOrigins");
    expect(body.components.schemas.ApiUsageMetrics.required).toContain("trafficSummary");
    expect(body.components.schemas.ApiUsageTrafficSummary.required).toContain("externalRequestCount");
    expect(body.paths["/api/usage/stats"].get.responses["403"].description).toBe("Structured API error.");
    expect(body.paths["/api/mcp"].post.responses["200"].content["application/json"].schema.oneOf).toHaveLength(2);
    expect(body.paths["/api/archive/search"].get.parameters[1].schema.maximum).toBe(100);
    expect(body.paths["/api/archive/confirm"].post.responses["422"].description).toContain("validation failed");
    for (const path of Object.values(body.paths)) {
      for (const operation of Object.values(path as Record<string, any>)) {
        expect(operation.responses["200"].content?.["application/json"]?.schema).toBeTruthy();
      }
    }
  });

  test("supports CORS preflight", () => {
    const response = OPTIONS(new Request("https://nipmod.com/api/openapi"));

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-methods")).toContain("GET");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });
});
