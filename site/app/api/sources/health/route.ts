import { apiOptions, createApiHttpContext } from "../../../../lib/api-http";
import { apiJsonWithUsage } from "../../../../lib/api-response";
import { usageStoreStatus } from "../../../../lib/api-usage";
import { externalSourceCapabilities } from "../../../../lib/external-packages";
import { archiveStoreStatus } from "../../../../lib/package-intelligence-store";
import { checkApiRateLimit } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS(request: Request): Response {
  return apiOptions(createApiHttpContext(request));
}

export async function GET(request: Request): Promise<Response> {
  const context = createApiHttpContext(request);
  const rateLimit = checkApiRateLimit(request, { limit: 240, name: "source-health", windowMs: 60_000 }, context);
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  const archive = archiveStoreStatus();
  const usage = usageStoreStatus();
  const sources = externalSourceCapabilities();
  return apiJsonWithUsage(
    request,
    {
      apiAccess: {
        authorizationHeaderSupported: true,
        keyHeaders: ["x-nipmod-api-key"],
        publicBeta: true,
        tiers: ["public", "builder", "partner", "admin"]
      },
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
      usage: {
        configured: usage.configured,
        driver: usage.driver,
        privacy: "hashed client, query and package identifiers only"
      },
      type: "dev.nipmod.source-health.v1"
    },
    {
      access: rateLimit.access,
      context,
      headers: rateLimit.headers
    }
  );
}
