#!/usr/bin/env node
import { fileURLToPath } from "node:url";

const DEFAULT_BASE_URL = "https://nipmod.com";

const DEFAULT_CANARIES = [
  {
    name: "npm package depth",
    path: "/api/inspect?source=npm&name=undici",
    requiredEvidenceIds: [
      "npm.manifest.latest",
      "npm.tarball.integrity",
      "npm.registry.signature",
      "npm.packument.versions",
      "npm.dist_tags",
      "npm.version_intelligence",
      "npm.osv",
      "npm.artifact_shape",
      "npm.lifecycle"
    ],
    requiredDimensions: {
      provenanceStatus: "signature",
      securityConfidence: "high"
    },
    requiredSignals: [
      "Latest tarball integrity metadata is present",
      "npm registry signature metadata is present",
      "Latest npm tarball host:",
      "Latest npm release file count:",
      "npm latest publish age hours:",
      "OSV",
      "maintainer records",
      "Node engine"
    ],
    source: "npm"
  },
  {
    name: "PyPI package depth",
    path: "/api/inspect?source=pypi&name=requests",
    requiredEvidenceIds: [
      "pypi.project.json",
      "pypi.vulnerabilities",
      "pypi.osv",
      "pypi.release.files",
      "pypi.file.digests",
      "pypi.simple.provenance",
      "pypi.core_metadata",
      "pypi.release_shape",
      "pypi.yanked",
      "pypi.requires_python",
      "pypi.version_intelligence",
      "pypi.release_history"
    ],
    requiredDimensions: {
      provenanceStatus: "attested"
    },
    requiredSignals: [
      "PyPI returned no vulnerabilities",
      "OSV",
      "PyPI latest release files returned",
      "digest metadata",
      "PyPI simple API provenance links returned",
      "PyPI simple API core metadata hashes returned",
      "PyPI latest release file types:",
      "PyPI latest release files are not marked yanked.",
      "requires-python",
      "PyPI latest publish age hours:"
    ],
    source: "pypi"
  },
  {
    name: "GitHub repository depth",
    path: "/api/inspect?source=github&name=vercel/next.js",
    requiredEvidenceIds: [
      "github.repo.metadata",
      "github.activity",
      "github.default_branch",
      "github.manifests",
      "github.lockfiles",
      "github.security",
      "github.content_risk",
      "github.release_assets",
      "github.default_branch_commit"
    ],
    requiredSignals: [
      "Default branch:",
      "Open issues returned by GitHub:",
      "GitHub forks returned:",
      "GitHub package manifests found:",
      "GitHub package.json declares",
      "GitHub security files",
      "GitHub lockfiles",
      "GitHub workflow/Dockerfile risk",
      "GitHub latest release asset count:",
      "GitHub latest default-branch commit date:",
      "GitHub package.json package manager:"
    ],
    source: "github"
  },
  {
    name: "Hugging Face model depth",
    path: "/api/inspect?source=huggingface-model&name=google-bert/bert-base-uncased",
    requiredEvidenceIds: [
      "hf.card_data",
      "hf.files",
      "hf.readme",
      "hf.config",
      "hf.safetensors",
      "hf.file_shape",
      "hf.remote_code",
      "hf.commit",
      "hf.gated"
    ],
    requiredDimensions: {
      provenanceStatus: "integrity"
    },
    requiredSignals: [
      "Hugging Face repository files returned:",
      "Hugging Face README/model card file",
      "Hugging Face config metadata file",
      "Hugging Face safetensors weight file",
      "Hugging Face pickle/binary weight files",
      "Hugging Face commit digest metadata is present",
      "Hugging Face gated access flag"
    ],
    source: "huggingface-model"
  },
  {
    name: "Hugging Face dataset depth",
    path: "/api/inspect?source=huggingface-dataset&name=rajpurkar/squad",
    requiredEvidenceIds: [
      "hf.card_data",
      "hf.dataset_info",
      "hf.dataset_features",
      "hf.dataset_splits",
      "hf.files",
      "hf.dataset_files",
      "hf.readme",
      "hf.commit",
      "hf.gated",
      "hf.script_files"
    ],
    requiredDimensions: {
      provenanceStatus: "integrity"
    },
    requiredSignals: [
      "Hugging Face repository files returned:",
      "Hugging Face commit digest metadata is present",
      "Hugging Face gated access flag"
    ],
    source: "huggingface-dataset"
  },
  {
    name: "MCP registry depth",
    path: "/api/inspect?source=mcp&name=ac.tandem/docs-mcp",
    requiredEvidenceIds: [
      "mcp.registry.status",
      "mcp.schema",
      "mcp.remote_endpoints",
      "mcp.endpoint_security",
      "mcp.env_requirements",
      "mcp.credential_scope",
      "mcp.source_repo",
      "mcp.transport"
    ],
    requiredSignals: [
      "MCP Registry status:",
      "MCP schema URL",
      "Remote MCP endpoints returned:",
      "MCP remote endpoint HTTPS count:",
      "MCP server",
      "Source repository is present"
    ],
    source: "mcp"
  }
];

