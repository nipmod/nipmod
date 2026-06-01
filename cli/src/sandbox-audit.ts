import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import {
  DEFAULT_DEEP_SCAN_LIMITS,
  deepScanProject,
  formatDeepScanReport,
  type DeepScanOptions,
  type DeepScanReport,
  type DeepScanRiskInventory
} from "./deep-scan.js";

export type SandboxAuditVerdict = "blocked" | "pass" | "review";
export type SandboxAuditExecutionGateStatus = "blocked" | "passed" | "review-required";

export interface SandboxAuditExecutionGate {
  blockedActions: string[];
  hostOnly: true;
  reason: string;
  requiredBeforeExecution: string[];
  requiresExplicitRuntimeConfirmation: true;
  runtimeCommand: "nipmod sandbox-runtime <artifact-or-source-path> --confirm-runtime -- <command>";
  status: SandboxAuditExecutionGateStatus;
  type: "dev.nipmod.sandbox-execution-gate.v1";
}

export interface SandboxAuditProvenanceBinding {
  auditReceiptSha256: string;
  cacheKey: string;
  contentSha256: string;
  hashAlgorithm: "sha256";
  keyMaterial: string[];
  localArtifactOnly: true;
  policySha256: string;
  runOncePerHash: true;
  type: "dev.nipmod.sandbox-provenance-binding.v1";
}

export interface SandboxAuditAnalysis {
  approvalBoundary: "explicit-host-approval-required";
  inspectedCapabilities: DeepScanRiskInventory;
  receiptIncludesRiskInventory: true;
  type: "dev.nipmod.sandbox-audit-analysis.v1";
}

export interface SandboxAuditReport {
  analysis: SandboxAuditAnalysis;
  cache: {
    cacheKey: string;
    cachePath: string;
    contentSha256: string;
    hashAlgorithm: "sha256";
    hit: boolean;
    keyScope: "artifact-content-plus-policy";
    policySha256: string;
    reusedAt: string | null;
    runOncePerHash: true;
  };
  executionGate: SandboxAuditExecutionGate;
  formatVersion: 1;
  generatedAt: string;
  limitations: string[];
  provenanceBinding: SandboxAuditProvenanceBinding;
  recommendation: string;
  sandbox: {
    executesCode: false;
    filesystem: "isolated-read-only-analysis";
    installsPackages: false;
    mode: "local-sandbox-audit";
    network: "disabled-by-policy";
    unpacksArtifactsToWorkspace: false;
    workspaceWrites: false;
  };
  policy: SandboxAuditPolicyBinding;
  scan: DeepScanReport;
  subject: {
    contentSha256: string;
    fileCount: number;
    inputPath: string;
    kind: "directory" | "file";
    rootName: string;
    totalBytes: number;
  };
  type: "dev.nipmod.sandbox-audit.v1";
  verdict: SandboxAuditVerdict;
}

export interface SandboxAuditPolicyBinding {
  hashAlgorithm: "sha256";
  keyMaterial: string[];
  policySha256: string;
  type: "dev.nipmod.sandbox-audit-policy-binding.v1";
  version: "local-static-no-exec-v3";
}

export interface SandboxAuditOptions extends DeepScanOptions {
  cacheDir?: string;
  force?: boolean;
}

interface ContentHashSubject {
  contentSha256: string;
  fileCount: number;
  inputPath: string;
  kind: "directory" | "file";
  rootName: string;
  totalBytes: number;
}

const DEFAULT_CACHE_DIR = join(".nipmod", "cache", "sandbox-audit");
const HASH_SKIPPED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".nipmod",
  ".nuxt",
  ".pnpm",
  ".turbo",
  ".venv",
  ".vercel",
  "__pycache__",
  "build",
  "coverage",
  "node_modules",
  "out",
  "target",
  "vendor",
  "venv"
]);

