import { installCommandRisk, type InstallCommandRisk } from "./package-command-safety";

export type PackageRiskSeverity = "info" | "low" | "medium" | "high";
export type PackageRiskCategory = "source" | "metadata" | "artifact" | "install" | "credential" | "timeline";
export type AgentPackageAction = "consider" | "review" | "avoid";

export interface PackageRiskSignal {
  action: AgentPackageAction;
  category: PackageRiskCategory;
  code: string;
  evidence: string;
  severity: PackageRiskSeverity;
}

export interface PackageArtifactIntelligence {
  executableSurface: "none-returned" | "install-script" | "build-backend" | "remote-code" | "dataset-script" | "repo-automation" | "mcp-tooling";
  fileShape: string[];
  hostedScan: "metadata-only";
  limitations: string[];
  riskSignals: string[];
  version: "artifact-intelligence-v1";
}

export interface PackageSourceGraph {
  edges: Array<{
    from: string;
    to: string;
    type: "resolved-from" | "published-by" | "links-to" | "installs-from" | "mirrors-to" | "runs-as-tool";
  }>;
  nodes: Array<{
    id: string;
    label: string;
    type: "package" | "source" | "owner" | "repository" | "registry" | "artifact" | "endpoint";
    url?: string;
  }>;
  summary: string;
  version: "source-graph-v1";
}

export interface PackageTrustTimeline {
  events: Array<{
    at: string | null;
    evidence: string;
    label: string;
    type: "created" | "published" | "updated" | "previous-release" | "registry-status" | "source-observed";
  }>;
  riskFlags: string[];
  version: "trust-timeline-v1";
}

export interface PackageAgentRecommendation {
  action: AgentPackageAction;
  installPlanRequired: true;
  nextSteps: string[];
  summary: string;
  version: "agent-recommendation-v1";
  workspaceWriteAllowed: false;
}

export interface PackageScannerIntelligence {
  agentRecommendation: PackageAgentRecommendation;
  artifactIntelligence: PackageArtifactIntelligence;
  riskSignals: PackageRiskSignal[];
  sourceGraph: PackageSourceGraph;
  trustTimeline: PackageTrustTimeline;
}

export interface PackageScannerIntelligenceInput {
  description: string;
  displayName: string;
  id: string;
  install: {
    command: string;
    commands?: string[];
    manager: string;
    notes: string[];
  };
  license: string | null;
  metrics: {
    dependents?: number | null;
    downloads?: number | null;
    likes?: number | null;
    stars?: number | null;
  };
  name: string;
  originalUrl: string;
  owner: string | null;
  registryUrl: string;
  repo: string | null;
  signals: string[];
  source: string;
  sourceKind: string;
  sourceEvidence?: {
    checks: Array<{ id: string; status: "pass" | "warning" | "missing"; evidence: string }>;
    depthScore: number;
  };
  trust: {
    decision: string;
    risk: string;
    score: number;
    warnings: string[];
  };
  updatedAt: string | null;
  version: string | null;
}

export function buildPackageScannerIntelligence(input: PackageScannerIntelligenceInput): PackageScannerIntelligence {
  const commands = input.install.commands ?? [input.install.command];
  const commandRisk = installCommandRisk(commands);
  const riskSignals = packageRiskSignals(input, commandRisk);
  const artifactIntelligence = packageArtifactIntelligence(input, commandRisk, riskSignals);
  const trustTimeline = packageTrustTimeline(input, riskSignals);
  const sourceGraph = packageSourceGraph(input, artifactIntelligence);
  const agentRecommendation = packageAgentRecommendation(input, commandRisk, riskSignals);

  return {
    agentRecommendation,
    artifactIntelligence,
    riskSignals,
    sourceGraph,
    trustTimeline
  };
}

export function packageRiskPenalty(riskSignals: PackageRiskSignal[]): number {
  return riskSignals.reduce((sum, signal) => {
    if (signal.severity === "high") return sum + 28;
    if (signal.severity === "medium") return sum + 12;
    if (signal.severity === "low") return sum + 4;
    return sum;
  }, 0);
}

export function packageEvidenceBonus(depthScore: number | undefined): number {
  if (typeof depthScore !== "number") {
    return 0;
  }
  return Math.max(0, Math.min(8, Math.round((depthScore - 70) / 4)));
}

