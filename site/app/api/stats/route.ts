import { apiOptions, createApiHttpContext, PUBLIC_READ_CACHE } from "../../../lib/api-http";
import { apiJsonWithUsage } from "../../../lib/api-response";
import { readPublicStats } from "../../../lib/public-stats";
import { checkApiRateLimitAsync } from "../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS(request: Request): Response {
  return apiOptions(createApiHttpContext(request));
}

export async function GET(request: Request): Promise<Response> {
  const context = createApiHttpContext(request);
  const rateLimit = await checkApiRateLimitAsync(request, { limit: 120, name: "public-stats", windowMs: 60_000 }, context);
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  const url = new URL(request.url);
  const stats = await readPublicStats({ hours: readWindowHours(url.searchParams.get("hours")) });
  return apiJsonWithUsage(request, stats, {
    access: rateLimit.access,
    cacheControl: PUBLIC_READ_CACHE,
    context,
    headers: rateLimit.headers
  });
}

function readWindowHours(value: string | null): number {
  if (!value) {
    return 24;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && String(parsed) === value.trim() && parsed >= 1 && parsed <= 168 ? parsed : 24;
}
