#!/usr/bin/env node
import { fileURLToPath } from "node:url";

const DEFAULT_BASE_URL = "https://nipmod.com";
const PUBLIC_RATE_LIMIT_HEADERS = [
  "x-ratelimit-limit",
  "x-ratelimit-policy",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
  "x-ratelimit-store"
];
const REQUIRED_API_HEADERS = [
  "access-control-allow-origin",
  "cache-control",
  "x-nipmod-api-version",
  "x-nipmod-request-id",
  "x-nipmod-response-time-ms"
];

const CONTRACT_CHECKS = [
  {
    expectError: false,
    expectRateLimitHeaders: true,
    expectedStatus: 200,
    expectedType: "dev.nipmod.external-search.v1",
    method: "GET",
    name: "search_success_contract",
    path: "/api/search?q=http%20client&sources=npm&limit=1"
  },
  {
    expectCode: "invalid_query",
    expectError: true,
    expectRateLimitHeaders: true,
    expectedStatus: 400,
    method: "GET",
    name: "search_invalid_query_error",
    path: "/api/search?q=&sources=npm"
  },
  {
    expectCode: "invalid_source",
    expectError: true,
    expectRateLimitHeaders: true,
    expectedStatus: 400,
    method: "GET",
    name: "inspect_invalid_source_error",
    path: "/api/inspect?source=unknown&name=react"
  },
  {
    body: "{",
    expectCode: "invalid_json",
    expectError: true,
    expectRateLimitHeaders: true,
    expectedStatus: 400,
    headers: { "content-type": "application/json" },
    method: "POST",
    name: "install_plan_invalid_json_error",
    path: "/api/install-plan"
  },
  {
    expectCode: "invalid_api_key",
    expectError: true,
    expectRateLimitHeaders: false,
    expectedStatus: 401,
    headers: { "x-nipmod-api-key": "short-key" },
    method: "GET",
    name: "invalid_api_key_error",
    path: "/api/search?q=http%20client",
    secretProbe: "short-key"
  }
] as const;

export async function runApiContractCanary({
  baseUrl = DEFAULT_BASE_URL,
  checks = CONTRACT_CHECKS,
  fetchFn = fetch
} = {}) {
  const startedAt = Date.now();
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const results = [];

  for (const check of checks) {
    const startedCheckAt = Date.now();
    try {
      const data = await runContractCheck(normalizedBaseUrl, check, fetchFn);
      results.push({
        data,
        durationMs: Date.now() - startedCheckAt,
        name: check.name,
        status: "pass"
      });
    } catch (error) {
      results.push({
        durationMs: Date.now() - startedCheckAt,
        error: safeError(error),
        name: check.name,
        status: "fail"
      });
    }
  }

  return result({ baseUrl: normalizedBaseUrl, checks: results, startedAt });
}

async function runContractCheck(baseUrl: string, check: (typeof CONTRACT_CHECKS)[number], fetchFn: typeof fetch) {
  const requestId = `api-contract-canary-${check.name}`;
  const response = await fetchFn(`${baseUrl}${check.path}`, {
    body: "body" in check ? check.body : undefined,
    headers: {
      accept: "application/json",
      "user-agent": "nipmod-api-contract-canary/1.2.5 (+https://nipmod.com)",
      "x-request-id": requestId,
      ...("headers" in check ? check.headers : {})
    },
    method: check.method
  });
  const text = await response.text();
  const payload = parseJson(text);

  if (response.status !== check.expectedStatus) {
    throw new Error(`expected status ${check.expectedStatus}, got ${response.status}`);
  }

  assertApiHeaders(response.headers, requestId);
  if (check.expectRateLimitHeaders) {
    assertRateLimitHeaders(response.headers);
  }
  if (response.status !== 204) {
    assertJsonContentType(response.headers);
  }

  if (check.expectError) {
    assertApiError(payload, check.expectedStatus, check.expectCode);
    if ("secretProbe" in check && check.secretProbe && text.includes(check.secretProbe)) {
      throw new Error("error response leaked the submitted API key");
    }
  } else {
    if (payload?.type !== check.expectedType) {
      throw new Error(`expected response type ${check.expectedType}, got ${payload?.type ?? "unknown"}`);
    }
  }

  return {
    code: payload?.code ?? null,
    method: check.method,
    path: check.path,
    rateLimitStore: response.headers.get("x-ratelimit-store"),
    requestId: response.headers.get("x-nipmod-request-id"),
    status: response.status,
    type: payload?.type ?? null
  };
}

function assertApiHeaders(headers: Headers, requestId: string) {
  for (const header of REQUIRED_API_HEADERS) {
    if (!headers.get(header)) {
      throw new Error(`missing API header ${header}`);
    }
  }
  if (headers.get("access-control-allow-origin") !== "*") {
    throw new Error("CORS allow-origin header mismatch");
  }
  if (headers.get("x-nipmod-request-id") !== requestId) {
    throw new Error("request id was not echoed through x-nipmod-request-id");
  }
}

function assertRateLimitHeaders(headers: Headers) {
  for (const header of PUBLIC_RATE_LIMIT_HEADERS) {
    if (!headers.get(header)) {
      throw new Error(`missing rate-limit header ${header}`);
    }
  }
  const limit = Number.parseInt(headers.get("x-ratelimit-limit") ?? "", 10);
  const remaining = Number.parseInt(headers.get("x-ratelimit-remaining") ?? "", 10);
  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error("x-ratelimit-limit must be a positive integer");
  }
  if (!Number.isFinite(remaining) || remaining < 0) {
    throw new Error("x-ratelimit-remaining must be a non-negative integer");
  }
  if (!Number.isFinite(Date.parse(headers.get("x-ratelimit-reset") ?? ""))) {
    throw new Error("x-ratelimit-reset must be an ISO timestamp");
  }
}

function assertJsonContentType(headers: Headers) {
  const contentType = headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(`expected JSON content-type, got ${contentType || "missing"}`);
  }
}

function assertApiError(payload: unknown, status: number, code: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("API error payload must be an object");
  }
  const error = payload as Record<string, unknown>;
  if (error.type !== "dev.nipmod.api-error.v1") {
    throw new Error(`API error type mismatch: ${String(error.type)}`);
  }
  if (error.status !== status) {
    throw new Error(`API error status mismatch: expected ${status}, got ${String(error.status)}`);
  }
  if (error.code !== code) {
    throw new Error(`API error code mismatch: expected ${code}, got ${String(error.code)}`);
  }
  if (typeof error.error !== "string" || error.error.length === 0) {
    throw new Error("API error message must be a non-empty string");
  }
  if (typeof error.retryable !== "boolean") {
    throw new Error("API error retryable must be boolean");
  }
  if (!("source" in error)) {
    throw new Error("API error must include source");
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
    type: "dev.nipmod.api-contract-canary.v1"
  };
}

function parseJson(text: string) {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function safeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
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
  const output = await runApiContractCanary({
    baseUrl: optionValue("--base-url") ?? process.env.NIPMOD_CANARY_BASE_URL ?? DEFAULT_BASE_URL
  });
  console.log(JSON.stringify(output, null, 2));
  if (!output.ok) {
    process.exitCode = 1;
  }
}