function packageRiskSignals(input: PackageScannerIntelligenceInput, commandRisk: InstallCommandRisk): PackageRiskSignal[] {
  const signals: PackageRiskSignal[] = [];
  if (commandRisk === "high") {
    signals.push(risk("install.command.high", "install", "high", "avoid", "Install command contains a high-risk shell pattern."));
  } else if (commandRisk === "medium") {
    signals.push(risk("install.command.medium", "install", "medium", "review", "Install command needs manual review before execution."));
  }

  for (const warning of input.trust.warnings) {
    const classified = classifyWarning(warning);
    signals.push(risk(classified.code, classified.category, classified.severity, classified.action, warning));
  }

  for (const check of input.sourceEvidence?.checks ?? []) {
    if (check.status === "warning") {
      signals.push(risk(`evidence.${check.id}.warning`, "source", criticalEvidenceId(check.id) ? "high" : "medium", criticalEvidenceId(check.id) ? "avoid" : "review", check.evidence));
    }
    if (check.status === "missing" && coreEvidenceId(check.id)) {
      signals.push(risk(`evidence.${check.id}.missing`, "source", "medium", "review", check.evidence));
    }
  }

  if (!input.license) {
    signals.push(risk("metadata.license.missing", "metadata", "low", "review", "No license metadata returned."));
  }
  if (!input.repo && input.source !== "huggingface-model" && input.source !== "huggingface-dataset") {
    signals.push(risk("source.repository.missing", "source", input.source === "mcp" ? "medium" : "low", "review", "No source repository link returned."));
  }

  return dedupeRiskSignals(signals);
}

function packageArtifactIntelligence(
  input: PackageScannerIntelligenceInput,
  commandRisk: InstallCommandRisk,
  riskSignals: PackageRiskSignal[]
): PackageArtifactIntelligence {
  const text = [...input.signals, ...input.trust.warnings].join("\n");
  const fileShape = artifactFileShape(input.source, text);
  const executableSurface = executableSurfaceFromSignals(input.source, text, commandRisk);
  const riskSignalLabels = riskSignals
    .filter((signal) => signal.category === "artifact" || signal.category === "install" || signal.category === "credential")
    .map((signal) => signal.code)
    .slice(0, 12);

  return {
    executableSurface,
    fileShape,
    hostedScan: "metadata-only",
    limitations: [
      "Hosted API does not execute, clone, unpack or download package artifacts.",
      "Deep artifact inspection must run in a local or isolated sandbox worker before execution."
    ],
    riskSignals: riskSignalLabels,
    version: "artifact-intelligence-v1"
  };
}

function packageSourceGraph(input: PackageScannerIntelligenceInput, artifact: PackageArtifactIntelligence): PackageSourceGraph {
  const nodes: PackageSourceGraph["nodes"] = [
    { id: input.id, label: input.displayName, type: "package", url: input.originalUrl },
    { id: `source:${input.source}`, label: input.source, type: "source" },
    { id: `registry:${hostLabel(input.registryUrl)}`, label: hostLabel(input.registryUrl), type: "registry", url: input.registryUrl }
  ];
  const edges: PackageSourceGraph["edges"] = [
    { from: input.id, to: `source:${input.source}`, type: "resolved-from" },
    { from: input.id, to: `registry:${hostLabel(input.registryUrl)}`, type: "installs-from" }
  ];

  if (input.owner) {
    nodes.push({ id: `owner:${input.source}:${input.owner}`, label: input.owner, type: "owner" });
    edges.push({ from: input.id, to: `owner:${input.source}:${input.owner}`, type: "published-by" });
  }
  if (input.repo) {
    nodes.push({ id: `repo:${input.repo}`, label: shortUrlLabel(input.repo), type: "repository", url: input.repo });
    edges.push({ from: input.id, to: `repo:${input.repo}`, type: "links-to" });
  }
  if (artifact.executableSurface !== "none-returned") {
    nodes.push({ id: `artifact:${input.id}:${artifact.executableSurface}`, label: artifact.executableSurface, type: "artifact" });
    edges.push({ from: input.id, to: `artifact:${input.id}:${artifact.executableSurface}`, type: "mirrors-to" });
  }
  if (input.source === "mcp") {
    nodes.push({ id: `endpoint:${input.id}`, label: "MCP endpoint", type: "endpoint", url: input.originalUrl });
    edges.push({ from: input.id, to: `endpoint:${input.id}`, type: "runs-as-tool" });
  }

  return {
    edges: dedupeEdges(edges),
    nodes: dedupeNodes(nodes),
    summary: `${input.displayName} resolved from ${input.source} with ${nodes.length} graph node(s) and ${edges.length} relationship(s).`,
    version: "source-graph-v1"
  };
}

