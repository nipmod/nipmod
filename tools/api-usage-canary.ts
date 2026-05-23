#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_BASE_URL = "https://nipmod.com";
const REQUIRED_ENV = ["NIPMOD_ARCHIVE_SUPABASE_URL", "NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY"];

export async function runApiUsageCanary({
  baseUrl = DEFAULT_BASE_URL,
  env = process.env,
  fetchFn = fetch,
  pollDelayMs = 250,
  pollAttempts = 8,
  requestId = `usage-canary-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  requireConfigured = false
} = {}) {
  const startedAt = Date.now();
  const missing = REQUIRED_ENV.filter((key) => !env[key]);
  if (missing.length > 0) {
    return result({
      checks: [
        {
          data: { missing },
          name: "usage_store_config",
          status: requireConfigured ? "fail" : "skip"
        }
      ],
      startedAt
    });
  }

  const checks = [];
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const apiResponse = await fetchFn(`${normalizedBaseUrl}/api/search?q=http%20client&sources=npm&limit=1`, {
    headers: {
      "user-agent": "nipmod-usage-canary",
      "x-request-id": requestId
    }
  });
  checks.push({
    data: {
      requestId,
      status: apiResponse.status
    },
    name: "usage_canary_request",
    status: apiResponse.ok ? "pass" : "fail"
  });

  if (!apiResponse.ok) {
    return result({ checks, startedAt });
  }

  const row = await pollUsageRow({
    env,
    fetchFn,
    pollAttempts,
    pollDelayMs,
    requestId
  });
  checks.push({
    data: row
      ? {
          createdAt: row.created_at,
          requestId: row.request_id,
          resultCount: row.result_count,
          route: row.route,
          status: row.status
        }
      : { requestId },
    name: "usage_event_ingested",
    status: row ? "pass" : "fail"
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

async function pollUsageRow({ env, fetchFn, pollAttempts, pollDelayMs, requestId }) {
  for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
    const rows = await fetchUsageRows({ env, fetchFn, requestId });
    if (rows.length > 0) {
      return rows[0];
    }
    if (attempt + 1 < pollAttempts) {
      await sleep(pollDelayMs);
    }
  }
  return null;
}

async function fetchUsageRows({ env, fetchFn, requestId }) {
  const baseUrl = env.NIPMOD_ARCHIVE_SUPABASE_URL;
  const serviceRoleKey = env.NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY;
  const params = new URLSearchParams({
    limit: "1",
    request_id: `eq.${requestId}`,
    select: "request_id,route,status,result_count,created_at"
  });
  const response = await fetchFn(`${baseUrl.replace(/\/+$/, "")}/rest/v1/api_usage_events?${params.toString()}`, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`
    }
  });
  if (!response.ok) {
    throw new Error(`usage store query failed with ${response.status}`);
  }
  const value = await response.json();
  return Array.isArray(value) ? value : [];
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
    type: "dev.nipmod.api-usage-canary.v1"
  };
}

function stripQuotes(value) {
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
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
  const output = await runApiUsageCanary({
    baseUrl: optionValue("--base-url") ?? process.env.NIPMOD_CANARY_BASE_URL ?? DEFAULT_BASE_URL,
    env: await envFromCli(),
    requireConfigured: process.argv.includes("--require-configured")
  });
  console.log(JSON.stringify(output, null, 2));
  if (!output.ok) {
    process.exitCode = 1;
  }
}
