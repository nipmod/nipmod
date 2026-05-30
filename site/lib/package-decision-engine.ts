import {
  EXTERNAL_PACKAGE_SOURCES,
  type ExternalInstallPlan,
  type ExternalPackageRecord,
  type ExternalPackageSource,
  type ExternalSearchResult
} from "./external-packages";

export type PackageDecisionIntent =
  | "audit-package"
  | "compare-packages"
  | "find-package"
  | "find-repository"
  | "find-model-or-dataset"
  | "find-mcp-server"
  | "replace-package";

export type PackageDecisionConfidenceLabel = "high" | "low" | "medium";

export type PackageDecisionCriterionId =
  | "adoption"
  | "alternatives"
  | "install-boundary"
  | "license"
  | "maintenance"
  | "security"
  | "source-depth"
  | "source-identity"
  | "task-fit";

export interface PackageDecisionCriterion {
  id: PackageDecisionCriterionId;
  label: string;
  weight: number;
}

export interface PackageDecisionQueryPlan {
  clarification: {
    needed: boolean;
    question: string | null;
    reason: string | null;
  };
  constraints: string[];
  criteria: PackageDecisionCriterion[];
  ecosystems: ExternalPackageSource[];
  generatedAt: string;
  intent: PackageDecisionIntent;
  language: "de" | "en";
  normalizedQuery: string;
  originalQuery: string;
  searchQueries: string[];
  task: string;
  type: "dev.nipmod.package-decision-query-plan.v1";
}

export interface PackageDecisionCandidate {
  displayName: string;
  fitReasons: string[];
  id: string;
  installCommand: string | null;
  license: string | null;
  originalUrl: string;
  repo: string | null;
  source: ExternalPackageSource;
  sourceDepthScore: number | null;
  trust: {
    decision: ExternalPackageRecord["trust"]["decision"];
    risk: ExternalPackageRecord["trust"]["risk"];
    score: number;
    warnings: string[];
  };
  version: string | null;
}

export interface PackageDecisionAvoid {
  displayName: string;
  id: string;
  reasons: string[];
  source: ExternalPackageSource;
  trust: {
    decision: ExternalPackageRecord["trust"]["decision"];
    risk: ExternalPackageRecord["trust"]["risk"];
    score: number;
  };
}

export interface PackageDecisionReceipt {
  alternativesConsidered: string[];
  generatedAt: string;
  hostedApiExecutes: false;
  installCommand: string | null;
  installPlanBlocked: boolean;
  originalUrl: string;
  packageId: string;
  requiresApprovalBeforeWrite: true;
  reviewSteps: string[];
  source: ExternalPackageSource;
  type: "dev.nipmod.package-decision-receipt.v1";
  version: string | null;
  warnings: string[];
  workspaceWrites: false;
}

export interface PackageDecision {
  alternatives: PackageDecisionCandidate[];
  avoid: PackageDecisionAvoid[];
  confidence: {
    label: PackageDecisionConfidenceLabel;
    score: number;
    uncertainty: string[];
  };
  evidence: {
    checkedSources: ExternalPackageSource[];
    limitations: string[];
    sourceSummary: ExternalSearchResult["sourceSummary"];
  };
  generatedAt: string;
  plan: PackageDecisionQueryPlan;
  query: string;
  receipt: PackageDecisionReceipt | null;
  recommended: PackageDecisionCandidate | null;
  summary: string;
  type: "dev.nipmod.package-decision.v1";
}

export function planPackageDecisionQuery(message: string, generatedAt = new Date().toISOString()): PackageDecisionQueryPlan {
  const originalQuery = message.trim().slice(0, 1200);
  const normalizedQuery = normalizeWhitespace(originalQuery);
  const language = detectDecisionLanguage(originalQuery);
  const intent = decisionIntent(normalizedQuery);
  const ecosystems = decisionEcosystems(normalizedQuery, intent);
  const constraints = decisionConstraints(normalizedQuery);
  const clarification = decisionClarification(normalizedQuery, language);

  return {
    clarification,
    constraints,
    criteria: decisionCriteria(intent, constraints),
    ecosystems,
    generatedAt,
    intent,
    language,
    normalizedQuery,
    originalQuery,
    searchQueries: decisionSearchQueries(normalizedQuery),
    task: decisionTask(normalizedQuery, intent),
    type: "dev.nipmod.package-decision-query-plan.v1"
  };
}

