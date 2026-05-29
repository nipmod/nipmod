import { ArchiveStoreError, archiveStoreStatus, searchPackageIntelligenceArchive } from "../../../../lib/package-intelligence-store";
import { ExternalPackageError, externalPackageApiError } from "../../../../lib/external-packages";
import { apiOptions, createApiHttpContext } from "../../../../lib/api-http";
import { apiJsonWithUsage } from "../../../../lib/api-response";
import { checkApiRateLimitAsync } from "../../../../lib/rate-limit";
import { readLimit } from "../shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS(request: Request): Response {
  return apiOptions(createApiHttpContext(request));
}

export async function GET(request: Request): Promise<Response> {
  const context = createApiHttpContext(request);
  const rateLimit = await checkApiRateLimitAsync(request, { limit: 120, name: "archive-search", windowMs: 60_000 }, context, {
    requireApiKey: true
  });
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const limit = readLimit(url.searchParams.get("limit"));

  try {
    const options = limit === undefined ? {} : { limit };
    const result = await searchPackageIntelligenceArchive(query, options);
    return apiJsonWithUsage(request, {
      ...result,
      store: archiveStoreStatus()
    }, { access: rateLimit.access, context, headers: rateLimit.headers, status: 200 });
  } catch (error) {
    return errorJson(error, rateLimit.access, rateLimit.headers, context, request);
  }
}

function errorJson(
  error: unknown,
  access: Awaited<ReturnType<typeof checkApiRateLimitAsync>>["access"],
  headers: Record<string, string> = {},
  context = createApiHttpContext(),
  request = new Request("https://nipmod.com/api/archive/search")
): Promise<Response> {
  if (error instanceof ArchiveStoreError) {
    return apiJsonWithUsage(request,
      {
        code: "archive_store_error",
        error: error.message,
        retryable: error.status >= 500,
        source: null,
        status: error.status,
        type: "dev.nipmod.api-error.v1"
      },
      { access, context, headers, status: error.status }
    );
  }
  if (error instanceof ExternalPackageError) {
    return apiJsonWithUsage(request, externalPackageApiError(error, "archive search failed"), { access, context, headers, status: error.status });
  }
  return apiJsonWithUsage(request,
    {
      code: "internal_error",
      error: "archive search failed",
      retryable: false,
      source: null,
      status: 500,
      type: "dev.nipmod.api-error.v1"
    },
    { access, context, headers, status: 500 }
  );
}