export async function runSandboxAudit(options: SandboxAuditOptions): Promise<SandboxAuditReport> {
  const cacheDir = resolve(options.cacheDir ?? DEFAULT_CACHE_DIR);
  const subject = await hashSandboxSubject(options.path, cacheDir);
  const policy = sandboxAuditPolicyBinding(options);
  const cacheKey = sandboxAuditCacheKey(subject.contentSha256, policy.policySha256);
  const cachePath = join(cacheDir, `${cacheKey}.json`);

  if (!options.force) {
    const cached = await readCachedSandboxAudit(cachePath, subject, policy, cacheKey);
    if (cached) {
      const scan = remapCachedScanTarget(cached.scan, cached.subject.rootName, subject);
      return {
        ...cached,
        cache: {
          ...cached.cache,
          cacheKey,
          cachePath,
          contentSha256: subject.contentSha256,
          hit: true,
          keyScope: "artifact-content-plus-policy",
          policySha256: policy.policySha256,
          reusedAt: new Date().toISOString()
        },
        executionGate: sandboxAuditExecutionGate(cached.verdict),
        analysis: sandboxAuditAnalysis(scan),
        policy,
        provenanceBinding: sandboxAuditProvenanceBinding({ cacheKey, policy, scan, subject, verdict: cached.verdict }),
        scan,
        subject
      };
    }
  }

  const scan = await deepScanProject(options);
  const verdict = sandboxAuditVerdict(scan);
  const generatedAt = new Date().toISOString();
  const executionGate = sandboxAuditExecutionGate(verdict);
  const analysis = sandboxAuditAnalysis(scan);
  const provenanceBinding = sandboxAuditProvenanceBinding({ cacheKey, policy, scan, subject, verdict });
  const report: SandboxAuditReport = {
    analysis,
    cache: {
      cacheKey,
      cachePath,
      contentSha256: subject.contentSha256,
      hashAlgorithm: "sha256",
      hit: false,
      keyScope: "artifact-content-plus-policy",
      policySha256: policy.policySha256,
      reusedAt: null,
      runOncePerHash: true
    },
    executionGate,
    formatVersion: 1,
    generatedAt,
    limitations: [
      "This is a local sandbox audit wrapper around bounded static deep-scan.",
      "It does not install dependencies, run package code, clone repositories, download remote artifacts or grant network access.",
      "The result is cached by a SHA-256 hash of the scanned file or directory content tree plus the local audit policy.",
      "If the package bytes, bundle, source tree, scan limits or sandbox policy changes, the cache key changes and the audit must be rerun.",
      "Runtime behavior still needs a stricter sandbox when the host plans to execute package code."
    ],
    recommendation: sandboxAuditRecommendation(verdict),
    sandbox: {
      executesCode: false,
      filesystem: "isolated-read-only-analysis",
      installsPackages: false,
      mode: "local-sandbox-audit",
      network: "disabled-by-policy",
      unpacksArtifactsToWorkspace: false,
      workspaceWrites: false
    },
    policy,
    provenanceBinding,
    scan,
    subject,
    type: "dev.nipmod.sandbox-audit.v1",
    verdict
  };

  await mkdir(cacheDir, { recursive: true });
  await writeFile(cachePath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export function formatSandboxAuditReport(report: SandboxAuditReport): string {
  return [
    `nipmod sandbox-audit ${report.verdict} ${report.subject.inputPath}`,
    `cache: ${report.cache.hit ? "hit" : "miss"} sha256:${report.cache.cacheKey}`,
    `content: sha256:${report.subject.contentSha256}`,
    `policy: sha256:${report.policy.policySha256}`,
    `receipt: sha256:${report.provenanceBinding.auditReceiptSha256}`,
    `execution gate: ${report.executionGate.status}`,
    `analysis: hooks ${report.analysis.inspectedCapabilities.installHookCount}, network ${report.analysis.inspectedCapabilities.networkAccessCount}, filesystem ${report.analysis.inspectedCapabilities.filesystemWriteCount}, process ${report.analysis.inspectedCapabilities.processExecutionCount}, credentials ${report.analysis.inspectedCapabilities.credentialAccessCount}`,
    `subject: ${report.subject.kind}, ${report.subject.fileCount} file(s), ${report.subject.totalBytes} bytes`,
    "sandbox: local read-only analysis, no execution, no installs, no network, no workspace writes",
    formatDeepScanReport(report.scan)
  ].join("\n");
}

async function readCachedSandboxAudit(
  cachePath: string,
  subject: ContentHashSubject,
  policy: SandboxAuditPolicyBinding,
  cacheKey: string
): Promise<SandboxAuditReport | null> {
  try {
    const parsed = JSON.parse(await readFile(cachePath, "utf8")) as Partial<SandboxAuditReport>;
    if (
      parsed.type === "dev.nipmod.sandbox-audit.v1" &&
      parsed.cache?.cacheKey === cacheKey &&
      parsed.subject?.contentSha256 === subject.contentSha256 &&
      parsed.policy?.policySha256 === policy.policySha256 &&
      parsed.scan
    ) {
      return normalizeSandboxAuditReport(parsed as SandboxAuditReport, policy, cacheKey);
    }
  } catch {
    return null;
  }
  return null;
}

function normalizeSandboxAuditReport(report: SandboxAuditReport, policy: SandboxAuditPolicyBinding, cacheKey: string): SandboxAuditReport {
  const executionGate = report.executionGate ?? sandboxAuditExecutionGate(report.verdict);
  const normalizedPolicy = report.policy ?? policy;
  const provenanceBinding =
    report.provenanceBinding ??
    sandboxAuditProvenanceBinding({
      cacheKey,
      policy: normalizedPolicy,
      scan: report.scan,
      subject: report.subject,
      verdict: report.verdict
    });
  return {
    ...report,
    analysis: report.analysis ?? sandboxAuditAnalysis(report.scan),
    cache: {
      ...report.cache,
      cacheKey,
      contentSha256: report.subject.contentSha256,
      keyScope: "artifact-content-plus-policy",
      policySha256: normalizedPolicy.policySha256
    },
    executionGate,
    policy: normalizedPolicy,
    provenanceBinding
  };
}

function sandboxAuditVerdict(scan: DeepScanReport): SandboxAuditVerdict {
  if (scan.summary.highCount > 0) return "blocked";
  if (scan.summary.mediumCount > 0 || scan.files.skipped.length > 0) return "review";
  return "pass";
}

function sandboxAuditRecommendation(verdict: SandboxAuditVerdict): string {
  if (verdict === "blocked") {
    return "Do not approve execution until high-risk findings are removed or manually accepted by policy.";
  }
  if (verdict === "review") {
    return "Review medium findings or skipped files before approving install, load or execution.";
  }
  return "Static sandbox audit passed; still require explicit host approval before workspace changes or runtime execution.";
}

function sandboxAuditExecutionGate(verdict: SandboxAuditVerdict): SandboxAuditExecutionGate {
  const commonRequired = [
    "Keep the sandbox-audit JSON receipt with the package decision.",
    "Compare subject.contentSha256 with the artifact or source snapshot that will be executed.",
    "Compare policy.policySha256 with the sandbox policy required by the package decision.",
    "Require explicit local host approval before install, load, clone, enable, apply or run."
  ];
  if (verdict === "blocked") {
    return {
      blockedActions: ["install", "load", "clone", "enable", "apply", "run"],
      hostOnly: true,
      reason: "Static sandbox audit found high-risk behavior.",
      requiredBeforeExecution: ["Remove or explicitly accept high-risk findings by local policy.", ...commonRequired],
      requiresExplicitRuntimeConfirmation: true,
      runtimeCommand: "nipmod sandbox-runtime <artifact-or-source-path> --confirm-runtime -- <command>",
      status: "blocked",
      type: "dev.nipmod.sandbox-execution-gate.v1"
    };
  }
  if (verdict === "review") {
    return {
      blockedActions: ["install", "load", "clone", "enable", "apply", "run"],
      hostOnly: true,
      reason: "Static sandbox audit has medium findings or skipped files that need local review.",
      requiredBeforeExecution: ["Review medium findings and skipped files.", ...commonRequired],
      requiresExplicitRuntimeConfirmation: true,
      runtimeCommand: "nipmod sandbox-runtime <artifact-or-source-path> --confirm-runtime -- <command>",
      status: "review-required",
      type: "dev.nipmod.sandbox-execution-gate.v1"
    };
  }
  return {
    blockedActions: [],
    hostOnly: true,
    reason: "Static sandbox audit passed for this exact content hash.",
    requiredBeforeExecution: commonRequired,
    requiresExplicitRuntimeConfirmation: true,
    runtimeCommand: "nipmod sandbox-runtime <artifact-or-source-path> --confirm-runtime -- <command>",
    status: "passed",
    type: "dev.nipmod.sandbox-execution-gate.v1"
  };
}

function sandboxAuditAnalysis(scan: DeepScanReport): SandboxAuditAnalysis {
  return {
    approvalBoundary: "explicit-host-approval-required",
    inspectedCapabilities: scan.riskInventory,
    receiptIncludesRiskInventory: true,
    type: "dev.nipmod.sandbox-audit-analysis.v1"
  };
}

function sandboxAuditProvenanceBinding(input: {
  cacheKey: string;
  policy: SandboxAuditPolicyBinding;
  scan: DeepScanReport;
  subject: ContentHashSubject;
  verdict: SandboxAuditVerdict;
}): SandboxAuditProvenanceBinding {
  const material = {
    findings: input.scan.findings.map((finding) => ({
      category: finding.category,
      evidence: finding.evidence,
      file: finding.file,
      line: finding.line ?? null,
      recommendation: finding.recommendation,
      severity: finding.severity
    })),
    scan: {
      checks: input.scan.checks.map((check) => ({ id: check.id, status: check.status })),
      files: {
        matchedManifests: input.scan.files.matchedManifests,
        scannedArtifacts: input.scan.files.scannedArtifacts,
        skipped: input.scan.files.skipped
      },
      riskInventory: input.scan.riskInventory,
      summary: input.scan.summary,
      type: input.scan.type
    },
    policy: {
      keyMaterial: input.policy.keyMaterial,
      policySha256: input.policy.policySha256,
      type: input.policy.type,
      version: input.policy.version
    },
    subject: {
      contentSha256: input.subject.contentSha256,
      fileCount: input.subject.fileCount,
      kind: input.subject.kind,
      rootName: input.subject.rootName,
      totalBytes: input.subject.totalBytes
    },
    type: "dev.nipmod.sandbox-audit-receipt-material.v1",
    verdict: input.verdict
  };
  const summaryKey = [
    input.scan.summary.fileCount,
    input.scan.summary.findingCount,
    input.scan.summary.highCount,
    input.scan.summary.mediumCount,
    input.scan.summary.skippedFileCount
  ].join("/");
  return {
    auditReceiptSha256: sha256Text(JSON.stringify(material)),
    cacheKey: input.cacheKey,
    contentSha256: input.subject.contentSha256,
    hashAlgorithm: "sha256",
    keyMaterial: [
      `subject.contentSha256:${input.subject.contentSha256}`,
      `policy.sha256:${input.policy.policySha256}`,
      `subject.kind:${input.subject.kind}`,
      `scan.type:${input.scan.type}`,
      `scan.summary:${summaryKey}`,
      `verdict:${input.verdict}`,
      `sandbox.policy:${input.policy.version}`
    ],
    policySha256: input.policy.policySha256,
    localArtifactOnly: true,
    runOncePerHash: true,
    type: "dev.nipmod.sandbox-provenance-binding.v1"
  };
}

function sandboxAuditPolicyBinding(options: SandboxAuditOptions): SandboxAuditPolicyBinding {
  const limits = {
    maxArtifactBytes: options.maxArtifactBytes ?? DEFAULT_DEEP_SCAN_LIMITS.maxArtifactBytes,
    maxArtifactEntries: options.maxArtifactEntries ?? DEFAULT_DEEP_SCAN_LIMITS.maxArtifactEntries,
    maxBytesPerFile: options.maxBytesPerFile ?? DEFAULT_DEEP_SCAN_LIMITS.maxBytesPerFile,
    maxFiles: options.maxFiles ?? DEFAULT_DEEP_SCAN_LIMITS.maxFiles
  };
  const keyMaterial = [
    "sandbox.policy:local-static-no-exec-v3",
    "sandbox.mode:local-sandbox-audit",
    "sandbox.network:disabled-by-policy",
    "sandbox.filesystem:isolated-read-only-analysis",
    "sandbox.executesCode:false",
    "sandbox.installsPackages:false",
    "sandbox.workspaceWrites:false",
    `scan.maxFiles:${limits.maxFiles}`,
    `scan.maxBytesPerFile:${limits.maxBytesPerFile}`,
    `scan.maxArtifactBytes:${limits.maxArtifactBytes}`,
    `scan.maxArtifactEntries:${limits.maxArtifactEntries}`,
    `hash.skippedDirectories:${[...HASH_SKIPPED_DIRECTORIES].sort().join(",")}`
  ];
  return {
    hashAlgorithm: "sha256",
    keyMaterial,
    policySha256: sha256Text(JSON.stringify({ keyMaterial, type: "dev.nipmod.sandbox-audit-policy-material.v1" })),
    type: "dev.nipmod.sandbox-audit-policy-binding.v1",
    version: "local-static-no-exec-v3"
  };
}

function sandboxAuditCacheKey(contentSha256: string, policySha256: string): string {
  return sha256Text(
    JSON.stringify({
      contentSha256,
      policySha256,
      type: "dev.nipmod.sandbox-audit-cache-key.v1"
    })
  );
}

async function hashSandboxSubject(inputPath: string, cacheDir: string): Promise<ContentHashSubject> {
  const absolutePath = resolve(inputPath);
  const stat = await lstat(absolutePath);
  const hash = createHash("sha256");
  let fileCount = 0;
  let totalBytes = 0;

  if (stat.isFile()) {
    hash.update("file-v1\0");
    totalBytes += stat.size;
    fileCount += 1;
    await updateHashWithFile(hash, absolutePath);
    return {
      contentSha256: hash.digest("hex"),
      fileCount,
      inputPath,
      kind: "file",
      rootName: basename(absolutePath),
      totalBytes
    };
  }

  if (!stat.isDirectory()) {
    hash.update("other\0");
    hash.update(basename(absolutePath));
    return {
      contentSha256: hash.digest("hex"),
      fileCount: 0,
      inputPath,
      kind: "file",
      rootName: basename(absolutePath),
      totalBytes: 0
    };
  }

  const root = await realpath(absolutePath);
  const ignoredCacheDir = await safeRealpath(cacheDir);
  hash.update("dir-v1\0");

  for (const file of await listSubjectFiles(root, ignoredCacheDir)) {
    const fileStat = await lstat(file);
    if (!fileStat.isFile()) continue;
    const rel = relative(root, file).split(sep).join("/");
    hash.update(rel);
    hash.update("\0");
    hash.update(String(fileStat.size));
    hash.update("\0");
    totalBytes += fileStat.size;
    fileCount += 1;
    await updateHashWithFile(hash, file);
    hash.update("\0");
  }

  return {
    contentSha256: hash.digest("hex"),
    fileCount,
    inputPath,
    kind: "directory",
    rootName: basename(root),
    totalBytes
  };
}

async function listSubjectFiles(root: string, ignoredCacheDir: string | null): Promise<string[]> {
  const files: string[] = [];
  async function walk(dir: string): Promise<void> {
    const realDir = await realpath(dir);
    if (ignoredCacheDir && (realDir === ignoredCacheDir || realDir.startsWith(`${ignoredCacheDir}${sep}`))) {
      return;
    }
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (HASH_SKIPPED_DIRECTORIES.has(entry.name)) continue;
        await walk(absolute);
      } else if (entry.isFile()) {
        files.push(absolute);
      }
    }
  }
  await walk(root);
  return files.sort();
}

