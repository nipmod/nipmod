import { ArchiveStoreError, archiveStoreStatus, searchPackageIntelligenceArchive } from "../../../../lib/package-intelligence-store";
import { apiJson, apiOptions, createApiHttpContext } from "../../../../lib/api-http";
import { checkRateLimit } from "../../../../lib/rate-limit";
import { readLimit } from "../shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS(request: Request): Response {
  return apiOptions(createApiHttpContext(request));
}

export async function GET(request: Request): Promise<Response> {
  const context = createApiHttpContext(request);
  const rateLimit = checkRateLimit(request, { limit: 120, name: "archive-search", windowMs: 60_000 }, context);
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const limit = readLimit(url.searchParams.get("limit"));

  try {
    const options = limit === undefined ? {} : { limit };
    const result = await searchPackageIntelligenceArchive(query, options);
    return json({
      ...result,
      store: archiveStoreStatus()
    }, 200, rateLimit.headers, context);
  } catch (error) {
    return errorJson(error, rateLimit.headers, context);
  }
}

function errorJson(error: unknown, headers: Record<string, string> = {}, context = createApiHttpContext()): Response {
  if (error instanceof ArchiveStoreError) {
    return json(
      {
        code: "archive_store_error",
        error: error.message,
        retryable: error.status >= 500,
        source: null,
        status: error.status,
        type: "dev.nipmod.api-error.v1"
      },
      error.status,
      headers,
      context
    );
  }
  return json(
    {
      code: "internal_error",
      error: error instanceof Error ? error.message : "archive search failed",
      retryable: false,
      source: null,
      status: 500,
      type: "dev.nipmod.api-error.v1"
    },
    500,
    headers,
    context
  );
}

function json(value: unknown, status = 200, headers: Record<string, string> = {}, context = createApiHttpContext()): Response {
  return apiJson(value, { context, headers, status });
}
