#!/usr/bin/env node
import { fileURLToPath } from "node:url";

const DEFAULT_BASE_URL = "https://nipmod.com";

const DEFAULT_CANARIES = [
  {
    expectBlocked: false,
    name: "npm install-plan boundary",
    path: "/api/install-plan?source=npm&name=undici",
    source: "npm"
  },
  {
    expectBlocked: false,
    name: "PyPI install-plan boundary",
    path: "/api/install-plan?source=pypi&name=requests",
    source: "pypi"
  },
  {
    expectBlocked: false,
    name: "GitHub install-plan boundary",
    path: "/api/install-plan?source=github&name=vercel/next.js",
    source: "github"
  },
  {
    expectBlocked: false,
    name: "Hugging Face model install-plan boundary",
    path: "/api/install-plan?source=huggingface-model&name=bert-base-uncased",
    source: "huggingface-model"
  },
  {
    expectBlocked: false,
    name: "Hugging Face dataset install-plan boundary",
    path: "/api/install-plan?source=huggingface-dataset&name=squad",
    source: "huggingface-dataset"
  },
  {
    expectBlocked: false,
    name: "MCP install-plan boundary",
    path: "/api/install-plan?source=mcp&name=ac.tandem/docs-mcp",
    source: "mcp"
  }
] as const;

export async function runInstallPlanCanary({
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
      const data = assertInstallPlanPayload(payload, canary);
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

export function assertInstallPlanPayload(payload: unknown, canary: { expectBlocked?: boolean; source: string }) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("install-plan response must be an object");
  }

  const planPayload = payload as Record<string, any>;
  if (planPayload.type !== "dev.nipmod.external-install-plan.v1") {
    throw new Error(`install-plan response type mismatch for ${canary.source}`);
  }

  const packageRecord = planPayload.package;
  if (!packageRecord || typeof packageRecord !== "object") {
    throw new Error(`install-plan package missing for ${canary.source}`);
  }
  if (packageRecord.source !== canary.source) {
    throw new Error(`source mismatch: expected ${canary.source}, got ${packageRecord.source ?? "unknown"}`);
  }
  if (typeof packageRecord.id !== "string" || !packageRecord.id.startsWith(`${canary.source}:`)) {
    throw new Error(`package id must use source prefix ${canary.source}:`);
  }

  assertTrust(packageRecord.trust, packageRecord.id);

  const plan = planPayload.plan;
  if (!plan || typeof plan !== "object") {
    throw new Error(`install-plan.plan missing for ${packageRecord.id}`);
  }
  if (plan.requiresApprovalBeforeWrite !== true) {
    throw new Error(`plan.requiresApprovalBeforeWrite must be true for ${packageRecord.id}`);
  }
  if (!Array.isArray(plan.writes) || plan.writes.length !== 0) {
    throw new Error(`hosted install plan must not declare workspace writes for ${packageRecord.id}`);
  }
  if (!Array.isArray(plan.commands) || plan.commands.length === 0) {
    throw new Error(`install commands missing for ${packageRecord.id}`);
  }
  if (!Array.isArray(plan.commandDetails) || plan.commandDetails.length !== plan.commands.length) {
    throw new Error(`commandDetails must exist for every command in ${packageRecord.id}`);
  }

  const safety = planPayload.safety;
  if (!safety || typeof safety !== "object") {
    throw new Error(`install-plan.safety missing for ${packageRecord.id}`);
  }
  if (safety.requiresApprovalBeforeWrite !== true) {
    throw new Error(`safety.requiresApprovalBeforeWrite must be true for ${packageRecord.id}`);
  }
  if (safety.metadataIsInstruction !== false) {
    throw new Error(`package metadata must not be treated as instruction for ${packageRecord.id}`);
  }
  if (typeof canary.expectBlocked === "boolean" && safety.blocked !== canary.expectBlocked) {
    throw new Error(`safety.blocked mismatch for ${packageRecord.id}: expected ${canary.expectBlocked}, got ${safety.blocked}`);
  }
  if (!["low", "medium", "high"].includes(safety.commandRisk)) {
    throw new Error(`unknown command risk for ${packageRecord.id}: ${String(safety.commandRisk)}`);
  }

  for (const [index, detail] of plan.commandDetails.entries()) {
    assertCommandDetail(detail, plan.commands[index], packageRecord.id, Boolean(safety.blocked));
  }

  return {
    blocked: safety.blocked,
    commandCount: plan.commandDetails.length,
    commandRisk: safety.commandRisk,
    decision: packageRecord.trust?.decision ?? null,
    id: packageRecord.id,
    score: packageRecord.trust?.score ?? null,
    source: packageRecord.source
  };
}

