import { scryptSync, timingSafeEqual } from "node:crypto";
import { type ApiHttpContext, apiJson, createApiHttpContext } from "./api-http";

type ApiAuthEnv = Record<string, string | undefined>;

export type ApiAccessTier = "public" | "beta" | "builder" | "partner" | "admin";

export interface ApiAccess {
  authenticated: boolean;
  headers: Record<string, string>;
  keyId: string | null;
  limitMultiplier: number;
  subject: string;
  tier: ApiAccessTier;
}

export interface ApiAccessResult {
  access: ApiAccess;
  ok: boolean;
  response?: Response;
}

const API_KEY_HASHES_ENV = "NIPMOD_API_KEY_HASHES";
const API_KEY_HASH_SECRET_ENV = "NIPMOD_API_KEY_HASH_SECRET";
const SUPABASE_URL_ENV = "NIPMOD_ARCHIVE_SUPABASE_URL";
const SUPABASE_SERVICE_ROLE_KEY_ENV = "NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY";
const API_KEY_MIN_LENGTH = 24;
const API_KEY_MAX_LENGTH = 256;
const API_KEY_REGISTRY_TIMEOUT_MS = 700;

const PUBLIC_ACCESS: ApiAccess = {
  authenticated: false,
  headers: {
    "x-nipmod-access-tier": "public"
  },
  keyId: null,
  limitMultiplier: 1,
  subject: "public",
  tier: "public"
};

export function readApiAccess(
  request: Request,
  context: ApiHttpContext = createApiHttpContext(request),
  env: ApiAuthEnv = process.env
): ApiAccessResult {
  const provided = readProvidedKey(request);
  if (!provided) {
    return { access: PUBLIC_ACCESS, ok: true };
  }

  if (provided.length < API_KEY_MIN_LENGTH) {
    return unauthorized(context, "api key is too short");
  }
  if (provided.length > API_KEY_MAX_LENGTH) {
    return unauthorized(context, "api key is too long");
  }

  const configured = readConfiguredKeys(env);
  if (configured.length === 0) {
    return unauthorized(context, "api keys are not enabled on this deployment");
  }

  const providedHash = digestApiKey(provided, env);
  if (!providedHash) {
    return unauthorized(context, "api key hashing is not configured on this deployment");
  }
  const match = configured.find((candidate) => constantTimeEqual(candidate.hash, providedHash));
  if (!match) {
    return unauthorized(context, "api key is invalid");
  }

  return { access: apiAccessFromKey(match), ok: true };
}

export async function readApiAccessAsync(
  request: Request,
  context: ApiHttpContext = createApiHttpContext(request),
  env: ApiAuthEnv = process.env,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = API_KEY_REGISTRY_TIMEOUT_MS
): Promise<ApiAccessResult> {
  const provided = readProvidedKey(request);
  if (!provided) {
    return { access: PUBLIC_ACCESS, ok: true };
  }

  if (provided.length < API_KEY_MIN_LENGTH) {
    return unauthorized(context, "api key is too short");
  }
  if (provided.length > API_KEY_MAX_LENGTH) {
    return unauthorized(context, "api key is too long");
  }

  const configured = readConfiguredKeys(env);
  const providedHash = digestApiKey(provided, env);
  if (configured.length > 0) {
    if (!providedHash) {
      return unauthorized(context, "api key hashing is not configured on this deployment");
    }
    const match = configured.find((candidate) => constantTimeEqual(candidate.hash, providedHash));
    if (match) {
      return { access: apiAccessFromKey(match), ok: true };
    }
  }

  const store = apiKeyStoreStatus(env);
  if (store.registryConfigured) {
    if (!providedHash) {
      return unauthorized(context, "api key hashing is not configured on this deployment");
    }
    const stored = await readStoredApiKey(providedHash, env, fetchImpl, timeoutMs);
    if (stored.status === "ok") {
      return { access: apiAccessFromKey(stored.key), ok: true };
    }
    if (stored.status === "unavailable") {
      return apiKeyStoreUnavailable(context);
    }
  }

  if (configured.length === 0 && !store.registryConfigured) {
    return unauthorized(context, "api keys are not enabled on this deployment");
  }
  return unauthorized(context, "api key is invalid");
}

