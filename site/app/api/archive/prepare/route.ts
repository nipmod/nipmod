import {
  ExternalPackageError,
  externalPackageApiError,
  type ExternalPackageRecord,
  inspectExternalPackage
} from "../../../../lib/external-packages";
import { apiJson, apiOptions, createApiHttpContext } from "../../../../lib/api-http";
import { createPackageIntelligenceRecord, validatePackageIntelligenceRecord } from "../../../../lib/package-intelligence";
import { archiveStoreStatus } from "../../../../lib/package-intelligence-store";
import { checkRateLimit } from "../../../../lib/rate-limit";
import { parseSource, readExternalRecord } from "../shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS(request: Request): Response {
  return apiOptions(createApiHttpContext(request));
}

export async function GET(request: Request): Promise<Response> {
  const context = createApiHttpContext(request);
  const rateLimit = checkRateLimit(request, { limit: 60, name: "archive-prepare", windowMs: 60_000 }, context);
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  const url = new URL(request.url);

  try {
    const source = parseSource(url.searchParams.get("source"));
    const name = url.searchParams.get("name") ?? "";
    const externalRecord = await inspectExternalPackage(source, name);
    return archiveRecordResponse(externalRecord, rateLimit.headers, context);
  } catch (error) {
    return errorJson(error, rateLimit.headers, context);
  }
}

export async function POST(request: Request): Promise<Response> {
  const context = createApiHttpContext(request);
  const rateLimit = checkRateLimit(request, { limit: 60, name: "archive-prepare", windowMs: 60_000 }, context);
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(
      { code: "invalid_json", error: "invalid JSON", retryable: false, source: null, status: 400, type: "dev.nipmod.api-error.v1" },
      400,
      rateLimit.headers,
      context
    );
  }

  try {
    const bodyRecord = readExternalRecord(body);
    if (bodyRecord) {
      return archiveRecordResponse(bodyRecord, rateLimit.headers, context);
    }

    const source = parseSource(readString(body, "source"));
    const name = readString(body, "name") ?? "";
    const externalRecord = await inspectExternalPackage(source, name);
    return archiveRecordResponse(externalRecord, rateLimit.headers, context);
  } catch (error) {
    return errorJson(error, rateLimit.headers, context);
  }
}

function archiveRecordResponse(
  externalRecord: ExternalPackageRecord,
  headers: Record<string, string> = {},
  context = createApiHttpContext()
): Response {
  const record = createPackageIntelligenceRecord(externalRecord);
  const validation = validatePackageIntelligenceRecord(record);
  return json({
    next: {
      confirm: "POST /api/archive/confirm",
      writeBoundary: "Prepared records are not persisted by this endpoint. Durable writes require archive confirmation and an authorized server writer."
    },
    preparedOnly: true,
    record,
    store: archiveStoreStatus(),
    stored: false,
    type: "dev.nipmod.archive-prepare.v1",
    validation
  }, 200, headers, context);
}

function readString(value: unknown, key: string): string | null {
  return value && typeof value === "object" && !Array.isArray(value) && typeof (value as Record<string, unknown>)[key] === "string"
    ? ((value as Record<string, string>)[key] ?? null)
    : null;
}

function errorJson(error: unknown, headers: Record<string, string> = {}, context = createApiHttpContext()): Response {
  if (error instanceof ExternalPackageError) {
    return json(externalPackageApiError(error, "archive prepare failed"), error.status, headers, context);
  }
  return json(externalPackageApiError(error, "archive prepare failed"), 500, headers, context);
}

function json(value: unknown, status = 200, headers: Record<string, string> = {}, context = createApiHttpContext()): Response {
  return apiJson(value, { context, headers, status });
}