function assertTrust(trust: Record<string, any>, id: string) {
  if (!trust || typeof trust !== "object") {
    throw new Error(`trust object missing for ${id}`);
  }
  if (!Number.isFinite(trust.score) || trust.score < 0 || trust.score > 100) {
    throw new Error(`trust score out of range for ${id}`);
  }
  if (!["recommended", "usable_with_warning", "avoid"].includes(trust.decision)) {
    throw new Error(`trust decision mismatch for ${id}: ${String(trust.decision)}`);
  }
  if (!Array.isArray(trust.factors) || trust.factors.length === 0) {
    throw new Error(`trust factors missing for ${id}`);
  }
  if (!trust.factors.some((factor: Record<string, any>) => factor?.category === "install")) {
    throw new Error(`install trust factor missing for ${id}`);
  }
  if (!trust.policy || trust.policy.version !== "external-v2") {
    throw new Error(`trust policy version mismatch for ${id}`);
  }
}

function assertCommandDetail(detail: Record<string, any>, command: string, id: string, planBlocked: boolean) {
  if (!detail || typeof detail !== "object") {
    throw new Error(`command detail missing for ${id}`);
  }
  if (detail.command !== command) {
    throw new Error(`command detail does not match command list for ${id}`);
  }
  if (detail.hostedApiExecutes !== false) {
    throw new Error(`hosted API must never execute install commands for ${id}`);
  }
  if (detail.metadataIsInstruction !== false) {
    throw new Error(`install command metadata must not become agent instruction for ${id}`);
  }
  if (detail.requiresApprovalBeforeWrite !== true) {
    throw new Error(`command must require approval before workspace write for ${id}`);
  }
  if (!["low", "medium", "high"].includes(detail.risk)) {
    throw new Error(`unknown command detail risk for ${id}: ${String(detail.risk)}`);
  }

  if (detail.risk === "high" || detail.blocked === true || planBlocked) {
    if (!["blocked-high-risk-command", "blocked-source-risk"].includes(detail.boundary) || detail.blocked !== true) {
      throw new Error(`unsafe install plan must be blocked for ${id}`);
    }
    return;
  }

  if (detail.boundary !== "manual-after-user-approval") {
    throw new Error(`safe command boundary mismatch for ${id}: ${String(detail.boundary)}`);
  }
  if (detail.blocked !== false) {
    throw new Error(`safe command must not be marked blocked for ${id}`);
  }
}

async function fetchJson(url: string, fetchFn: typeof fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetchFn(url, {
      headers: {
        accept: "application/json",
        "user-agent": "nipmod-install-plan-canary/1.2.5 (+https://nipmod.com)"
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

function result({ baseUrl, checks, startedAt }: { baseUrl: string; checks: Array<Record<string, unknown>>; startedAt: number }) {
  const summary = {
    fail: checks.filter((check) => check.status === "fail").length,
    pass: checks.filter((check) => check.status === "pass").length,
    total: checks.length
  };
  return {
    baseUrl,
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    formatVersion: 1,
    ok: summary.fail === 0,
    summary,
    checks,
    type: "dev.nipmod.install-plan-canary.v1"
  };
}

function optionValue(name: string): string | undefined {
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
  const output = await runInstallPlanCanary({
    baseUrl: optionValue("--base-url") ?? process.env.NIPMOD_CANARY_BASE_URL ?? DEFAULT_BASE_URL
  });
  console.log(JSON.stringify(output, null, 2));
  if (!output.ok) {
    process.exitCode = 1;
  }
}
