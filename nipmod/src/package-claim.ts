import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as z from "zod";
import { type Identity, publicKeyPemFromDidKey, signBytes, verifyBytes } from "./identity.js";
import { validateManifest } from "./protocol.js";
import { canonicalJson } from "./verifier.js";

export type PackageCandidateStatus = "ready" | "almost" | "needs-work";
export type PackageCandidateSeverity = "missing" | "warn";

export interface GitlawbRepoCandidateInput {
  cloneUrl: string;
  defaultBranch: string;
  description: string;
  isPublic: boolean;
  name: string;
  ownerDid: string;
  updatedAt: string;
}

export interface PackageCandidateSignal {
  id: string;
  label: string;
  points: number;
}

export interface PackageCandidateMissingItem {
  id: string;
  label: string;
  severity: PackageCandidateSeverity;
}

export interface PackageCandidateReport {
  commands: {
    claim: string;
    doctor: string;
    draft: string;
  };
  missing: PackageCandidateMissingItem[];
  package: string;
  readinessScore: number;
  repo: GitlawbRepoCandidateInput;
  signals: PackageCandidateSignal[];
  source: string;
  status: PackageCandidateStatus;
  suggestedType: string;
}

export interface FetchGitlawbPackageCandidatesResult {
  candidates: PackageCandidateReport[];
  nodeUrl: string;
  total: number;
}

export interface PackageClaimProof {
  createdAt: string;
  ownerDid: string;
  package: string;
  repo: string;
  repoName: string;
  signature: {
    algorithm: "Ed25519";
    keyId: string;
    signatureBase64: string;
  };
  type: "dev.nipmod.package-claim.v1";
}

const TEXT_FILE_LIMIT = 256 * 1024;

const GitlawbRepoSchema = z.strictObject({
  clone_url: z.string().url(),
  default_branch: z.string().min(1).default("main"),
  description: z.string().default(""),
  is_public: z.boolean().default(true),
  name: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/),
  owner_did: z.string().regex(/^did:key:z[A-Za-z0-9]+$/),
  updated_at: z.string().min(1)
}).passthrough();

const GitlawbRepoListSchema = z.array(GitlawbRepoSchema);

export async function fetchGitlawbPackageCandidates(options: {
  fetchImpl?: typeof fetch;
  limit?: number;
  nodeUrl: string;
}): Promise<FetchGitlawbPackageCandidatesResult> {
  const nodeUrl = normalizeNodeUrl(options.nodeUrl);
  const response = await (options.fetchImpl ?? fetch)(`${nodeUrl}/api/v1/repos`);
  if (!response.ok) {
    throw new Error(`Gitlawb repo scan failed: HTTP ${response.status}`);
  }
  const repos = GitlawbRepoListSchema.parse(await response.json())
    .filter((repo) => repo.is_public)
    .slice(0, options.limit ?? 100);

  const candidates = repos.map((repo) =>
    analyzePackageCandidate({
      readme: repo.description,
      repo: repoInputFromApi(repo)
    })
  );

  return {
    candidates,
    nodeUrl,
    total: candidates.length
  };
}

