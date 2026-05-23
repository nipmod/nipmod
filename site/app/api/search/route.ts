import { ExternalPackageError, externalPackageApiError, parseExternalSources, searchExternalPackages } from "../../../lib/external-packages";
import { PUBLIC_READ_CACHE, apiOptions, createApiHttpContext } from "../../../lib/api-http";
import { apiJsonWithUsage } from "../../../lib/api-response";
import { checkApiRateLimitAsync } from "../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS(request: Request): Response {
  return apiOptions(createApiHttpContext(request));
}

export async function GET(request: Request): Promise<Response> {
  const context = createApiHttpContext(request);
  const rateLimit = await checkApiRateLimitAsync(request, { limit: 120, name: "external-search", windowMs: 60_000 }, context);
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  const url = new URL(request.url);

  try {
    const query = url.searchParams.get("q") ?? "";
    const limit = readLimit(url.searchParams.get("limit"));
    const sources = parseExternalSources(url.searchParams.get("sources"));
    const result = await searchExternalPackages(query, limit === undefined ? { sources } : { limit, sources });
    return apiJsonWithUsage(request, {
      ...result,
      archivePolicy: {
        externalRecords: "Stored as external_indexed records after confirmed use.",
        ownership: "Original package owners keep ownership. Nipmod adds source context, trust checks, install plans and receipts.",
        verifiedRecords: "Only claimed or directly published packages become verified_nipmod."
      }
    }, { access: rateLimit.access, cacheControl: PUBLIC_READ_CACHE, context, headers: rateLimit.headers, status: 200 });
  } catch (error) {
    return errorJson(error, rateLimit.access, rateLimit.headers, context, request);
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

async function errorJson(
  error: unknown,
  access: Awaited<ReturnType<typeof checkApiRateLimitAsync>>["access"],
  headers: Record<string, string> = {},
  context = createApiHttpContext(),
  request = new Request("https://nipmod.com/api/search")
): Promise<Response> {
  if (error instanceof ExternalPackageError) {
    return apiJsonWithUsage(request, externalPackageApiError(error, "external search failed"), { access, context, headers, status: error.status });
  }
  return apiJsonWithUsage(request, externalPackageApiError(error, "external search failed"), { access, context, headers, status: 500 });
}
