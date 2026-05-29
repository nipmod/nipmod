import {
  EXTERNAL_PACKAGE_SOURCES,
  ExternalPackageError,
  createExternalInstallPlan,
  externalPackageApiError,
  inspectExternalPackage,
  searchExternalPackages,
  type ExternalPackageRecord
} from "../../../../lib/external-packages";
import { accountAuthConfig, getCurrentAccountUser } from "../../../../lib/account-auth";
import { apiJson, createApiHttpContext } from "../../../../lib/api-http";
import { ApiRequestBodyError, readJsonRequestBody } from "../../../../lib/api-request";
import { checkApiRateLimitAsync } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const context = createApiHttpContext(request);
  const rateLimit = await checkApiRateLimitAsync(request, { limit: 30, name: "account-chat", windowMs: 60_000 }, context);
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  if (!accountAuthConfig().configured) {
    return chatError(request, "account_auth_not_configured", "account login is not configured", 503, false, rateLimit.headers);
  }

  const user = await getCurrentAccountUser();
  if (!user) {
    return chatError(request, "account_login_required", "login required before using Nipmod Chat", 401, false, rateLimit.headers);
  }

  const input = await readChatInput(request);
  if (!input.ok) {
    return chatError(request, input.code, input.error, input.status, false, rateLimit.headers);
  }

  try {
    const search = await searchExternalPackages(input.message, {
      limit: 5,
      sources: [...EXTERNAL_PACKAGE_SOURCES]
    });
    const selected = selectRecord(search.records, search.selection.recommendedId);
    const inspected = selected ? await inspectExternalPackage(selected.source, selected.name) : null;
    const installPlan = inspected ? createExternalInstallPlan(inspected) : null;

    return apiJson(
      {
        answer: buildChatAnswer(input.message, inspected, search.records, installPlan),
        generatedAt: new Date().toISOString(),
        installPlan,
        query: search.query,
        records: search.records,
        selected: inspected,
        sourceSummary: search.sourceSummary,
        type: "dev.nipmod.account-chat.v1",
        user: {
          email: user.email,
          id: user.id
        }
      },
      { context, headers: rateLimit.headers }
    );
  } catch (error) {
    const mapped = error instanceof ExternalPackageError ? externalPackageApiError(error, "Nipmod Chat failed") : externalPackageApiError(error, "Nipmod Chat failed");
    return apiJson(mapped, { context, headers: rateLimit.headers, status: mapped.status });
  }
}

async function readChatInput(
  request: Request
): Promise<{ message: string; ok: true } | { code: "invalid_json" | "invalid_message" | "payload_too_large"; error: string; ok: false; status: 400 | 413 }> {
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
    return { code: "invalid_json", error: "request body must be an object", ok: false, status: 400 };
  }
  const message = (body as Record<string, unknown>).message;
  if (typeof message !== "string" || message.trim().length < 3) {
    return { code: "invalid_message", error: "message must contain a package search question", ok: false, status: 400 };
  }
  return { message: message.trim().slice(0, 1200), ok: true };
}

function selectRecord(records: ExternalPackageRecord[], recommendedId: string | null): ExternalPackageRecord | null {
  return records.find((record) => record.id === recommendedId) ?? records[0] ?? null;
}

function buildChatAnswer(
  query: string,
  selected: ExternalPackageRecord | null,
  records: ExternalPackageRecord[],
  installPlan: ReturnType<typeof createExternalInstallPlan> | null
): string {
  if (!selected || !installPlan) {
    return `I could not find a strong package candidate for "${query}". Try a narrower package task or name the ecosystem you want.`;
  }

  const alternatives = records
    .filter((record) => record.id !== selected.id)
    .slice(0, 3)
    .map((record) => `${record.displayName} (${record.source})`);
  const warnings = [...selected.trust.warnings, ...(installPlan.safety.warnings ?? [])].slice(0, 3);
  const command = installPlan.plan.commands.at(0) ?? selected.install.command;
  const warningText = warnings.length ? ` Visible warnings: ${warnings.join("; ")}.` : " No blocking warning was returned in this preflight.";
  const alternativesText = alternatives.length ? ` Alternatives worth comparing: ${alternatives.join(", ")}.` : "";

  return `For "${query}", Nipmod would inspect ${selected.displayName} from ${selected.source}. Trust result: ${selected.trust.decision}, risk ${selected.trust.risk}, score ${selected.trust.score}/100. Install plan: ${command}. The hosted API is read-only and does not execute or write to a workspace.${warningText}${alternativesText}`;
}

function chatError(
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
