#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const ARCHIVE_ENTRY_LIMIT = 1024 * 1024;
const ARCHIVE_SUFFIXES = [".tgz"];
const ARCHIVE_TEXT_ENTRY = /\.(?:cjs|css|env|html|js|json|jsx|mjs|md|sh|toml|ts|tsx|txt|yaml|yml)$/i;

const SECRET_PATTERNS = [
  {
    type: "cloudflare-token",
    pattern: /\bCLOUDFLARE_API_TOKEN\s*=\s*["']?[A-Za-z0-9_-]{20,}/
  },
  {
    type: "fly-token",
    pattern: /\bFLY_API_TOKEN\s*=\s*["']?(?:FlyV1\s+)?[A-Za-z0-9._:-]{20,}/
  },
  {
    type: "private-key",
    pattern: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/
  },
  {
    type: "github-token",
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}\b/
  },
  {
    type: "npm-token",
    pattern: /\bnpm_[A-Za-z0-9_]{30,}\b/
  },
  {
    type: "bearer-token",
    pattern: /\bAuthorization\s*:\s*Bearer\s+[A-Za-z0-9._~+/=-]{20,}/i
  },
  {
    type: "generic-secret-assignment",
    pattern:
      /\b(?:API_TOKEN|AUTH_TOKEN|BEARER_TOKEN|GITHUB_TOKEN|NPM_TOKEN|PRIVATE_KEY|SECRET|SIGNING_PRIVATE_KEY|TOKEN|VERCEL_TOKEN)\s*=\s*["']?[A-Za-z0-9._~+/=-]{24,}|["'](?:apiToken|authToken|bearerToken|githubToken|npmToken|privateKey|secret|signingPrivateKey|token|vercelToken)["']\s*:\s*["'][A-Za-z0-9._~+/=-]{24,}["']/i
  }
];

const SKIP_SEGMENTS = new Set([
  ".git",
  ".gitlawb-bin",
  ".next",
  ".vercel",
  "dist",
  "node_modules",
  "probe-work",
  "target"
]);

const SKIP_SUFFIXES = [
  ".env.local",
  ".tsbuildinfo",
  ".zip"
];

export function scanTextForSecrets(path, text) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (const [lineIndex, line] of lines.entries()) {
    for (const { type, pattern } of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        findings.push({
          line: lineIndex + 1,
          path,
          type
        });
      }
    }
  }
  return findings;
}

export function shouldSkipPath(path) {
  const normalized = path.replaceAll("\\", "/").replace(/^\.\//, "");
  const segments = normalized.split("/");
  if (SKIP_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) {
    return true;
  }
  if (/\.env\.[^.]+\.local$/.test(normalized)) {
    return true;
  }
  if (segments[0] === ".nipmod") {
    return true;
  }
  if (segments.some((segment) => SKIP_SEGMENTS.has(segment))) {
    return true;
  }
  if (/(^|\/).*identity.*\.json$/.test(normalized)) {
    return false;
  }
  return false;
}

export async function scanFiles(paths, { root = process.cwd() } = {}) {
  const findings = [];
  for (const path of paths) {
    const displayPath = relative(root, path).replaceAll("\\", "/") || path;
    if (isArchivePath(displayPath)) {
      findings.push(...scanArchiveForSecrets(path, displayPath));
      continue;
    }
    if (shouldSkipPath(displayPath)) {
      continue;
    }
    let text;
    try {
      text = await readFile(path, "utf8");
    } catch {
      continue;
    }
    findings.push(...scanTextForSecrets(displayPath, text));
  }
  return findings;
}

function isArchivePath(path) {
  const normalized = path.replaceAll("\\", "/");
  return ARCHIVE_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

function isArchiveTextEntry(entry) {
  const normalized = entry.replaceAll("\\", "/");
  const basename = normalized.split("/").at(-1) ?? "";
  return ARCHIVE_TEXT_ENTRY.test(normalized) || basename.startsWith(".env");
}

function scanArchiveForSecrets(path, displayPath) {
  const list = spawnSync("tar", ["-tzf", path], {
    encoding: "utf8",
    maxBuffer: ARCHIVE_ENTRY_LIMIT
  });
  if (list.status !== 0) {
    return [];
  }

  const findings = [];
  for (const entry of list.stdout.split(/\r?\n/).filter(Boolean)) {
    if (!isArchiveTextEntry(entry)) {
      continue;
    }
    const extracted = spawnSync("tar", ["-xOf", path, entry], {
      encoding: "utf8",
      maxBuffer: ARCHIVE_ENTRY_LIMIT
    });
    if (extracted.status !== 0 || extracted.error) {
      continue;
    }
    findings.push(...scanTextForSecrets(`${displayPath}!${entry}`, extracted.stdout));
  }
  return findings;
}

function listWorkspaceFiles() {
  const result = spawnSync("find", [
    ".",
    "(",
    "-name",
    "node_modules",
    "-o",
    "-name",
    ".git",
    "-o",
    "-name",
    ".next",
    "-o",
    "-name",
    "dist",
    "-o",
    "-name",
    "target",
    ")",
    "-prune",
    "-o",
    "-type",
    "f",
    "-print"
  ], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "failed to list files");
  }
  return result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((path) => path.replace(/^\.\//, ""));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const files = listWorkspaceFiles();
  scanFiles(files)
    .then((findings) => {
      if (findings.length === 0) {
        console.log("secret scan passed");
        return;
      }
      for (const finding of findings) {
        console.error(`${finding.path}:${finding.line} ${finding.type}`);
      }
      process.exit(1);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
