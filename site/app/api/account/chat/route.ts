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
    const intent = analyzeChatIntent(input.message);
    const search = await searchExternalPackages(intent.searchQuery, {
      limit: intent.category === "web-design" ? 8 : 5,
      sources: [...EXTERNAL_PACKAGE_SOURCES]
    });
    const selected = selectRecord(search.records, search.selection.recommendedId, intent);
    const inspected = selected ? await inspectExternalPackage(selected.source, selected.name) : null;
    const installPlan = inspected ? createExternalInstallPlan(inspected) : null;

    return apiJson(
      {
        answer: buildChatAnswer(input.message, inspected, search.records, installPlan, intent),
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

type ChatIntent = {
  category: "generic" | "web-design";
  language: "de" | "en";
  searchQuery: string;
};

function analyzeChatIntent(message: string): ChatIntent {
  const language = detectLanguage(message);
  const normalized = message.toLowerCase();
  const asksForWebDesign =
    /\b(web ?design|websitedesign|website ?design|webseite|frontend design|ui design|design system|komponenten|component library|css|tailwind|icons?|animation)\b/i.test(normalized) ||
    (/\b(website|web|frontend|ui)\b/i.test(normalized) && /\b(design|styling|style|pakete|packages|library|libraries|libs)\b/i.test(normalized));
  const asksForStandardSet = /\b(standard|standart|typisch|bekannt|beliebt|wichtig|common|popular|known|best|beste|packages|pakete|libs|libraries)\b/i.test(normalized);

  if (asksForWebDesign && asksForStandardSet) {
    return {
      category: "web-design",
      language,
      searchQuery: "website design react ui component library css tailwind icons animation"
    };
  }

  return {
    category: "generic",
    language,
    searchQuery: message
  };
}

function detectLanguage(message: string): "de" | "en" {
  if (/[äöüß]/i.test(message)) {
    return "de";
  }
  const normalized = message.toLowerCase();
  const germanWords = normalized.match(/\b(was|ist|sind|so|für|paket|pakete|brauche|bekannt|bekannteste|beste|webseite|warum|wie|kann|ich|nicht|oder)\b/g);
  return (germanWords?.length ?? 0) >= 2 ? "de" : "en";
}

function selectRecord(records: ExternalPackageRecord[], recommendedId: string | null, intent: ChatIntent): ExternalPackageRecord | null {
  if (intent.category === "web-design") {
    const preferred = ["tailwindcss", "@radix-ui/react-dialog", "lucide-react", "framer-motion", "clsx", "class-variance-authority"];
    for (const name of preferred) {
      const record = records.find((candidate) => candidate.source === "npm" && candidate.name.toLowerCase() === name);
      if (record) {
        return record;
      }
    }
  }
  return records.find((record) => record.id === recommendedId) ?? records[0] ?? null;
}

function buildChatAnswer(
  query: string,
  selected: ExternalPackageRecord | null,
  records: ExternalPackageRecord[],
  installPlan: ReturnType<typeof createExternalInstallPlan> | null,
  intent: ChatIntent
): string {
  if (!selected || !installPlan) {
    return intent.language === "de"
      ? `Ich konnte für "${query}" keinen starken Paketkandidaten finden. Versuch es enger, zum Beispiel mit Stack, Sprache oder konkretem Use Case.`
      : `I could not find a strong package candidate for "${query}". Try a narrower package task or name the ecosystem you want.`;
  }

  const alternatives = records
    .filter((record) => record.id !== selected.id)
    .slice(0, 3)
    .map((record) => `${record.displayName} (${record.source})`);
  const warnings = [...selected.trust.warnings, ...(installPlan.safety.warnings ?? [])].slice(0, 3);
  const command = installPlan.plan.commands.at(0) ?? selected.install.command;

  if (intent.language === "de") {
    if (intent.category === "web-design") {
      const warningsText = warnings.length ? `\n\nWarnungen: ${warnings.join("; ")}` : "";
      const alternativesText = alternatives.length ? `\n\nWeitere Kandidaten aus dem Scan: ${alternatives.join(", ")}.` : "";
      return `Für Website Design würde ich nicht ein einzelnes Paket als Antwort nehmen. In der Praxis ist es meistens eine kleine Kombination aus Styling, UI Primitives, Icons und Animation.\n\nAls ersten starken Kandidaten hat Nipmod ${selected.displayName} aus ${selected.source} geprüft. Ergebnis: ${selected.trust.decision}, Risiko ${selected.trust.risk}, Score ${selected.trust.score}/100. Install Plan: ${command}.\n\nTypische Pakete, die du je nach Stack vergleichen solltest:\n- Styling: tailwindcss\n- UI Primitives: @radix-ui/react-dialog\n- Icons: lucide-react\n- Animation: framer-motion oder motion\n- Class Handling: clsx und class-variance-authority\n\nNipmod führt dabei nichts aus und schreibt nicht in den Workspace. Es liefert Kontext, Warnungen und den Install Plan vor der Ausführung.${warningsText}${alternativesText}`;
    }

    const warningText = warnings.length ? ` Sichtbare Warnungen: ${warnings.join("; ")}.` : " In diesem Preflight gab es keine blockierende Warnung.";
    const alternativesText = alternatives.length ? ` Vergleichbare Alternativen: ${alternatives.join(", ")}.` : "";
    return `Für "${query}" würde Nipmod zuerst ${selected.displayName} aus ${selected.source} prüfen. Ergebnis: ${selected.trust.decision}, Risiko ${selected.trust.risk}, Score ${selected.trust.score}/100. Install Plan: ${command}. Die hosted API ist read-only, führt nichts aus und schreibt nicht in den Workspace.${warningText}${alternativesText}`;
  }

  if (intent.category === "web-design") {
    const warningText = warnings.length ? `\n\nVisible warnings: ${warnings.join("; ")}` : "";
    const alternativesText = alternatives.length ? `\n\nOther candidates from the scan: ${alternatives.join(", ")}.` : "";
    return `For website design, I would not treat one package as the whole answer. The usual stack is a small set across styling, UI primitives, icons and animation.\n\nNipmod inspected ${selected.displayName} from ${selected.source} first. Result: ${selected.trust.decision}, risk ${selected.trust.risk}, score ${selected.trust.score}/100. Install plan: ${command}.\n\nPackages worth comparing by role:\n- Styling: tailwindcss\n- UI primitives: @radix-ui/react-dialog\n- Icons: lucide-react\n- Animation: framer-motion or motion\n- Class handling: clsx and class-variance-authority\n\nNipmod does not execute or write to the workspace. It returns context, warnings and the install plan before execution.${warningText}${alternativesText}`;
  }

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
