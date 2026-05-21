import {
  EXTERNAL_PACKAGE_SOURCES,
  ExternalPackageError,
  createExternalInstallPlan,
  inspectExternalPackage,
  type ExternalPackageRecord,
  type ExternalPackageSource
} from "../../../lib/external-packages";
import { checkRateLimit } from "../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const rateLimit = checkRateLimit(request, { limit: 90, name: "external-install-plan", windowMs: 60_000 });
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  const url = new URL(request.url);

  try {
    const source = parseSource(url.searchParams.get("source"));
    const name = url.searchParams.get("name") ?? "";
    const record = await inspectExternalPackage(source, name);
    return json(createExternalInstallPlan(record), 200, rateLimit.headers);
  } catch (error) {
    return errorJson(error, rateLimit.headers);
  }
}

export async function POST(request: Request): Promise<Response> {
  const rateLimit = checkRateLimit(request, { limit: 90, name: "external-install-plan", windowMs: 60_000 });
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
    const record = readRecord(body);
    return json(createExternalInstallPlan(record), 200, rateLimit.headers);
  } catch (error) {
    return errorJson(error, rateLimit.headers);
  }
}

function parseSource(value: string | null): ExternalPackageSource {
  if (typeof value === "string" && (EXTERNAL_PACKAGE_SOURCES as readonly string[]).includes(value)) {
    return value as ExternalPackageSource;
  }
  throw new ExternalPackageError("source must be one of npm, pypi, github, huggingface-model, huggingface-dataset or mcp", 400);
}

function readRecord(value: unknown): ExternalPackageRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ExternalPackageError("request body must be an external package record", 400);
  }
  const record = "record" in value ? (value as { record: unknown }).record : value;
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new ExternalPackageError("request body must include a record object", 400);
  }
  const candidate = record as Partial<ExternalPackageRecord>;
  if (candidate.type !== "dev.nipmod.external-package.v1" || typeof candidate.id !== "string") {
    throw new ExternalPackageError("record must be a dev.nipmod.external-package.v1 object", 400);
  }
  return candidate as ExternalPackageRecord;
}

function errorJson(error: unknown, headers: Record<string, string> = {}): Response {
  if (error instanceof ExternalPackageError) {
    return json({ error: error.message, type: "dev.nipmod.api-error.v1" }, error.status, headers);
  }
  return json({ error: error instanceof Error ? error.message : "external install plan failed", type: "dev.nipmod.api-error.v1" }, 500, headers);
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
