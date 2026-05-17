import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as z from "zod";
import { type Identity, publicKeyPemFromDidKey, signBytes, verifyBytes } from "./identity.js";
import { validateManifest, type Manifest } from "./protocol.js";
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

export type PackageClaimVerificationStatus = "verified" | "missing" | "invalid" | "mismatch";

export interface PackageClaimVerification {
  claimed: boolean;
  ownerDid: string;
  package: string;
  proof?: PackageClaimProof;
  proofPath: ".nipmod/package-claim.json";
  reasons: string[];
  repo: string;
  repoName: string;
  status: PackageClaimVerificationStatus;
}

export interface PackageClaimIndexCandidate {
  ownerDid: string;
  package: string;
  readinessScore: number;
  reasons: string[];
  repo: string;
  repoName: string;
  status: PackageClaimVerificationStatus;
}

export interface PackageClaimIndex {
  candidates: PackageClaimIndexCandidate[];
  formatVersion: 1;
  generatedAt: string;
  invalidClaims: PackageClaimVerification[];
  nodeUrl: string;
  policy: typeof PACKAGE_CLAIM_AUTOMATION_POLICY;
  total: number;
  verifiedClaims: PackageClaimVerification[];
}

export interface AssistedPackagePatch {
  files: Array<{ content: string; path: string }>;
  nextCommands: string[];
  package: string;
  remoteWrites: false;
  repo: string;
}

export const PACKAGE_CLAIM_PROOF_PATH = ".nipmod/package-claim.json" as const;
export const PACKAGE_CLAIM_AUTOMATION_POLICY = {
  autoOpenRemoteIssues: false,
  autoOpenRemotePullRequests: false,
  maxScanLimit: 100,
  maxVerifyConcurrency: 1,
  remoteWritesRequireHumanAction: true
} as const;

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

const PackageClaimProofSchema = z.strictObject({
  createdAt: z.string().datetime(),
  ownerDid: z.string().regex(/^did:key:z[A-Za-z0-9]+$/),
  package: z.string().regex(/^pkg:did:key:z[A-Za-z0-9]+\/[a-z0-9][a-z0-9._-]*$/),
  repo: z.string().regex(/^gitlawb:\/\/did:key:z[A-Za-z0-9]+\/[a-z0-9][a-z0-9._-]*$/),
  repoName: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/),
  signature: z.strictObject({
    algorithm: z.literal("Ed25519"),
    keyId: z.string().regex(/^did:key:z[A-Za-z0-9]+$/),
    signatureBase64: z.string().min(1)
  }),
  type: z.literal("dev.nipmod.package-claim.v1")
});

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
    .slice(0, Math.min(options.limit ?? PACKAGE_CLAIM_AUTOMATION_POLICY.maxScanLimit, PACKAGE_CLAIM_AUTOMATION_POLICY.maxScanLimit));

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

export async function fetchGitlawbPackageClaimVerification(options: {
  fetchImpl?: typeof fetch;
  nodeUrl: string;
  ownerDid: string;
  repoName: string;
}): Promise<PackageClaimVerification> {
  const nodeUrl = normalizeNodeUrl(options.nodeUrl);
  const ownerSegment = ownerSegmentFromDid(options.ownerDid);
  const repo = `gitlawb://${options.ownerDid}/${options.repoName}`;
  const packageId = `pkg:${options.ownerDid}/${options.repoName}`;
  const proofText = await fetchGitlawbTextFile(
    options.fetchImpl ?? fetch,
    nodeUrl,
    ownerSegment,
    options.repoName,
    PACKAGE_CLAIM_PROOF_PATH
  );
  if (!proofText) {
    return {
      claimed: false,
      ownerDid: options.ownerDid,
      package: packageId,
      proofPath: PACKAGE_CLAIM_PROOF_PATH,
      reasons: ["claim proof missing"],
      repo,
      repoName: options.repoName,
      status: "missing"
    };
  }

  try {
    return verifyPackageClaimProofForRepo(JSON.parse(proofText) as unknown, {
      ownerDid: options.ownerDid,
      repoName: options.repoName
    });
  } catch (error) {
    return {
      claimed: false,
      ownerDid: options.ownerDid,
      package: packageId,
      proofPath: PACKAGE_CLAIM_PROOF_PATH,
      reasons: [error instanceof Error ? error.message : "claim proof is invalid JSON"],
      repo,
      repoName: options.repoName,
      status: "invalid"
    };
  }
}