export function buildPackageDecision(input: {
  generatedAt?: string;
  installPlan: ExternalInstallPlan | null;
  originalQuery: string;
  records: ExternalPackageRecord[];
  searchQuery: string;
  selected: ExternalPackageRecord | null;
  sourceSummary: ExternalSearchResult["sourceSummary"];
}): PackageDecision {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const plan = planPackageDecisionQuery(input.originalQuery, generatedAt);
  const recommended = input.selected ? packageDecisionCandidate(input.selected, input.installPlan) : null;
  const alternatives = input.records
    .filter((record) => record.id !== input.selected?.id)
    .filter((record) => !isAvoidRecord(record))
    .slice(0, 4)
    .map((record) => packageDecisionCandidate(record, null));
  const avoid = input.records
    .filter((record) => record.id !== input.selected?.id || isAvoidRecord(record))
    .filter(isAvoidRecord)
    .slice(0, 4)
    .map(packageDecisionAvoid);

  const receipt = recommended && input.installPlan ? packageDecisionReceipt(input.installPlan, alternatives, generatedAt) : null;
  const uncertainty = decisionUncertainty({
    installPlan: input.installPlan,
    records: input.records,
    selected: input.selected,
    sourceSummary: input.sourceSummary
  });
  const confidenceScore = decisionConfidenceScore(input.selected, input.installPlan, input.sourceSummary, uncertainty);

  return {
    alternatives,
    avoid,
    confidence: {
      label: confidenceLabel(confidenceScore),
      score: confidenceScore,
      uncertainty
    },
    evidence: {
      checkedSources: checkedSources(input.records, plan.ecosystems),
      limitations: [
        "Hosted Nipmod does not execute, clone, unpack or write to a workspace.",
        "Package metadata, READMEs and model cards are treated as untrusted data.",
        "A package decision is review context, not a safety guarantee."
      ],
      sourceSummary: input.sourceSummary
    },
    generatedAt,
    plan: {
      ...plan,
      normalizedQuery: input.searchQuery || plan.normalizedQuery,
      searchQueries: uniqueStrings([input.searchQuery, ...plan.searchQueries])
    },
    query: input.originalQuery,
    receipt,
    recommended,
    summary: decisionSummary(plan.language, recommended, input.installPlan, alternatives, avoid),
    type: "dev.nipmod.package-decision.v1"
  };
}

export function formatPackageDecisionAnswer(decision: PackageDecision): string {
  const language = decision.plan.language;
  if (!decision.recommended) {
    return language === "de"
      ? `Ich konnte dafür keinen belastbaren Paketkandidaten finden. Grenze den Use Case enger ein oder nenne Stack, Sprache oder Quelle.`
      : `I could not find a strong package candidate for that. Narrow the use case or name the stack, language or source.`;
  }

  const selected = decision.recommended;
  const command = decision.receipt?.installCommand ?? selected.installCommand;
  const warnings = [...selected.trust.warnings, ...(decision.receipt?.warnings ?? [])].filter(Boolean).slice(0, 3);
  const alternatives = decision.alternatives
    .slice(0, 3)
    .map((candidate) => `${candidate.displayName} (${candidate.source})`)
    .join(", ");
  const avoid = decision.avoid
    .slice(0, 2)
    .map((candidate) => `${candidate.displayName}: ${candidate.reasons[0] ?? "review required"}`)
    .join("; ");

  if (language === "de") {
    const warningText = warnings.length ? ` Sichtbare Warnungen: ${uniqueStrings(warnings).join("; ")}.` : " Keine blockierende Warnung im Preflight.";
    const alternativesText = alternatives ? ` Gute Vergleichskandidaten: ${alternatives}.` : "";
    const avoidText = avoid ? ` Nicht blind installieren: ${avoid}.` : "";
    return `Ich würde zuerst ${selected.displayName} aus ${selected.source} prüfen. Trust: ${selected.trust.score}/100, ${selected.trust.decision}, Risiko ${selected.trust.risk}. Install Plan: ${command ?? "kein Install Command zurückgegeben"}. Nipmod bleibt hosted read-only und führt nichts aus.${warningText}${alternativesText}${avoidText}`;
  }

  const warningText = warnings.length ? ` Visible warnings: ${uniqueStrings(warnings).join("; ")}.` : " No blocking warning was returned in this preflight.";
  const alternativesText = alternatives ? ` Compare it with: ${alternatives}.` : "";
  const avoidText = avoid ? ` Do not install blindly: ${avoid}.` : "";
  return `I would inspect ${selected.displayName} from ${selected.source} first. Trust: ${selected.trust.score}/100, ${selected.trust.decision}, risk ${selected.trust.risk}. Install plan: ${command ?? "no install command returned"}. Hosted Nipmod stays read-only and does not execute anything.${warningText}${alternativesText}${avoidText}`;
}

