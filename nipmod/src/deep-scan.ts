import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import { basename, extname, join, relative, resolve, sep } from "node:path";

export type DeepScanSeverity = "low" | "medium" | "high";
export type DeepScanCheckStatus = "pass" | "warning" | "missing";

export interface DeepScanFinding {
  category: string;
  evidence: string;
  file: string;
  line?: number;
  recommendation: string;
  severity: DeepScanSeverity;
}

export interface DeepScanCheck {
  evidence: string;
  id: string;
  label: string;
  status: DeepScanCheckStatus;
}

export interface DeepScanReport {
  boundaries: {
    executesCode: false;
    installsPackages: false;
    networkFetch: false;
    readsLocalFiles: true;
    unpacksArtifacts: false;
    writesWorkspace: false;
  };
  checks: DeepScanCheck[];
  files: {
    matchedManifests: string[];
    scanned: string[];
    skipped: Array<{ path: string; reason: string }>;
  };
  findings: DeepScanFinding[];
  formatVersion: 1;
  generatedAt: string;
  limitations: string[];
  mode: "local-static";
  nextStep: "review_findings_before_install";
  summary: {
    fileCount: number;
    findingCount: number;
    highCount: number;
    lowCount: number;
    mediumCount: number;
    scannedFileCount: number;
    skippedFileCount: number;
  };
  target: {
    absolutePath: string;
    inputPath: string;
    kind: "directory" | "file";
  };
  type: "dev.nipmod.deep-scan.v1";
}

export interface DeepScanOptions {
  maxBytesPerFile?: number;
  maxFiles?: number;
  path: string;
}

interface ScanState {
  findings: DeepScanFinding[];
  inputPath: string;
  matchedManifests: Set<string>;
  maxBytesPerFile: number;
  maxFiles: number;
  root: string;
  scanned: string[];
  skipped: Array<{ path: string; reason: string }>;
  totalFiles: number;
}

interface TextRule {
  category: string;
  recommendation: string;
  regex: RegExp;
  severity: DeepScanSeverity;
}

const DEFAULT_MAX_FILES = 750;
const DEFAULT_MAX_BYTES_PER_FILE = 256 * 1024;
const MAX_FINDINGS = 250;
const MAX_EVIDENCE_LENGTH = 220;

const SKIPPED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".nuxt",
  ".pnpm",
  ".turbo",
  ".venv",
  ".vercel",
  "__pycache__",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "target",
  "vendor",
  "venv"
]);

const MANIFEST_FILENAMES = new Set([
  "Cargo.toml",
  "Dockerfile",
  "Pipfile",
  "Pipfile.lock",
  "go.mod",
  "npm-shrinkwrap.json",
  "package-lock.json",
  "package.json",
  "pnpm-lock.yaml",
  "poetry.lock",
  "pyproject.toml",
  "requirements.txt",
  "setup.cfg",
  "setup.py",
  "uv.lock",
  "yarn.lock"
]);

const TEXT_EXTENSIONS = new Set([
  ".bash",
  ".cfg",
  ".cjs",
  ".ini",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".ps1",
  ".py",
  ".sh",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
  ".zsh"
]);

const LIFECYCLE_SCRIPTS = new Set([
  "preinstall",
  "install",
  "postinstall",
  "prepack",
  "prepare",
  "prepublish",
  "prepublishOnly"
]);

