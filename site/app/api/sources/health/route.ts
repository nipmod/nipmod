import { apiJson, apiOptions, createApiHttpContext } from "../../../../lib/api-http";
import { externalSourceCapabilities } from "../../../../lib/external-packages";
import { archiveStoreStatus } from "../../../../lib/package-intelligence-store";
import { checkRateLimit } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS(request: Request): Response {
  return apiOptions(createApiHttpContext(request));
}

export function GET(request: Request): Response {
  const context = createApiHttpContext(request);
  const rateLimit = checkRateLimit(request, { limit: 240, name: "source-health", windowMs: 60_000 }, context);
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  const archive = archiveStoreStatus();
  const sources = externalSourceCapabilities();
  return apiJson(
    {
      archive: {
        configured: archive.configured,
        driver: archive.driver,
        mode: archive.configured ? "durable-archive-enabled" : "resolver-only-safe-mode"
      },
      generatedAt: new Date().toISOString(),
      sources,
      summary: {
        available: sources.length,
        optionalAuthConfigured: sources.filter((source) => source.authConfigured).length,
        requested: sources.length,
        workspaceWritesFromHostedApi: false
      },
      type: "dev.nipmod.source-health.v1"
    },
    {
      context,
      headers: rateLimit.headers
    }
  );
}