export async function fetchGitlawbPackageCandidate(options: {
  fetchImpl?: typeof fetch;
  nodeUrl: string;
  ownerDid: string;
  repoName: string;
}): Promise<PackageCandidateReport> {
  const nodeUrl = normalizeNodeUrl(options.nodeUrl);
  const ownerSegment = ownerSegmentFromDid(options.ownerDid);
  const repoPath = `/api/v1/repos/${encodeURIComponent(ownerSegment)}/${encodeURIComponent(options.repoName)}`;
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${nodeUrl}${repoPath}`);
  if (!response.ok) {
    throw new Error(`Gitlawb repo fetch failed: HTTP ${response.status}`);
  }
  const repo = repoInputFromApi(GitlawbRepoSchema.parse(await response.json()));
  const [readme, manifest, skill, license] = await Promise.all([
    fetchGitlawbTextFile(fetchImpl, nodeUrl, ownerSegment, options.repoName, "README.md"),
    fetchGitlawbTextFile(fetchImpl, nodeUrl, ownerSegment, options.repoName, "nipmod.json"),
    fetchGitlawbTextFile(fetchImpl, nodeUrl, ownerSegment, options.repoName, "SKILL.md"),
    fetchGitlawbTextFile(fetchImpl, nodeUrl, ownerSegment, options.repoName, "LICENSE")
  ]);
  return analyzePackageCandidate({ license, manifest, readme, repo, skill });
}

export async function analyzeLocalPackageCandidate(options: {
  dir: string;
  repo: GitlawbRepoCandidateInput;
}): Promise<PackageCandidateReport> {
  const [readme, manifest, skill, license] = await Promise.all([
    readOptionalText(join(options.dir, "README.md")),
    readOptionalText(join(options.dir, "nipmod.json")),
    readOptionalText(join(options.dir, "SKILL.md")),
    readOptionalText(join(options.dir, "LICENSE"))
  ]);

  return analyzePackageCandidate({
    license,
    manifest,
    readme,
    repo: options.repo,
    skill
  });
}

export function analyzePackageCandidate(options: {
  license?: string | null;
  manifest?: string | null;
  readme?: string | null;
  repo: GitlawbRepoCandidateInput;
  skill?: string | null;
}): PackageCandidateReport {
  const source = `gitlawb://${options.repo.ownerDid}/${options.repo.name}`;
  const packageId = `pkg:${options.repo.ownerDid}/${options.repo.name}`;
  const signals: PackageCandidateSignal[] = [];
  const missing: PackageCandidateMissingItem[] = [];
  const corpus = [options.repo.name, options.repo.description, options.readme ?? "", options.skill ?? ""]
    .join("\n")
    .toLowerCase();
  const hasReadme = Boolean(options.readme?.trim());
  const manifestResult = parseCandidateManifest(options.manifest);
  const suggestedType = manifestResult.type ?? suggestPackageType(corpus);

  addSignal(signals, options.repo.isPublic, "public-repo", "Public Gitlawb repo", 10);
  addSignal(signals, Boolean(options.repo.description.trim()), "description", "Repo description", 8);
  addSignal(signals, hasReadme, "readme", "README or agent docs", 18);
  addSignal(signals, hasAgentSignals(corpus), "agent-signals", "Agent or package signals", 14);
  addSignal(signals, manifestResult.valid, "manifest", "Valid nipmod.json", 25);
  addSignal(signals, manifestResult.hasPermissions, "permissions", "Explicit permissions", 10);
  addSignal(signals, hasUsageExample(options.readme ?? ""), "examples", "Install or usage example", 10);
  addSignal(signals, Boolean(options.license?.trim() || manifestResult.hasLicense), "license", "License metadata", 5);

  if (!hasReadme) {
    missing.push({ id: "readme", label: "Add README.md with agent-facing usage", severity: "missing" });
  }
  if (!manifestResult.valid) {
    missing.push({ id: "manifest", label: "Add nipmod.json package manifest", severity: "missing" });
  }
  if (!manifestResult.hasPermissions) {
    missing.push({ id: "permissions", label: "Declare package permissions explicitly", severity: "missing" });
  }
  if (!hasUsageExample(options.readme ?? "")) {
    missing.push({ id: "examples", label: "Add install or usage example", severity: "warn" });
  }
  if (!options.license?.trim() && !manifestResult.hasLicense) {
    missing.push({ id: "license", label: "Add license metadata", severity: "warn" });
  }

  const readinessScore = Math.min(100, signals.reduce((total, signal) => total + signal.points, 0));
  const status: PackageCandidateStatus =
    readinessScore >= 90 && missing.every((item) => item.severity !== "missing")
      ? "ready"
      : readinessScore >= 50
        ? "almost"
        : "needs-work";

  return {
    commands: {
      claim: `nipmod claim ${source}`,
      doctor: `nipmod package doctor ${source}`,
      draft: `nipmod package ${source} --dir ${options.repo.name}`
    },
    missing,
    package: packageId,
    readinessScore,
    repo: options.repo,
    signals,
    source,
    status,
    suggestedType
  };
}

export function formatPackageCandidateReport(report: PackageCandidateReport): string {
  const lines = [
    `${report.repo.name}`,
    `source: ${report.source}`,
    `package: ${report.package}`,
    `status: ${report.status}`,
    `readiness: ${report.readinessScore}/100`,
    `suggested type: ${report.suggestedType}`,
    "",
    "signals:"
  ];
  for (const signal of report.signals) {
    lines.push(`ok: ${signal.label} +${signal.points}`);
  }
  if (report.missing.length > 0) {
    lines.push("", "missing:");
    for (const item of report.missing) {
      lines.push(`missing: ${item.label}${item.severity === "warn" ? " (warn)" : ""}`);
    }
  }
  lines.push("", "commands:", report.commands.doctor, report.commands.draft, report.commands.claim);
  return lines.join("\n");
}

export function createPackageClaimProof(options: {
  createdAt?: string;
  identity: Identity;
  ownerDid?: string;
  repoName: string;
}): PackageClaimProof {
  const ownerDid = options.ownerDid ?? options.identity.did;
  if (ownerDid !== options.identity.did) {
    throw new Error("claim identity must match Gitlawb repo owner");
  }
  assertRepoName(options.repoName);
  const unsigned = {
    createdAt: options.createdAt ?? new Date().toISOString(),
    ownerDid,
    package: `pkg:${ownerDid}/${options.repoName}`,
    repo: `gitlawb://${ownerDid}/${options.repoName}`,
    repoName: options.repoName,
    type: "dev.nipmod.package-claim.v1" as const
  };
  const signatureBase = canonicalJson(unsigned);
  const signature = signBytes(options.identity.privateKeyPem, Buffer.from(signatureBase));
  return {
    ...unsigned,
    signature: {
      algorithm: "Ed25519",
      keyId: ownerDid,
      signatureBase64: signature.toString("base64")
    }
  };
}

