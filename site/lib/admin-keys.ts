type AdminKeyEnv = Record<string, string | undefined>;

const SUPABASE_URL_ENV = "NIPMOD_ARCHIVE_SUPABASE_URL";
const SUPABASE_SERVICE_ROLE_KEY_ENV = "NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY";
const ADMIN_KEYS_TIMEOUT_MS = 1_500;
const KEY_SELECT = "id,label,tier,status,rate_limit_multiplier,created_at,expires_at,revoked_at";
const DEFAULT_STALE_BETA_HOURS = 720;
const MAX_STALE_BETA_HOURS = 8_760;

export type AdminKeyAction = "cleanup-stale-beta" | "pause" | "resume" | "revoke" | "update-label";

export type AdminKeyRecord = {
  createdAt: string;
  expiresAt: string | null;
  id: string;
  label: string;
  rateLimitMultiplier: number;
  revokedAt: string | null;
  status: string;
  tier: string;
};

export type AdminKeyActionResult =
  | {
      action: AdminKeyAction;
      affectedCount: number;
      keys: AdminKeyRecord[];
      ok: true;
      privacy: string;
      store: ReturnType<typeof keyStoreStatus>;
      type: "dev.nipmod.admin-key-action.v1";
    }
  | {
      code: string;
      error: string;
      missing?: string[];
      ok: false;
      retryable: boolean;
      status: number;
    };

export async function updateAdminKeyStatus(
  input: {
    action: "pause" | "resume" | "revoke";
    currentKeyId?: string | null;
    keyId: string;
  },
  env: AdminKeyEnv = process.env,
  fetchImpl: typeof fetch = fetch
): Promise<AdminKeyActionResult> {
  if (!isKeyId(input.keyId)) {
    return actionFailure("invalid_key_id", "keyId must be a Nipmod API key id", 400, false);
  }
  if (input.currentKeyId && input.keyId === input.currentKeyId) {
    return actionFailure("cannot_modify_current_admin_key", "current admin key cannot modify itself", 400, false);
  }

  const status = keyStoreStatus(env);
  if (!status.configured) {
    return actionFailure("key_store_not_configured", "API key registry is not configured", 503, false, status.missing);
  }

  const now = new Date().toISOString();
  const params = new URLSearchParams({
    id: `eq.${input.keyId}`,
    select: KEY_SELECT,
    status: input.action === "resume" ? "eq.paused" : "eq.active"
  });
  const patch =
    input.action === "pause"
      ? { revoked_at: null, status: "paused" }
      : input.action === "resume"
        ? { revoked_at: null, status: "active" }
        : { revoked_at: now, status: "revoked" };
  const response = await patchApiKeys(env, params, patch, fetchImpl);
  if (!response.ok) {
    return actionFailure("key_management_unavailable", "API key registry is temporarily unavailable", 503, true);
  }
  const keys = await readKeyRows(response);
  if (keys.length === 0) {
    return actionFailure("api_key_not_found_or_inactive", "API key was not found or is already inactive", 404, false);
  }
  return adminKeyAction(input.action, keys, status);
}

export async function updateAdminKeyLabel(
  input: {
    keyId: string;
    label: string;
  },
  env: AdminKeyEnv = process.env,
  fetchImpl: typeof fetch = fetch
): Promise<AdminKeyActionResult> {
  if (!isKeyId(input.keyId)) {
    return actionFailure("invalid_key_id", "keyId must be a Nipmod API key id", 400, false);
  }
  const label = sanitizeEditableLabel(input.label);
  if (!label) {
    return actionFailure("invalid_key_label", "label must contain 1 to 80 safe characters", 400, false);
  }

  const status = keyStoreStatus(env);
  if (!status.configured) {
    return actionFailure("key_store_not_configured", "API key registry is not configured", 503, false, status.missing);
  }

  const params = new URLSearchParams({
    id: `eq.${input.keyId}`,
    select: KEY_SELECT
  });
  const response = await patchApiKeys(env, params, { label }, fetchImpl);
  if (!response.ok) {
    return actionFailure("key_management_unavailable", "API key registry is temporarily unavailable", 503, true);
  }
  const keys = await readKeyRows(response);
  if (keys.length === 0) {
    return actionFailure("api_key_not_found", "API key was not found", 404, false);
  }
  return adminKeyAction("update-label", keys, status);
}

