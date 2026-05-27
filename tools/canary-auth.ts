import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const TEST_CANARY_API_KEY = "nka_test_canary_key_1234567890";
const DEFAULT_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const issuedCanaryKeys = new Map<string, Promise<string>>();

export function resetCanaryAuthCacheForTests(): void {
  issuedCanaryKeys.clear();
}

export async function readCanaryApiKey({
  baseUrl,
  fetchFn,
  label,
  userAgent
}: {
  baseUrl: string;
  fetchFn: typeof fetch;
  label: string;
  userAgent: string;
}): Promise<string> {
  const configured = process.env.NIPMOD_CANARY_API_KEY ?? process.env.NIPMOD_API_KEY;
  if (configured) {
    return configured;
  }
  if (fetchFn !== fetch) {
    return TEST_CANARY_API_KEY;
  }

  const cacheKey = baseUrl.replace(/\/$/, "");
  const cached = issuedCanaryKeys.get(cacheKey);
  if (cached) {
    return cached;
  }

  const persisted = await readPersistedCanaryKey(cacheKey);
  if (persisted) {
    issuedCanaryKeys.set(cacheKey, Promise.resolve(persisted));
    return persisted;
  }

  const pending = issueCanaryBetaKey({ baseUrl, fetchFn, label, userAgent }).then(async (key) => {
    await writePersistedCanaryKey(cacheKey, key);
    return key;
  });
  issuedCanaryKeys.set(cacheKey, pending);
  try {
    return await pending;
  } catch (error) {
    if (issuedCanaryKeys.get(cacheKey) === pending) {
      issuedCanaryKeys.delete(cacheKey);
    }
    throw error;
  }
}

async function readPersistedCanaryKey(baseUrl: string): Promise<string | null> {
  if (!canUsePersistentCache()) {
    return null;
  }
  try {
    const payload = JSON.parse(await readFile(canaryCachePath(baseUrl), "utf8")) as Partial<{ baseUrl: string; cachedAt: string; key: string }>;
    if (payload.baseUrl !== baseUrl || typeof payload.key !== "string" || !payload.key) {
      return null;
    }
    const cachedAt = typeof payload.cachedAt === "string" ? new Date(payload.cachedAt).getTime() : Number.NaN;
    const maxAgeMs = Number(process.env.NIPMOD_CANARY_KEY_CACHE_MAX_AGE_MS ?? DEFAULT_CACHE_MAX_AGE_MS);
    if (!Number.isFinite(cachedAt) || Date.now() - cachedAt > maxAgeMs) {
      return null;
    }
    return payload.key;
  } catch {
    return null;
  }
}

async function writePersistedCanaryKey(baseUrl: string, key: string): Promise<void> {
  if (!canUsePersistentCache()) {
    return;
  }
  try {
    const path = canaryCachePath(baseUrl);
    await mkdir(dirname(path), { mode: 0o700, recursive: true });
    await writeFile(path, JSON.stringify({ baseUrl, cachedAt: new Date().toISOString(), key }), { mode: 0o600 });
  } catch {
    // Canary key caching is an optimization; failed cache writes must not hide canary behavior.
  }
}

function canUsePersistentCache(): boolean {
  const flag = process.env.NIPMOD_CANARY_KEY_CACHE;
  if (flag === "0" || flag === "false") {
    return false;
  }
  return process.env.NODE_ENV !== "test" || Boolean(process.env.NIPMOD_CANARY_KEY_CACHE_FILE);
}

function canaryCachePath(baseUrl: string): string {
  if (process.env.NIPMOD_CANARY_KEY_CACHE_FILE) {
    return process.env.NIPMOD_CANARY_KEY_CACHE_FILE;
  }
  const digest = createHash("sha256").update(baseUrl).digest("hex").slice(0, 16);
  return join(process.env.NIPMOD_CANARY_KEY_CACHE_DIR ?? join(tmpdir(), "nipmod"), `canary-key-${digest}.json`);
}

async function issueCanaryBetaKey({
  baseUrl,
  fetchFn,
  label,
  userAgent
}: {
  baseUrl: string;
  fetchFn: typeof fetch;
  label: string;
  userAgent: string;
}): Promise<string> {
  const response = await fetchFn(`${baseUrl}/api/keys/beta`, {
    body: JSON.stringify({ label: `canary/${label}` }),
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": userAgent
    },
    method: "POST"
  });
  const payload = await response.json().catch(() => null);
  const key = payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).key === "string"
    ? ((payload as Record<string, string>).key)
    : "";
  if (!response.ok || !key) {
    throw new Error(`could not issue canary beta key: ${response.status}`);
  }
  return key;
}

export function canaryAuthHeaders(apiKey: string): Record<string, string> {
  return {
    "x-nipmod-api-key": apiKey
  };
}