function packageDecisionCandidate(record: ExternalPackageRecord, installPlan: ExternalInstallPlan | null): PackageDecisionCandidate {
  return {
    displayName: record.displayName,
    fitReasons: candidateFitReasons(record, installPlan),
    id: record.id,
    installCommand: installPlan?.plan.commands.at(0) ?? record.install.command ?? null,
    license: record.license,
    originalUrl: record.originalUrl,
    repo: record.repo,
    source: record.source,
    sourceDepthScore: record.sourceEvidence?.depthScore ?? null,
    trust: {
      decision: record.trust.decision,
      risk: record.trust.risk,
      score: record.trust.score,
      warnings: record.trust.warnings.slice(0, 6)
    },
    version: record.version
  };
}

function packageDecisionAvoid(record: ExternalPackageRecord): PackageDecisionAvoid {
  return {
    displayName: record.displayName,
    id: record.id,
    reasons: avoidReasons(record),
    source: record.source,
    trust: {
      decision: record.trust.decision,
      risk: record.trust.risk,
      score: record.trust.score
    }
  };
}

function packageDecisionReceipt(
  installPlan: ExternalInstallPlan,
  alternatives: PackageDecisionCandidate[],
  generatedAt: string
): PackageDecisionReceipt {
  return {
    alternativesConsidered: alternatives.map((candidate) => candidate.id).slice(0, 6),
    generatedAt,
    hostedApiExecutes: false,
    installCommand: installPlan.plan.commands.at(0) ?? null,
    installPlanBlocked: installPlan.safety.blocked,
    originalUrl: installPlan.package.originalUrl,
    packageId: installPlan.package.id,
    requiresApprovalBeforeWrite: true,
    reviewSteps: installPlan.plan.steps.slice(0, 8),
    source: installPlan.package.source,
    type: "dev.nipmod.package-decision-receipt.v1",
    version: installPlan.package.version,
    warnings: uniqueStrings(installPlan.safety.warnings).slice(0, 8),
    workspaceWrites: false
  };
}

function candidateFitReasons(record: ExternalPackageRecord, installPlan: ExternalInstallPlan | null): string[] {
  const reasons = [`trust ${record.trust.score}/100`];
  if (record.trust.decision === "recommended") reasons.push("passes current trust gate");
  if (record.sourceEvidence?.depthScore !== undefined) reasons.push(`source depth ${record.sourceEvidence.depthScore}/100`);
  if (record.license) reasons.push("license metadata present");
  if (record.repo) reasons.push("source link present");
  if (record.trust.dimensions.provenanceStatus !== "unknown") reasons.push(`${record.trust.dimensions.provenanceStatus} provenance`);
  if (installPlan) {
    reasons.push(installPlan.safety.blocked ? "install plan blocked" : "install plan available before workspace write");
  }
  return reasons.slice(0, 6);
}

function avoidReasons(record: ExternalPackageRecord): string[] {
  const reasons: string[] = [];
  if (record.trust.decision === "avoid") reasons.push("trust decision is avoid");
  if (record.trust.risk === "high") reasons.push("high source or install risk");
  if (record.trust.warnings.length > 0) reasons.push(...record.trust.warnings.slice(0, 3));
  if (!record.license) reasons.push("license metadata missing");
  if (!record.repo && record.source !== "huggingface-model" && record.source !== "huggingface-dataset") reasons.push("source repository link missing");
  return uniqueStrings(reasons).slice(0, 5);
}

function isAvoidRecord(record: ExternalPackageRecord): boolean {
  return record.trust.decision === "avoid" || record.trust.risk === "high" || record.trust.warnings.some((warning) => /malware|backdoor|credential|token|wallet|high-risk|typosquat|confusion/i.test(warning));
}

