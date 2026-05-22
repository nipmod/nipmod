import {
  ExternalPackageError,
  externalPackageApiError,
  type ExternalPackageRecord,
  inspectExternalPackage
} from "../../../../lib/external-packages";
import { apiOptions, createApiHttpContext } from "../../../../lib/api-http";
import { apiJsonWithUsage } from "../../../../lib/api-response";
import {
  createPackageIntelligenceReceipt,
  createPackageIntelligenceRecord,
  validatePackageIntelligenceRecord
} from "../../../../lib/package-intelligence";
import { archiveStoreStatus } from "../../../../lib/package-intelligence-store";
import { checkApiRateLimit } from "../../../../lib/rate-limit";
import { parseSource, readExternalRecord } from "../shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS(request: Request): Response {
  return apiOptions(createApiHttpContext(request));
}

export async function GET(request: Request): Promise<Response> {
  const context = createApiHttpContext(request);
  const rateLimit = checkApiRateLimit(request, { limit: 60, name: "archive-prepare", windowMs: 60_000 }, context);
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  const url = new URL(request.url);

  try {
    const source = parseSource(url.searchParams.get("source"));
    const name = url.searchParams.get("name") ?? "";
    const externalRecord = await inspectExternalPackage(source, name);
    return archiveRecordResponse(request, externalRecord, rateLimit.access, rateLimit.headers, context);
  } catch (error) {
    return errorJson(error, rateLimit.access, rateLimit.headers, context, request);
  }
}

export async function POST(request: Request): Promise<Response> {
  const context = createApiHttpContext(request);
  const rateLimit = checkApiRateLimit(request, { limit: 60, name: "archive-prepare", windowMs: 60_000 }, context);
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
    const bodyRecord = readExternalRecord(body);
    if (bodyRecord) {
      return archiveRecordResponse(request, bodyRecord, rateLimit.access, rateLimit.headers, context);
    }

    const source = parseSource(readString(body, "source"));
    const name = readString(body, "name") ?? "";
    const externalRecord = await inspectExternalPackage(source, name);
    return archiveRecordResponse(request, externalRecord, rateLimit.access, rateLimit.headers, context);
  } catch (error) {
    return errorJson(error, rateLimit.access, rateLimit.headers, context, request);
  }
}

function archiveRecordResponse(
  request: Request,
  externalRecord: ExternalPackageRecord,
  access: ReturnType<typeof checkApiRateLimit>["access"],
  headers: Record<string, string> = {},
  context = createApiHttpContext()
): Promise<Response> {
  const record = createPackageIntelligenceRecord(externalRecord);
  const validation = validatePackageIntelligenceRecord(record);
  return apiJsonWithUsage(request, {
    next: {
      confirm: "POST /api/archive/confirm",
      writeBoundary: "Prepared records are not persisted by this endpoint. Durable writes require archive confirmation and an authorized server writer."
    },
    preparedOnly: true,
    receiptPreview: createPackageIntelligenceReceipt(record, { dryRun: true, stored: false }),
    record,
    store: archiveStoreStatus(),
    stored: false,
    type: "dev.nipmod.archive-prepare.v1",
    validation
  }, { access, context, headers, status: 200 });
}

function readString(value: unknown, key: string): string | null {
  return value && typeof value === "object" && !Array.isArray(value) && typeof (value as Record<string, unknown>)[key] === "string"
    ? ((value as Record<string, string>)[key] ?? null)
    : null;
}

function errorJson(
  error: unknown,
  access: ReturnType<typeof checkApiRateLimit>["access"],
  headers: Record<string, string> = {},
  context = createApiHttpContext(),
  request = new Request("https://nipmod.com/api/archive/prepare")
): Promise<Response> {
  if (error instanceof ExternalPackageError) {
    return apiJsonWithUsage(request, externalPackageApiError(error, "archive prepare failed"), { access, context, headers, status: error.status });
  }
  return apiJsonWithUsage(request, externalPackageApiError(error, "archive prepare failed"), { access, context, headers, status: 500 });
}
