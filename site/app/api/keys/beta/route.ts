import { apiJson, apiOptions, createApiHttpContext } from "../../../../lib/api-http";
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
        code: "invalid_json",
        error: "invalid JSON",
        retryable: false,
        source: null,
        status: 400,
        type: "dev.nipmod.api-error.v1"
      },
      { context, headers: rateLimit.headers, status: 400 }
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

async function readIssueInput(request: Request): Promise<{ label?: unknown; ok: true } | { ok: false }> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return { ok: false };
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { ok: false };
    }
    return { label: readFirstString(body, ["label", "name", "agent", "client"]), ok: true };
  }

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return { ok: false };
    }
    return {
      label: form.get("label") ?? form.get("name") ?? form.get("agent") ?? form.get("client") ?? undefined,
      ok: true
    };
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