function decisionIntent(query: string): PackageDecisionIntent {
  if (/\b(replace|alternative|instead|statt|ersetzen|ablösen)\b/i.test(query)) return "replace-package";
  if (/\b(compare|vergleich|vs|versus|oder)\b/i.test(query)) return "compare-packages";
  if (/\b(audit|safe|safety|security|malware|cve|risk|risiko|sicher|gefährlich|prüf|check)\b/i.test(query)) return "audit-package";
  if (/\b(mcp|model context protocol|tool server|mcp server|agent skill|skill package)\b/i.test(query)) return "find-mcp-server";
  if (/\b(hugging ?face|hf|model|dataset|embedding|llm|vision model)\b/i.test(query)) return "find-model-or-dataset";
  if (/\b(github|repo|repository|source code)\b/i.test(query)) return "find-repository";
  return "find-package";
}

function decisionEcosystems(query: string, intent: PackageDecisionIntent): ExternalPackageSource[] {
  if (intent === "find-mcp-server") return ["mcp"];
  if (intent === "find-repository") return ["github"];
  if (intent === "find-model-or-dataset") {
    if (/\bdataset|daten|data set\b/i.test(query)) return ["huggingface-dataset", "huggingface-model", "pypi", "npm"];
    return ["huggingface-model", "huggingface-dataset", "pypi", "npm"];
  }
  if (/\b(npm|node|javascript|typescript|react|next|vite|css|tailwind)\b/i.test(query)) return ["npm", "github", "mcp"];
  if (/\b(pypi|pip|python|django|fastapi|pandas|pytest)\b/i.test(query)) return ["pypi", "github", "huggingface-model"];
  return [...EXTERNAL_PACKAGE_SOURCES];
}

function decisionCriteria(intent: PackageDecisionIntent, constraints: string[]): PackageDecisionCriterion[] {
  const criteria: PackageDecisionCriterion[] = [
    criterion("task-fit", "Task fit", 20),
    criterion("source-identity", "Source identity", 16),
    criterion("security", "Security evidence", intent === "audit-package" || constraints.includes("security-sensitive") ? 22 : 18),
    criterion("install-boundary", "Install boundary", 16),
    criterion("source-depth", "Source depth", 10),
    criterion("maintenance", "Maintenance", 8),
    criterion("license", "License", 4),
    criterion("adoption", "Adoption", 4)
  ];
  const total = criteria.reduce((sum, item) => sum + item.weight, 0);
  return criteria.map((item) => ({ ...item, weight: Math.round((item.weight / total) * 100) }));
}

function criterion(id: PackageDecisionCriterionId, label: string, weight: number): PackageDecisionCriterion {
  return { id, label, weight };
}

function decisionConstraints(query: string): string[] {
  const constraints: string[] = [];
  if (/\b(production|prod|enterprise|kunden|users|payments|wallet|token|ssh|secret|private key|api key)\b/i.test(query)) constraints.push("security-sensitive");
  if (/\b(browser|frontend|react|next|vite)\b/i.test(query)) constraints.push("frontend");
  if (/\b(server|backend|api|worker|queue)\b/i.test(query)) constraints.push("backend");
  if (/\b(lightweight|small|klein|fast|schnell)\b/i.test(query)) constraints.push("prefer-small-surface");
  return constraints;
}

function decisionClarification(query: string, language: "de" | "en"): PackageDecisionQueryPlan["clarification"] {
  const tokenCount = query.split(/\s+/).filter(Boolean).length;
  if (tokenCount <= 2 && !/\b(zod|react|npm|pypi|github|mcp|hugging ?face)\b/i.test(query)) {
    return {
      needed: true,
      question: language === "de" ? "Für welchen Stack oder Use Case brauchst du das Paket?" : "Which stack or use case do you need the package for?",
      reason: "query too broad for a strong package decision"
    };
  }
  return { needed: false, question: null, reason: null };
}