async function updateHashWithFile(hash: ReturnType<typeof createHash>, path: string): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolvePromise);
  });
}

function remapCachedScanTarget(scan: DeepScanReport, previousRootName: string, subject: ContentHashSubject): DeepScanReport {
  const absolutePath = resolve(subject.inputPath);
  if (subject.kind !== "file" || previousRootName === subject.rootName) {
    return {
      ...scan,
      target: {
        ...scan.target,
        absolutePath,
        inputPath: subject.inputPath,
        kind: subject.kind
      }
    };
  }

  const remapPath = (path: string): string => (path === previousRootName ? subject.rootName : path);
  return {
    ...scan,
    files: {
      matchedManifests: scan.files.matchedManifests.map(remapPath),
      scanned: scan.files.scanned.map(remapPath),
      scannedArtifacts: scan.files.scannedArtifacts.map((artifact) => ({
        ...artifact,
        path: remapPath(artifact.path)
      })),
      skipped: scan.files.skipped.map((skipped) => ({
        ...skipped,
        path: remapPath(skipped.path)
      }))
    },
    findings: scan.findings.map((finding) => ({
      ...finding,
      file: remapPath(finding.file)
    })),
    target: {
      ...scan.target,
      absolutePath,
      inputPath: subject.inputPath,
      kind: subject.kind
    }
  };
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function safeRealpath(path: string): Promise<string | null> {
  try {
    return await realpath(path);
  } catch {
    return null;
  }
}
