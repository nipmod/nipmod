import {
  EXTERNAL_PACKAGE_SOURCES,
  ExternalPackageError,
  externalPackageApiError,
  type ExternalPackageSource,
  inspectExternalPackage
} from "../../../lib/external-packages";
import { PUBLIC_READ_CACHE, apiJson, apiOptions, createApiHttpContext } from "../../../lib/api-http";
import { checkRateLimit } from "../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS(request: Request): Response {
  return apiOptions(createApiHttpContext(request));
}

export async function GET(request: Request): Promise<Response> {
  const context = createApiHttpContext(request);
  const rateLimit = checkRateLimit(request, { limit: 120, name: "external-inspect", windowMs: 60_000 }, context);
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  const url = new URL(request.url);

  try {
    const source = parseSource(url.searchParams.get("source"));
    const name = url.searchParams.get("name") ?? "";
    const record = await inspectExternalPackage(source, name);
    return json({
      meta: {
        generatedAt: new Date().toISOString(),
        source
      },
      record,
      type: "dev.nipmod.external-inspect.v1"
    }, 200, rateLimit.headers, context, PUBLIC_READ_CACHE);
  } catch (error) {
    return errorJson(error, rateLimit.headers, context);
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

function errorJson(error: unknown, headers: Record<string, string> = {}, context = createApiHttpContext()): Response {
  if (error instanceof ExternalPackageError) {
    return json(externalPackageApiError(error, "external inspect failed"), error.status, headers, context);
  }
  return json(externalPackageApiError(error, "external inspect failed"), 500, headers, context);
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