export function publicApiAccess(): ApiAccess {
  return PUBLIC_ACCESS;
}

export function fingerprintApiKey(rawKey: string): string {
  return `key_${deriveKeyedDigest(rawKey, "nipmod-api-key-fingerprint-v1").slice(0, 16)}`;
}

export function deriveApiKeyDigestForStorage(rawKey: string, secret: string): string {
  return deriveKeyedDigest(rawKey, secret);
}

export function hasApiAccessTier(access: ApiAccess, minimum: Exclude<ApiAccessTier, "public">): boolean {
  return tierRank(access.tier) >= tierRank(minimum);
}

export function apiKeyStoreStatus(env: ApiAuthEnv = process.env): {
  configured: boolean;
  driver: "env-or-supabase-rest";
  envKeysConfigured: boolean;
  hashingConfigured: boolean;
  missing: string[];
  privacy: string;
  registryConfigured: boolean;
  tiers: ApiAccessTier[];
  type: "dev.nipmod.api-key-store-status.v1";
} {
  const registryEnv = [SUPABASE_URL_ENV, SUPABASE_SERVICE_ROLE_KEY_ENV];
  const missing = registryEnv.filter((key) => !env[key]);
  const hashingConfigured = Boolean(env[API_KEY_HASH_SECRET_ENV]);
  const envKeysConfigured = Boolean(env[API_KEY_HASHES_ENV] && env[API_KEY_HASH_SECRET_ENV]);
  const registryConfigured = missing.length === 0 && hashingConfigured;
  return {
    configured: envKeysConfigured || registryConfigured,
    driver: "env-or-supabase-rest",
    envKeysConfigured,
    hashingConfigured,
    missing: registryConfigured ? [] : missing,
    privacy: "keys are verified by keyed hashes and are not stored in usage events",
    registryConfigured,
    tiers: ["public", "beta", "partner", "admin"],
    type: "dev.nipmod.api-key-store-status.v1"
  };
}

function readProvidedKey(request: Request): string | null {
  const direct = request.headers.get("x-nipmod-api-key")?.trim();
  if (direct) {
    return direct;
  }

  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  return authorization.slice(7).trim() || null;
}

function unauthorized(context: ApiHttpContext, message: string): ApiAccessResult {
  return {
    access: PUBLIC_ACCESS,
    ok: false,
    response: apiJson(
      {
        code: "invalid_api_key",
        error: message,
        retryable: false,
        source: null,
        status: 401,
        type: "dev.nipmod.api-error.v1"
      },
      {
        context,
        headers: PUBLIC_ACCESS.headers,
        status: 401
      }
    )
  };
}

interface ConfiguredKey {
  hash: string;
  id: string;
  label: string;
  limitMultiplier?: number;
  tier: ApiAccessTier;
}

function readConfiguredKeys(env: ApiAuthEnv): ConfiguredKey[] {
  const raw = env[API_KEY_HASHES_ENV];
  if (!raw || !env[API_KEY_HASH_SECRET_ENV]) {
    return [];
  }
  return raw
    .split(",")
    .map((entry) => parseConfiguredKey(entry.trim()))
    .filter((entry): entry is ConfiguredKey => entry !== null);
}

function parseConfiguredKey(entry: string): ConfiguredKey | null {
  const [label, tierValue, hashValue, multiplierValue] = entry.split(":");
  const tier = readTier(tierValue);
  const hash = hashValue?.toLowerCase();
  if (!label || !tier || !hash || !/^[a-f0-9]{64}$/.test(hash)) {
    return null;
  }
  return {
    hash,
    id: `key_${hash.slice(0, 16)}`,
    label: label.replace(/[^\w./-]/g, "").slice(0, 80) || "api-key",
    limitMultiplier: readLimitMultiplier(multiplierValue) ?? tierMultiplier(tier),
    tier
  };
}

function readTier(value: string | undefined): ApiAccessTier | null {
  if (value === "beta" || value === "builder" || value === "partner" || value === "admin" || value === "public") {
    return value;
  }
  return null;
}