export async function buildPackageClaimIndex(options: {
  fetchImpl?: typeof fetch;
  generatedAt?: string;
  limit?: number;
  nodeUrl: string;
}): Promise<PackageClaimIndex> {
  const nodeUrl = normalizeNodeUrl(options.nodeUrl);
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${nodeUrl}/api/v1/repos`);
  if (!response.ok) {
    throw new Error(`Gitlawb repo scan failed: HTTP ${response.status}`);
  }
  const repos = GitlawbRepoListSchema.parse(await response.json())
    .filter((repo) => repo.is_public)
    .slice(0, Math.min(options.limit ?? PACKAGE_CLAIM_AUTOMATION_POLICY.maxScanLimit, PACKAGE_CLAIM_AUTOMATION_POLICY.maxScanLimit));
  const candidates: PackageClaimIndexCandidate[] = [];
  const verifiedClaims: PackageClaimVerification[] = [];
  const invalidClaims: PackageClaimVerification[] = [];

  for (const repo of repos) {
    const input = repoInputFromApi(repo);
    const report = analyzePackageCandidate({
      readme: repo.description,
      repo: input
    });
    const verification = await fetchGitlawbPackageClaimVerification({
      fetchImpl,
      nodeUrl,
      ownerDid: input.ownerDid,
      repoName: input.name
    });
    candidates.push({
      ownerDid: input.ownerDid,
      package: verification.package,
      readinessScore: verification.claimed ? 100 : report.readinessScore,
      reasons: verification.reasons,
      repo: verification.repo,
      repoName: verification.repoName,
      status: verification.status
    });
    if (verification.status === "verified") {
      verifiedClaims.push(verification);
    } else if (verification.status === "invalid" || verification.status === "mismatch") {
      invalidClaims.push(verification);
    }
  }

  return {
    candidates,
    formatVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    invalidClaims,
    nodeUrl,
    policy: PACKAGE_CLAIM_AUTOMATION_POLICY,
    total: candidates.length,
    verifiedClaims
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

export function verifyPackageClaimProof(proof: PackageClaimProof | unknown): boolean {
  try {
    const parsed = PackageClaimProofSchema.parse(proof);
    if (parsed.signature.keyId !== parsed.ownerDid) {
      return false;
    }
    const { signature, ...unsigned } = parsed;
    const signatureBase = canonicalJson(unsigned);
    return verifyBytes(
      publicKeyPemFromDidKey(parsed.ownerDid),
      Buffer.from(signatureBase),
      Buffer.from(signature.signatureBase64, "base64")
    );
  } catch {
    return false;
  }
}

export function verifyPackageClaimProofForRepo(
  proof: PackageClaimProof | unknown,
  expected: { ownerDid: string; repoName: string }
): PackageClaimVerification {
  const expectedRepo = `gitlawb://${expected.ownerDid}/${expected.repoName}`;
  const expectedPackage = `pkg:${expected.ownerDid}/${expected.repoName}`;
  let parsed: PackageClaimProof;
  try {
    parsed = PackageClaimProofSchema.parse(proof);
  } catch (error) {
    return {
      claimed: false,
      ownerDid: expected.ownerDid,
      package: expectedPackage,
      proofPath: PACKAGE_CLAIM_PROOF_PATH,
      reasons: [error instanceof Error ? error.message : "claim proof schema invalid"],
      repo: expectedRepo,
      repoName: expected.repoName,
      status: "invalid"
    };
  }

  if (!verifyPackageClaimProof(parsed)) {
    return {
      claimed: false,
      ownerDid: expected.ownerDid,
      package: expectedPackage,
      proof: parsed,
      proofPath: PACKAGE_CLAIM_PROOF_PATH,
      reasons: ["signature invalid"],
      repo: expectedRepo,
      repoName: expected.repoName,
      status: "invalid"
    };
  }

  const reasons: string[] = [];
  if (parsed.ownerDid !== expected.ownerDid) reasons.push("ownerDid mismatch");
  if (parsed.repoName !== expected.repoName) reasons.push("repoName mismatch");
  if (parsed.package !== expectedPackage) reasons.push("package mismatch");
  if (parsed.repo !== expectedRepo) reasons.push("repo mismatch");
  if (reasons.length > 0) {
    return {
      claimed: false,
      ownerDid: expected.ownerDid,
      package: expectedPackage,
      proof: parsed,
      proofPath: PACKAGE_CLAIM_PROOF_PATH,
      reasons,
      repo: expectedRepo,
      repoName: expected.repoName,
      status: "mismatch"
    };
  }

  return {
    claimed: true,
    ownerDid: expected.ownerDid,
    package: expectedPackage,
    proof: parsed,
    proofPath: PACKAGE_CLAIM_PROOF_PATH,
    reasons: [],
    repo: expectedRepo,
    repoName: expected.repoName,
    status: "verified"
  };
}