export async function cleanupStaleBetaKeys(
  input: { olderThanHours?: number | null },
  env: AdminKeyEnv = process.env,
  fetchImpl: typeof fetch = fetch
): Promise<AdminKeyActionResult> {
  const status = keyStoreStatus(env);
  if (!status.configured) {
    return actionFailure("key_store_not_configured", "API key registry is not configured", 503, false, status.missing);
  }

  const olderThanHours = clampStaleHours(input.olderThanHours);
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  const staleParams = new URLSearchParams({
    created_at: `lt.${cutoff}`,
    label: "like.self-serve/%",
    select: KEY_SELECT,
    status: "eq.active",
    tier: "eq.beta"
  });
  const expiredParams = new URLSearchParams({
    expires_at: `lt.${now}`,
    label: "like.self-serve/%",
    select: KEY_SELECT,
    status: "eq.active",
    tier: "eq.beta"
  });
  const staleResponse = await patchApiKeys(env, staleParams, { revoked_at: now, status: "revoked" }, fetchImpl);
  if (!staleResponse.ok) {
    return actionFailure("key_management_unavailable", "API key registry is temporarily unavailable", 503, true);
  }
  const expiredResponse = await patchApiKeys(env, expiredParams, { revoked_at: now, status: "revoked" }, fetchImpl);
  if (!expiredResponse.ok) {
    return actionFailure("key_management_unavailable", "API key registry is temporarily unavailable", 503, true);
  }
  return adminKeyAction("cleanup-stale-beta", dedupeKeyRows([...(await readKeyRows(staleResponse)), ...(await readKeyRows(expiredResponse))]), status);
}

export function keyStoreStatus(env: AdminKeyEnv = process.env) {
  const missing = [SUPABASE_URL_ENV, SUPABASE_SERVICE_ROLE_KEY_ENV].filter((key) => !env[key]);
  return {
    configured: missing.length === 0,
    driver: "supabase-rest" as const,
    missing
  };
}

function adminKeyAction(action: AdminKeyAction, keys: AdminKeyRecord[], store: ReturnType<typeof keyStoreStatus>): AdminKeyActionResult {
  return {
    action,
    affectedCount: keys.length,
    keys,
    ok: true,
    privacy: "admin key management returns key ids and metadata only; raw keys and key hashes are never returned",
    store,
    type: "dev.nipmod.admin-key-action.v1"
  };
}

function actionFailure(
  code: string,
  error: string,
  status: number,
  retryable: boolean,
  missing?: string[]
): AdminKeyActionResult {
  const result: AdminKeyActionResult = {
    code,
    error,
    ok: false,
    retryable,
    status
  };
  if (missing !== undefined) {
    result.missing = missing;
  }
  return result;
}

async function patchApiKeys(
  env: AdminKeyEnv,
  params: URLSearchParams,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch
): Promise<Response> {
  const baseUrl = env[SUPABASE_URL_ENV];
  const serviceRoleKey = env[SUPABASE_SERVICE_ROLE_KEY_ENV];
  if (!baseUrl || !serviceRoleKey) {
    return Response.json({ error: "not configured" }, { status: 503 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ADMIN_KEYS_TIMEOUT_MS);
  try {
    return await fetchImpl(`${baseUrl.replace(/\/$/, "")}/rest/v1/api_keys?${params.toString()}`, {
      body: JSON.stringify(body),
      headers: {
        Prefer: "return=representation",
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json"
      },
      method: "PATCH",
      signal: controller.signal
    });
  } catch {
    return Response.json({ error: "key management unavailable" }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}

async function readKeyRows(response: Response): Promise<AdminKeyRecord[]> {
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows.map(keyRecordFromRow).filter((row): row is AdminKeyRecord => row !== null) : [];
}

function dedupeKeyRows(rows: AdminKeyRecord[]): AdminKeyRecord[] {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

function keyRecordFromRow(value: unknown): AdminKeyRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.created_at !== "string" ||
    !(typeof row.expires_at === "string" || row.expires_at === null) ||
    typeof row.id !== "string" ||
    typeof row.label !== "string" ||
    typeof row.rate_limit_multiplier !== "number" ||
    !(typeof row.revoked_at === "string" || row.revoked_at === null) ||
    typeof row.status !== "string" ||
    typeof row.tier !== "string"
  ) {
    return null;
  }
  return {
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    id: row.id,
    label: row.label,
    rateLimitMultiplier: row.rate_limit_multiplier,
    revokedAt: row.revoked_at,
    status: row.status,
    tier: row.tier
  };
}

function clampStaleHours(value: number | null | undefined): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    return DEFAULT_STALE_BETA_HOURS;
  }
  return Math.min(MAX_STALE_BETA_HOURS, Number(value));
}

function isKeyId(value: string): boolean {
  return /^key_[a-f0-9]{16,32}$/.test(value);
}

function sanitizeEditableLabel(value: string): string {
  return value.replace(/[^\w./-]/g, "").slice(0, 80);
}