function packageTrustTimeline(input: PackageScannerIntelligenceInput, riskSignals: PackageRiskSignal[]): PackageTrustTimeline {
  const events: PackageTrustTimeline["events"] = [];
  const signalText = input.signals.join("\n");
  addTimelineEvent(events, signalText, /package created at:\s*([^\n.]+)/i, "created", "Package created");
  addTimelineEvent(events, signalText, /latest version published at:\s*([^\n.]+)/i, "published", "Latest version published");
  addTimelineEvent(events, signalText, /latest upload timestamp:\s*([^\n.]+)/i, "published", "Latest upload");
  addTimelineEvent(events, signalText, /previous (?:version published|release upload) (?:at|timestamp):\s*([^\n.]+)/i, "previous-release", "Previous release");
  addTimelineEvent(events, signalText, /package modified at:\s*([^\n.]+)/i, "updated", "Package modified");
  addTimelineEvent(events, signalText, /MCP Registry status:\s*([^\n.]+)/i, "registry-status", "Registry status");
  if (input.updatedAt) {
    events.push({ at: input.updatedAt, evidence: input.updatedAt, label: "Source updated", type: "updated" });
  }
  if (events.length === 0) {
    events.push({ at: null, evidence: "No source timeline metadata returned.", label: "Source observed", type: "source-observed" });
  }

  const riskFlags = [
    ...timelineRiskFlags(signalText),
    ...riskSignals.filter((signal) => signal.category === "timeline").map((signal) => signal.code)
  ];

  return {
    events: dedupeTimelineEvents(events).slice(0, 8),
    riskFlags: [...new Set(riskFlags)].slice(0, 10),
    version: "trust-timeline-v1"
  };
}

function packageAgentRecommendation(
  input: PackageScannerIntelligenceInput,
  commandRisk: InstallCommandRisk,
  riskSignals: PackageRiskSignal[]
): PackageAgentRecommendation {
  const hasHigh = riskSignals.some((signal) => signal.severity === "high" || signal.action === "avoid");
  const hasMedium = riskSignals.some((signal) => signal.severity === "medium" || signal.action === "review");
  const action: AgentPackageAction =
    input.trust.decision === "avoid" || input.trust.risk === "high" || commandRisk === "high" || hasHigh
      ? "avoid"
      : input.trust.decision !== "recommended" || input.trust.risk !== "low" || commandRisk === "medium" || hasMedium
        ? "review"
        : "consider";
  const nextSteps =
    action === "avoid"
      ? [
          "Do not run the install command.",
          "Inspect the original source manually.",
          "Look for a safer alternative before touching the workspace."
        ]
      : action === "review"
        ? [
            "Request an install plan before workspace writes.",
            "Review warnings, source graph and artifact surface.",
            "Run deeper local or sandbox scanning if execution is needed."
          ]
        : [
            "Request an install plan before workspace writes.",
            "Ask the user or host policy for approval.",
            "Store a receipt after execution."
          ];

  return {
    action,
    installPlanRequired: true,
    nextSteps,
    summary: recommendationSummary(action, input),
    version: "agent-recommendation-v1",
    workspaceWriteAllowed: false
  };
}

function classifyWarning(warning: string): Omit<PackageRiskSignal, "evidence"> {
  const normalized = warning.toLowerCase();
  if (/agent-targeted|prompt injection/.test(normalized)) return baseRisk("metadata.agent_instruction", "metadata", "high", "avoid");
  if (/credential|secret|environment requirement|wallet|ssh|\.env/.test(normalized)) return baseRisk("credential.scope", "credential", "high", "avoid");
  if (/vulnerab|malicious|insecure|yanked/.test(normalized)) return baseRisk("known.security.warning", "source", "high", "avoid");
  if (/remote download|encoded|inline interpreter|shell pattern|lifecycle|postinstall|source-only|build backend/.test(normalized)) {
    return baseRisk("artifact.execution_surface", "artifact", "high", "avoid");
  }
  if (/trust_remote_code|custom python|dataset script|pickle|binary weight/.test(normalized)) return baseRisk("artifact.model_code", "artifact", "high", "avoid");
  if (/non-https remote|no source repository|pinned public registry snapshot/.test(normalized)) return baseRisk("source.operator_review", "source", "medium", "review");
  if (/prerelease|confused|missing|not returned|unavailable/.test(normalized)) return baseRisk("metadata.incomplete", "metadata", "medium", "review");
  if (/dormancy|versions uploaded|versions published/.test(normalized)) return baseRisk("timeline.release_velocity", "timeline", "medium", "review");
  return baseRisk("source.warning", "source", "low", "review");
}

function artifactFileShape(source: string, text: string): string[] {
  const shape: string[] = [];
  if (/file count|unpacked size|tarball/i.test(text)) shape.push("registry artifact metadata");
  if (/wheel|bdist_wheel/i.test(text)) shape.push("wheel");
  if (/sdist|source-only/i.test(text)) shape.push("source distribution");
  if (/safetensors/i.test(text)) shape.push("safetensors");
  if (/pickle|binary weight|\.(?:bin|pkl|pt)/i.test(text)) shape.push("pickle/binary weights");
  if (/dataset data files|parquet|csv|jsonl|arrow/i.test(text)) shape.push("dataset files");
  if (/workflow files|Dockerfile|lockfiles|package manifests/i.test(text)) shape.push("repository automation/manifests");
  if (/Remote MCP endpoints|environment requirements/i.test(text)) shape.push("remote tool endpoints");
  if (shape.length === 0) shape.push(source === "github" ? "repository metadata" : "source metadata");
  return [...new Set(shape)].slice(0, 8);
}

