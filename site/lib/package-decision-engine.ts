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
export type PackageDecisionGate = "block" | "pass" | "review";
export type PackageDecisionSecurityPosture = "blocked" | "clean-preflight" | "needs-review";

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
  decisionScore: number;
  displayName: string;
  fitReasons: string[];
  gate: PackageDecisionGate;
  id: string;
  installCommand: string | null;
  license: string | null;
  originalUrl: string;
  repo: string | null;
  scoreBreakdown: PackageDecisionScoreBreakdown;
  securitySignals: PackageDecisionSecuritySignal[];
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
  gate: PackageDecisionGate;
  id: string;
  reasons: string[];
  score: number;
  source: ExternalPackageSource;
  trust: {
    decision: ExternalPackageRecord["trust"]["decision"];
    risk: ExternalPackageRecord["trust"]["risk"];
    score: number;
  };
}

export interface PackageDecisionReceipt {
  alternativesConsidered: string[];
  archiveConfirm: {
    confirmable: boolean;
    dryRunEndpoint: "POST /api/archive/confirm";
    reason: string;
    required: false;
  };
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
  archive: {
    confirmable: boolean;
    dryRunEndpoint: "POST /api/archive/confirm";
    reason: string;
    required: false;
  };
  avoid: PackageDecisionAvoid[];
  comparison: {
    candidates: Array<{
      dimensions: PackageDecisionScoreDimension[];
      displayName: string;
      gate: PackageDecisionGate;
      id: string;
      score: number;
      source: ExternalPackageSource;
    }>;
    version: "package-decision-comparison-v2";
  };
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
  security: {
    highSignalCount: number;
    posture: PackageDecisionSecurityPosture;
    reviewSignalCount: number;
    signals: PackageDecisionSecuritySignal[];
  };
  summary: string;
  type: "dev.nipmod.package-decision.v1";
}

export interface PackageDecisionScoreBreakdown {
  dimensions: PackageDecisionScoreDimension[];
  total: number;
  version: "decision-score-v2";
}

export interface PackageDecisionScoreDimension {
  id: PackageDecisionCriterionId;
  label: string;
  reason: string;
  score: number;
  weight: number;
}

export interface PackageDecisionSecuritySignal {
  category: "advisory" | "credential" | "install" | "metadata" | "provenance" | "source";
  evidence: string;
  id: string;
  severity: "high" | "info" | "low" | "medium";
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
  const candidateRecords = orderedUniqueRecords(input.selected ? [input.selected, ...input.records] : input.records);
  const evaluated = candidateRecords
    .map((record) => packageDecisionCandidate(record, record.id === input.selected?.id ? input.installPlan : null, plan))
    .sort(compareDecisionCandidates);
  const recommended = evaluated.find((candidate) => candidate.id === input.selected?.id && candidate.gate !== "block") ?? evaluated.find((candidate) => candidate.gate === "pass") ?? evaluated.find((candidate) => candidate.gate === "review") ?? null;
  const alternatives = evaluated.filter((candidate) => candidate.id !== recommended?.id && candidate.gate !== "block").slice(0, 4);
  const avoid = input.records
    .filter((record) => evaluated.find((candidate) => candidate.id === record.id)?.gate === "block" || isAvoidRecord(record))
    .slice(0, 4)
    .map((record) => packageDecisionAvoid(record, evaluated.find((candidate) => candidate.id === record.id)));

  const receipt = recommended && input.installPlan ? packageDecisionReceipt(input.installPlan, alternatives, generatedAt) : null;
  const uncertainty = decisionUncertainty({
    installPlan: input.installPlan,
    records: input.records,
    selected: input.selected,
    sourceSummary: input.sourceSummary
  });
  const confidenceScore = decisionConfidenceScore(input.selected, input.installPlan, input.sourceSummary, uncertainty);
  const securitySignals = evaluated.flatMap((candidate) => candidate.securitySignals);
  const archive = archiveConfirmHint(recommended, receipt);

