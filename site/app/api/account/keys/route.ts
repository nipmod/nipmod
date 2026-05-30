import { accountAuthConfig, getCurrentAccountUser } from "../../../../lib/account-auth";
import { apiJson, createApiHttpContext } from "../../../../lib/api-http";
import { issueAccountBetaApiKey } from "../../../../lib/api-key-issuer";
import { ApiRequestBodyError, readJsonRequestBody } from "../../../../lib/api-request";
import { accountMutationRejection } from "../../../../lib/account-request-security";
import { checkApiRateLimitAsync } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const context = createApiHttpContext(request);
  const rejectedMutation = accountMutationRejection(request);
  if (rejectedMutation) {
    return accountError(request, "account_mutation_rejected", rejectedMutation, 403, false, {});
  }

  const rateLimit = await checkApiRateLimitAsync(request, { limit: 5, name: "account-key-issue", windowMs: 60 * 60_000 }, context);
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  const config = accountAuthConfig();
  if (!config.configured) {
    return accountError(request, "account_auth_not_configured", "account login is not configured", 503, false, rateLimit.headers);
  }

  const user = await getCurrentAccountUser();
  if (!user) {
    return accountError(request, "account_login_required", "login required before creating an API key", 401, false, rateLimit.headers);
  }

  const body = await readOptionalJson(request);
  if (!body.ok) {
    return accountError(request, body.code, body.error, body.status, false, rateLimit.headers);
  }

  const result = await issueAccountBetaApiKey({ label: readLabel(body.body) });
  if (!result.ok) {
    return accountError(request, result.code, result.error, result.status, result.retryable, rateLimit.headers);
  }

  return apiJson(
    {
      ...result.response,
      account: {
        email: user.email,
        userId: user.id
      },
      privacy: "raw API key is returned once; the server stores only a keyed hash and key metadata"
    },
    {
      context,
      headers: {
        ...rateLimit.headers,
        "x-nipmod-access-tier": "beta",
        "x-nipmod-key-id": result.keyId
      }
    }
  );
}

async function readOptionalJson(
  request: Request
): Promise<{ body: unknown; ok: true } | { code: "invalid_json" | "payload_too_large"; error: string; ok: false; status: 400 | 413 }> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return { body: {}, ok: true };
  }
  try {
    return { body: await readJsonRequestBody(request, 16 * 1024), ok: true };
  } catch (error) {
    if (error instanceof ApiRequestBodyError) {
      return { code: error.code, error: error.message, ok: false, status: error.status };
    }
    return { code: "invalid_json", error: "invalid JSON", ok: false, status: 400 };
  }
}

function readLabel(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const label = record.label ?? record.name ?? record.agent ?? record.client;
  return typeof label === "string" ? label : undefined;
}

function accountError(
  request: Request,
  code: string,
  error: string,
  status: number,
  retryable: boolean,
  headers: Record<string, string>
): Response {
  return apiJson(
    {
      code,
      error,
      retryable,
      source: null,
      status,
      type: "dev.nipmod.api-error.v1"
    },
    { context: createApiHttpContext(request), headers, status }
  );
}
