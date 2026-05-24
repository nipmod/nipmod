import { hasApiAccessTier } from "../../../../lib/api-auth";
import { apiOptions, createApiHttpContext } from "../../../../lib/api-http";
import { apiJsonWithUsage } from "../../../../lib/api-response";
import { readApiUsageMetrics } from "../../../../lib/api-usage";
import { checkApiRateLimitAsync } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS(request: Request): Response {
  return apiOptions(createApiHttpContext(request));
}

export async function GET(request: Request): Promise<Response> {
  const context = createApiHttpContext(request);
  const rateLimit = await checkApiRateLimitAsync(request, { limit: 30, name: "usage-stats", windowMs: 60_000 }, context);
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  if (!hasApiAccessTier(rateLimit.access, "admin")) {
    return apiJsonWithUsage(
      request,
      {
        code: "insufficient_api_access",
        error: "usage stats require an admin API key",
        retryable: false,
        source: null,
        status: 403,
        type: "dev.nipmod.api-error.v1"
      },
      {
        access: rateLimit.access,
        context,
        headers: rateLimit.headers,
        status: 403
      }
    );
  }

  const url = new URL(request.url);
  const limit = readLimit(url.searchParams.get("limit"));
  const since = readSince(url.searchParams.get("hours"));
  const result = await readApiUsageMetrics({ limit, since });
  if (!result.ok) {
    return apiJsonWithUsage(
      request,
      {
        code: result.code,
        error: result.error,
        missing: result.missing ?? [],
        retryable: result.retryable,
        source: null,
        status: result.status,
        type: "dev.nipmod.api-error.v1"
      },
      {
        access: rateLimit.access,
        context,
        headers: rateLimit.headers,
        status: result.status
      }
    );
  }

  return apiJsonWithUsage(request, result.metrics, {
    access: rateLimit.access,
    context,
    headers: rateLimit.headers
  });
}

function readLimit(value: string | null): number {
  if (!value) {
    return 20;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || String(parsed) !== value.trim() || parsed < 1 || parsed > 100) {
    return 20;
  }
  return parsed;
}

function readSince(value: string | null): Date {
  const hours = value ? Number.parseInt(value, 10) : 24;
  const safeHours = Number.isFinite(hours) && String(hours) === value?.trim() && hours >= 1 && hours <= 168 ? hours : 24;
  return new Date(Date.now() - safeHours * 60 * 60 * 1000);
}