export function formatPackageClaimVerification(verification: PackageClaimVerification): string {
  const lines = [
    `claim ${verification.status}`,
    `repo: ${verification.repo}`,
    `package: ${verification.package}`,
    `proof: ${verification.proofPath}`
  ];
  for (const reason of verification.reasons) {
    lines.push(`reason: ${reason}`);
  }
  return lines.join("\n");
}

export function createAssistedPackagePatch(options: {
  proof?: PackageClaimProof;
  repo: GitlawbRepoCandidateInput;
  type?: Manifest["type"];
  version?: string;
}): AssistedPackagePatch {
  const source = `gitlawb://${options.repo.ownerDid}/${options.repo.name}`;
  const canonical = `pkg:${options.repo.ownerDid}/${options.repo.name}`;
  const manifest = validateManifest({
    formatVersion: 1,
    name: options.repo.name,
    canonical,
    version: options.version ?? "0.1.0",
    type: options.type ?? "tool-bundle",
    description: options.repo.description || `${options.repo.name} package from Gitlawb source`,
    license: "NOASSERTION",
    exports: {
      ".": {
        source: "./README.nipmod.md"
      }
    },
    files: ["README.nipmod.md", "nipmod.json"],
    permissions: {
      filesystem: [],
      network: [],
      mcpTools: [],
      env: [],
      secrets: [],
      exec: {
        allowed: false
      },
      postinstall: {
        allowed: false
      }
    },
    publish: {
      signingKey: options.repo.ownerDid,
      provenance: source
    }
  });
  const files: AssistedPackagePatch["files"] = [
    {
      content: `${JSON.stringify(manifest, null, 2)}\n`,
      path: "nipmod.json"
    },
    {
      content: [
        `# ${options.repo.name}`,
        "",
        "Install this Gitlawb repo as a Nipmod package for agents.",
        "",
        "```sh",
        `nipmod add ${canonical}`,
        "```",
        "",
        `Source: ${source}`,
        ""
      ].join("\n"),
      path: "README.nipmod.md"
    }
  ];
  if (options.proof) {
    files.push({
      content: `${JSON.stringify(options.proof, null, 2)}\n`,
      path: PACKAGE_CLAIM_PROOF_PATH
    });
  }
  return {
    files,
    nextCommands: [
      `git add ${files.map((file) => file.path).join(" ")}`,
      'git commit -m "feat: add nipmod package manifest"',
      "GITLAWB_NODE=https://node.nipmod.com git push"
    ],
    package: canonical,
    remoteWrites: false,
    repo: source
  };
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
