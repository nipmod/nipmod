import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { basename, join, posix, relative, resolve, sep } from "node:path";
import type { NetworkPolicy } from "@vercel/sandbox";
import { bindSandboxAuditReportToDecision, type SandboxDecisionBinding } from "./sandbox-decision-binding.js";
import { runSandboxAudit, type SandboxAuditOptions, type SandboxAuditReport } from "./sandbox-audit.js";

export type SandboxRuntimeNetworkPolicy = "allow-all" | "deny-all";
export type SandboxRuntimeRuntime = "node22" | "node24" | "node26" | "python3.13";
export type SandboxRuntimeVerdict = "blocked" | "pass" | "review" | "skipped";

export interface SandboxRuntimeExecutionReceipt {
  commandArgv: string[];
  commandExecuted: boolean;
  commandExitCode: number | null;
  commandSha256: string;
  contentSha256: string;
  hashAlgorithm: "sha256";
  networkPolicy: SandboxRuntimeNetworkPolicy;
  preflightAuditReceiptSha256: string;
  preflightPolicySha256: string;
  runtime: SandboxRuntimeRuntime;
  runtimePolicySha256: string;
  sandboxProvider: "vercel-sandbox";
  secretsAllowed: false;
  type: "dev.nipmod.sandbox-runtime-receipt.v1";
  verdict: SandboxRuntimeVerdict;
  workspaceMountAllowed: false;
}

export interface SandboxRuntimeOptions extends SandboxAuditOptions {
  allowBlocked?: boolean;
  allowReview?: boolean;
  command: readonly string[];
  confirmRuntime?: boolean;
  decision?: unknown;
  dryRun?: boolean;
  maxUploadBytes?: number;
  networkPolicy?: SandboxRuntimeNetworkPolicy;
  runtime?: SandboxRuntimeRuntime;
  targetConfirmed?: boolean;
  timeoutMs?: number;
}

export interface SandboxRuntimeReport {
  boundaries: {
    callerWorkspaceWrites: false;
    hostedApiExecutes: false;
    localHostOnly: true;
    sandboxFilesystemWrites: true;
    secretsAllowed: false;
    uploadsSubjectFilesOnly: true;
    workspaceMountAllowed: false;
  };
  command: {
    argv: string[];
    cwd: "/vercel/sandbox/input";
    durationMs: number | null;
    error: string | null;
    executed: boolean;
    exitCode: number | null;
    stderrTail: string;
    stdoutTail: string;
    timedOut: boolean;
  };
  decisionBinding: SandboxDecisionBinding | null;
  formatVersion: 1;
  generatedAt: string;
  limitations: string[];
  preflight: {
    allowBlocked: boolean;
    allowReview: boolean;
    auditReceiptSha256: string;
    cacheHit: boolean;
    cacheKey: string;
    commandRequiredExplicitConfirmation: true;
    contentSha256: string;
    executionGateStatus: SandboxAuditReport["executionGate"]["status"];
    policySha256: string;
    requiredConfirmation: "--confirm-runtime";
    sandboxAuditType: "dev.nipmod.sandbox-audit.v1";
    sandboxAuditVerdict: SandboxAuditReport["verdict"];
  };
  provider: {
    microVm: true;
    name: "vercel-sandbox";
    networkPolicy: SandboxRuntimeNetworkPolicy;
    runtime: SandboxRuntimeRuntime;
  };
  recommendation: string;
  runtimeReceipt: SandboxRuntimeExecutionReceipt;
  subject: {
    contentSha256: string;
    fileCount: number;
    inputPath: string;
    kind: "directory" | "file";
    rootName: string;
    totalBytes: number;
    uploadFileCount: number;
    uploadTotalBytes: number;
  };
  type: "dev.nipmod.sandbox-runtime.v1";
  verdict: SandboxRuntimeVerdict;
}

interface UploadFile {
  content: Uint8Array;
  mode?: number;
  sandboxPath: string;
}

interface UploadSubject {
  files: UploadFile[];
  totalBytes: number;
}

interface RuntimeCommandResult {
  exitCode: number;
  stderr: (opts?: { signal?: AbortSignal }) => Promise<string>;
  stdout: (opts?: { signal?: AbortSignal }) => Promise<string>;
}

