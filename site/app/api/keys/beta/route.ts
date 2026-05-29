import { apiJson, apiOptions, createApiHttpContext } from "../../../../lib/api-http";
import { ApiRequestBodyError, readJsonRequestBody, readLimitedRequestText } from "../../../../lib/api-request";
import { issueSelfServeBetaApiKey } from "../../../../lib/api-key-issuer";
import { checkApiRateLimitAsync } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS(request: Request): Response {
  return apiOptions(createApiHttpContext(request));
}

export async function POST(request: Request): Promise<Response> {
  const context = createApiHttpContext(request);
  const rateLimit = await checkApiRateLimitAsync(request, { limit: 3, name: "beta-key-issue", windowMs: 60 * 60_000 }, context);
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  const input = await readIssueInput(request);
  if (!input.ok) {
    return apiJson(
      {
        code: input.code,
        error: input.error,
        retryable: false,
        source: null,
        status: input.status,
        type: "dev.nipmod.api-error.v1"
      },
      { context, headers: rateLimit.headers, status: input.status }
    );
  }

  const result = await issueSelfServeBetaApiKey({ label: input.label });
  if (!result.ok) {
    return apiJson(
      {
        code: result.code,
        error: result.error,
        retryable: result.retryable,
        source: null,
        status: result.status,
        type: "dev.nipmod.api-error.v1"
      },
      { context, headers: rateLimit.headers, status: result.status }
    );
  }

  return apiJson(result.response, {
    context,
    headers: {
      ...rateLimit.headers,
      "x-nipmod-access-tier": "beta",
      "x-nipmod-key-id": result.keyId
    }
  });
}

async function readIssueInput(
  request: Request
): Promise<{ label?: unknown; ok: true } | { code: "invalid_json" | "payload_too_large"; error: string; ok: false; status: 400 | 413 }> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) {
    let body: unknown;
    try {
      body = await readJsonRequestBody(request, 16 * 1024);
    } catch (error) {
      if (error instanceof ApiRequestBodyError) {
        return { code: error.code, error: error.message, ok: false, status: error.status };
      }
      return { code: "invalid_json", error: "invalid JSON", ok: false, status: 400 };
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { code: "invalid_json", error: "invalid JSON", ok: false, status: 400 };
    }
    return { label: readFirstString(body, ["label", "name", "agent", "client"]), ok: true };
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    let form: URLSearchParams;
    try {
      form = new URLSearchParams(await readLimitedRequestText(request, 16 * 1024));
    } catch (error) {
      if (error instanceof ApiRequestBodyError) {
        return { code: error.code, error: error.message, ok: false, status: error.status };
      }
      return { code: "invalid_json", error: "invalid JSON", ok: false, status: 400 };
    }
    return {
      label: form.get("label") ?? form.get("name") ?? form.get("agent") ?? form.get("client") ?? undefined,
      ok: true
    };
  }

  if (contentType.includes("multipart/form-data")) {
    return { ok: true };
  }

  return { ok: true };
}

function readFirstString(value: unknown, keys: string[]): string | undefined {
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    if (typeof record[key] === "string") {
      return record[key] as string;
    }
  }
  return undefined;
}
