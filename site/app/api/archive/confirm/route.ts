import { ExternalPackageError, externalPackageApiError } from "../../../../lib/external-packages";
import { apiOptions, createApiHttpContext } from "../../../../lib/api-http";
import { apiJsonWithUsage } from "../../../../lib/api-response";
import {
  confirmPackageIntelligenceRecord,
  createPackageIntelligenceReceipt,
  createPackageIntelligenceRecord,
  validatePackageIntelligenceRecord
} from "../../../../lib/package-intelligence";
import {
  ArchiveStoreError,
  archiveStoreStatus,
  assertArchiveWriteAuthorized,
  upsertPackageIntelligenceRecord
} from "../../../../lib/package-intelligence-store";
import { checkApiRateLimit } from "../../../../lib/rate-limit";
import { inspectExternalRecordFromRequest } from "../shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS(request: Request): Response {
  return apiOptions(createApiHttpContext(request));
}

export async function POST(request: Request): Promise<Response> {
  const context = createApiHttpContext(request);
  const rateLimit = checkApiRateLimit(request, { limit: 30, name: "archive-confirm", windowMs: 60_000 }, context);
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
    const dryRun = readBoolean(body, "dryRun");
    const externalRecord = await inspectExternalRecordFromRequest(body);
    const prepared = createPackageIntelligenceRecord(externalRecord, {
      firstSeenReason: "Confirmed package use through the Nipmod archive API."
    });
    const confirmed = confirmPackageIntelligenceRecord(prepared, {
      actor: readString(body, "actor") ?? readString(body, "agent") ?? "external-agent",
      message: readString(body, "message") ?? "Package usefulness confirmed before archive persistence."
    });
    const validation = validatePackageIntelligenceRecord(confirmed);
    if (!validation.ok) {
      return apiJsonWithUsage(request, {
        receipt: createPackageIntelligenceReceipt(confirmed, { dryRun: true, stored: false }),
        record: confirmed,
        stored: false,
        type: "dev.nipmod.archive-confirm.v1",
        validation
      }, {
        access: rateLimit.access,
        context,
        headers: rateLimit.headers,
        status: 422
      });
    }

    if (dryRun) {
      return apiJsonWithUsage(request, {
        dryRun: true,
        receipt: createPackageIntelligenceReceipt(confirmed, { dryRun: true, stored: false }),
        record: confirmed,
        store: archiveStoreStatus(),
        stored: false,
        type: "dev.nipmod.archive-confirm.v1",
        validation
      }, { access: rateLimit.access, context, headers: rateLimit.headers, status: 200 });
    }

    assertArchiveWriteAuthorized(request);
    const write = await upsertPackageIntelligenceRecord(confirmed);
    return apiJsonWithUsage(request, {
      ...write,
      receipt: createPackageIntelligenceReceipt(write.record, { stored: write.stored }),
      store: archiveStoreStatus(),
      type: "dev.nipmod.archive-confirm.v1",
      validation
    }, { access: rateLimit.access, context, headers: rateLimit.headers, status: 200 });
  } catch (error) {
    return errorJson(error, rateLimit.access, rateLimit.headers, context, request);
  }
}

function readString(value: unknown, key: string): string | null {
  return value && typeof value === "object" && !Array.isArray(value) && typeof (value as Record<string, unknown>)[key] === "string"
    ? ((value as Record<string, string>)[key] ?? null)
    : null;
}

function readBoolean(value: unknown, key: string): boolean {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>)[key] === true);
}

function errorJson(
  error: unknown,
  access: ReturnType<typeof checkApiRateLimit>["access"],
  headers: Record<string, string> = {},
  context = createApiHttpContext(),
  request = new Request("https://nipmod.com/api/archive/confirm")
): Promise<Response> {
  if (error instanceof ExternalPackageError) {
    return apiJsonWithUsage(request, externalPackageApiError(error, "archive confirm failed"), { access, context, headers, status: error.status });
  }
  if (error instanceof ArchiveStoreError) {
    return apiJsonWithUsage(request,
      {
        code: "archive_store_error",
        error: error.message,
        retryable: error.status >= 500,
        source: null,
        status: error.status,
        type: "dev.nipmod.api-error.v1"
      },
      { access, context, headers, status: error.status }
    );
  }
  return apiJsonWithUsage(request, externalPackageApiError(error, "archive confirm failed"), { access, context, headers, status: 500 });
}
