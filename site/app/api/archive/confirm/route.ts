import { ExternalPackageError, externalPackageApiError, inspectExternalPackage } from "../../../../lib/external-packages";
import { apiJson, apiOptions, createApiHttpContext } from "../../../../lib/api-http";
import {
  confirmPackageIntelligenceRecord,
  createPackageIntelligenceRecord,
  validatePackageIntelligenceRecord
} from "../../../../lib/package-intelligence";
import {
  ArchiveStoreError,
  archiveStoreStatus,
  assertArchiveWriteAuthorized,
  upsertPackageIntelligenceRecord
} from "../../../../lib/package-intelligence-store";
import { checkRateLimit } from "../../../../lib/rate-limit";
import { parseSource, readExternalRecord } from "../shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS(request: Request): Response {
  return apiOptions(createApiHttpContext(request));
}

export async function POST(request: Request): Promise<Response> {
  const context = createApiHttpContext(request);
  const rateLimit = checkRateLimit(request, { limit: 30, name: "archive-confirm", windowMs: 60_000 }, context);
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
    const dryRun = readBoolean(body, "dryRun");
    const externalRecord = readExternalRecord(body) ?? (await inspectExternalPackage(parseSource(readString(body, "source")), readString(body, "name") ?? ""));
    const prepared = createPackageIntelligenceRecord(externalRecord, {
      firstSeenReason: "Confirmed package use through the Nipmod archive API."
    });
    const confirmed = confirmPackageIntelligenceRecord(prepared, {
      actor: readString(body, "actor") ?? readString(body, "agent") ?? "external-agent",
      message: readString(body, "message") ?? "Package usefulness confirmed before archive persistence."
    });
    const validation = validatePackageIntelligenceRecord(confirmed);
    if (!validation.ok) {
      return json({ record: confirmed, type: "dev.nipmod.archive-confirm.v1", validation }, 422, rateLimit.headers, context);
    }

    if (dryRun) {
      return json({
        dryRun: true,
        record: confirmed,
        store: archiveStoreStatus(),
        stored: false,
        type: "dev.nipmod.archive-confirm.v1",
        validation
      }, 200, rateLimit.headers, context);
    }

    assertArchiveWriteAuthorized(request);
    const write = await upsertPackageIntelligenceRecord(confirmed);
    return json({
      ...write,
      store: archiveStoreStatus(),
      type: "dev.nipmod.archive-confirm.v1",
      validation
    }, 200, rateLimit.headers, context);
  } catch (error) {
    return errorJson(error, rateLimit.headers, context);
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

function errorJson(error: unknown, headers: Record<string, string> = {}, context = createApiHttpContext()): Response {
  if (error instanceof ExternalPackageError) {
    return json(externalPackageApiError(error, "archive confirm failed"), error.status, headers, context);
  }
  if (error instanceof ArchiveStoreError) {
    return json(
      {
        code: "archive_store_error",
        error: error.message,
        retryable: error.status >= 500,
        source: null,
        status: error.status,
        type: "dev.nipmod.api-error.v1"
      },
      error.status,
      headers,
      context
    );
  }
  return json(externalPackageApiError(error, "archive confirm failed"), 500, headers, context);
}

function json(value: unknown, status = 200, headers: Record<string, string> = {}, context = createApiHttpContext()): Response {
  return apiJson(value, { context, headers, status });
}
