import { hasApiAccessTier } from "../../../../lib/api-auth";
import { adminCorsPolicy, apiJson, apiOptions, createApiHttpContext } from "../../../../lib/api-http";
import { ApiRequestBodyError, readJsonRequestBody } from "../../../../lib/api-request";
import { cleanupStaleBetaKeys, updateAdminKeyLabel, updateAdminKeyStatus } from "../../../../lib/admin-keys";
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
    allowAdminPassword: true,
    corsPolicy,
    requireApiKey: true
  });
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  if (!hasApiAccessTier(rateLimit.access, "admin")) {
    return apiJson(
      {
        code: "insufficient_api_access",
        error: "admin key management requires an admin key or password",
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

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) {
    return apiJson(
      {
        code: bodyResult.code,
        error: bodyResult.error,
        retryable: false,
        source: null,
        status: bodyResult.status,
        type: "dev.nipmod.api-error.v1"
      },
      {
        context,
        corsPolicy,
        headers: rateLimit.headers,
        status: bodyResult.status
      }
    );
  }
  const body = bodyResult.body;
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
      : parsed.action === "update-label"
        ? await updateAdminKeyLabel({
            keyId: parsed.keyId,
            label: parsed.label
          })
      : await updateAdminKeyStatus({
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

async function readJsonBody(
  request: Request
): Promise<{ body: unknown; ok: true } | { code: "invalid_json" | "payload_too_large"; error: string; ok: false; status: 400 | 413 }> {
  try {
    return { body: await readJsonRequestBody(request, 64 * 1024), ok: true };
  } catch (error) {
    if (error instanceof ApiRequestBodyError) {
      return { code: error.code, error: error.message, ok: false, status: error.status };
    }
    return { code: "invalid_json", error: "invalid JSON", ok: false, status: 400 };
  }
}

type ParsedAdminKeyAction =
  | {
      action: "cleanup-stale-beta";
      ok: true;
      olderThanHours: number | null;
    }
  | {
      action: "pause" | "resume" | "revoke";
      keyId: string;
      ok: true;
    }
  | {
      action: "update-label";
      keyId: string;
      label: string;
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
  if (action === "pause" || action === "resume" || action === "revoke") {
    const keyId = typeof record.keyId === "string" ? record.keyId.trim() : "";
    if (!keyId) {
      return { code: "missing_key_id", error: "keyId is required", ok: false };
    }
    return { action, keyId, ok: true };
  }
  if (action === "update-label") {
    const keyId = typeof record.keyId === "string" ? record.keyId.trim() : "";
    const label = typeof record.label === "string" ? record.label.trim() : "";
    if (!keyId) {
      return { code: "missing_key_id", error: "keyId is required", ok: false };
    }
    if (!label) {
      return { code: "missing_key_label", error: "label is required", ok: false };
    }
    return { action, keyId, label, ok: true };
  }
  return { code: "unsupported_admin_key_action", error: "action must be revoke, pause, resume, update-label or cleanup-stale-beta", ok: false };
}

function readOptionalInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
