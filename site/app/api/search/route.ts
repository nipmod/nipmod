import { ExternalPackageError, externalPackageApiError, parseExternalSources, searchExternalPackages } from "../../../lib/external-packages";
import { PUBLIC_READ_CACHE, apiJson, apiOptions, createApiHttpContext } from "../../../lib/api-http";
import { checkRateLimit } from "../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS(request: Request): Response {
  return apiOptions(createApiHttpContext(request));
}

export async function GET(request: Request): Promise<Response> {
  const context = createApiHttpContext(request);
  const rateLimit = checkRateLimit(request, { limit: 120, name: "external-search", windowMs: 60_000 }, context);
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  const url = new URL(request.url);

  try {
    const query = url.searchParams.get("q") ?? "";
    const limit = readLimit(url.searchParams.get("limit"));
    const sources = parseExternalSources(url.searchParams.get("sources"));
    const result = await searchExternalPackages(query, limit === undefined ? { sources } : { limit, sources });
    return json({
      ...result,
      archivePolicy: {
        externalRecords: "Stored as external_indexed records after confirmed use.",
        ownership: "Original package owners keep ownership. Nipmod adds source context, trust checks, install plans and receipts.",
        verifiedRecords: "Only claimed or directly published packages become verified_nipmod."
      }
    }, 200, rateLimit.headers, context, PUBLIC_READ_CACHE);
  } catch (error) {
    return errorJson(error, rateLimit.headers, context);
  }
}

function readLimit(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || String(parsed) !== value.trim()) {
    throw new ExternalPackageError("limit must be an integer", { code: "invalid_limit", status: 400 });
  }
  if (parsed < 1 || parsed > 50) {
    throw new ExternalPackageError("limit must be an integer from 1 to 50", { code: "invalid_limit", status: 400 });
  }
  return parsed;
}

function errorJson(error: unknown, headers: Record<string, string> = {}, context = createApiHttpContext()): Response {
  if (error instanceof ExternalPackageError) {
    return json(externalPackageApiError(error, "external search failed"), error.status, headers, context);
  }
  return json(externalPackageApiError(error, "external search failed"), 500, headers, context);
}

function json(
  value: unknown,
  status = 200,
  headers: Record<string, string> = {},
  context = createApiHttpContext(),
  cacheControl?: string
): Response {
  return apiJson(value, { cacheControl, context, headers, status });
}