  return {
    alternatives,
    archive,
    avoid,
    comparison: {
      candidates: evaluated.slice(0, 8).map((candidate) => ({
        dimensions: candidate.scoreBreakdown.dimensions,
        displayName: candidate.displayName,
        gate: candidate.gate,
        id: candidate.id,
        score: candidate.decisionScore,
        source: candidate.source
      })),
      version: "package-decision-comparison-v2"
    },
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
    security: {
      highSignalCount: securitySignals.filter((signal) => signal.severity === "high").length,
      posture: securityPosture(recommended, receipt, recommended?.securitySignals ?? []),
      reviewSignalCount: securitySignals.filter((signal) => signal.severity === "medium").length,
      signals: securitySignals.slice(0, 12)
    },
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
  const confidence = `${decision.confidence.score}/100`;
  const alternatives = decision.alternatives
    .slice(0, 3)
    .map((candidate) => `${candidate.displayName} (${candidate.source}, ${candidate.decisionScore}/100)`)
    .join(", ");
  const avoid = decision.avoid
    .slice(0, 2)
    .map((candidate) => `${candidate.displayName}: ${candidate.reasons[0] ?? "review required"}`)
    .join("; ");

  if (language === "de") {
    const warningText = warnings.length ? ` Sichtbare Warnungen: ${uniqueStrings(warnings).join("; ")}.` : " Keine blockierende Warnung im Preflight.";
    const alternativesText = alternatives ? ` Vergleichskandidaten: ${alternatives}.` : "";
    const avoidText = avoid ? ` Nicht blind installieren: ${avoid}.` : "";
    return `Ich würde ${selected.displayName} aus ${selected.source} als ersten Kandidaten nehmen und trotzdem vor der Ausführung prüfen. Decision Score: ${selected.decisionScore}/100, Confidence ${confidence}, Trust ${selected.trust.score}/100, Risiko ${selected.trust.risk}. Install Plan: ${command ?? "kein Install Command zurückgegeben"}. Hosted Nipmod bleibt read-only: keine Ausführung, kein Clone, kein Workspace Write.${warningText}${alternativesText}${avoidText}`;
  }

  const warningText = warnings.length ? ` Visible warnings: ${uniqueStrings(warnings).join("; ")}.` : " No blocking warning was returned in this preflight.";
  const alternativesText = alternatives ? ` Compare it with: ${alternatives}.` : "";
  const avoidText = avoid ? ` Do not install blindly: ${avoid}.` : "";
  return `I would start with ${selected.displayName} from ${selected.source}, then review it before execution. Decision score: ${selected.decisionScore}/100, confidence ${confidence}, trust ${selected.trust.score}/100, risk ${selected.trust.risk}. Install plan: ${command ?? "no install command returned"}. Hosted Nipmod stays read-only: no execution, no clone, no workspace write.${warningText}${alternativesText}${avoidText}`;
}

function packageDecisionCandidate(
  record: ExternalPackageRecord,
  installPlan: ExternalInstallPlan | null,
  plan: PackageDecisionQueryPlan
): PackageDecisionCandidate {
  const securitySignals = packageSecuritySignals(record, installPlan);
  const scoreBreakdown = decisionScoreBreakdown(record, installPlan, plan, securitySignals);
  const decisionScore = scoreBreakdown.total;
  const gate = candidateGate(record, installPlan, securitySignals, decisionScore);
  return {
    decisionScore,
    displayName: record.displayName,
    fitReasons: candidateFitReasons(record, installPlan),
    gate,
    id: record.id,
    installCommand: installPlan?.plan.commands.at(0) ?? record.install.command ?? null,
    license: record.license,
    originalUrl: record.originalUrl,
    repo: record.repo,
    scoreBreakdown,
    securitySignals,
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

function packageDecisionAvoid(record: ExternalPackageRecord, candidate: PackageDecisionCandidate | undefined): PackageDecisionAvoid {
  return {
    displayName: record.displayName,
    gate: candidate?.gate ?? "block",
    id: record.id,
    reasons: avoidReasons(record),
    score: candidate?.decisionScore ?? record.trust.score,
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
    archiveConfirm: archiveConfirmHint(
      {
        decisionScore: installPlan.package.trust.score,
        gate: installPlan.safety.blocked ? "block" : "pass",
        trust: installPlan.package.trust
      },
      { installPlanBlocked: installPlan.safety.blocked }
    ),
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
  return record.trust.decision === "avoid" || record.trust.risk === "high" || packageSecuritySignals(record, null).some((signal) => signal.severity === "high");
}

function orderedUniqueRecords(records: ExternalPackageRecord[]): ExternalPackageRecord[] {
  const seen = new Set<string>();
  const unique: ExternalPackageRecord[] = [];
  for (const record of records) {
    if (!seen.has(record.id)) {
      seen.add(record.id);
      unique.push(record);
    }
  }
  return unique;
}

function compareDecisionCandidates(left: PackageDecisionCandidate, right: PackageDecisionCandidate): number {
  return gateRank(right.gate) - gateRank(left.gate) || right.decisionScore - left.decisionScore || right.trust.score - left.trust.score || left.displayName.localeCompare(right.displayName);
}

function gateRank(gate: PackageDecisionGate): number {
  if (gate === "pass") return 3;
  if (gate === "review") return 2;
  return 1;
}

function candidateGate(
  record: ExternalPackageRecord,
  installPlan: ExternalInstallPlan | null,
  securitySignals: PackageDecisionSecuritySignal[],
  decisionScore: number
): PackageDecisionGate {
  if (installPlan?.safety.blocked || record.trust.decision === "avoid" || record.trust.risk === "high") {
    return "block";
  }
  if (securitySignals.some((signal) => signal.severity === "high")) {
    return "block";
  }
  if (
    decisionScore < 72 ||
    record.trust.decision !== "recommended" ||
    record.trust.risk !== "low" ||
    record.trust.warnings.length > 0 ||
    securitySignals.some((signal) => signal.severity === "medium")
  ) {
    return "review";
  }
  return "pass";
}

function decisionScoreBreakdown(
  record: ExternalPackageRecord,
  installPlan: ExternalInstallPlan | null,
  plan: PackageDecisionQueryPlan,
  securitySignals: PackageDecisionSecuritySignal[]
): PackageDecisionScoreBreakdown {
  const dimensions = plan.criteria.map((criterionItem) => scoreDimension(criterionItem, record, installPlan, plan, securitySignals));
  const weighted = dimensions.reduce((sum, dimension) => sum + dimension.score * (dimension.weight / 100), 0);
  const highPenalty = securitySignals.filter((signal) => signal.severity === "high").length * 18;
  const mediumPenalty = securitySignals.filter((signal) => signal.severity === "medium").length * 6;
  return {
    dimensions,
    total: clamp(Math.round(weighted - highPenalty - mediumPenalty), 0, 100),
    version: "decision-score-v2"
  };
}

function scoreDimension(
  criterionItem: PackageDecisionCriterion,
  record: ExternalPackageRecord,
  installPlan: ExternalInstallPlan | null,
  plan: PackageDecisionQueryPlan,
  securitySignals: PackageDecisionSecuritySignal[]
): PackageDecisionScoreDimension {
  if (criterionItem.id === "task-fit") {
    const match = taskFitScore(record, plan);
    return { ...criterionItem, reason: match.reason, score: match.score };
  }
  if (criterionItem.id === "source-identity") {
    const score = clamp(52 + (record.originalUrl ? 16 : 0) + (record.owner ? 10 : 0) + (record.version ? 10 : 0) + (record.repo ? 12 : 0), 0, 100);
    return { ...criterionItem, reason: record.originalUrl ? "resolved source URL and identity fields" : "weak source identity fields", score };
  }
  if (criterionItem.id === "security") {
    const signalPenalty = securitySignals.reduce((sum, signal) => sum + (signal.severity === "high" ? 30 : signal.severity === "medium" ? 12 : signal.severity === "low" ? 4 : 0), 0);
    const score = clamp(record.trust.score - signalPenalty + (record.trust.dimensions.securityConfidence === "high" ? 8 : 0), 0, 100);
    return { ...criterionItem, reason: securitySignals.length ? `${securitySignals.length} security signal(s)` : "no additional security signal in hosted preflight", score };
  }
  if (criterionItem.id === "install-boundary") {
    const score = installPlan ? (installPlan.safety.blocked ? 12 : installPlan.safety.commandRisk === "medium" ? 68 : 96) : 45;
    return { ...criterionItem, reason: installPlan ? "install plan returned before workspace write" : "install plan not available for this candidate", score };
  }
  if (criterionItem.id === "source-depth") {
    const score = record.sourceEvidence?.depthScore ?? 45;
    return { ...criterionItem, reason: record.sourceEvidence ? "structured source evidence returned" : "source evidence missing", score };
  }
  if (criterionItem.id === "maintenance") {
    const score = clamp(record.trust.dimensions.qualityScore + (record.updatedAt ? 10 : 0), 0, 100);
    return { ...criterionItem, reason: record.updatedAt ? "quality score plus update metadata" : "quality score without update metadata", score };
  }
  if (criterionItem.id === "license") {
    return { ...criterionItem, reason: record.license ? "license metadata present" : "license metadata missing", score: record.license ? 96 : 20 };
  }
  if (criterionItem.id === "adoption") {
    const signals = (record.metrics.downloads ?? 0) + (record.metrics.stars ?? 0) + (record.metrics.likes ?? 0) + (record.metrics.dependents ?? 0);
    const score = signals > 1_000_000 ? 96 : signals > 100_000 ? 84 : signals > 10_000 ? 68 : signals > 0 ? 50 : 30;
    return { ...criterionItem, reason: signals > 0 ? "public usage signal present" : "no public usage signal returned", score };
  }
  return { ...criterionItem, reason: "alternative context is derived from the candidate set", score: 50 };
}

function taskFitScore(record: ExternalPackageRecord, plan: PackageDecisionQueryPlan): { reason: string; score: number } {
  const text = `${record.name} ${record.displayName} ${record.description}`.toLowerCase();
  const tokens = queryTokens(plan.normalizedQuery);
  const matchCount = tokens.filter((token) => text.includes(token)).length;
  const sourceFit = plan.ecosystems.includes(record.source) ? 20 : -18;
  const exact = text.includes(plan.normalizedQuery.toLowerCase()) ? 20 : 0;
  const score = clamp(44 + matchCount * 8 + sourceFit + exact, 0, 100);
  return {
    reason: matchCount > 0 ? `${matchCount} query token(s) match package text` : "weak direct text fit; rely on source resolver ranking",
    score
  };
}

function packageSecuritySignals(record: ExternalPackageRecord, installPlan: ExternalInstallPlan | null): PackageDecisionSecuritySignal[] {
  const text = `${record.name}\n${record.displayName}\n${record.description}\n${record.install.command}\n${record.trust.warnings.join("\n")}\n${record.trust.signals.join("\n")}`.toLowerCase();
  const signals: PackageDecisionSecuritySignal[] = [];
  if (record.trust.risk === "high" || record.trust.decision === "avoid") {
    signals.push(securitySignal("trust.high-risk", "source", "high", "Trust policy returned avoid or high risk."));
  }
  if (installPlan?.safety.blocked) {
    signals.push(securitySignal("install.blocked", "install", "high", installPlan.safety.blockReason ?? "Install plan is blocked."));
  }
  if (/postinstall|preinstall|install script|lifecycle script/.test(text)) {
    signals.push(securitySignal("install.lifecycle", "install", "medium", "Package text or warnings mention install lifecycle behavior."));
  }
  if (/curl\s|wget\s|bash\s+-c|powershell|remote code|eval\(|exec\(/.test(text)) {
    signals.push(securitySignal("install.remote-code", "install", "high", "Install or metadata text suggests remote-code or shell execution patterns."));
  }
  if (/wallet|private key|seed phrase|mnemonic|ssh key|credential|token stealer|secret/.test(text)) {
    signals.push(securitySignal("credential.language", "credential", "high", "Credential or wallet-sensitive language appears in package context."));
  }
  if (/typosquat|dependency confusion|confusable|package confusion/.test(text)) {
    signals.push(securitySignal("source.confusion", "source", "high", "Package confusion or typosquat warning returned."));
  }
  if (!record.license) {
    signals.push(securitySignal("metadata.license-missing", "metadata", "low", "License metadata missing."));
  }
  if (!record.repo && record.source !== "huggingface-model" && record.source !== "huggingface-dataset") {
    signals.push(securitySignal("source.repo-missing", "source", record.source === "mcp" ? "medium" : "low", "Repository link missing from source metadata."));
  }
  if (!record.sourceEvidence) {
    signals.push(securitySignal("source.evidence-missing", "source", "medium", "Structured source evidence missing."));
  }
  if (record.trust.dimensions.provenanceStatus === "unknown") {
    signals.push(securitySignal("provenance.unknown", "provenance", "low", "Provenance status unknown."));
  }
  return dedupeSecuritySignals(signals);
}

function securitySignal(
  id: string,
  category: PackageDecisionSecuritySignal["category"],
  severity: PackageDecisionSecuritySignal["severity"],
  evidence: string
): PackageDecisionSecuritySignal {
  return { category, evidence, id, severity };
}

function dedupeSecuritySignals(signals: PackageDecisionSecuritySignal[]): PackageDecisionSecuritySignal[] {
  const seen = new Set<string>();
  return signals.filter((signal) => {
    if (seen.has(signal.id)) {
      return false;
    }
    seen.add(signal.id);
    return true;
  });
}

function archiveConfirmHint(
  candidate: Pick<PackageDecisionCandidate, "decisionScore" | "gate" | "trust"> | null,
  receipt: Pick<PackageDecisionReceipt, "installPlanBlocked"> | null
): PackageDecision["archive"] {
  if (!candidate) {
    return {
      confirmable: false,
      dryRunEndpoint: "POST /api/archive/confirm",
      reason: "No recommended package decision to confirm.",
      required: false
    };
  }
  if (candidate.gate === "block" || receipt?.installPlanBlocked) {
    return {
      confirmable: false,
      dryRunEndpoint: "POST /api/archive/confirm",
      reason: "Blocked or high-risk decisions are not confirmable archive candidates.",
      required: false
    };
  }
  if (candidate.trust.decision !== "recommended" || candidate.decisionScore < 72) {
    return {
      confirmable: false,
      dryRunEndpoint: "POST /api/archive/confirm",
      reason: "Review candidates need stronger trust before archive confirmation.",
      required: false
    };
  }
  return {
    confirmable: true,
    dryRunEndpoint: "POST /api/archive/confirm",
    reason: "Can be dry-run confirmed after the host or user verifies the result was useful.",
    required: false
  };
}

function securityPosture(
  recommended: PackageDecisionCandidate | null,
  receipt: PackageDecisionReceipt | null,
  signals: PackageDecisionSecuritySignal[]
): PackageDecisionSecurityPosture {
  if (!recommended || recommended.gate === "block" || receipt?.installPlanBlocked || signals.some((signal) => signal.severity === "high")) {
    return "blocked";
  }
  if (recommended.gate === "review" || signals.some((signal) => signal.severity === "medium")) {
    return "needs-review";
  }
  return "clean-preflight";
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
  if (/\b(base|onchain|coinbase|evm|web3|wallet|token|tokens|coin|coins|crypto|swap|trading|traden|dex|router|liquidity|viem|wagmi|uniswap)\b/i.test(query)) {
    return ["npm", "github", "mcp"];
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
  if (/\b(base|onchain|coinbase|evm|web3|wallet|token|tokens|coin|coins|crypto|swap|trading|traden|dex|router|liquidity)\b/i.test(query)) constraints.push("onchain-transaction-sensitive");
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
  const expansions: string[] = [];
  if (/\b(form|forms|formular|schema|validation|validierung|react)\b/i.test(query)) {
    expansions.push("react forms validation schema react-hook-form zod valibot tanstack form");
  }
  if (/\b(web ?design|website ?design|ui|component|tailwind|icons?|animation)\b/i.test(query)) {
    expansions.push("website design react ui component library css tailwind icons animation");
  }
  if (/\b(pdf|document|extract|parse|text)\b/i.test(query)) {
    expansions.push("pdf document parsing extract text package");
  }
  if (/\b(embedding|rag|semantic search|vector)\b/i.test(query)) {
    expansions.push("embedding model sentence transformers rag semantic search");
  }
  if (/\b(base|onchain|coinbase|evm|web3|wallet|token|tokens|coin|coins|crypto|swap|trading|traden|dex|router|liquidity|viem|wagmi|uniswap)\b/i.test(query)) {
    expansions.push("base onchain token trading swap sdk viem wagmi uniswap coinbase onchainkit");
  }
  if (/\b(wallet|token|private key|ssh|secret|malware|postinstall|supply chain)\b/i.test(query)) {
    expansions.push(`${cleaned || query} security install script provenance`);
  }
  return uniqueStrings([query, cleaned, ...expansions]).filter(Boolean).slice(0, 5);
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

function queryTokens(value: string): string[] {
  return uniqueStrings(
    value
      .toLowerCase()
      .split(/[^a-z0-9@/_-]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  ).slice(0, 10);
}

function checkedSources(records: ExternalPackageRecord[], fallback: ExternalPackageSource[]): ExternalPackageSource[] {
  const sources = records.map((record) => record.source);
  return sources.length ? [...new Set(sources)] : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
