import { randomBytes } from "node:crypto";
import { deriveApiKeyDigestForStorage, fingerprintApiKey } from "./api-auth";

type ApiKeyIssuerEnv = Record<string, string | undefined>;

export type BetaApiKeyIssueResult =
  | {
      key: string;
      keyId: string;
      label: string;
      ok: true;
      response: BetaApiKeyIssueResponse;
    }
  | {
      code: string;
      error: string;
      ok: false;
      retryable: boolean;
      status: number;
    };

export interface BetaApiKeyIssueResponse {
  auth: {
    bearer: boolean;
    header: "x-nipmod-api-key";
  };
  createdAt: string;
  expiresAt: string;
  key: string;
  keyId: string;
  label: string;
  next: {
    docs: string;
    openapi: string;
    search: string;
  };
  rateLimitMultiplier: number;
  storage: {
    rawKeyReturnedOnce: true;
    serverStoresHashOnly: true;
    serverStoresRawKey: false;
  };
  tier: "beta";
  type: "dev.nipmod.beta-api-key.v1";
}

const API_KEY_HASH_SECRET_ENV = "NIPMOD_API_KEY_HASH_SECRET";
const SUPABASE_URL_ENV = "NIPMOD_ARCHIVE_SUPABASE_URL";
const SUPABASE_SERVICE_ROLE_KEY_ENV = "NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY";
const BETA_KEY_TTL_DAYS = 90;
const BETA_KEY_RATE_LIMIT_MULTIPLIER = 10;
const ISSUE_TIMEOUT_MS = 1_000;

export async function issueSelfServeBetaApiKey(
  input: { label?: unknown },
  env: ApiKeyIssuerEnv = process.env,
  fetchImpl: typeof fetch = fetch
): Promise<BetaApiKeyIssueResult> {
  const baseUrl = env[SUPABASE_URL_ENV];
  const serviceRoleKey = env[SUPABASE_SERVICE_ROLE_KEY_ENV];
  const hashSecret = env[API_KEY_HASH_SECRET_ENV];
  if (!baseUrl || !serviceRoleKey || !hashSecret) {
    return {
      code: "beta_key_store_not_configured",
      error: "beta key issuing is not enabled on this deployment",
      ok: false,
      retryable: false,
      status: 503
    };
  }

  const label = normalizeBetaKeyLabel(input.label);
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + BETA_KEY_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const key = generateBetaApiKey();
    const keyId = fingerprintApiKey(key);
    const keyHash = deriveApiKeyDigestForStorage(key, hashSecret);
    const row = {
      expires_at: expiresAt,
      id: keyId,
      key_hash: keyHash,
      label,
      rate_limit_multiplier: BETA_KEY_RATE_LIMIT_MULTIPLIER,
      status: "active" as const,
      tier: "beta" as const
    };

    const result = await insertApiKeyRow({ baseUrl, fetchImpl, row, serviceRoleKey });
    if (result === "conflict") {
      continue;
    }
    if (result !== "ok") {
      return result;
    }

    const response: BetaApiKeyIssueResponse = {
      auth: {
        bearer: true,
        header: "x-nipmod-api-key"
      },
      createdAt: createdAt.toISOString(),
      expiresAt,
      key,
      keyId,
      label,
      next: {
        docs: "https://nipmod.com/api-access",
        openapi: "https://nipmod.com/api/openapi",
        search: "https://nipmod.com/api/search?q=http%20client&limit=3"
      },
      rateLimitMultiplier: BETA_KEY_RATE_LIMIT_MULTIPLIER,
      storage: {
        rawKeyReturnedOnce: true,
        serverStoresHashOnly: true,
        serverStoresRawKey: false
      },
      tier: "beta",
      type: "dev.nipmod.beta-api-key.v1"
    };
    return { key, keyId, label, ok: true, response };
  }

  return {
    code: "beta_key_issue_conflict",
    error: "beta key id collided during issue",
    ok: false,
    retryable: true,
    status: 503
  };
}

function generateBetaApiKey(): string {
  return `nka_beta_${randomBytes(32).toString("base64url")}`;
}

function normalizeBetaKeyLabel(value: unknown): string {
  const raw = typeof value === "string" ? value : "";
  const cleaned = raw
    .replace(/[^\w./-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `self-serve/${cleaned || "agent"}`.slice(0, 80);
}

async function insertApiKeyRow(input: {
  baseUrl: string;
  fetchImpl: typeof fetch;
  row: {
    expires_at: string;
    id: string;
    key_hash: string;
    label: string;
    rate_limit_multiplier: number;
    status: "active";
    tier: "beta";
  };
  serviceRoleKey: string;
}): Promise<"ok" | "conflict" | Exclude<BetaApiKeyIssueResult, { ok: true }>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ISSUE_TIMEOUT_MS);
  try {
    const response = await input.fetchImpl(`${input.baseUrl.replace(/\/$/, "")}/rest/v1/api_keys`, {
      body: JSON.stringify(input.row),
      headers: {
        Prefer: "return=minimal",
        apikey: input.serviceRoleKey,
        authorization: `Bearer ${input.serviceRoleKey}`,
        "content-type": "application/json"
      },
      method: "POST",
      signal: controller.signal
    });
    if (response.status === 409) {
      return "conflict";
    }
    if (response.ok) {
      return "ok";
    }
    if (response.status === 404) {
      return {
        code: "beta_key_store_unavailable",
        error: "beta key registry is not available",
        ok: false,
        retryable: true,
        status: 503
      };
    }
    if (response.status === 401 || response.status === 403) {
      return {
        code: "beta_key_store_not_authorized",
        error: "beta key registry is not authorized for this deployment",
        ok: false,
        retryable: false,
        status: 503
      };
    }
    return {
      code: "beta_key_issue_failed",
      error: "beta key issuing failed",
      ok: false,
      retryable: response.status >= 500,
      status: response.status >= 500 ? 503 : response.status
    };
  } catch (error) {
    return {
      code: error instanceof DOMException && error.name === "AbortError" ? "beta_key_issue_timeout" : "beta_key_issue_network_error",
      error: "beta key issuing is temporarily unavailable",
      ok: false,
      retryable: true,
      status: 503
    };
  } finally {
    clearTimeout(timeout);
  }
}