function executableSurfaceFromSignals(source: string, text: string, commandRisk: InstallCommandRisk): PackageArtifactIntelligence["executableSurface"] {
  if (commandRisk !== "low" || /lifecycle scripts|postinstall|install-time lifecycle/i.test(text)) return "install-script";
  if (/source-only|build backend/i.test(text)) return "build-backend";
  if (/trust_remote_code|custom Python model/i.test(text)) return "remote-code";
  if (/dataset Python script/i.test(text)) return "dataset-script";
  if (/workflow\/Dockerfile risk|risky automation|Dockerfile/i.test(text)) return "repo-automation";
  if (source === "mcp" || /Remote MCP endpoints|environment requirements/i.test(text)) return "mcp-tooling";
  return "none-returned";
}

function recommendationSummary(action: AgentPackageAction, input: PackageScannerIntelligenceInput): string {
  if (action === "avoid") {
    return `${input.displayName} has high-risk source, metadata or install evidence. Treat it as blocked until reviewed.`;
  }
  if (action === "review") {
    return `${input.displayName} is usable only after manual review of source evidence and install boundaries.`;
  }
  return `${input.displayName} has enough public evidence to consider, but still requires an install plan and approval.`;
}

function addTimelineEvent(
  events: PackageTrustTimeline["events"],
  text: string,
  pattern: RegExp,
  type: PackageTrustTimeline["events"][number]["type"],
  label: string
): void {
  const match = pattern.exec(text);
  if (!match?.[1]) return;
  const evidence = match[1].trim();
  events.push({ at: isoLike(evidence) ? evidence : null, evidence, label, type });
}

function timelineRiskFlags(text: string): string[] {
  const flags: string[] = [];
  const publishAge = /latest publish age hours:\s*(\d+)/i.exec(text)?.[1];
  const recentVersions = /versions (?:uploaded|published) in the last 30 days:\s*(\d+)/i.exec(text)?.[1];
  const dormancyDays = /dormancy before latest release days:\s*(\d+)/i.exec(text)?.[1];
  if (publishAge && Number(publishAge) <= 24) flags.push("timeline.latest_release_under_24h");
  if (recentVersions && Number(recentVersions) >= 8) flags.push("timeline.high_release_velocity_30d");
  if (dormancyDays && Number(dormancyDays) >= 365) flags.push("timeline.long_dormancy_before_latest");
  return flags;
}

function risk(
  code: string,
  category: PackageRiskCategory,
  severity: PackageRiskSeverity,
  action: AgentPackageAction,
  evidence: string
): PackageRiskSignal {
  return { action, category, code, evidence, severity };
}

function baseRisk(
  code: string,
  category: PackageRiskCategory,
  severity: PackageRiskSeverity,
  action: AgentPackageAction
): Omit<PackageRiskSignal, "evidence"> {
  return { action, category, code, severity };
}

function criticalEvidenceId(id: string): boolean {
  return /metadata\.agent_instructions|npm\.lifecycle|pypi\.yanked|hf\.remote_code|hf\.file_shape|hf\.script_files|mcp\.endpoint_security|mcp\.credential_scope/.test(id);
}

function coreEvidenceId(id: string): boolean {
  return /npm\.manifest\.latest|npm\.tarball\.integrity|pypi\.project\.json|pypi\.file\.digests|github\.content_risk|hf\.files|hf\.commit|mcp\.remote_endpoints/.test(id);
}

function dedupeRiskSignals(signals: PackageRiskSignal[]): PackageRiskSignal[] {
  const seen = new Set<string>();
  return signals.filter((signal) => {
    const key = `${signal.code}:${signal.evidence}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeNodes(nodes: PackageSourceGraph["nodes"]): PackageSourceGraph["nodes"] {
  const seen = new Set<string>();
  return nodes.filter((node) => {
    if (seen.has(node.id)) return false;
    seen.add(node.id);
    return true;
  });
}

function dedupeEdges(edges: PackageSourceGraph["edges"]): PackageSourceGraph["edges"] {
  const seen = new Set<string>();
  return edges.filter((edge) => {
    const key = `${edge.from}:${edge.to}:${edge.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeTimelineEvents(events: PackageTrustTimeline["events"]): PackageTrustTimeline["events"] {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${event.type}:${event.at}:${event.evidence}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hostLabel(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "unknown-host";
  }
}

function shortUrlLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`.replace(/\/$/, "");
  } catch {
    return url;
  }
}

function isoLike(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(value);
}
