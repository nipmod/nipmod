import type { ExternalPackageRecord, ExternalPackageSource } from "./external-packages";

type AccountChatInstallPlan = {
  plan: {
    commands: string[];
  };
  safety: {
    warnings?: string[];
  };
};

export type AccountChatIntent = {
  category:
    | "capability"
    | "clarify-security"
    | "clarify-trading"
    | "compare"
    | "form-stack"
    | "general"
    | "generic"
    | "greeting"
    | "hugging-face"
    | "mcp"
    | "onchain-trading"
    | "security-stack"
    | "small-talk"
    | "thanks"
    | "web-design";
  language: "de" | "en";
  mode: "conversation" | "search";
  resultLimit?: number | undefined;
  searchQuery: string;
  sources?: ExternalPackageSource[];
};

export function analyzeAccountChatIntent(message: string): AccountChatIntent {
  const language = detectAccountChatLanguage(message);
  const normalized = message.toLowerCase();
  const compact = normalized.replace(/[!?.,;:]+/g, " ").replace(/\s+/g, " ").trim();

  if (isGreeting(compact)) {
    return { category: "greeting", language, mode: "conversation", searchQuery: "" };
  }

  if (isThanks(compact)) {
    return { category: "thanks", language, mode: "conversation", searchQuery: "" };
  }

  if (isSmallTalk(compact)) {
    return { category: "small-talk", language, mode: "conversation", searchQuery: "" };
  }

  if (asksAboutNipmod(compact)) {
    return { category: "capability", language, mode: "conversation", searchQuery: "" };
  }

  if (asksForSourceAccess(normalized)) {
    return { category: "capability", language, mode: "conversation", searchQuery: "" };
  }

  if (asksForBroadTrading(normalized)) {
    return { category: "clarify-trading", language, mode: "conversation", searchQuery: "" };
  }

  if (asksForBroadSecurity(normalized)) {
    return { category: "clarify-security", language, mode: "conversation", searchQuery: "" };
  }

  const requestedLimit = requestedResultLimit(normalized);

  const asksForWebDesign =
    /\b(web ?design|websitedesign|website ?design|webseite|frontend design|ui design|design system|komponenten|component library|css|tailwind|icons?|animation)\b/i.test(normalized) ||
    (/\b(website|web|frontend|ui)\b/i.test(normalized) && /\b(design|styling|style|pakete|packages|library|libraries|libs)\b/i.test(normalized));
  const asksForStandardSet = /\b(standard|standart|typisch|bekannt|beliebt|wichtig|common|popular|known|best|beste|packages|pakete|libs|libraries)\b/i.test(normalized);

  if (asksForWebDesign && asksForStandardSet) {
    return {
      category: "web-design",
      language,
      mode: "search",
      resultLimit: Math.max(requestedLimit ?? 0, 8) || undefined,
      searchQuery: "website design react ui component library css tailwind icons animation"
    };
  }

  if (asksForFormStack(normalized)) {
    return {
      category: "form-stack",
      language,
      mode: "search",
      resultLimit: requestedLimit,
      searchQuery: "react forms validation schema react-hook-form zod valibot tanstack form",
      sources: ["npm", "github"]
    };
  }

  const asksForHuggingFace =
    /\b(hugging ?face|huggingface|hf)\b/i.test(normalized) &&
    /\b(paket|pakete|package|packages|library|libraries|lib|modell|model|models|dataset|datasets|datensatz|datensätze|bekannt|bekannteste|beste|popular|standard|top|liste|list)\b/i.test(normalized);

  if (asksForHuggingFace) {
    const datasetFirst = /\b(dataset|datasets|datensatz|datensätze)\b/i.test(normalized);
    return {
      category: "hugging-face",
      language,
      mode: "search",
      resultLimit: requestedLimit,
      searchQuery: datasetFirst
        ? "huggingface datasets popular dataset question answering text image audio"
        : "huggingface transformers huggingface hub datasets sentence transformers model inference",
      sources: datasetFirst ? ["huggingface-dataset", "huggingface-model", "pypi", "npm"] : ["huggingface-model", "pypi", "npm", "huggingface-dataset"]
    };
  }

  if (asksForOnchainTrading(normalized)) {
    return {
      category: "onchain-trading",
      language,
      mode: "search",
      resultLimit: requestedLimit,
      searchQuery: onchainTradingQuery(normalized),
      sources: ["npm", "github", "mcp"]
    };
  }

  if (asksForSecurityStack(normalized)) {
    return {
      category: "security-stack",
      language,
      mode: "search",
      resultLimit: requestedLimit,
      searchQuery: securityStackQuery(normalized),
      sources: securitySources(normalized)
    };
  }

  if (asksForMcp(normalized)) {
    return {
      category: "mcp",
      language,
      mode: "search",
      resultLimit: requestedLimit,
      searchQuery: message,
      sources: ["mcp", "github", "npm"]
    };
  }

  if (asksForComparison(normalized)) {
    return {
      category: "compare",
      language,
      mode: "search",
      resultLimit: requestedLimit,
      searchQuery: message
    };
  }

  if (hasPackageDecisionIntent(normalized)) {
    return {
      category: "generic",
      language,
      mode: "search",
      resultLimit: requestedLimit,
      searchQuery: message
    };
  }

  return { category: "general", language, mode: "conversation", searchQuery: "" };
}

