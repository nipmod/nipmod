import { hasApiAccessTier } from "../../../../lib/api-auth";
import { adminCorsPolicy, apiJson, apiOptions, createApiHttpContext } from "../../../../lib/api-http";
import { cleanupStaleBetaKeys, revokeAdminKey, type AdminKeyAction } from "../../../../lib/admin-keys";
import { checkApiRateLimitAsync } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS(request: Request): Response {
  return apiOptions(createApiHttpContext(request), { corsPolicy: adminCorsPolicy(request) });
}

export async function POST(request: Request): Promise<Response> {
  const context = createApiHttpContext(request);
  const corsPolicy = adminCorsPolicy(request);
  const rateLimit = await checkApiRateLimitAsync(request, { limit: 20, name: "admin-keys", windowMs: 60_000 }, context, {
    corsPolicy
  });
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  if (!hasApiAccessTier(rateLimit.access, "admin")) {
    return apiJson(
      {
        code: "insufficient_api_access",
        error: "admin key management requires an admin API key",
        retryable: false,
        source: null,
        status: 403,
        type: "dev.nipmod.api-error.v1"
      },
      {
        context,
        corsPolicy,
        headers: rateLimit.headers,
        status: 403
      }
    );
  }

  const body = await readJsonBody(request);
  const parsed = parseAdminKeyAction(body);
  if (!parsed.ok) {
    return apiJson(
      {
        code: parsed.code,
        error: parsed.error,
        retryable: false,
        source: null,
        status: 400,
        type: "dev.nipmod.api-error.v1"
      },
      {
        context,
        corsPolicy,
        headers: rateLimit.headers,
        status: 400
      }
    );
  }

  const result =
    parsed.action === "cleanup-stale-beta"
      ? await cleanupStaleBetaKeys({ olderThanHours: parsed.olderThanHours })
      : await revokeAdminKey({
          action: parsed.action,
          currentKeyId: rateLimit.access.keyId,
          keyId: parsed.keyId
        });

  if (!result.ok) {
    return apiJson(
      {
        code: result.code,
        error: result.error,
        missing: result.missing ?? [],
        retryable: result.retryable,
        source: null,
        status: result.status,
        type: "dev.nipmod.api-error.v1"
      },
      {
        context,
        corsPolicy,
        headers: rateLimit.headers,
        status: result.status
      }
    );
  }

  return apiJson(result, {
    context,
    corsPolicy,
    headers: rateLimit.headers
  });
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

type ParsedAdminKeyAction =
  | {
      action: "cleanup-stale-beta";
      ok: true;
      olderThanHours: number | null;
    }
  | {
      action: Exclude<AdminKeyAction, "cleanup-stale-beta">;
      keyId: string;
      ok: true;
    }
  | {
      code: string;
      error: string;
      ok: false;
    };

function parseAdminKeyAction(body: unknown): ParsedAdminKeyAction {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { code: "invalid_admin_key_action", error: "request body must be an object", ok: false };
  }
  const record = body as Record<string, unknown>;
  const action = typeof record.action === "string" ? record.action : "";
  if (action === "cleanup-stale-beta") {
    const olderThanHours = readOptionalInteger(record.olderThanHours);
    return { action, ok: true, olderThanHours };
  }
  if (action === "pause" || action === "revoke") {
    const keyId = typeof record.keyId === "string" ? record.keyId.trim() : "";
    if (!keyId) {
      return { code: "missing_key_id", error: "keyId is required", ok: false };
    }
    return { action, keyId, ok: true };
  }
  return { code: "unsupported_admin_key_action", error: "action must be revoke, pause or cleanup-stale-beta", ok: false };
}

function readOptionalInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
