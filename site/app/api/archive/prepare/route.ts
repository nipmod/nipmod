import { ExternalPackageError, type ExternalPackageRecord, inspectExternalPackage } from "../../../../lib/external-packages";
import { createPackageIntelligenceRecord, validatePackageIntelligenceRecord } from "../../../../lib/package-intelligence";
import { archiveStoreStatus } from "../../../../lib/package-intelligence-store";
import { checkRateLimit } from "../../../../lib/rate-limit";
import { parseSource, readExternalRecord } from "../shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const rateLimit = checkRateLimit(request, { limit: 60, name: "archive-prepare", windowMs: 60_000 });
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  const url = new URL(request.url);

  try {
    const source = parseSource(url.searchParams.get("source"));
    const name = url.searchParams.get("name") ?? "";
    const externalRecord = await inspectExternalPackage(source, name);
    return archiveRecordResponse(externalRecord, rateLimit.headers);
  } catch (error) {
    return errorJson(error, rateLimit.headers);
  }
}

export async function POST(request: Request): Promise<Response> {
  const rateLimit = checkRateLimit(request, { limit: 60, name: "archive-prepare", windowMs: 60_000 });
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON", type: "dev.nipmod.api-error.v1" }, 400, rateLimit.headers);
  }

  try {
    const bodyRecord = readExternalRecord(body);
    if (bodyRecord) {
      return archiveRecordResponse(bodyRecord, rateLimit.headers);
    }

    const source = parseSource(readString(body, "source"));
    const name = readString(body, "name") ?? "";
    const externalRecord = await inspectExternalPackage(source, name);
    return archiveRecordResponse(externalRecord, rateLimit.headers);
  } catch (error) {
    return errorJson(error, rateLimit.headers);
  }
}

function archiveRecordResponse(externalRecord: ExternalPackageRecord, headers: Record<string, string> = {}): Response {
  const record = createPackageIntelligenceRecord(externalRecord);
  const validation = validatePackageIntelligenceRecord(record);
  return json({
    record,
    store: archiveStoreStatus(),
    type: "dev.nipmod.archive-prepare.v1",
    validation
  }, 200, headers);
}

function readString(value: unknown, key: string): string | null {
  return value && typeof value === "object" && !Array.isArray(value) && typeof (value as Record<string, unknown>)[key] === "string"
    ? ((value as Record<string, string>)[key] ?? null)
    : null;
}

function errorJson(error: unknown, headers: Record<string, string> = {}): Response {
  if (error instanceof ExternalPackageError) {
    return json({ error: error.message, type: "dev.nipmod.api-error.v1" }, error.status, headers);
  }
  return json({ error: error instanceof Error ? error.message : "archive prepare failed", type: "dev.nipmod.api-error.v1" }, 500, headers);
}

function json(value: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(value, {
    headers: {
      ...headers,
      "cache-control": "no-store"
    },
    status
  });
}