interface RuntimeSandbox {
  runCommand: (
    params: { args?: string[]; cmd: string; cwd?: string; signal?: AbortSignal }
  ) => Promise<RuntimeCommandResult>;
  stop: (opts?: { signal?: AbortSignal }) => Promise<unknown>;
  writeFiles: (
    files: Array<{ content: string | Uint8Array; mode?: number; path: string }>,
    opts?: { signal?: AbortSignal }
  ) => Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const DEFAULT_MAX_BYTES_PER_FILE = 5 * 1024 * 1024;
const DEFAULT_MAX_FILES = 750;
const OUTPUT_TAIL_BYTES = 16 * 1024;
const SANDBOX_INPUT_DIR = "/vercel/sandbox/input";
const SUPPORTED_RUNTIMES = new Set<SandboxRuntimeRuntime>(["node22", "node24", "node26", "python3.13"]);
const SKIPPED_UPLOAD_DIRECTORIES = new Set([
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
const SKIPPED_UPLOAD_FILES = new Set([
  ".env",
  ".env.local",
  ".npmrc",
  ".pypirc",
  ".netrc",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  "id_rsa"
]);

export async function runSandboxRuntime(options: SandboxRuntimeOptions): Promise<SandboxRuntimeReport> {
  const runtime = options.runtime ?? "node24";
  if (!SUPPORTED_RUNTIMES.has(runtime)) {
    throw new Error(`unsupported sandbox runtime: ${runtime}`);
  }
  if (options.command.length === 0) {
    throw new Error("sandbox-runtime requires a command after --");
  }
  if (!options.dryRun && options.confirmRuntime !== true) {
    throw new Error("sandbox-runtime requires --confirm-runtime before executing code");
  }

  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const maxBytesPerFile = options.maxBytesPerFile ?? DEFAULT_MAX_BYTES_PER_FILE;
  const maxUploadBytes = options.maxUploadBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const networkPolicy = options.networkPolicy ?? "deny-all";
  const audit = await runSandboxAudit({
    ...(options.cacheDir === undefined ? {} : { cacheDir: options.cacheDir }),
    ...(options.force === undefined ? {} : { force: options.force }),
    ...(options.maxArtifactBytes === undefined ? {} : { maxArtifactBytes: options.maxArtifactBytes }),
    ...(options.maxArtifactEntries === undefined ? {} : { maxArtifactEntries: options.maxArtifactEntries }),
    maxBytesPerFile,
    maxFiles,
    path: options.path
  });
  const decisionBinding =
    options.decision === undefined
      ? null
      : bindSandboxAuditReportToDecision({
          decision: options.decision,
          report: audit,
          targetConfirmed: options.targetConfirmed === true
        });
  const upload = await collectUploadSubject(options.path, {
    maxBytesPerFile,
    maxFiles,
    maxUploadBytes
  });
  const base = baseReport({
    allowBlocked: options.allowBlocked === true,
    allowReview: options.allowReview === true,
    audit,
    command: options.command,
    decisionBinding,
    networkPolicy,
    runtime,
    upload
  });

  if (decisionBinding && !decisionBinding.ok) {
    return {
      ...base,
      recommendation: "Do not run the package. The sandbox-audit receipt is not bound to the package decision approval contract.",
      runtimeReceipt: {
        ...base.runtimeReceipt,
        verdict: "blocked"
      },
      verdict: "blocked"
    };
  }
  if (audit.verdict === "blocked" && options.allowBlocked !== true) {
    return {
      ...base,
      recommendation: "Do not run the package. The static sandbox audit is blocked; pass --allow-blocked only under an explicit local policy exception.",
      runtimeReceipt: {
        ...base.runtimeReceipt,
        verdict: "blocked"
      },
      verdict: "blocked"
    };
  }
  if (audit.verdict === "review" && options.allowReview !== true) {
    return {
      ...base,
      recommendation: "Review the sandbox-audit findings before runtime execution, or pass --allow-review when local policy accepts the residual risk.",
      runtimeReceipt: {
        ...base.runtimeReceipt,
        verdict: "review"
      },
      verdict: "review"
    };
  }
  if (options.dryRun) {
    return {
      ...base,
      recommendation: "Dry run only. Re-run with --confirm-runtime to execute in an isolated microVM.",
      verdict: "skipped"
    };
  }

  const startedAt = Date.now();
  const abort = createTimeoutSignal(timeoutMs);
  let sandbox: RuntimeSandbox | null = null;
  try {
    const { Sandbox } = await import("@vercel/sandbox");
    const activeSandbox = (await Sandbox.create({
      networkPolicy: networkPolicy as NetworkPolicy,
      persistent: false,
      runtime,
      timeout: Math.max(timeoutMs + 30_000, 60_000)
    })) as RuntimeSandbox;
    sandbox = activeSandbox;
    await activeSandbox.runCommand({ args: ["-p", ...uploadDirectories(upload.files)], cmd: "mkdir", signal: abort.signal });
    if (upload.files.length > 0) {
      await activeSandbox.writeFiles(upload.files.map((file) => ({ path: file.sandboxPath, content: file.content, ...(file.mode ? { mode: file.mode } : {}) })), {
        signal: abort.signal
      });
    }
    const command = options.command[0]!;
    const args = options.command.slice(1);
    const result = await activeSandbox.runCommand({ args, cmd: command, cwd: SANDBOX_INPUT_DIR, signal: abort.signal });
    const [stdout, stderr] = await Promise.all([result.stdout({ signal: abort.signal }), result.stderr({ signal: abort.signal })]);
    const exitCode = result.exitCode;
    const verdict = exitCode === 0 ? "pass" : "blocked";
    return {
      ...base,
      command: {
        argv: [...options.command],
        cwd: SANDBOX_INPUT_DIR,
        durationMs: Date.now() - startedAt,
        error: null,
        executed: true,
        exitCode,
        stderrTail: tail(stderr),
        stdoutTail: tail(stdout),
        timedOut: false
      },
      runtimeReceipt: sandboxRuntimeExecutionReceipt({
        audit,
        command: options.command,
        commandExecuted: true,
        commandExitCode: exitCode,
        networkPolicy,
        runtime,
        verdict
      }),
      recommendation:
        exitCode === 0
          ? "Runtime sandbox command passed. Keep the logs with the package decision before approving real workspace execution."
          : "Runtime sandbox command failed. Review stdout, stderr, exit code and filesystem behavior before approving the package.",
      verdict
    };
  } catch (error) {
    return {
      ...base,
      command: {
        argv: [...options.command],
        cwd: SANDBOX_INPUT_DIR,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
        executed: true,
        exitCode: null,
        stderrTail: "",
        stdoutTail: "",
        timedOut: abort.timedOut
      },
      runtimeReceipt: sandboxRuntimeExecutionReceipt({
        audit,
        command: options.command,
        commandExecuted: true,
        commandExitCode: null,
        networkPolicy,
        runtime,
        verdict: "blocked"
      }),
      recommendation: abort.timedOut
        ? "Runtime sandbox command timed out. Treat the package as blocked until the behavior is understood."
        : "Runtime sandbox command could not complete. Review the error and rerun only if local policy allows it.",
      verdict: "blocked"
    };
  } finally {
    abort.cancel();
    if (sandbox) {
      await sandbox.stop({}).catch(() => undefined);
    }
  }
}

export function formatSandboxRuntimeReport(report: SandboxRuntimeReport): string {
  return [
    `nipmod sandbox-runtime ${report.verdict} ${report.subject.inputPath}`,
    `preflight: sandbox-audit ${report.preflight.sandboxAuditVerdict} sha256:${report.preflight.cacheKey} cache:${report.preflight.cacheHit ? "hit" : "miss"}`,
    `preflight receipt: sha256:${report.preflight.auditReceiptSha256}`,
    `runtime receipt: sha256:${report.runtimeReceipt.runtimePolicySha256} command:${report.runtimeReceipt.commandSha256.slice(0, 12)}`,
    `provider: ${report.provider.name} ${report.provider.runtime} network:${report.provider.networkPolicy}`,
    `upload: ${report.subject.uploadFileCount} file(s), ${report.subject.uploadTotalBytes} bytes`,
    report.command.executed
      ? `command: ${report.command.argv.join(" ")} exit:${report.command.exitCode ?? "n/a"} duration:${report.command.durationMs ?? 0}ms`
      : `command: ${report.command.argv.join(" ")} not executed`,
    report.command.stdoutTail ? `stdout:\n${report.command.stdoutTail}` : "",
    report.command.stderrTail ? `stderr:\n${report.command.stderrTail}` : "",
    report.command.error ? `error: ${report.command.error}` : "",
    `recommendation: ${report.recommendation}`
  ]
    .filter(Boolean)
    .join("\n");
}

function baseReport(input: {
  allowBlocked: boolean;
  allowReview: boolean;
  audit: SandboxAuditReport;
  command: readonly string[];
  decisionBinding: SandboxDecisionBinding | null;
  networkPolicy: SandboxRuntimeNetworkPolicy;
  runtime: SandboxRuntimeRuntime;
  upload: UploadSubject;
}): SandboxRuntimeReport {
  return {
    boundaries: {
      callerWorkspaceWrites: false,
      hostedApiExecutes: false,
      localHostOnly: true,
      sandboxFilesystemWrites: true,
      secretsAllowed: false,
      uploadsSubjectFilesOnly: true,
      workspaceMountAllowed: false
    },
    command: {
      argv: [...input.command],
      cwd: SANDBOX_INPUT_DIR,
      durationMs: null,
      error: null,
      executed: false,
      exitCode: null,
      stderrTail: "",
      stdoutTail: "",
      timedOut: false
    },
    decisionBinding: input.decisionBinding,
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    limitations: [
      "This is an optional local or host-controlled runtime sandbox, not hosted API execution.",
      "Only the selected local file tree is uploaded; the caller workspace is not mounted.",
      "Common local secret and host-state files are excluded from the upload set.",
      "No secrets or host environment variables are forwarded by Nipmod.",
      "Default network policy is deny-all; use allow-all only for an explicit local policy exception.",
      "Runtime behavior still depends on the command chosen by the host."
    ],
    preflight: {
      allowBlocked: input.allowBlocked,
      allowReview: input.allowReview,
      auditReceiptSha256: input.audit.provenanceBinding.auditReceiptSha256,
      cacheHit: input.audit.cache.hit,
      cacheKey: input.audit.cache.cacheKey,
      commandRequiredExplicitConfirmation: true,
      contentSha256: input.audit.subject.contentSha256,
      executionGateStatus: input.audit.executionGate.status,
      policySha256: input.audit.policy.policySha256,
      requiredConfirmation: "--confirm-runtime",
      sandboxAuditType: input.audit.type,
      sandboxAuditVerdict: input.audit.verdict
    },
    provider: {
      microVm: true,
      name: "vercel-sandbox",
      networkPolicy: input.networkPolicy,
      runtime: input.runtime
    },
    recommendation: "Runtime sandbox was not executed.",
    runtimeReceipt: sandboxRuntimeExecutionReceipt({
      audit: input.audit,
      command: input.command,
      commandExecuted: false,
      commandExitCode: null,
      networkPolicy: input.networkPolicy,
      runtime: input.runtime,
      verdict: "skipped"
    }),
    subject: {
      contentSha256: input.audit.subject.contentSha256,
      fileCount: input.audit.subject.fileCount,
      inputPath: input.audit.subject.inputPath,
      kind: input.audit.subject.kind,
      rootName: input.audit.subject.rootName,
      totalBytes: input.audit.subject.totalBytes,
      uploadFileCount: input.upload.files.length,
      uploadTotalBytes: input.upload.totalBytes
    },
    type: "dev.nipmod.sandbox-runtime.v1",
    verdict: "skipped"
  };
}

function sandboxRuntimeExecutionReceipt(input: {
  audit: SandboxAuditReport;
  command: readonly string[];
  commandExecuted: boolean;
  commandExitCode: number | null;
  networkPolicy: SandboxRuntimeNetworkPolicy;
  runtime: SandboxRuntimeRuntime;
  verdict: SandboxRuntimeVerdict;
}): SandboxRuntimeExecutionReceipt {
  const commandArgv = [...input.command];
  const commandSha256 = createHash("sha256").update(commandArgv.join("\0")).digest("hex");
  const runtimePolicyMaterial = JSON.stringify({
    commandSha256,
    contentSha256: input.audit.subject.contentSha256,
    networkPolicy: input.networkPolicy,
    preflightAuditReceiptSha256: input.audit.provenanceBinding.auditReceiptSha256,
    preflightPolicySha256: input.audit.policy.policySha256,
    runtime: input.runtime,
    sandboxProvider: "vercel-sandbox",
    type: "dev.nipmod.sandbox-runtime-policy-material.v1",
    workspaceMountAllowed: false
  });
  return {
    commandArgv,
    commandExecuted: input.commandExecuted,
    commandExitCode: input.commandExitCode,
    commandSha256,
    contentSha256: input.audit.subject.contentSha256,
    hashAlgorithm: "sha256",
    networkPolicy: input.networkPolicy,
    preflightAuditReceiptSha256: input.audit.provenanceBinding.auditReceiptSha256,
    preflightPolicySha256: input.audit.policy.policySha256,
    runtime: input.runtime,
    runtimePolicySha256: createHash("sha256").update(runtimePolicyMaterial).digest("hex"),
    sandboxProvider: "vercel-sandbox",
    secretsAllowed: false,
    type: "dev.nipmod.sandbox-runtime-receipt.v1",
    verdict: input.verdict,
    workspaceMountAllowed: false
  };
}

async function collectUploadSubject(
  inputPath: string,
  limits: { maxBytesPerFile: number; maxFiles: number; maxUploadBytes: number }
): Promise<UploadSubject> {
  const absolutePath = resolve(inputPath);
  const stat = await lstat(absolutePath);
  if (stat.isFile()) {
    const content = await readLimitedFile(absolutePath, limits.maxBytesPerFile);
    return {
      files: [
        {
          content,
          sandboxPath: sandboxPathForRelative(basename(absolutePath))
        }
      ],
      totalBytes: content.byteLength
    };
  }
  if (!stat.isDirectory()) {
    return { files: [], totalBytes: 0 };
  }

  const root = await realpath(absolutePath);
  const files: UploadFile[] = [];
  let totalBytes = 0;
  for (const file of await listUploadFiles(root)) {
    if (files.length >= limits.maxFiles) break;
    const fileStat = await lstat(file);
    if (!fileStat.isFile() || fileStat.size > limits.maxBytesPerFile) continue;
    if (totalBytes + fileStat.size > limits.maxUploadBytes) break;
    const relativePath = relative(root, file).split(sep).join(posix.sep);
    const content = await readFile(file);
    files.push({
      content,
      sandboxPath: sandboxPathForRelative(relativePath)
    });
    totalBytes += content.byteLength;
  }
  return { files, totalBytes };
}

async function listUploadFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (SKIPPED_UPLOAD_DIRECTORIES.has(entry.name)) continue;
        await walk(absolute);
      } else if (entry.isFile()) {
        if (shouldSkipUploadFile(entry.name)) continue;
        files.push(absolute);
      }
    }
  }
  await walk(root);
  return files.sort();
}

