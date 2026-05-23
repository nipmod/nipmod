#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_BASE_URL = "https://nipmod.com";
const REQUIRED_ENV = ["NIPMOD_ARCHIVE_SUPABASE_URL", "NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY"];

export async function runRateLimitCanary({
  baseUrl = DEFAULT_BASE_URL,
  env = process.env,
  fetchFn = fetch,
  now = new Date(),
  requireActive = false,
  requireConfigured = false,
  requestId = `rate-limit-canary-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
} = {}) {
  const startedAt = Date.now();
  const checks = [];

  const health = await fetchSourceHealth({ baseUrl, fetchFn, requestId });
  checks.push({
    data: health.data,
    name: "live_rate_limit_store",
    status:
      health.ok && (!requireActive || (health.data.activeStore === "supabase" && health.data.distributedActive === true))
        ? "pass"
        : "fail"
  });

  const missing = REQUIRED_ENV.filter((key) => !env[key]);

  if (missing.length > 0) {
    checks.push({
      data: { missing },
      name: "rate_limit_store_config",
      status: requireConfigured ? "fail" : "skip"
    });
    return result({ checks, startedAt });
  }

  const rpc = await callRateLimitRpc({ env, fetchFn, now, requestId }).catch((error) => ({
    data: {
      code: null,
      error: safeError(error),
      exposedToDataApi: false,
      responseShape: [],
      status: null
    },
    ok: false
  }));
  checks.push({
    data: rpc.data,
    name: "rate_limit_rpc",
    status: rpc.ok ? "pass" : "fail"
  });

  return result({ checks, startedAt });
}

export function parseEnvFile(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separator = line.indexOf("=");
    if (separator <= 0) {
      throw new Error(`invalid env line: ${rawLine}`);
    }
    const key = line.slice(0, separator).trim();
    if (!/^[A-Z0-9_]+$/.test(key)) {
      throw new Error(`invalid env key: ${key}`);
    }
    env[key] = stripQuotes(line.slice(separator + 1).trim());
  }
  return env;
}

async function callRateLimitRpc({ env, fetchFn, now, requestId }) {
  const baseUrl = env.NIPMOD_ARCHIVE_SUPABASE_URL;
  const serviceRoleKey = env.NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY;
  const bucketKey = hashValue(`canary:${requestId}:${now.toISOString()}`);
  const clientHash = hashValue(`canary-client:${requestId}`);
  const response = await fetchFn(`${baseUrl.replace(/\/+$/, "")}/rest/v1/rpc/consume_api_rate_limit`, {
    body: JSON.stringify({
      p_bucket_key: bucketKey,
      p_client_hash: clientHash,
      p_limit_count: 10,
      p_policy: "rate-limit-canary",
      p_window_ms: 60_000
    }),
    headers: {
      accept: "application/json",
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      "user-agent": "nipmod-rate-limit-canary/1.2.5 (+https://nipmod.com)"
    },
    method: "POST"
  });
  const text = await response.text();
  const parsed = parseJson(text);
  const row = Array.isArray(parsed) ? parsed.at(0) : parsed;
  return {
    data: {
      code: errorCode(parsed),
      exposedToDataApi: response.ok,
      responseShape: row && typeof row === "object" && !Array.isArray(row) ? Object.keys(row).sort() : [],
      status: response.status
    },
    ok: response.ok && isRateLimitRow(row)
  };
}

async function fetchSourceHealth({ baseUrl, fetchFn, requestId }) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  try {
    const response = await fetchFn(`${normalizedBaseUrl}/api/sources/health`, {
      headers: {
        "user-agent": "nipmod-rate-limit-canary/1.2.5 (+https://nipmod.com)",
        "x-request-id": requestId
      }
    });
    const text = await response.text();
    const parsed = parseJson(text);
    return {
      data: {
        activeStore: parsed?.rateLimit?.activeStore ?? null,
        configured: parsed?.rateLimit?.configured ?? null,
        distributedActive: parsed?.rateLimit?.distributedActive ?? null,
        missing: parsed?.rateLimit?.missing ?? null,
        status: response.status
      },
      ok: response.ok && parsed?.type === "dev.nipmod.source-health.v1"
    };
  } catch (error) {
    return {
      data: {
        activeStore: null,
        configured: null,
        distributedActive: null,
        error: safeError(error),
        missing: null,
        status: null
      },
      ok: false
    };
  }
}

function result({ checks, startedAt }) {
  const summary = {
    fail: checks.filter((check) => check.status === "fail").length,
    pass: checks.filter((check) => check.status === "pass").length,
    skip: checks.filter((check) => check.status === "skip").length,
    total: checks.length
  };
  return {
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    formatVersion: 1,
    ok: summary.fail === 0,
    summary,
    checks,
    type: "dev.nipmod.rate-limit-canary.v1"
  };
}

function parseJson(text) {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function errorCode(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return typeof value.code === "string" ? value.code : null;
}

function safeError(error) {
  return error instanceof Error ? error.message : String(error);
}

function isRateLimitRow(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return (
    typeof value.allowed === "boolean" &&
    typeof value.count === "number" &&
    typeof value.remaining === "number" &&
    typeof value.reset_at === "string" &&
    Number.isFinite(Date.parse(value.reset_at))
  );
}

function hashValue(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stripQuotes(value) {
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
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

async function envFromCli() {
  const envPath = process.env.NIPMOD_CANARY_ENV_FILE ?? optionValue("--canary-env-file") ?? optionValue("--env-file");
  if (!envPath) {
    return process.env;
  }
  return {
    ...process.env,
    ...parseEnvFile(await readFile(resolve(envPath), "utf8"))
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const output = await runRateLimitCanary({
    baseUrl: optionValue("--base-url") ?? process.env.NIPMOD_CANARY_BASE_URL ?? DEFAULT_BASE_URL,
    env: await envFromCli(),
    requireActive: process.argv.includes("--require-active"),
    requireConfigured: process.argv.includes("--require-configured")
  });
  console.log(JSON.stringify(output, null, 2));
  if (!output.ok) {
    process.exitCode = 1;
  }
}
