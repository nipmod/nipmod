import {
  EXTERNAL_PACKAGE_SOURCES,
  ExternalPackageError,
  createExternalInstallPlan,
  externalPackageApiError,
  inspectExternalPackage,
  searchExternalPackages
} from "../../../../lib/external-packages";
import { analyzeAccountChatIntent, buildAccountChatAnswer, selectAccountChatRecord } from "../../../../lib/account-chat";
import { buildPackageDecision, formatPackageDecisionAnswer, planPackageDecisionQuery } from "../../../../lib/package-decision-engine";
import { tryAnswerAccountChatWithLlm, type AccountChatHistoryEntry } from "../../../../lib/account-chat-llm";
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
    const llm = await tryAnswerAccountChatWithLlm(input.message, {
      history: input.history,
      userEmail: user.email,
      userId: user.id
    });
    if (llm.ok) {
      return apiJson(
        {
          answer: llm.answer,
          decision: llm.decision,
          generatedAt: new Date().toISOString(),
          installPlan: llm.installPlan,
          intent: {
            category: "llm",
            language: llm.language,
            mode: "llm",
            searchQuery: llm.query ?? ""
          },
          llm: {
            cost: llm.cost,
            costMode: llm.costMode,
            model: llm.model,
            provider: "vercel-ai-gateway",
            usedTools: llm.usedTools
          },
          query: llm.query,
          records: llm.records,
          selected: llm.selected,
          sourceSummary: llm.sourceSummary,
          type: "dev.nipmod.account-chat.v1",
          user: {
            email: user.email,
            id: user.id
          }
        },
        { context, headers: rateLimit.headers }
      );
    }

    const intent = analyzeAccountChatIntent(input.message);
    if (intent.mode === "conversation") {
      return apiJson(
        {
          answer: buildAccountChatAnswer(input.message, null, [], null, intent),
          decision: null,
          generatedAt: new Date().toISOString(),
          installPlan: null,
          intent,
          query: null,
          records: [],
          selected: null,
          sourceSummary: {
            empty: 0,
            failed: 0,
            ok: 0,
            requested: 0
          },
          type: "dev.nipmod.account-chat.v1",
          user: {
            email: user.email,
            id: user.id
          }
        },
        { context, headers: rateLimit.headers }
      );
    }

    const decisionPlan = planPackageDecisionQuery(input.message);
    const searchQuery = intent.searchQuery || decisionPlan.searchQueries.at(-1) || input.message;
    const search = await searchExternalPackages(searchQuery, {
      limit: intent.resultLimit ?? (intent.category === "web-design" ? 8 : 5),
      sources: intent.sources ?? (intent.category === "generic" || intent.category === "onchain-trading" ? decisionPlan.ecosystems : [...EXTERNAL_PACKAGE_SOURCES])
    });
    const selected = selectAccountChatRecord(search.records, search.selection.recommendedId, intent);
    const inspected = selected ? await inspectExternalPackage(selected.source, selected.name) : null;
    const installPlan = inspected ? createExternalInstallPlan(inspected) : null;
    const decision = buildPackageDecision({
      installPlan,
      originalQuery: input.message,
      records: search.records,
      searchQuery: search.query,
      selected: inspected,
      sourceSummary: search.sourceSummary
    });

    return apiJson(
      {
        answer:
          intent.category === "generic" || intent.category === "compare"
            ? formatPackageDecisionAnswer(decision)
            : buildAccountChatAnswer(input.message, inspected, search.records, installPlan, intent),
        decision,
        generatedAt: new Date().toISOString(),
        intent,
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
): Promise<
  | { history: AccountChatHistoryEntry[]; message: string; ok: true }
  | { code: "invalid_json" | "invalid_message" | "payload_too_large"; error: string; ok: false; status: 400 | 413 }
> {
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
  if (typeof message !== "string" || message.trim().length < 1) {
    return { code: "invalid_message", error: "message is required", ok: false, status: 400 };
  }
  return { history: readChatHistory((body as Record<string, unknown>).history), message: message.trim().slice(0, 1200), ok: true };
}

function readChatHistory(value: unknown): AccountChatHistoryEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const role = item.role === "assistant" || item.role === "user" ? item.role : null;
      const content = typeof item.content === "string" ? item.content.trim().slice(0, 2000) : "";
      return role && content ? { content, role } : null;
    })
    .filter((item): item is AccountChatHistoryEntry => item !== null)
    .slice(-8);
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