export function buildAccountChatAnswer(
  query: string,
  selected: ExternalPackageRecord | null,
  records: ExternalPackageRecord[],
  installPlan: AccountChatInstallPlan | null,
  intent: AccountChatIntent
): string {
  if (intent.mode === "conversation") {
    return buildConversationAnswer(intent);
  }

  if (!selected || !installPlan) {
    return intent.language === "de"
      ? `Ich konnte für "${query}" keinen starken Paketkandidaten finden. Versuch es enger, zum Beispiel mit Stack, Sprache oder konkretem Use Case.`
      : `I could not find a strong package candidate for "${query}". Try a narrower package task or name the ecosystem you want.`;
  }

  const listLimit = Math.max(0, Math.min(intent.resultLimit ?? 0, 12));
  const alternatives = records
    .filter((record) => record.id !== selected.id)
    .slice(0, Math.max(3, Math.min(listLimit, 8)))
    .map(formatCandidateLine);
  const scannedList = records.slice(0, listLimit || 0).map(formatCandidateLine);
  const warnings = [...selected.trust.warnings, ...(installPlan.safety.warnings ?? [])].slice(0, 3);
  const command = installPlan.plan.commands.at(0) ?? selected.install.command;

  if (intent.language === "de") {
    if (intent.category === "web-design") {
      const warningsText = warnings.length ? `\n\nWarnungen: ${warnings.join("; ")}` : "";
      const alternativesText = alternatives.length ? `\n\nWeitere Kandidaten aus dem Scan: ${alternatives.join(", ")}.` : "";
      return `Für Website Design würde ich nicht ein einzelnes Paket als Antwort nehmen. In der Praxis ist es meistens eine kleine Kombination aus Styling, UI Primitives, Icons und Animation.\n\nAls ersten starken Kandidaten hat Nipmod ${selected.displayName} aus ${selected.source} geprüft. Ergebnis: ${selected.trust.decision}, Risiko ${selected.trust.risk}, Score ${selected.trust.score}/100. Install Plan: ${command}.\n\nTypische Pakete, die du je nach Stack vergleichen solltest:\n- Styling: tailwindcss\n- UI Primitives: @radix-ui/react-dialog\n- Icons: lucide-react\n- Animation: framer-motion oder motion\n- Class Handling: clsx und class-variance-authority\n\nNipmod führt dabei nichts aus und schreibt nicht in den Workspace. Es liefert Kontext, Warnungen und den Install Plan vor der Ausführung.${warningsText}${alternativesText}`;
    }

    if (intent.category === "hugging-face") {
      const warningText = warnings.length ? `\n\nSichtbare Warnungen: ${warnings.join("; ")}` : "";
      const alternativesText = alternatives.length ? `\n\nWeitere Kandidaten aus dem Scan: ${alternatives.join(", ")}.` : "";
      const topText = scannedList.length ? `\n\nTop Kandidaten aus dem Scan:\n${scannedList.map((item, index) => `${index + 1}. ${item}`).join("\n")}` : "";
      return `Bei Hugging Face muss man zuerst unterscheiden: suchst du ein Entwicklerpaket, ein Modell oder ein Dataset? Nipmod prüft dafür Hugging Face selbst und passende npm/PyPI Pakete.\n\nAls ersten Kandidaten hat Nipmod ${selected.displayName} aus ${selected.source} geprüft. Ergebnis: ${selected.trust.decision}, Risiko ${selected.trust.risk}, Score ${selected.trust.score}/100. Install Plan: ${command}.${topText}\n\nWenn du ein konkretes Modell suchst, ist ein Task besser als "bestes Modell", zum Beispiel Embeddings für RAG, kleines Vision Modell oder Dataset für QA.${warningText}${alternativesText}`;
    }

    if (intent.category === "onchain-trading") {
      const warningText = warnings.length ? `\n\nSichtbare Warnungen: ${warnings.join("; ")}` : "";
      const alternativesText = alternatives.length ? `\n\nWeitere Kandidaten aus dem Scan: ${alternatives.join(", ")}.` : "";
      return `Für Base Token Trading würde ich nicht nach einem beliebigen "Coin Package" suchen. Sinnvoller ist ein SDK für Onchain Reads, Swap Routing oder Wallet/App Integration.\n\nNipmod hat zuerst ${selected.displayName} aus ${selected.source} geprüft. Ergebnis: ${selected.trust.decision}, Risiko ${selected.trust.risk}, Score ${selected.trust.score}/100. Install Plan: ${command}.\n\nWichtig: Nipmod gibt keine Trading Empfehlung und führt keine Wallet Aktion aus. Es prüft nur Paketkontext, Trust Signale und den Install Plan vor lokaler Ausführung.${warningText}${alternativesText}`;
    }

    if (intent.category === "form-stack") {
      const alternativesText = alternatives.length ? `\n\nWeitere Kandidaten aus dem Scan: ${alternatives.join(", ")}.` : "";
      return `Für React Forms würde ich die Entscheidung in drei Teile trennen: Form State, Schema Validation und UI Integration.\n\nNipmod hat zuerst ${selected.displayName} aus ${selected.source} geprüft. Ergebnis: ${selected.trust.decision}, Risiko ${selected.trust.risk}, Score ${selected.trust.score}/100. Install Plan: ${command}.\n\nTypische Kandidaten sind react-hook-form, @tanstack/react-form, zod, valibot und je nach UI Stack Radix/shadcn Komponenten. Nipmod führt nichts aus, sondern liefert dir Paketkontext, Warnungen und den Install Plan.${alternativesText}`;
    }

    if (intent.category === "security-stack") {
      const warningText = warnings.length ? `\n\nSichtbare Warnungen: ${warnings.join("; ")}` : "";
      const alternativesText = alternatives.length ? `\n\nWeitere Kandidaten aus dem Scan: ${alternatives.join(", ")}.` : "";
      return `Für Security Pakete ist der Stack entscheidend: Auth, Input Validation, Rate Limits, Dependency Audit und Secret Handling sind verschiedene Aufgaben.\n\nNipmod hat zuerst ${selected.displayName} aus ${selected.source} geprüft. Ergebnis: ${selected.trust.decision}, Risiko ${selected.trust.risk}, Score ${selected.trust.score}/100. Install Plan: ${command}.\n\nIch würde danach nicht blind installieren, sondern die Warnungen, Maintainer, Provenance, Lifecycle Scripts und genaue Install Boundary prüfen.${warningText}${alternativesText}`;
    }

    if (intent.category === "mcp") {
      const alternativesText = alternatives.length ? `\n\nWeitere Kandidaten aus dem Scan: ${alternatives.join(", ")}.` : "";
      return `Für MCP Server zählt nicht nur der Name, sondern welche Tools er freigibt, ob ein Repository verlinkt ist, welche Credentials nötig sind und ob Remote Endpoints sauber aussehen.\n\nNipmod hat zuerst ${selected.displayName} aus ${selected.source} geprüft. Ergebnis: ${selected.trust.decision}, Risiko ${selected.trust.risk}, Score ${selected.trust.score}/100. Install Plan: ${command}.${alternativesText}`;
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

  if (intent.category === "hugging-face") {
    const warningText = warnings.length ? `\n\nVisible warnings: ${warnings.join("; ")}` : "";
    const alternativesText = alternatives.length ? `\n\nOther candidates from the scan: ${alternatives.join(", ")}.` : "";
    const topText = scannedList.length ? `\n\nTop candidates from the scan:\n${scannedList.map((item, index) => `${index + 1}. ${item}`).join("\n")}` : "";
    return `With Hugging Face, the first split is package, model or dataset. Nipmod can check Hugging Face itself plus related npm/PyPI packages.\n\nNipmod inspected ${selected.displayName} from ${selected.source} first. Result: ${selected.trust.decision}, risk ${selected.trust.risk}, score ${selected.trust.score}/100. Install plan: ${command}.${topText}\n\nFor model selection, ask by task rather than "best model", for example embeddings for RAG, small vision model or QA dataset.${warningText}${alternativesText}`;
  }

  if (intent.category === "onchain-trading") {
    const warningText = warnings.length ? `\n\nVisible warnings: ${warnings.join("; ")}` : "";
    const alternativesText = alternatives.length ? `\n\nOther candidates from the scan: ${alternatives.join(", ")}.` : "";
    return `For Base token trading, I would not search for a random "coin package." The useful surface is usually an SDK for onchain reads, swap routing or wallet/app integration.\n\nNipmod inspected ${selected.displayName} from ${selected.source} first. Result: ${selected.trust.decision}, risk ${selected.trust.risk}, score ${selected.trust.score}/100. Install plan: ${command}.\n\nImportant: Nipmod does not give trading advice and does not execute wallet actions. It only checks package context, trust signals and the install plan before local execution.${warningText}${alternativesText}`;
  }

  if (intent.category === "form-stack") {
    const alternativesText = alternatives.length ? `\n\nOther candidates from the scan: ${alternatives.join(", ")}.` : "";
    return `For React forms, split the decision into form state, schema validation and UI integration.\n\nNipmod inspected ${selected.displayName} from ${selected.source} first. Result: ${selected.trust.decision}, risk ${selected.trust.risk}, score ${selected.trust.score}/100. Install plan: ${command}.\n\nTypical candidates include react-hook-form, @tanstack/react-form, zod, valibot and UI primitives depending on your stack. Nipmod does not execute anything; it returns context, warnings and the install plan.${alternativesText}`;
  }

  if (intent.category === "security-stack") {
    const warningText = warnings.length ? `\n\nVisible warnings: ${warnings.join("; ")}` : "";
    const alternativesText = alternatives.length ? `\n\nOther candidates from the scan: ${alternatives.join(", ")}.` : "";
    return `For security packages, the stack matters: auth, input validation, rate limits, dependency audit and secret handling are different jobs.\n\nNipmod inspected ${selected.displayName} from ${selected.source} first. Result: ${selected.trust.decision}, risk ${selected.trust.risk}, score ${selected.trust.score}/100. Install plan: ${command}.\n\nI would review warnings, maintainers, provenance, lifecycle scripts and the exact install boundary before installing.${warningText}${alternativesText}`;
  }

  if (intent.category === "mcp") {
    const alternativesText = alternatives.length ? `\n\nOther candidates from the scan: ${alternatives.join(", ")}.` : "";
    return `For MCP servers, the important parts are exposed tools, linked source, credential requirements and remote endpoint posture.\n\nNipmod inspected ${selected.displayName} from ${selected.source} first. Result: ${selected.trust.decision}, risk ${selected.trust.risk}, score ${selected.trust.score}/100. Install plan: ${command}.${alternativesText}`;
  }

  const warningText = warnings.length ? ` Visible warnings: ${warnings.join("; ")}.` : " No blocking warning was returned in this preflight.";
  const alternativesText = alternatives.length ? ` Alternatives worth comparing: ${alternatives.join(", ")}.` : "";
  return `For "${query}", Nipmod would inspect ${selected.displayName} from ${selected.source}. Trust result: ${selected.trust.decision}, risk ${selected.trust.risk}, score ${selected.trust.score}/100. Install plan: ${command}. The hosted API is read-only and does not execute or write to a workspace.${warningText}${alternativesText}`;
}

export function detectAccountChatLanguage(message: string): "de" | "en" {
  if (/[äöüß]/i.test(message)) {
    return "de";
  }
  const normalized = message.toLowerCase();
  const compact = normalized.replace(/[!?.,;:]+/g, " ").replace(/\s+/g, " ").trim();
  if (/^(hallo|servus|moin|danke|danke dir|danke nipmod)$/.test(compact)) {
    return "de";
  }
  if (/\bbei\b/i.test(normalized) && /\b(hugging ?face|huggingface|npm|pypi|github|mcp)\b/i.test(normalized)) {
    return "de";
  }
  const germanWords = normalized.match(/\b(alles|auf|bei|bekannt|bekannteste|beste|betse|brauche|danke|das|deutsch|dir|du|find|für|geht|gehts|gut|hast|ich|ist|kann|kannst|mir|nicht|oder|paket|pakete|quelle|quellen|sicherheit|sicherheits|sind|so|traden|vergleich|was|webseite|welche|welches|wie|wofür|warum|zugriff)\b/g);
  return (germanWords?.length ?? 0) >= 2 ? "de" : "en";
}

export function selectAccountChatRecord(records: ExternalPackageRecord[], recommendedId: string | null, intent: AccountChatIntent): ExternalPackageRecord | null {
  if (intent.category === "web-design") {
    const preferred = ["tailwindcss", "@radix-ui/react-dialog", "lucide-react", "framer-motion", "clsx", "class-variance-authority"];
    for (const name of preferred) {
      const record = records.find((candidate) => candidate.source === "npm" && candidate.name.toLowerCase() === name);
      if (record) {
        return record;
      }
    }
  }

  if (intent.category === "hugging-face") {
    const preferred = [
      ["npm", "@huggingface/transformers"],
      ["pypi", "transformers"],
      ["pypi", "huggingface-hub"],
      ["pypi", "datasets"],
      ["pypi", "sentence-transformers"]
    ];
    for (const [source, name] of preferred) {
      const record = records.find((candidate) => candidate.source === source && candidate.name.toLowerCase() === name);
      if (record) {
        return record;
      }
    }
  }

  if (intent.category === "form-stack") {
    const preferred = [
      ["npm", "react-hook-form"],
      ["npm", "@tanstack/react-form"],
      ["npm", "zod"],
      ["npm", "valibot"],
      ["npm", "formik"]
    ];
    for (const [source, name] of preferred) {
      const record = records.find((candidate) => candidate.source === source && candidate.name.toLowerCase() === name);
      if (record) {
        return record;
      }
    }
  }

  if (intent.category === "onchain-trading") {
    const preferred = [
      ["npm", "@coinbase/onchainkit"],
      ["npm", "viem"],
      ["npm", "wagmi"],
      ["npm", "@uniswap/sdk-core"],
      ["npm", "@uniswap/v3-sdk"]
    ];
    for (const [source, name] of preferred) {
      const record = records.find((candidate) => candidate.source === source && candidate.name.toLowerCase() === name);
      if (record) {
        return record;
      }
    }
    return (
      records.find((candidate) =>
        /\b(base|onchain|swap|trading|trade|wallet|viem|wagmi|uniswap|coinbase)\b/i.test(
          `${candidate.name} ${candidate.displayName} ${candidate.description}`
        )
      ) ?? null
    );
  }

  if (intent.category === "security-stack") {
    const preferred = [
      ["npm", "jose"],
      ["npm", "helmet"],
      ["npm", "zod"],
      ["npm", "express-rate-limit"],
      ["pypi", "cryptography"],
      ["pypi", "bandit"],
      ["pypi", "pip-audit"]
    ];
    for (const [source, name] of preferred) {
      const record = records.find((candidate) => candidate.source === source && candidate.name.toLowerCase() === name);
      if (record) {
        return record;
      }
    }
  }

  return records.find((record) => record.id === recommendedId) ?? records[0] ?? null;
}

function asksAboutNipmod(compact: string): boolean {
  return /\b(was kannst du|was kann nipmod|wie funktioniert nipmod|wer bist du|was bist du|hilfe|help|what can you do|how does nipmod work|what is nipmod|what are you)\b/i.test(compact);
}

function buildConversationAnswer(intent: AccountChatIntent): string {
  if (intent.language === "de") {
    if (intent.category === "greeting") {
      return "Hey. Frag mich nach einem Paket, Modell, Repository oder MCP Server. Wenn du nur den Use Case kennst, reicht das auch.";
    }
    if (intent.category === "small-talk") {
      return "Mir geht's gut. Ich bin hier, um dir bei Paket-, Modell-, Repo- und MCP Entscheidungen zu helfen. Frag einfach normal, zum Beispiel: \"Ich brauche ein gutes Paket für Forms in React.\"";
    }
    if (intent.category === "thanks") {
      return "Gerne. Schick mir einfach den nächsten Use Case oder Paketnamen.";
    }
    if (intent.category === "general") {
      return "Ich kann normal antworten, aber mein eigentlicher Job ist Paket-Intelligence. Wenn du ein Paket, Modell, Repo oder einen MCP Server suchst, beschreib einfach den Use Case. Dann prüfe ich Quellen, Trust Signale und den Install Plan.";
    }
    if (intent.category === "clarify-trading") {
      return "Für welche Art von Trading meinst du das? Base/onchain Token Swaps, Solana/EVM Wallet Integration, Börsen/Exchange APIs, Backtesting oder Charting? Sobald du mir das sagst, kann ich die passenden Pakete prüfen statt irgendein Trading Paket zu raten.";
    }
    if (intent.category === "clarify-security") {
      return "Security ist zu breit für eine ehrliche Paketempfehlung. Meinst du Auth/JWT, Input Validation, Rate Limiting, Dependency Audit, Secret Scanning, Malware Prüfung oder Hardening für Node/Python? Sag mir Stack und Ziel, dann prüfe ich passende Pakete.";
    }
    return "Ja. Nipmod kann öffentliche Quellen wie npm, PyPI, GitHub, Hugging Face Models, Hugging Face Datasets und MCP vor einer Installation prüfen. Die hosted API bleibt read-only: sie sucht, inspiziert Trust Signale und erstellt Install Plans, aber sie führt nichts aus und schreibt nicht in deinen Workspace.";
  }

  if (intent.category === "greeting") {
    return "Hey. Ask me for a package, model, repository or MCP server. A use case is enough if you do not know the exact name.";
  }
  if (intent.category === "small-talk") {
    return "Doing well. I am here to help with package, model, repository and MCP decisions. Ask naturally, for example: \"I need a good forms package for React.\"";
  }
  if (intent.category === "thanks") {
    return "Anytime. Send the next use case or package name when you are ready.";
  }
  if (intent.category === "general") {
    return "I can answer normally, but Nipmod is built for package intelligence. If you need a package, model, repo or MCP server, describe the use case and I will check sources, trust signals and the install plan.";
  }
  if (intent.category === "clarify-trading") {
    return "What kind of trading do you mean: Base/onchain token swaps, Solana/EVM wallet integration, exchange APIs, backtesting or charting? Once you give me that, I can check the right packages instead of guessing.";
  }
  if (intent.category === "clarify-security") {
    return "Security is too broad for an honest package recommendation. Do you mean auth/JWT, input validation, rate limiting, dependency audit, secret scanning, malware checks or Node/Python hardening? Give me the stack and target, then I can inspect candidates.";
  }
  return "Yes. Nipmod can inspect public sources including npm, PyPI, GitHub, Hugging Face Models, Hugging Face Datasets and MCP. The hosted API stays read-only: it searches, inspects trust signals and creates install plans, but it does not execute or write to your workspace.";
}

function asksForSourceAccess(normalized: string): boolean {
  const sourceMention = /\b(npm|pypi|github|mcp|hf)\b|hugg\w*face\w*/i.test(normalized);
  const accessQuestion = /\b(access|support|supports|source|sources|registry|registries|zugriff|quelle|quellen|unterstützt|kannst|kann|hast)\b/i.test(normalized);
  return sourceMention && accessQuestion;
}

function asksForOnchainTrading(normalized: string): boolean {
  const onchainSurface = /\b(base|onchain|coinbase|evm|web3|wallet|token|tokens|coin|coins|crypto|solana|aptos|sui|ethereum)\b/i.test(normalized);
  const tradingNeed = /\b(trade|trading|traden|swap|swaps|dex|router|liquidity|kaufen|verkaufen)\b/i.test(normalized);
  const packageNeed = /\b(package|packages|paket|pakete|sdk|library|lib|tool|find|finde|such|suche|best|beste|betse|good|gute)\b/i.test(normalized);
  return onchainSurface && tradingNeed && packageNeed;
}

function asksForBroadTrading(normalized: string): boolean {
  const tradingNeed = /\b(trade|trading|traden|swap|market|börse|boerse|exchange)\b/i.test(normalized);
  const packageNeed = /\b(package|packages|paket|pakete|sdk|library|lib|tool|find|finde|such|suche|best|beste|welches|welche|recommend|empfehl)\b/i.test(normalized);
  const hasSurface = /\b(base|onchain|coinbase|evm|web3|wallet|token|tokens|coin|coins|crypto|solana|aptos|sui|ethereum|stock|stocks|aktien|forex|binance|coinbase|backtest|chart|charting)\b/i.test(normalized);
  return tradingNeed && packageNeed && !hasSurface;
}

function asksForBroadSecurity(normalized: string): boolean {
  const securityNeed = /\b(security|sicherheit|sicherheits|safe|sicher|audit|malware|cve|vulnerability|schwachstelle)\b/i.test(normalized);
  const packageNeed = /\b(package|packages|paket|pakete|sdk|library|lib|tool|tools|best|beste|welche|welches|recommend|empfehl)\b/i.test(normalized);
  const hasStackOrTask = /\b(node|npm|react|next|express|python|pypi|django|fastapi|auth|jwt|oauth|rate limit|validation|validierung|secret|dependency|dependencies|api)\b/i.test(normalized);
  return securityNeed && packageNeed && !hasStackOrTask;
}

function asksForSecurityStack(normalized: string): boolean {
  const securityNeed = /\b(security|sicherheit|sicherheits|safe|sicher|audit|malware|cve|vulnerability|schwachstelle|auth|jwt|oauth|rate limit|secret scanning|dependency audit)\b/i.test(normalized);
  const packageNeed = /\b(package|packages|paket|pakete|sdk|library|lib|tool|tools|find|finde|such|suche|best|beste|welche|welches|recommend|empfehl|brauche|need)\b/i.test(normalized);
  return securityNeed && packageNeed;
}

function asksForFormStack(normalized: string): boolean {
  return /\b(form|forms|formular|formulare)\b/i.test(normalized) && /\b(react|next|frontend|validation|validierung|schema|package|paket|library|lib)\b/i.test(normalized);
}

function asksForMcp(normalized: string): boolean {
  return /\b(mcp|model context protocol|tool server|agent skill|skill package)\b/i.test(normalized) && /\b(server|tool|skill|package|paket|find|suche|best|beste|recommend|empfehl)\b/i.test(normalized);
}

function asksForComparison(normalized: string): boolean {
  if (!/\b(compare|vergleich|vergleichen|vs|versus|oder|better|besser)\b/i.test(normalized)) {
    return false;
  }
  const packageishTokens =
    normalized.match(/(?:@[a-z0-9_.-]+\/[a-z0-9_.-]+|[a-z0-9_.-]+\/[a-z0-9_.-]+|[a-z][a-z0-9_.-]{1,44})/gi)?.filter((token) =>
      !/^(compare|vergleich|vergleichen|versus|oder|better|besser|was|ist|which|is|the|and|und|für|for)$/.test(token)
    ) ?? [];
  return hasPackageDecisionIntent(normalized) || packageishTokens.length >= 2;
}

function requestedResultLimit(normalized: string): number | undefined {
  const numeric = normalized.match(/\b(?:top|beste|best|list|liste)\s*(\d{1,2})\b/i) ?? normalized.match(/\b(\d{1,2})\s*(?:pakete|packages|models|modelle|datasets)\b/i);
  if (!numeric) {
    return undefined;
  }
  return Math.min(12, Math.max(3, Number(numeric[1])));
}

function onchainTradingQuery(normalized: string): string {
  if (/\b(solana|spl)\b/i.test(normalized)) {
    return "solana wallet trading swap sdk @solana/web3.js";
  }
  if (/\b(ethereum|evm)\b/i.test(normalized) && !/\b(base|coinbase)\b/i.test(normalized)) {
    return "ethereum evm wallet trading swap sdk ethers viem wagmi uniswap";
  }
  return "base onchain token trading swap sdk viem wagmi uniswap coinbase onchainkit";
}

function securityStackQuery(normalized: string): string {
  if (/\b(python|pypi|django|fastapi)\b/i.test(normalized)) {
    return "python security auth validation dependency audit cryptography pyjwt bandit pip-audit";
  }
  if (/\b(rate limit|rate-limit|ratelimit)\b/i.test(normalized)) {
    return "node api rate limiting security express-rate-limit slow-down";
  }
  return "node api security auth jwt validation rate limiting helmet jose zod express-rate-limit";
}

function securitySources(normalized: string): ExternalPackageSource[] {
  if (/\b(python|pypi|django|fastapi)\b/i.test(normalized)) {
    return ["pypi", "github", "npm"];
  }
  return ["npm", "github", "pypi"];
}

function formatCandidateLine(record: ExternalPackageRecord): string {
  return `${record.displayName} (${record.source}, ${record.trust.score}/100, ${record.trust.risk})`;
}

function isGreeting(compact: string): boolean {
  return /^(hey|hi|hello|hallo|servus|moin|yo|gm|gn|hey nipmod|hi nipmod|hallo nipmod)$/.test(compact);
}

function isThanks(compact: string): boolean {
  return /^(thanks|thank you|thx|danke|danke dir|dankeschön|danke nipmod)$/.test(compact);
}

function isSmallTalk(compact: string): boolean {
  return /^(wie gehts|wie geht es dir|wie geht's|wie gehts dir|alles gut|alles klar|was geht|na|how are you|how are u|how is it going|how's it going|whats up|what's up|sup)$/.test(compact);
}

function hasPackageDecisionIntent(normalized: string): boolean {
  const namesKnownSurface = /\b(npm|pypi|pip|python|github|repo|repository|hugging ?face|huggingface|hf|mcp|sdk|cli|library|libraries|lib|package|packages|paket|pakete|modell|model|dataset|server|dependency|dependencies|abhängigkeit|tool|tools|wallet|token|coin|base|onchain|swap|trading|traden)\b/i.test(normalized);
  const asksForChoice = /\b(best|beste|good|gute|better|besser|popular|bekannt|bekannteste|standard|standart|typisch|common|recommend|empfehl|suche|find|finden|brauche|need|looking for|use case|install|installieren|safe|sicher|trust|risk|risiko|malware|cve|vulnerab|schwachstelle)\b/i.test(normalized);
  const directInstallOrInspect = /\b(npm install|pnpm add|yarn add|bun add|pip install|uv add|npx|git clone|docker pull|install|installieren|install plan|install-plan|inspect|preflight)\b/i.test(normalized);
  const packageLikeName = /(^|\s)(@[a-z0-9_.-]+\/[a-z0-9_.-]+|[a-z0-9_.-]+\/[a-z0-9_.-]+|[a-z0-9_.-]+@[0-9]+(?:\.[0-9]+){1,3})(\s|$)/i.test(normalized);
  const singlePackageName = /^[a-z][a-z0-9_.-]{1,44}$/i.test(normalized.trim());

  return directInstallOrInspect || packageLikeName || singlePackageName || (namesKnownSurface && asksForChoice);
}