function tierMultiplier(tier: ApiAccessTier): number {
  switch (tier) {
    case "admin":
      return 200;
    case "partner":
      return 50;
    case "beta":
    case "builder":
      return 10;
    case "public":
      return 1;
  }
}

function tierRank(tier: ApiAccessTier): number {
  switch (tier) {
    case "admin":
      return 3;
    case "partner":
      return 2;
    case "beta":
    case "builder":
      return 1;
    case "public":
      return 0;
  }
}

function digestApiKey(value: string, env: ApiAuthEnv): string | null {
  const secret = env[API_KEY_HASH_SECRET_ENV];
  if (!secret) {
    return null;
  }
  return deriveKeyedDigest(value, secret);
}

function deriveKeyedDigest(value: string, secret: string): string {
  return scryptSync(value, secret, 32).toString("hex");
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function apiAccessFromKey(key: Omit<ConfiguredKey, "hash">): ApiAccess {
  return {
    authenticated: true,
    headers: {
      "x-nipmod-access-tier": key.tier,
      "x-nipmod-key-id": key.id
    },
    keyId: key.id,
    limitMultiplier: key.limitMultiplier ?? tierMultiplier(key.tier),
    subject: key.label,
    tier: key.tier
  };
}

type StoredApiKeyLookup =
  | {
      key: Omit<ConfiguredKey, "hash">;
      status: "ok";
    }
  | {
      status: "missing";
    }
  | {
      status: "unavailable";
    };

async function readStoredApiKey(
  providedHash: string,
  env: ApiAuthEnv,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<StoredApiKeyLookup> {
  const baseUrl = env[SUPABASE_URL_ENV];
  const serviceRoleKey = env[SUPABASE_SERVICE_ROLE_KEY_ENV];
  if (!baseUrl || !serviceRoleKey) {
    return { status: "missing" };
  }

  const params = new URLSearchParams({
    key_hash: `eq.${providedHash}`,
    limit: "1",
    select: "id,label,tier,rate_limit_multiplier,expires_at",
    status: "eq.active"
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/rest/v1/api_keys?${params.toString()}`, {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`
      },
      signal: controller.signal
    });
    if (!response.ok) {
      return { status: "unavailable" };
    }
    const rows = await response.json();
    const row = Array.isArray(rows) ? rows.at(0) : null;
    return storedApiKeyFromRow(row) ?? { status: "missing" };
  } catch {
    return { status: "unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}

function storedApiKeyFromRow(row: unknown): StoredApiKeyLookup | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return null;
  }
  const record = row as Record<string, unknown>;
  const id = typeof record.id === "string" && /^key_[a-f0-9]{16,32}$/.test(record.id) ? record.id : null;
  const tier = readTier(typeof record.tier === "string" ? record.tier : undefined);
  const expiresAt = typeof record.expires_at === "string" ? record.expires_at : null;
  if (!id || !tier || tier === "public") {
    return null;
  }
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
    return { status: "missing" };
  }
  return {
    key: {
      id,
      label: sanitizeLabel(typeof record.label === "string" ? record.label : "api-key"),
      limitMultiplier: readLimitMultiplier(record.rate_limit_multiplier) ?? tierMultiplier(tier),
      tier
    },
    status: "ok"
  };
}

function sanitizeLabel(value: string): string {
  return value.replace(/[^\w./-]/g, "").slice(0, 80) || "api-key";
}

function readLimitMultiplier(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  if (!Number.isInteger(parsed) || parsed < 1) {
    return undefined;
  }
  return Math.min(50_000, parsed);
}

function apiKeyStoreUnavailable(context: ApiHttpContext): ApiAccessResult {
  return {
    access: PUBLIC_ACCESS,
    ok: false,
    response: apiJson(
      {
        code: "api_key_store_unavailable",
        error: "api key verification is temporarily unavailable",
        retryable: true,
        source: null,
        status: 503,
        type: "dev.nipmod.api-error.v1"
      },
      {
        context,
        headers: PUBLIC_ACCESS.headers,
        status: 503
      }
    )
  };
}