function decisionSearchQueries(query: string): string[] {
  const cleaned = query
    .replace(/\b(ich brauche|i need|finde|find|suche|such|bestes|beste|best|good|gutes|paket|package|library|lib)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return uniqueStrings([query, cleaned]).filter(Boolean).slice(0, 3);
}

function decisionTask(query: string, intent: PackageDecisionIntent): string {
  if (intent === "audit-package") return "Assess package trust and install risk before execution.";
  if (intent === "compare-packages") return "Compare package candidates before selection.";
  if (intent === "replace-package") return "Find a safer or better replacement package.";
  if (intent === "find-mcp-server") return "Find an MCP server with trust and install boundaries.";
  if (intent === "find-model-or-dataset") return "Find a model or dataset with source and file-shape context.";
  if (intent === "find-repository") return "Find a repository with source posture context.";
  return query || "Find a package for the requested task.";
}

function decisionUncertainty(input: {
  installPlan: ExternalInstallPlan | null;
  records: ExternalPackageRecord[];
  selected: ExternalPackageRecord | null;
  sourceSummary: ExternalSearchResult["sourceSummary"];
}): string[] {
  const uncertainty: string[] = [];
  if (!input.selected) uncertainty.push("no selected candidate");
  if (!input.installPlan) uncertainty.push("install plan not returned");
  if (input.records.length < 2) uncertainty.push("few alternatives returned");
  if (input.sourceSummary.failed > 0) uncertainty.push(`${input.sourceSummary.failed} source(s) failed during lookup`);
  if (input.selected && !input.selected.repo && input.selected.source !== "huggingface-model" && input.selected.source !== "huggingface-dataset") {
    uncertainty.push("selected candidate has no repository link");
  }
  if (input.selected && !input.selected.license) uncertainty.push("selected candidate has no license metadata");
  if (input.selected && !input.selected.sourceEvidence) uncertainty.push("selected candidate has no structured source evidence");
  return uniqueStrings(uncertainty).slice(0, 8);
}

function decisionConfidenceScore(
  selected: ExternalPackageRecord | null,
  installPlan: ExternalInstallPlan | null,
  sourceSummary: ExternalSearchResult["sourceSummary"],
  uncertainty: string[]
): number {
  if (!selected) return 0;
  const evidence = selected.sourceEvidence?.depthScore ?? 50;
  const install = installPlan ? (installPlan.safety.blocked ? 0 : 18) : 0;
  const sourceHealth = sourceSummary.requested > 0 ? Math.round((sourceSummary.ok / sourceSummary.requested) * 12) : 0;
  const warningPenalty = Math.min(24, selected.trust.warnings.length * 5 + uncertainty.length * 3);
  return clamp(Math.round(selected.trust.score * 0.55 + evidence * 0.18 + install + sourceHealth - warningPenalty), 0, 100);
}

function confidenceLabel(score: number): PackageDecisionConfidenceLabel {
  if (score >= 78) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function decisionSummary(
  language: "de" | "en",
  recommended: PackageDecisionCandidate | null,
  installPlan: ExternalInstallPlan | null,
  alternatives: PackageDecisionCandidate[],
  avoid: PackageDecisionAvoid[]
): string {
  if (!recommended) {
    return language === "de" ? "Keine belastbare Empfehlung aus den geprüften Quellen." : "No strong recommendation from the checked sources.";
  }
  const boundary = installPlan?.safety.blocked ? "blocked install plan" : "read-only install plan";
  if (language === "de") {
    return `${recommended.displayName} ist der aktuelle stärkste Kandidat. Nipmod hat Trust, Quelle und ${boundary} geprüft; ${alternatives.length} Alternative(n), ${avoid.length} Avoid-Kandidat(en).`;
  }
  return `${recommended.displayName} is the current strongest candidate. Nipmod checked trust, source context and a ${boundary}; ${alternatives.length} alternative(s), ${avoid.length} avoid candidate(s).`;
}

function detectDecisionLanguage(message: string): "de" | "en" {
  if (/[äöüß]/i.test(message)) return "de";
  const normalized = message.toLowerCase();
  const germanWords = normalized.match(/\b(was|ist|sind|so|für|paket|pakete|brauche|bekannt|beste|webseite|warum|wie|geht|dir|kann|nicht|oder|danke|sicher|gefährlich)\b/g);
  return (germanWords?.length ?? 0) >= 2 ? "de" : "en";
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function checkedSources(records: ExternalPackageRecord[], fallback: ExternalPackageSource[]): ExternalPackageSource[] {
  const sources = records.map((record) => record.source);
  return sources.length ? [...new Set(sources)] : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