export function verifyPackageClaimProof(proof: PackageClaimProof): boolean {
  try {
    if (proof.type !== "dev.nipmod.package-claim.v1" || proof.signature.keyId !== proof.ownerDid) {
      return false;
    }
    const { signature, ...unsigned } = proof;
    const signatureBase = canonicalJson(unsigned);
    return verifyBytes(
      publicKeyPemFromDidKey(proof.ownerDid),
      Buffer.from(signatureBase),
      Buffer.from(signature.signatureBase64, "base64")
    );
  } catch {
    return false;
  }
}

export async function writePackageClaimProof(options: {
  dir: string;
  proof: PackageClaimProof;
}): Promise<string> {
  const claimDir = join(options.dir, ".nipmod");
  await mkdir(claimDir, { recursive: true });
  const proofPath = join(claimDir, "package-claim.json");
  await writeFile(proofPath, `${JSON.stringify(options.proof, null, 2)}\n`, { mode: 0o600 });
  return proofPath;
}

async function fetchGitlawbTextFile(
  fetchImpl: typeof fetch,
  nodeUrl: string,
  ownerSegment: string,
  repoName: string,
  filePath: string
): Promise<string | null> {
  const path = `/api/v1/repos/${encodeURIComponent(ownerSegment)}/${encodeURIComponent(repoName)}/blob/${filePath}`;
  const response = await fetchImpl(`${nodeUrl}${path}`);
  if (!response.ok) {
    return null;
  }
  return (await response.text()).slice(0, TEXT_FILE_LIMIT);
}

function repoInputFromApi(repo: z.infer<typeof GitlawbRepoSchema>): GitlawbRepoCandidateInput {
  return {
    cloneUrl: repo.clone_url,
    defaultBranch: repo.default_branch,
    description: repo.description,
    isPublic: repo.is_public,
    name: repo.name,
    ownerDid: repo.owner_did,
    updatedAt: repo.updated_at
  };
}

function ownerSegmentFromDid(ownerDid: string): string {
  if (!/^did:key:z[A-Za-z0-9]+$/.test(ownerDid)) {
    throw new Error("Gitlawb owner must be a did:key");
  }
  return ownerDid.slice("did:key:".length);
}

async function readOptionalText(path: string): Promise<string | null> {
  try {
    const content = await readFile(path, "utf8");
    return content.slice(0, TEXT_FILE_LIMIT);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function parseCandidateManifest(rawManifest: string | null | undefined): {
  hasLicense: boolean;
  hasPermissions: boolean;
  type?: string;
  valid: boolean;
} {
  if (!rawManifest?.trim()) {
    return { hasLicense: false, hasPermissions: false, valid: false };
  }
  try {
    const manifest = validateManifest(JSON.parse(rawManifest));
    return {
      hasLicense: Boolean(manifest.license),
      hasPermissions: Boolean(manifest.permissions),
      type: manifest.type,
      valid: true
    };
  } catch {
    return { hasLicense: false, hasPermissions: false, valid: false };
  }
}

function suggestPackageType(corpus: string): string {
  if (/mcp-server|mcp server|\bmcp\b.*\bserver\b|\bserver\b.*\bmcp\b/.test(corpus)) {
    return "mcp-server";
  }
  if (/\bpolicy\b|ruleset|guardrail/.test(corpus)) {
    return "policy-pack";
  }
  if (/\beval\b|benchmark|test fixture/.test(corpus)) {
    return "eval-pack";
  }
  if (/\bagent\b|assistant|persona/.test(corpus)) {
    return "agent-profile";
  }
  if (/\bworkflow\b|playbook|runbook/.test(corpus)) {
    return "workflow-pack";
  }
  if (/\bskill\b/.test(corpus)) {
    return "skill";
  }
  return "tool-bundle";
}

function hasAgentSignals(corpus: string): boolean {
  return /\bagent\b|\bskill\b|\bmcp\b|\btool\b|\bworkflow\b|\bpolicy\b|\beval\b|\bpackage\b|gitlawb|nipmod/.test(corpus);
}

function hasUsageExample(readme: string): boolean {
  return /\binstall\b|\busage\b|\bexample\b|nipmod\s+(add|install|package|claim)|```/.test(readme.toLowerCase());
}

function addSignal(
  signals: PackageCandidateSignal[],
  condition: boolean,
  id: string,
  label: string,
  points: number
): void {
  if (condition) {
    signals.push({ id, label, points });
  }
}

function normalizeNodeUrl(nodeUrl: string): string {
  const url = new URL(nodeUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Gitlawb node URL must be http or https");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function assertRepoName(repoName: string): void {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(repoName)) {
    throw new Error("Gitlawb repo names currently allow only lowercase letters, numbers, dots, hyphens, and underscores");
  }
}
