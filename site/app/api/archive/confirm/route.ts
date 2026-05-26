import { ExternalPackageError, externalPackageApiError } from "../../../../lib/external-packages";
import { apiOptions, createApiHttpContext } from "../../../../lib/api-http";
import { apiJsonWithUsage } from "../../../../lib/api-response";
import {
  archiveEligibility,
  confirmPackageIntelligenceRecord,
  createPackageIntelligenceReceipt,
  createPackageIntelligenceRecord,
  validatePackageIntelligenceRecord
} from "../../../../lib/package-intelligence";
import {
  ArchiveStoreError,
  assertArchiveStoreConfigured,
  archiveStoreStatus,
  assertArchiveWriteAuthorized,
  upsertPackageIntelligenceRecord
} from "../../../../lib/package-intelligence-store";
import { checkApiRateLimitAsync } from "../../../../lib/rate-limit";
import { inspectExternalRecordFromRequest } from "../shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS(request: Request): Response {
  return apiOptions(createApiHttpContext(request));
}

export async function POST(request: Request): Promise<Response> {
  const context = createApiHttpContext(request);
  const rateLimit = await checkApiRateLimitAsync(request, { limit: 30, name: "archive-confirm", windowMs: 60_000 }, context, {
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
    const dryRun = readBoolean(body, "dryRun");
    const writeStore = dryRun ? null : assertArchiveWriteReady(request);
    const externalRecord = await inspectExternalRecordFromRequest(body);
    const prepared = createPackageIntelligenceRecord(externalRecord, {
      firstSeenReason: "Confirmed package use through the Nipmod archive API."
    });
    const confirmed = confirmPackageIntelligenceRecord(prepared, {
      actor: readString(body, "actor") ?? readString(body, "agent") ?? "external-agent",
      message: readString(body, "message") ?? "Package usefulness confirmed before archive persistence."
    });
    const validation = validatePackageIntelligenceRecord(confirmed);
    const eligibility = archiveEligibility(confirmed);
    if (!validation.ok) {
      return apiJsonWithUsage(request, {
        eligibility,
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
        eligibility,
        receipt: createPackageIntelligenceReceipt(confirmed, { dryRun: true, stored: false }),
        record: confirmed,
        store: archiveStoreStatus(),
        stored: false,
        type: "dev.nipmod.archive-confirm.v1",
        validation
      }, { access: rateLimit.access, context, headers: rateLimit.headers, status: 200 });
    }

    const write = await upsertPackageIntelligenceRecord(confirmed, { requireConfigured: true });
    return apiJsonWithUsage(request, {
      ...write,
      eligibility,
      receipt: createPackageIntelligenceReceipt(write.record, { stored: write.stored }),
      store: writeStore,
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

function assertArchiveWriteReady(request: Request): ReturnType<typeof archiveStoreStatus> {
  assertArchiveWriteAuthorized(request);
  return assertArchiveStoreConfigured();
}

function errorJson(
  error: unknown,
  access: Awaited<ReturnType<typeof checkApiRateLimitAsync>>["access"],
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
