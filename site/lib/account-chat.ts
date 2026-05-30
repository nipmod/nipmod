import type { ExternalPackageRecord } from "./external-packages";

type AccountChatInstallPlan = {
  plan: {
    commands: string[];
  };
  safety: {
    warnings?: string[];
  };
};

export type AccountChatIntent = {
  category: "capability" | "generic" | "greeting" | "hugging-face" | "small-talk" | "thanks" | "web-design";
  language: "de" | "en";
  mode: "conversation" | "search";
  searchQuery: string;
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

  const asksForWebDesign =
    /\b(web ?design|websitedesign|website ?design|webseite|frontend design|ui design|design system|komponenten|component library|css|tailwind|icons?|animation)\b/i.test(normalized) ||
    (/\b(website|web|frontend|ui)\b/i.test(normalized) && /\b(design|styling|style|pakete|packages|library|libraries|libs)\b/i.test(normalized));
  const asksForStandardSet = /\b(standard|standart|typisch|bekannt|beliebt|wichtig|common|popular|known|best|beste|packages|pakete|libs|libraries)\b/i.test(normalized);

  if (asksForWebDesign && asksForStandardSet) {
    return {
      category: "web-design",
      language,
      mode: "search",
      searchQuery: "website design react ui component library css tailwind icons animation"
    };
  }

  const asksForHuggingFace =
    /\b(hugging ?face|huggingface|hf)\b/i.test(normalized) &&
    /\b(paket|pakete|package|packages|library|libraries|lib|modell|model|bekannt|bekannteste|beste|popular|standard)\b/i.test(normalized);

  if (asksForHuggingFace) {
    return {
      category: "hugging-face",
      language,
      mode: "search",
      searchQuery: "huggingface transformers huggingface hub datasets sentence transformers model inference"
    };
  }

  return {
    category: "generic",
    language,
    mode: "search",
    searchQuery: message
  };
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

    if (intent.category === "hugging-face") {
      const warningText = warnings.length ? `\n\nSichtbare Warnungen: ${warnings.join("; ")}` : "";
      const alternativesText = alternatives.length ? `\n\nWeitere Kandidaten aus dem Scan: ${alternatives.join(", ")}.` : "";
      return `Wenn du Hugging Face als Entwickler-Ökosystem meinst, sind die wichtigsten Namen meistens transformers, huggingface_hub, datasets und sentence-transformers. Für JavaScript ist @huggingface/transformers der naheliegende Einstieg.\n\nNipmod hat zuerst ${selected.displayName} aus ${selected.source} geprüft. Ergebnis: ${selected.trust.decision}, Risiko ${selected.trust.risk}, Score ${selected.trust.score}/100. Install Plan: ${command}.\n\nWenn du ein Modell suchst, sollte die Frage anders gestellt werden, zum Beispiel: "bestes Embedding Modell für RAG" oder "kleines Vision Modell für Browser".${warningText}${alternativesText}`;
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
    return `If you mean the Hugging Face developer ecosystem, the core names are usually transformers, huggingface_hub, datasets and sentence-transformers. For JavaScript, @huggingface/transformers is the natural starting point.\n\nNipmod inspected ${selected.displayName} from ${selected.source} first. Result: ${selected.trust.decision}, risk ${selected.trust.risk}, score ${selected.trust.score}/100. Install plan: ${command}.\n\nIf you mean a model instead of a package, ask by task, for example "embedding model for RAG" or "small vision model for browser use".${warningText}${alternativesText}`;
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
  const germanWords = normalized.match(/\b(was|ist|sind|so|für|paket|pakete|brauche|bekannt|bekannteste|beste|webseite|warum|wie|geht|gehts|dir|alles|gut|kann|kannst|ich|nicht|oder|danke)\b/g);
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
    return "Nipmod hilft dir vor einer Installation: Paket suchen, Quelle prüfen, Trust Signale ansehen und einen Install Plan bekommen. Die hosted API bleibt read-only und führt nichts in deinem Workspace aus.";
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
  return "Nipmod helps before install time: search a package, inspect source context, review trust signals and get an install plan. The hosted API stays read-only and does not execute in your workspace.";
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
