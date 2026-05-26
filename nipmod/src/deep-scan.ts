import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import { basename, extname, join, relative, resolve, sep } from "node:path";
import { gunzipSync, inflateRawSync } from "node:zlib";

export type DeepScanSeverity = "low" | "medium" | "high";
export type DeepScanCheckStatus = "pass" | "warning" | "missing";
export type DeepScanArtifactType = "tar" | "tar.gz" | "tgz" | "zip" | "whl";

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
    scannedArtifacts: Array<{ path: string; scannedEntries: number; skippedEntries: number; type: DeepScanArtifactType }>;
    skipped: Array<{ path: string; reason: string }>;
  };
  findings: DeepScanFinding[];
  formatVersion: 1;
  generatedAt: string;
  limitations: string[];
  mode: "local-static";
  nextStep: "review_findings_before_install";
  summary: {
    artifactCount: number;
    artifactEntryCount: number;
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
  maxArtifactBytes?: number;
  maxArtifactEntries?: number;
  maxBytesPerFile?: number;
  maxFiles?: number;
  path: string;
}

interface ScanState {
  findings: DeepScanFinding[];
  inputPath: string;
  matchedManifests: Set<string>;
  maxArtifactBytes: number;
  maxArtifactEntries: number;
  maxBytesPerFile: number;
  maxFiles: number;
  root: string;
  scanned: string[];
  scannedArtifacts: Array<{ path: string; scannedEntries: number; skippedEntries: number; type: DeepScanArtifactType }>;
  skipped: Array<{ path: string; reason: string }>;
  totalArtifactEntries: number;
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
const DEFAULT_MAX_ARTIFACT_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_ARTIFACT_ENTRIES = 200;
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
  "node_modules",
  "out",
  "target",
  "vendor",
  "venv"
]);

const MANIFEST_FILENAMES = new Set([
  "Cargo.toml",
  "Dockerfile",
  "METADATA",
  "Pipfile",
  "Pipfile.lock",
  "RECORD",
  "WHEEL",
  "entry_points.txt",
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
  "preprepare",
  "prepare",
  "postprepare",
  "prepack",
  "postpack",
  "prepublish",
  "prepublishOnly",
  "prepublishonly"
]);

