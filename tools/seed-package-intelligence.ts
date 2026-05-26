#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { canaryAuthHeaders, readCanaryApiKey } from "./canary-auth.ts";

type ExternalPackageSource = "npm" | "pypi" | "github" | "huggingface-model" | "huggingface-dataset" | "mcp";

interface SeedTarget {
  category: "api-example" | "agent-runtime" | "model-workflow" | "source-context" | "tool-registry";
  name: string;
  reason: string;
  source: ExternalPackageSource;
}

const seedTargets: SeedTarget[] = [
  {
    category: "api-example",
    source: "npm",
    name: "undici",
    reason: "Node HTTP client used in public API examples and canary install-plan checks."
  },
  {
    category: "api-example",
    source: "pypi",
    name: "requests",
    reason: "Python HTTP client used to verify PyPI search, inspect and install-plan flow."
  },
  {
    category: "agent-runtime",
    source: "npm",
    name: "zod",
    reason: "Schema validation package used by agents to validate tool inputs and structured API responses."
  },
  {
    category: "agent-runtime",
    source: "pypi",
    name: "pydantic",
    reason: "Schema validation package used by Python agents for typed request and response boundaries."
  },
  {
    category: "agent-runtime",
    source: "npm",
    name: "playwright",
    reason: "Browser automation package used to test install-plan risk and agent workflow tooling."
  },
  {
    category: "source-context",
    source: "github",
    name: "vercel/next.js",
    reason: "Large public source repository used to verify GitHub resolver source context."
  },
  {
    category: "source-context",
    source: "github",
    name: "modelcontextprotocol/servers",
    reason: "Public MCP server repository used to verify source context for agent tool ecosystems."
  },
  {
    category: "model-workflow",
    source: "huggingface-model",
    name: "google-bert/bert-base-uncased",
    reason: "Common public model record used to verify Hugging Face model source inspection."
  },
  {
    category: "model-workflow",
    source: "huggingface-model",
    name: "sentence-transformers/all-MiniLM-L6-v2",
    reason: "Embedding model record used to verify common agent retrieval and semantic search workflows."
  },
  {
    category: "model-workflow",
    source: "huggingface-dataset",
    name: "rajpurkar/squad",
    reason: "Public dataset record used to verify Hugging Face dataset source inspection."
  },
  {
    category: "tool-registry",
    source: "mcp",
    name: "ac.tandem/docs-mcp",
    reason: "Public MCP server record used to verify MCP Registry resolver and hosted read-only MCP planning."
  }
];

const write = process.argv.includes("--write");
const envFile = valueAfter("--env-file-path") ?? valueAfter("--dotenv");
if (envFile) {
  loadEnvFile(envFile);
}
const baseUrl = process.env.NIPMOD_API_BASE_URL ?? "https://nipmod.com";
const archiveToken = process.env.NIPMOD_ARCHIVE_WRITE_TOKEN ?? "";
const apiKey = await readCanaryApiKey({
  baseUrl: baseUrl.replace(/\/+$/, ""),
  fetchFn: fetch,
  label: "seed-package-intelligence",
  userAgent: "nipmod-seed/1.0"
});
const only = valueAfter("--only");
const targets = only ? seedTargets.filter((target) => `${target.source}:${target.name}` === only || target.name === only) : seedTargets;

if (!targets.length) {
  throw new Error(`no seed target matched ${only}`);
}
if (write && !archiveToken) {
  throw new Error("NIPMOD_ARCHIVE_WRITE_TOKEN is required with --write");
}

const results = [];
for (const target of targets) {
  const body = {
    actor: "nipmod-seed",
    dryRun: !write,
    message: `${target.reason} Confirmed as an API beta package intelligence seed after source inspection.`,
    name: target.name,
    source: target.source
  };
  const response = await postJson("/api/archive/confirm", body, {
    ...canaryAuthHeaders(apiKey),
    ...(write ? { "x-nipmod-archive-token": archiveToken } : {})
  });

  results.push({
    category: target.category,
    errors: response.validation?.errors ?? [],
    id: response.record?.id ?? null,
    name: response.record?.name ?? target.name,
    receipt: response.receipt?.receiptId ?? null,
    source: response.record?.source ?? target.source,
    status: response.stored ? "stored" : response.validation?.ok === false ? "rejected" : "dry-run",
    trustDecision: response.record?.trust?.decision ?? null,
    trustScore: response.record?.trust?.score ?? null,
    warnings: response.validation?.warnings ?? []
  });
}

console.log(JSON.stringify({
  baseUrl,
  checkedAt: new Date().toISOString(),
  dryRun: !write,
  results,
  summary: {
    byCategory: groupCount(results, "category"),
    bySource: groupCount(results, "source"),
    rejected: results.filter((result) => result.status === "rejected").length,
    stored: results.filter((result) => result.status === "stored").length,
    total: results.length
  },
  type: "dev.nipmod.package-intelligence-seed.v1"
}, null, 2));

function groupCount(items: Array<Record<string, unknown>>, key: string): Record<string, number> {
  return items.reduce<Record<string, number>>((accumulator, item) => {
    const value = typeof item[key] === "string" ? item[key] : "unknown";
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});
}

async function postJson(path: string, body: unknown, headers: Record<string, string>): Promise<Record<string, any>> {
  const response = await fetch(new URL(path, baseUrl), {
    body: JSON.stringify(body),
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "nipmod-seed/1.0",
      ...headers
    },
    method: "POST"
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

function valueAfter(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function loadEnvFile(path: string): void {
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const match = /^(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/.exec(trimmed);
    if (!match) {
      continue;
    }
    const [, key, rawValue] = match;
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    process.env[key] = value;
  }
}
