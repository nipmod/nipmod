import {
  EXTERNAL_PACKAGE_SOURCES,
  ExternalPackageError,
  externalPackageApiError,
  type ExternalPackageSource,
  inspectExternalPackage
} from "../../../lib/external-packages";
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
  const rateLimit = await checkApiRateLimitAsync(request, { limit: 120, name: "external-inspect", windowMs: 60_000 }, context);
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  const url = new URL(request.url);

  try {
    const source = parseSource(url.searchParams.get("source"));
    const name = url.searchParams.get("name") ?? "";
    const record = await inspectExternalPackage(source, name);
    return apiJsonWithUsage(request, {
      meta: {
        generatedAt: new Date().toISOString(),
        source
      },
      record,
      type: "dev.nipmod.external-inspect.v1"
    }, { access: rateLimit.access, cacheControl: PUBLIC_READ_CACHE, context, headers: rateLimit.headers, status: 200 });
  } catch (error) {
    return errorJson(error, rateLimit.access, rateLimit.headers, context, request);
  }
}

function parseSource(value: string | null): ExternalPackageSource {
  if (typeof value === "string" && (EXTERNAL_PACKAGE_SOURCES as readonly string[]).includes(value)) {
    return value as ExternalPackageSource;
  }
  throw new ExternalPackageError("source must be one of npm, pypi, github, huggingface-model, huggingface-dataset or mcp", {
    code: "invalid_source",
    status: 400
  });
}

function errorJson(
  error: unknown,
  access: Awaited<ReturnType<typeof checkApiRateLimitAsync>>["access"],
  headers: Record<string, string> = {},
  context = createApiHttpContext(),
  request = new Request("https://nipmod.com/api/inspect")
): Promise<Response> {
  if (error instanceof ExternalPackageError) {
    return apiJsonWithUsage(request, externalPackageApiError(error, "external inspect failed"), { access, context, headers, status: error.status });
  }
  return apiJsonWithUsage(request, externalPackageApiError(error, "external inspect failed"), { access, context, headers, status: 500 });
}