export async function runSourceDepthCanary({
  baseUrl = DEFAULT_BASE_URL,
  canaries = DEFAULT_CANARIES,
  fetchFn = fetch
} = {}) {
  const startedAt = Date.now();
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const checks = [];

  for (const canary of canaries) {
    const startedCheckAt = Date.now();
    try {
      const payload = await fetchJson(`${normalizedBaseUrl}${canary.path}`, fetchFn);
      const data = assertDepthPayload(payload, canary);
      checks.push({
        data,
        durationMs: Date.now() - startedCheckAt,
        name: canary.name,
        status: "pass"
      });
    } catch (error) {
      checks.push({
        durationMs: Date.now() - startedCheckAt,
        error: error instanceof Error ? error.message : String(error),
        name: canary.name,
        status: "fail"
      });
    }
  }

  return result({ baseUrl: normalizedBaseUrl, checks, startedAt });
}

function assertDepthPayload(payload, canary) {
  if (payload?.type !== "dev.nipmod.external-inspect.v1") {
    throw new Error(`inspect response type mismatch for ${canary.source}`);
  }
  const record = payload.record;
  if (record?.type !== "dev.nipmod.external-package.v1") {
    throw new Error(`external record missing for ${canary.source}`);
  }
  if (record.source !== canary.source) {
    throw new Error(`source mismatch: expected ${canary.source}, got ${record.source ?? "unknown"}`);
  }

  const signals = Array.isArray(record.trust?.signals) ? record.trust.signals : [];
  if (signals.length === 0) {
    throw new Error(`trust signals missing for ${record.id ?? canary.source}`);
  }
  for (const requiredSignal of canary.requiredSignals) {
    if (!signals.some((signal) => typeof signal === "string" && signal.includes(requiredSignal))) {
      throw new Error(`missing depth signal for ${record.id ?? canary.source}: ${requiredSignal}`);
    }
  }

  const sourceEvidence = record.sourceEvidence;
  if (sourceEvidence?.version !== "source-evidence-v1") {
    throw new Error(`sourceEvidence missing for ${record.id ?? canary.source}`);
  }
  if (!Number.isFinite(sourceEvidence.depthScore) || sourceEvidence.depthScore < 0 || sourceEvidence.depthScore > 100) {
    throw new Error(`sourceEvidence depthScore out of range for ${record.id ?? canary.source}`);
  }
  const evidenceChecks = Array.isArray(sourceEvidence.checks) ? sourceEvidence.checks : [];
  const evidenceById = new Map(evidenceChecks.map((check) => [check?.id, check]));
  for (const requiredEvidenceId of canary.requiredEvidenceIds ?? []) {
    const check = evidenceById.get(requiredEvidenceId);
    if (!check) {
      throw new Error(`missing sourceEvidence check for ${record.id ?? canary.source}: ${requiredEvidenceId}`);
    }
    if (check.status === "missing") {
      throw new Error(`sourceEvidence check missing evidence for ${record.id ?? canary.source}: ${requiredEvidenceId}`);
    }
  }

  const score = record.trust?.score;
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error(`trust score out of range for ${record.id ?? canary.source}`);
  }

  const factors = Array.isArray(record.trust?.factors) ? record.trust.factors : [];
  if (!factors.some((factor) => factor?.category === "install" && factor?.impact === "positive")) {
    throw new Error(`install-plan trust factor missing for ${record.id ?? canary.source}`);
  }

  const dimensions = record.trust?.dimensions ?? {};
  if (canary.requiredDimensions) {
    for (const [key, expected] of Object.entries(canary.requiredDimensions)) {
      if (dimensions[key] !== expected) {
        throw new Error(`dimension ${key} mismatch for ${record.id ?? canary.source}: expected ${expected}, got ${dimensions[key] ?? "unknown"}`);
      }
    }
  }

  return {
    decision: record.trust?.decision ?? null,
    id: record.id,
    requiredEvidenceIds: canary.requiredEvidenceIds?.length ?? 0,
    requiredSignals: canary.requiredSignals.length,
    score,
    sourceDepthScore: sourceEvidence.depthScore,
    source: record.source
  };
}

async function fetchJson(url, fetchFn) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetchFn(url, {
      headers: {
        accept: "application/json",
        "user-agent": "nipmod-source-depth-canary/1.2.9 (+https://nipmod.com)"
      },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`${url} returned ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function result({ baseUrl, checks, startedAt }) {
  const summary = {
    fail: checks.filter((check) => check.status === "fail").length,
    pass: checks.filter((check) => check.status === "pass").length,
    total: checks.length
  };
  return {
    baseUrl,
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    formatVersion: 2,
    ok: summary.fail === 0,
    summary,
    checks,
    type: "dev.nipmod.source-depth-canary.v2"
  };
}

function optionValue(name) {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }
  const index = process.argv.indexOf(name);
  if (index !== -1) {
    return process.argv[index + 1];
  }
  return undefined;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const output = await runSourceDepthCanary({
    baseUrl: optionValue("--base-url") ?? process.env.NIPMOD_CANARY_BASE_URL ?? DEFAULT_BASE_URL
  });
  console.log(JSON.stringify(output, null, 2));
  if (!output.ok) {
    process.exitCode = 1;
  }
}
