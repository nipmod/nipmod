#!/usr/bin/env node
import { readFileSync } from "node:fs";

type ExternalPackageSource = "npm" | "pypi" | "github" | "huggingface-model" | "huggingface-dataset" | "mcp";

interface SeedTarget {
  name: string;
  reason: string;
  source: ExternalPackageSource;
}

const seedTargets: SeedTarget[] = [
  { source: "npm", name: "react", reason: "Common frontend package used to verify npm search, inspect and install-plan flow." },
  { source: "npm", name: "undici", reason: "Node HTTP client used in public API examples." },
  { source: "pypi", name: "requests", reason: "Common Python HTTP package used to verify PyPI resolver flow." },
  { source: "github", name: "vercel/next.js", reason: "Large public source repo used to verify GitHub resolver flow." },
  { source: "huggingface-model", name: "bert-base-uncased", reason: "Common model record used to verify Hugging Face model resolver flow." },
  { source: "huggingface-dataset", name: "squad", reason: "Common dataset record used to verify Hugging Face dataset resolver flow." },
  { source: "mcp", name: "ac.tandem/docs-mcp", reason: "Public MCP server record used to verify MCP Registry resolver flow." }
];

const write = process.argv.includes("--write");
const envFile = valueAfter("--env-file");
if (envFile) {
  loadEnvFile(envFile);
}
const baseUrl = process.env.NIPMOD_API_BASE_URL ?? "https://nipmod.com";
const archiveToken = process.env.NIPMOD_ARCHIVE_WRITE_TOKEN ?? "";
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
    message: `${target.reason} Confirmed as a public beta package intelligence seed after source inspection.`,
    name: target.name,
    source: target.source
  };
  const response = await postJson("/api/archive/confirm", body, write ? { "x-nipmod-archive-token": archiveToken } : {});

  results.push({
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
    rejected: results.filter((result) => result.status === "rejected").length,
    stored: results.filter((result) => result.status === "stored").length,
    total: results.length
  },
  type: "dev.nipmod.package-intelligence-seed.v1"
}, null, 2));

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
    const match = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(trimmed);
    if (!match) {
      continue;
    }
    const [, key, rawValue] = match;
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    process.env[key] = value;
  }
}
