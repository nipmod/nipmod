import {
  EXTERNAL_PACKAGE_SOURCES,
  ExternalPackageError,
  createExternalInstallPlan,
  externalPackageApiError,
  inspectExternalPackage,
  readExternalPackageRecord,
  type ExternalPackageRecord,
  type ExternalPackageSource
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
  const rateLimit = await checkApiRateLimitAsync(request, { limit: 90, name: "external-install-plan", windowMs: 60_000 }, context, {
    requireApiKey: true
  });
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  const url = new URL(request.url);

  try {
    const source = parseSource(url.searchParams.get("source"));
    const name = url.searchParams.get("name") ?? "";
    const record = await inspectExternalPackage(source, name);
    return apiJsonWithUsage(request, createExternalInstallPlan(record), {
      access: rateLimit.access,
      cacheControl: PUBLIC_READ_CACHE,
      context,
      headers: rateLimit.headers,
      status: 200
    });
  } catch (error) {
    return errorJson(error, rateLimit.access, rateLimit.headers, context, request);
  }
}

export async function POST(request: Request): Promise<Response> {
  const context = createApiHttpContext(request);
  const rateLimit = await checkApiRateLimitAsync(request, { limit: 90, name: "external-install-plan", windowMs: 60_000 }, context, {
    requireApiKey: true
  });
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiJsonWithUsage(request,
      { code: "invalid_json", error: "invalid JSON", retryable: false, source: null, status: 400, type: "dev.nipmod.api-error.v1" },
      { access: rateLimit.access, context, headers: rateLimit.headers, status: 400 }
    );
  }

  try {
    const record = await readRecord(body);
    return apiJsonWithUsage(request, createExternalInstallPlan(record), { access: rateLimit.access, context, headers: rateLimit.headers, status: 200 });
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

async function readRecord(value: unknown): Promise<ExternalPackageRecord> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ExternalPackageError("request body must be an external package record", { code: "invalid_record", status: 400 });
  }
  const submitted = readExternalPackageRecord(value);
  const inspected = await inspectExternalPackage(submitted.source, submitted.name);
  if (inspected.id !== submitted.id || inspected.source !== submitted.source || inspected.name !== submitted.name) {
    throw new ExternalPackageError("submitted record does not match the current source record", {
      code: "stale_external_record",
      retryable: false,
      source: submitted.source,
      status: 409
    });
  }
  if (submitted.version && inspected.version && submitted.version !== inspected.version) {
    throw new ExternalPackageError("submitted record version is stale; reinspect before requesting an install plan", {
      code: "stale_external_record",
      retryable: false,
      source: submitted.source,
      status: 409
    });
  }
  return inspected;
}

function errorJson(
  error: unknown,
  access: Awaited<ReturnType<typeof checkApiRateLimitAsync>>["access"],
  headers: Record<string, string> = {},
  context = createApiHttpContext(),
  request = new Request("https://nipmod.com/api/install-plan")
): Promise<Response> {
  if (error instanceof ExternalPackageError) {
    return apiJsonWithUsage(request, externalPackageApiError(error, "external install plan failed"), {
      access,
      context,
      headers,
      status: error.status
    });
  }
  return apiJsonWithUsage(request, externalPackageApiError(error, "external install plan failed"), { access, context, headers, status: 500 });
}