function shouldSkipUploadFile(name: string): boolean {
  return SKIPPED_UPLOAD_FILES.has(name) || name.startsWith(".env.");
}

async function readLimitedFile(path: string, maxBytes: number): Promise<Uint8Array> {
  const stat = await lstat(path);
  if (stat.size > maxBytes) {
    throw new Error(`file exceeds sandbox upload limit: ${path}`);
  }
  return readFile(path);
}

function sandboxPathForRelative(relativePath: string): string {
  const normalized = relativePath.split(sep).join(posix.sep).replace(/^\/+/, "");
  const hash = createHash("sha256").update(normalized).digest("hex").slice(0, 12);
  const safePath = normalized
    .split(posix.sep)
    .filter((part) => part && part !== "." && part !== "..")
    .join(posix.sep);
  return posix.join(SANDBOX_INPUT_DIR, safePath || `input-${hash}`);
}

function uploadDirectories(files: UploadFile[]): string[] {
  const dirs = new Set<string>([SANDBOX_INPUT_DIR]);
  for (const file of files) {
    const dirname = posix.dirname(file.sandboxPath);
    if (dirname.startsWith(SANDBOX_INPUT_DIR)) {
      dirs.add(dirname);
    }
  }
  return [...dirs].sort();
}

function createTimeoutSignal(timeoutMs: number): { cancel: () => void; signal: AbortSignal; timedOut: boolean } {
  const controller = new AbortController();
  const state = { timedOut: false };
  const timer = setTimeout(() => {
    state.timedOut = true;
    controller.abort();
  }, timeoutMs);
  timer.unref();
  return {
    cancel: () => clearTimeout(timer),
    get signal() {
      return controller.signal;
    },
    get timedOut() {
      return state.timedOut;
    }
  };
}

function tail(value: string): string {
  if (Buffer.byteLength(value, "utf8") <= OUTPUT_TAIL_BYTES) return value;
  return `...${Buffer.from(value).subarray(-OUTPUT_TAIL_BYTES).toString("utf8")}`;
}