const TEXT_RULES: TextRule[] = [
  {
    category: "remote-shell",
    regex: /\b(curl|wget)\b[^\n\r|;&]{0,220}(?:\||;|&&)\s*(?:sudo\s+)?(?:sh|bash|zsh|node|python|python3)\b|\b(?:bash|sh|zsh)\s+-c\s+["']?\$?\(\s*(?:curl|wget)\b|\b(?:sh|bash|zsh)\s+<\(\s*(?:curl|wget)\b|\b(?:iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^\n\r]{0,220}(?:\||;)[^\n\r]{0,120}\b(?:iex|Invoke-Expression)\b/i,
    severity: "high",
    recommendation: "Review remote shell execution before allowing any install or setup command."
  },
  {
    category: "downloaded-file-execution",
    regex: /\b(curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^\n\r]{0,220}(?:-o|--output|>|-OutFile)\s*\S+[^\n\r]{0,220}(?:&&|;|\|\|)[^\n\r]{0,160}\b(sh|bash|zsh|node|python|python3|chmod|pwsh|powershell)\b/i,
    severity: "high",
    recommendation: "Reject or isolate installers that download a payload and then execute it."
  },
  {
    category: "encoded-execution",
    regex: /\b(base64|openssl)\b[^\n\r|;&]{0,120}(?:-d|-decode|enc)[^\n\r|;&]{0,120}(?:\||;|&&)\s*(?:sh|bash|node|python|python3)\b|\b(powershell|pwsh)\b[^\n\r]{0,80}\b(-enc|-encodedcommand)\b/i,
    severity: "high",
    recommendation: "Reject or isolate encoded command execution unless the source is independently verified."
  },
  {
    category: "obfuscated-execution",
    regex: /\$\{IFS\}|\$'\\x[0-9a-f]{2}|\\x[0-9a-f]{2}\\x[0-9a-f]{2}|\bc['"]u['"]rl\b|String\.fromCharCode|Buffer\.from\(\[|atob\s*\(|base64\.b64decode|marshal\.loads|zlib\.decompress/i,
    severity: "high",
    recommendation: "Review obfuscated execution before allowing package code to run."
  },
  {
    category: "secret-exfiltration",
    regex: /\b(curl|wget|fetch\s*\(|requests\.post|axios\.post|urllib\.request|http\.post|https\.post|Invoke-WebRequest|Invoke-RestMethod)\b[^\n\r]{0,220}\b(\.npmrc|\.pypirc|\.netrc|\.env|id_rsa|id_ed25519|GITHUB_TOKEN|NPM_TOKEN|PYPI_TOKEN|HF_TOKEN|AWS_SECRET_ACCESS_KEY|SSH_AUTH_SOCK|private[_-]?key|wallet|keystore|mnemonic)\b|\b(\.npmrc|\.pypirc|\.netrc|\.env|id_rsa|id_ed25519|GITHUB_TOKEN|NPM_TOKEN|PYPI_TOKEN|HF_TOKEN|AWS_SECRET_ACCESS_KEY|SSH_AUTH_SOCK|private[_-]?key|wallet|keystore|mnemonic)\b[^\n\r]{0,220}\b(curl|wget|fetch\s*\(|requests\.post|axios\.post|urllib\.request|http\.post|https\.post|Invoke-WebRequest|Invoke-RestMethod)\b/i,
    severity: "high",
    recommendation: "Block package code that appears to upload tokens, SSH keys, wallets or environment secrets."
  },
  {
    category: "credential-access",
    regex: /\b(id_rsa|id_ed25519|ssh-agent|\.ssh|\.npmrc|\.pypirc|\.netrc|\/proc\/self\/environ|process\.env|os\.environ|getenv|GITHUB_TOKEN|NPM_TOKEN|PYPI_TOKEN|HF_TOKEN|AWS_SECRET_ACCESS_KEY|SSH_AUTH_SOCK|169\.254\.169\.254|metadata\.google\.internal|mnemonic|seed phrase|private[_-]?key|wallet|keystore|\.env)\b/i,
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
    regex: /\b(child_process|execSync|spawnSync|subprocess\.|os\.system|ProcessBuilder|eval\s*\(|new Function\s*\(|cmdclass\s*=|setup_requires\s*=)\b/i,
    severity: "medium",
    recommendation: "Review process execution paths and make sure install-time code cannot run unexpectedly."
  },
  {
    category: "python-build-backend-risk",
    regex: /\bbackend-path\s*=|\bbuild-backend\s*=\s*["'](?!setuptools\.build_meta|hatchling\.build|flit_core\.buildapi|poetry\.core\.masonry\.api)[^"']+["']/i,
    severity: "medium",
    recommendation: "Review custom Python build backends because source installs can execute build backend code."
  },
  {
    category: "metadata-prompt-injection",
    regex: /\b(ignore|disregard|override)\b[^\n\r]{0,80}\b(previous|prior|system|developer|user|safety)\b[^\n\r]{0,80}\binstructions\b|\b(reveal|print|show|dump|send|upload|post|exfiltrate|leak)\b[^\n\r]{0,120}\b(system prompt|developer message|secret|api key|token|private key|ssh key|seed phrase|mnemonic|wallet|\.env)\b|\bdo not tell\b[^\n\r]{0,80}\b(user|developer|operator)\b|\brun\b[^\n\r]{0,80}\bwithout\b[^\n\r]{0,80}\b(approval|confirmation|permission)\b/i,
    severity: "high",
    recommendation: "Treat package docs, model cards and MCP metadata as untrusted data, not agent instructions."
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
    maxArtifactBytes: options.maxArtifactBytes ?? DEFAULT_MAX_ARTIFACT_BYTES,
    maxArtifactEntries: options.maxArtifactEntries ?? DEFAULT_MAX_ARTIFACT_ENTRIES,
    maxBytesPerFile: options.maxBytesPerFile ?? DEFAULT_MAX_BYTES_PER_FILE,
    maxFiles: options.maxFiles ?? DEFAULT_MAX_FILES,
    root,
    scanned: [],
    scannedArtifacts: [],
    skipped: [],
    totalArtifactEntries: 0,
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
      scannedArtifacts: [...state.scannedArtifacts].sort((left, right) => left.path.localeCompare(right.path)),
      skipped: state.skipped
    },
    findings: state.findings,
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    limitations: [
      "Static pattern scan only; it does not prove that external code is safe.",
      "The scan reads local files that already exist on disk.",
      "The scan does not download packages, clone repositories, extract artifacts to disk, install dependencies or execute code.",
      "Archive scanning is bounded and in-memory; unsupported, encrypted, zip64 or oversized members are skipped.",
      "Deep artifact validation should run in an isolated sandbox when package bytes are not already present locally."
    ],
    mode: "local-static",
    nextStep: "review_findings_before_install",
    summary: {
      artifactCount: state.scannedArtifacts.length,
      artifactEntryCount: state.totalArtifactEntries,
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
    `artifacts: ${report.summary.artifactCount} scanned, ${report.summary.artifactEntryCount} entries inspected`,
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
  const artifactType = artifactTypeForPath(rel);
  if (artifactType) {
    await scanArtifactFile(absolutePath, rel, artifactType, state);
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
  if (basename(rel) === "pyproject.toml") {
    scanPyProjectToml(rel, content, state);
  }
  if (basename(rel) === "setup.py" || basename(rel) === "setup.cfg") {
    scanPythonSetupFile(rel, content, state);
  }
  scanTextRules(rel, content, state);
}

async function scanArtifactFile(
  absolutePath: string,
  rel: string,
  type: DeepScanArtifactType,
  state: ScanState
): Promise<void> {
  const stat = await lstat(absolutePath);
  if (stat.size > state.maxArtifactBytes) {
    state.skipped.push({ path: rel, reason: `artifact exceeds ${state.maxArtifactBytes} byte scan limit` });
    return;
  }

  let scannedEntries = 0;
  let skippedEntries = 0;
  const scanEntry = (entryName: string, content: Buffer): void => {
    const result = scanVirtualArtifactEntry(rel, entryName, content, state, 0);
    if (result === "scanned") {
      scannedEntries += 1;
    } else if (result === "skipped") {
      skippedEntries += 1;
    }
  };
  const skipEntry = (entryName: string, reason: string): void => {
    skippedEntries += 1;
    if (state.skipped.length < state.maxFiles) {
      state.skipped.push({ path: `${rel}!${entryName}`, reason });
    }
    if (/encrypted|zip64|data descriptor|unsafe|exceeds|limit|could not be parsed/i.test(reason)) {
      addFinding(state, {
        category: "artifact-scan-limit",
        evidence: `${entryName || "."}: ${reason}`,
        file: rel,
        recommendation: "Review unsupported or intentionally hard-to-scan archive entries before allowing install execution.",
        severity: "medium"
      });
    }
  };

  try {
    const buffer = await readFile(absolutePath);
    if (type === "tar") {
      scanTarArtifact(buffer, scanEntry, skipEntry, state.maxArtifactEntries);
    } else if (type === "tar.gz" || type === "tgz") {
      scanTarArtifact(gunzipSync(buffer, { maxOutputLength: state.maxArtifactBytes }), scanEntry, skipEntry, state.maxArtifactEntries);
    } else {
      scanZipArtifact(buffer, scanEntry, skipEntry, state.maxArtifactEntries, state.maxBytesPerFile);
    }
  } catch {
    state.skipped.push({ path: rel, reason: "artifact could not be parsed as a supported archive" });
    return;
  }

  state.totalArtifactEntries += scannedEntries;
  state.scannedArtifacts.push({ path: rel, scannedEntries, skippedEntries, type });
}

function scanVirtualArtifactEntry(
  artifactPath: string,
  entryName: string,
  content: Buffer,
  state: ScanState,
  depth: number
): "ignored" | "scanned" | "skipped" {
  const safePath = safeArtifactEntryPath(entryName);
  if (!safePath) {
    state.skipped.push({ path: `${artifactPath}!${entryName}`, reason: "unsafe archive entry path skipped" });
    return "skipped";
  }
  const nestedType = artifactTypeForPath(safePath);
  if (nestedType) {
    return scanNestedArtifactEntry(artifactPath, safePath, content, nestedType, state, depth);
  }
  if (!shouldScanFile(safePath)) {
    return "ignored";
  }
  if (state.scanned.length >= state.maxFiles) {
    state.skipped.push({ path: `${artifactPath}!${safePath}`, reason: "max file scan limit reached" });
    return "skipped";
  }
  if (content.byteLength > state.maxBytesPerFile) {
    state.skipped.push({ path: `${artifactPath}!${safePath}`, reason: `artifact entry exceeds ${state.maxBytesPerFile} byte scan limit` });
    return "skipped";
  }
  const text = content.toString("utf8");
  if (text.includes("\u0000")) {
    state.skipped.push({ path: `${artifactPath}!${safePath}`, reason: "artifact entry is not plain utf8 text" });
    return "skipped";
  }
  const virtualPath = `${artifactPath}!${safePath}`;
  state.scanned.push(virtualPath);
  if (isManifestFile(safePath)) {
    state.matchedManifests.add(virtualPath);
  }
  if (basename(safePath) === "package.json") {
    scanPackageJson(virtualPath, text, state);
  }
  if (basename(safePath) === "pyproject.toml") {
    scanPyProjectToml(virtualPath, text, state);
  }
  if (basename(safePath) === "setup.py" || basename(safePath) === "setup.cfg") {
    scanPythonSetupFile(virtualPath, text, state);
  }
  scanTextRules(virtualPath, text, state);
  return "scanned";
}

function scanNestedArtifactEntry(
  artifactPath: string,
  safePath: string,
  content: Buffer,
  type: DeepScanArtifactType,
  state: ScanState,
  depth: number
): "scanned" | "skipped" {
  const nestedPath = `${artifactPath}!${safePath}`;
  if (depth >= 1) {
    state.skipped.push({ path: nestedPath, reason: "nested artifact scan depth limit reached" });
    addFinding(state, {
      category: "nested-artifact-depth",
      evidence: "Nested package artifact exceeds scan depth limit.",
      file: nestedPath,
      recommendation: "Review nested artifacts manually before allowing package execution.",
      severity: "medium"
    });
    return "skipped";
  }
  if (content.byteLength > state.maxArtifactBytes) {
    state.skipped.push({ path: nestedPath, reason: `nested artifact exceeds ${state.maxArtifactBytes} byte scan limit` });
    addFinding(state, {
      category: "artifact-scan-limit",
      evidence: "Nested artifact exceeds scan size limit.",
      file: nestedPath,
      recommendation: "Review large nested artifacts manually before allowing package execution.",
      severity: "medium"
    });
    return "skipped";
  }
  let scannedEntries = 0;
  let skippedEntries = 0;
  const scanEntry = (entryName: string, entryContent: Buffer): void => {
    const result = scanVirtualArtifactEntry(nestedPath, entryName, entryContent, state, depth + 1);
    if (result === "scanned") scannedEntries += 1;
    else if (result === "skipped") skippedEntries += 1;
  };
  const skipEntry = (entryName: string, reason: string): void => {
    skippedEntries += 1;
    state.skipped.push({ path: `${nestedPath}!${entryName}`, reason });
    addFinding(state, {
      category: "artifact-scan-limit",
      evidence: `${entryName || "."}: ${reason}`,
      file: nestedPath,
      recommendation: "Review skipped nested archive entries before allowing package execution.",
      severity: "medium"
    });
  };
  try {
    if (type === "tar") {
      scanTarArtifact(content, scanEntry, skipEntry, state.maxArtifactEntries);
    } else if (type === "tar.gz" || type === "tgz") {
      scanTarArtifact(gunzipSync(content, { maxOutputLength: state.maxArtifactBytes }), scanEntry, skipEntry, state.maxArtifactEntries);
    } else {
      scanZipArtifact(content, scanEntry, skipEntry, state.maxArtifactEntries, state.maxBytesPerFile);
    }
  } catch {
    state.skipped.push({ path: nestedPath, reason: "nested artifact could not be parsed as a supported archive" });
    addFinding(state, {
      category: "artifact-scan-limit",
      evidence: "Nested artifact could not be parsed.",
      file: nestedPath,
      recommendation: "Review unparsable nested artifacts manually before allowing package execution.",
      severity: "medium"
    });
    return "skipped";
  }
  state.totalArtifactEntries += scannedEntries;
  state.scannedArtifacts.push({ path: nestedPath, scannedEntries, skippedEntries, type });
  return "scanned";
}

function scanTarArtifact(
  buffer: Buffer,
  scanEntry: (entryName: string, content: Buffer) => void,
  skipEntry: (entryName: string, reason: string) => void,
  maxEntries: number
): void {
  let offset = 0;
  let entries = 0;
  while (offset + 512 <= buffer.length && entries < maxEntries) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      break;
    }
    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const entryName = [prefix, name].filter(Boolean).join("/");
    const size = readTarOctal(header, 124, 12);
    const typeFlag = String.fromCharCode(header[156] ?? 0).replace(/\0/g, "");
    const contentStart = offset + 512;
    const contentEnd = contentStart + size;
    if (!entryName || contentEnd > buffer.length) {
      skipEntry(entryName || ".", "invalid tar entry skipped");
      break;
    }
    if (typeFlag && typeFlag !== "0") {
      skipEntry(entryName, "non-regular tar entry skipped");
    } else {
      scanEntry(entryName, buffer.subarray(contentStart, contentEnd));
    }
    entries += 1;
    offset = contentStart + Math.ceil(size / 512) * 512;
  }
}

function scanZipArtifact(
  buffer: Buffer,
  scanEntry: (entryName: string, content: Buffer) => void,
  skipEntry: (entryName: string, reason: string) => void,
  maxEntries: number,
  maxOutputLength: number
): void {
  let offset = 0;
  let entries = 0;
  while (offset + 30 <= buffer.length && entries < maxEntries) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) {
      break;
    }
    const flags = buffer.readUInt16LE(offset + 6);
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    const entryName = buffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
    if ((flags & 1) === 1) {
      skipEntry(entryName, "encrypted zip entry skipped");
    } else if ((flags & 8) === 8 || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      skipEntry(entryName, "zip data descriptor or zip64 entry skipped");
    } else if (dataEnd > buffer.length) {
      skipEntry(entryName, "invalid zip entry skipped");
      break;
    } else if (uncompressedSize > maxOutputLength) {
      skipEntry(entryName, `zip entry exceeds ${maxOutputLength} byte uncompressed scan limit`);
    } else if (method === 0) {
      scanEntry(entryName, buffer.subarray(dataStart, dataEnd));
    } else if (method === 8) {
      try {
        scanEntry(entryName, inflateRawSync(buffer.subarray(dataStart, dataEnd), { maxOutputLength }));
      } catch {
        skipEntry(entryName, "zip entry could not be inflated within scan limits");
      }
    } else {
      skipEntry(entryName, "unsupported zip compression method skipped");
    }
    entries += 1;
    offset = dataEnd;
  }
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
    if ((!LIFECYCLE_SCRIPTS.has(name) && !LIFECYCLE_SCRIPTS.has(name.toLowerCase())) || typeof value !== "string") {
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

function scanPyProjectToml(file: string, content: string, state: ScanState): void {
  if (/\bbackend-path\s*=/i.test(content)) {
    addFinding(state, {
      category: "python-build-backend-risk",
      evidence: "pyproject.toml declares backend-path.",
      file,
      recommendation: "Review local build backend paths before allowing source installs.",
      severity: "medium"
    });
  }
  const backend = content.match(/\bbuild-backend\s*=\s*["']([^"']+)["']/i)?.[1];
  if (backend && !/^(setuptools\.build_meta|hatchling\.build|flit_core\.buildapi|poetry\.core\.masonry\.api)$/.test(backend)) {
    addFinding(state, {
      category: "python-build-backend-risk",
      evidence: `pyproject.toml declares custom build-backend ${compact(backend)}.`,
      file,
      recommendation: "Review custom Python build backends because building from source can execute backend code.",
      severity: "medium"
    });
  }
}

function scanPythonSetupFile(file: string, content: string, state: ScanState): void {
  if (/\bcmdclass\s*=|\bsetup_requires\s*=/i.test(content)) {
    addFinding(state, {
      category: "python-build-backend-risk",
      evidence: "setup file declares cmdclass or setup_requires.",
      file,
      recommendation: "Review setup-time Python hooks before allowing a package build.",
      severity: "high"
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
    },
    {
      evidence:
        state.scannedArtifacts.length > 0
          ? `${state.scannedArtifacts.length} local artifact(s) scanned in memory with ${state.totalArtifactEntries} text entries inspected.`
          : "No supported local package artifacts found.",
      id: "artifact-coverage",
      label: "Artifact coverage",
      status: state.scannedArtifacts.length > 0 ? "pass" : "missing"
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

function artifactTypeForPath(path: string): DeepScanArtifactType | null {
  const normalized = path.toLowerCase();
  if (normalized.endsWith(".tar.gz")) return "tar.gz";
  if (normalized.endsWith(".tgz")) return "tgz";
  if (normalized.endsWith(".whl")) return "whl";
  if (normalized.endsWith(".zip")) return "zip";
  if (normalized.endsWith(".tar")) return "tar";
  return null;
}

function safeArtifactEntryPath(path: string): string | null {
  if (!path || path.includes("\0") || path.startsWith("/") || /^[a-z]:/i.test(path) || path.includes("\\")) {
    return null;
  }
  const parts = path.split("/");
  if (parts.some((part) => part === ".." || part === "")) {
    return null;
  }
  return parts.join("/");
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

function readTarString(buffer: Buffer, offset: number, length: number): string {
  return buffer
    .subarray(offset, offset + length)
    .toString("utf8")
    .replace(/\0.*$/u, "")
    .trim();
}

function readTarOctal(buffer: Buffer, offset: number, length: number): number {
  const value = readTarString(buffer, offset, length).replace(/[^0-7]/g, "");
  return value ? Number.parseInt(value, 8) : 0;
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_EVIDENCE_LENGTH);
}