const TEXT_RULES: TextRule[] = [
  {
    category: "remote-shell",
    regex: /\b(curl|wget)\b[^\n\r|;&]{0,180}(?:\||;|&&)\s*(?:sudo\s+)?(?:sh|bash|zsh|node|python|python3)\b/i,
    severity: "high",
    recommendation: "Review remote shell execution before allowing any install or setup command."
  },
  {
    category: "encoded-execution",
    regex: /\b(base64|openssl)\b[^\n\r|;&]{0,120}(?:-d|-decode|enc)[^\n\r|;&]{0,120}(?:\||;|&&)\s*(?:sh|bash|node|python|python3)\b/i,
    severity: "high",
    recommendation: "Reject or isolate encoded command execution unless the source is independently verified."
  },
  {
    category: "credential-access",
    regex: /\b(id_rsa|id_ed25519|ssh-agent|\.ssh|mnemonic|seed phrase|private[_-]?key|wallet|keystore|\.env)\b/i,
    severity: "high",
    recommendation: "Check whether the package attempts to read credentials, wallets, SSH keys or environment secrets."
  },
  {
    category: "destructive-command",
    regex: /\b(rm\s+-rf|sudo\s+|chmod\s+\+x|chown\s+|mkfs|diskutil|format\s+[a-z]:)\b/i,
    severity: "high",
    recommendation: "Require explicit review before running destructive or privileged commands."
  },
  {
    category: "process-execution",
    regex: /\b(child_process|execSync|spawnSync|subprocess\.|os\.system|ProcessBuilder|eval\s*\(|new Function\s*\()\b/i,
    severity: "medium",
    recommendation: "Review process execution paths and make sure install-time code cannot run unexpectedly."
  },
  {
    category: "network-fetch",
    regex: /\b(curl|wget|Invoke-WebRequest|fetch\s*\(|requests\.get|urllib\.request|git\s+clone)\b/i,
    severity: "medium",
    recommendation: "Confirm that network fetches are expected and pinned to trustworthy sources."
  },
  {
    category: "shell-composition",
    regex: /(?:&&|\|\||;\s*(?:sh|bash|zsh|node|python|python3)\b|\$\(|`[^`]+`)/,
    severity: "medium",
    recommendation: "Review composed shell commands before allowing agent execution."
  },
  {
    category: "github-workflow-risk",
    regex: /\bpull_request_target\b|\bsecrets\.[A-Z0-9_]+\b|\bpermissions:\s*write-all\b/i,
    severity: "medium",
    recommendation: "Review workflow permissions and secret exposure before trusting repository automation."
  },
  {
    category: "direct-dependency-url",
    regex: /\b(git\+https?:\/\/|https?:\/\/[^ \n\r]+(?:\.whl|\.tar\.gz|\.zip|\.tgz))\b/i,
    severity: "medium",
    recommendation: "Prefer pinned registry packages or verify direct artifact URLs and hashes."
  }
];

export async function deepScanProject(options: DeepScanOptions): Promise<DeepScanReport> {
  const absolutePath = resolve(options.path);
  const stat = await lstat(absolutePath);
  const root = stat.isDirectory() ? await realpath(absolutePath) : await realpath(resolve(absolutePath, ".."));
  const state: ScanState = {
    findings: [],
    inputPath: options.path,
    matchedManifests: new Set(),
    maxBytesPerFile: options.maxBytesPerFile ?? DEFAULT_MAX_BYTES_PER_FILE,
    maxFiles: options.maxFiles ?? DEFAULT_MAX_FILES,
    root,
    scanned: [],
    skipped: [],
    totalFiles: 0
  };

  if (stat.isDirectory()) {
    await scanDirectory(absolutePath, state);
  } else if (stat.isFile()) {
    await scanFile(absolutePath, state);
  } else {
    state.skipped.push({ path: ".", reason: "target is not a regular file or directory" });
  }

  const highCount = state.findings.filter((finding) => finding.severity === "high").length;
  const mediumCount = state.findings.filter((finding) => finding.severity === "medium").length;
  const lowCount = state.findings.filter((finding) => finding.severity === "low").length;

  return {
    boundaries: {
      executesCode: false,
      installsPackages: false,
      networkFetch: false,
      readsLocalFiles: true,
      unpacksArtifacts: false,
      writesWorkspace: false
    },
    checks: buildChecks(state, { highCount, mediumCount }),
    files: {
      matchedManifests: [...state.matchedManifests].sort(),
      scanned: [...state.scanned].sort(),
      skipped: state.skipped
    },
    findings: state.findings,
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    limitations: [
      "Static pattern scan only; it does not prove that external code is safe.",
      "The scan reads local files that already exist on disk.",
      "The scan does not download packages, clone repositories, unpack artifacts, install dependencies or execute code.",
      "Deep artifact validation should run in an isolated sandbox when package bytes are not already present locally."
    ],
    mode: "local-static",
    nextStep: "review_findings_before_install",
    summary: {
      fileCount: state.totalFiles,
      findingCount: state.findings.length,
      highCount,
      lowCount,
      mediumCount,
      scannedFileCount: state.scanned.length,
      skippedFileCount: state.skipped.length
    },
    target: {
      absolutePath,
      inputPath: options.path,
      kind: stat.isDirectory() ? "directory" : "file"
    },
    type: "dev.nipmod.deep-scan.v1"
  };
}

export function formatDeepScanReport(report: DeepScanReport): string {
  const lines = [
    `nipmod deep-scan ${report.summary.highCount > 0 ? "needs review" : "completed"} ${report.target.inputPath}`,
    `files: ${report.summary.scannedFileCount} scanned, ${report.summary.skippedFileCount} skipped`,
    `findings: ${report.summary.highCount} high, ${report.summary.mediumCount} medium, ${report.summary.lowCount} low`,
    "boundary: local static scan only; no installs, no execution, no downloads, no workspace writes"
  ];

  for (const finding of report.findings.slice(0, 12)) {
    const location = finding.line === undefined ? finding.file : `${finding.file}:${finding.line}`;
    lines.push(`${finding.severity.toUpperCase()} ${location} ${finding.category}: ${finding.evidence}`);
  }
  if (report.findings.length > 12) {
    lines.push(`... ${report.findings.length - 12} more findings`);
  }
  return lines.join("\n");
}

async function scanDirectory(dir: string, state: ScanState): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    state.skipped.push({ path: relativePath(dir, state), reason: "directory could not be read" });
    return;
  }

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = join(dir, entry.name);
    const rel = relativePath(absolutePath, state);
    if (entry.isSymbolicLink()) {
      state.skipped.push({ path: rel, reason: "symbolic link skipped" });
      continue;
    }
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) {
        state.skipped.push({ path: rel, reason: "generated or dependency directory skipped" });
        continue;
      }
      await scanDirectory(absolutePath, state);
      continue;
    }
    if (entry.isFile()) {
      await scanFile(absolutePath, state);
    }
  }
}

async function scanFile(absolutePath: string, state: ScanState): Promise<void> {
  const rel = relativePath(absolutePath, state);
  state.totalFiles += 1;
  if (state.scanned.length >= state.maxFiles) {
    state.skipped.push({ path: rel, reason: "max file scan limit reached" });
    return;
  }
  if (!shouldScanFile(rel)) {
    return;
  }

  const stat = await lstat(absolutePath);
  if (stat.size > state.maxBytesPerFile) {
    state.skipped.push({ path: rel, reason: `file exceeds ${state.maxBytesPerFile} byte scan limit` });
    return;
  }

  let content: string;
  try {
    content = await readFile(absolutePath, "utf8");
  } catch {
    state.skipped.push({ path: rel, reason: "file could not be read as utf8 text" });
    return;
  }

  state.scanned.push(rel);
  if (isManifestFile(rel)) {
    state.matchedManifests.add(rel);
  }

  if (basename(rel) === "package.json") {
    scanPackageJson(rel, content, state);
  }
  scanTextRules(rel, content, state);
}

function scanPackageJson(file: string, content: string, state: ScanState): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    addFinding(state, {
      category: "manifest-parse",
      evidence: "package.json is not valid JSON",
      file,
      recommendation: "Fix manifest parsing before an agent trusts install metadata.",
      severity: "medium"
    });
    return;
  }
  if (!parsed || typeof parsed !== "object" || !("scripts" in parsed)) {
    return;
  }
  const scripts = (parsed as { scripts?: unknown }).scripts;
  if (!scripts || typeof scripts !== "object" || Array.isArray(scripts)) {
    return;
  }

  for (const [name, value] of Object.entries(scripts)) {
    if (!LIFECYCLE_SCRIPTS.has(name) || typeof value !== "string") {
      continue;
    }
    const severity = isHighRiskShell(value) ? "high" : "medium";
    addFinding(state, {
      category: "npm-lifecycle-script",
      evidence: `scripts.${name} = ${compact(value)}`,
      file,
      recommendation: "Review install-time lifecycle scripts before allowing package execution.",
      severity
    });
  }
}

function scanTextRules(file: string, content: string, state: ScanState): void {
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      continue;
    }
    for (const rule of TEXT_RULES) {
      rule.regex.lastIndex = 0;
      if (!rule.regex.test(line)) {
        continue;
      }
      addFinding(state, {
        category: rule.category,
        evidence: compact(line),
        file,
        line: index + 1,
        recommendation: rule.recommendation,
        severity: rule.severity
      });
    }
  }
}

function buildChecks(state: ScanState, counts: { highCount: number; mediumCount: number }): DeepScanCheck[] {
  const workflowCount = state.scanned.filter((file) => file.startsWith(`.github${sep}workflows`) || file.startsWith(".github/workflows")).length;
  return [
    {
      evidence: "Scanner uses local filesystem reads only.",
      id: "local-static-boundary",
      label: "Local static scan boundary",
      status: "pass"
    },
    {
      evidence:
        state.matchedManifests.size > 0 ? `${state.matchedManifests.size} manifest or lock files scanned.` : "No known manifest files were found.",
      id: "manifest-coverage",
      label: "Manifest coverage",
      status: state.matchedManifests.size > 0 ? "pass" : "missing"
    },
    {
      evidence: counts.highCount > 0 ? `${counts.highCount} high severity findings require review.` : "No high severity patterns found.",
      id: "high-risk-patterns",
      label: "High risk patterns",
      status: counts.highCount > 0 ? "warning" : "pass"
    },
    {
      evidence: counts.mediumCount > 0 ? `${counts.mediumCount} medium severity findings require review.` : "No medium severity patterns found.",
      id: "medium-risk-patterns",
      label: "Medium risk patterns",
      status: counts.mediumCount > 0 ? "warning" : "pass"
    },
    {
      evidence: workflowCount > 0 ? `${workflowCount} GitHub workflow files scanned.` : "No GitHub workflow files found.",
      id: "workflow-coverage",
      label: "Workflow coverage",
      status: workflowCount > 0 ? "pass" : "missing"
    }
  ];
}

function addFinding(
  state: ScanState,
  finding: {
    category: string;
    evidence: string;
    file: string;
    line?: number;
    recommendation: string;
    severity: DeepScanSeverity;
  }
): void {
  if (state.findings.length >= MAX_FINDINGS) {
    return;
  }
  const entry: DeepScanFinding = {
    category: finding.category,
    evidence: finding.evidence.slice(0, MAX_EVIDENCE_LENGTH),
    file: finding.file,
    recommendation: finding.recommendation,
    severity: finding.severity
  };
  if (finding.line !== undefined) {
    entry.line = finding.line;
  }
  state.findings.push(entry);
}

function shouldScanFile(path: string): boolean {
  return isManifestFile(path) || isWorkflowFile(path) || TEXT_EXTENSIONS.has(extname(path).toLowerCase());
}

function isManifestFile(path: string): boolean {
  return MANIFEST_FILENAMES.has(basename(path));
}

function isWorkflowFile(path: string): boolean {
  const normalized = path.split(sep).join("/");
  return normalized.startsWith(".github/workflows/") && (normalized.endsWith(".yml") || normalized.endsWith(".yaml"));
}

function relativePath(path: string, state: ScanState): string {
  const rel = relative(state.root, path);
  return rel && !rel.startsWith("..") ? rel : basename(path);
}

function isHighRiskShell(command: string): boolean {
  return TEXT_RULES.some((rule) => rule.severity === "high" && rule.regex.test(command));
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_EVIDENCE_LENGTH);
}
