import { createHash, timingSafeEqual } from "node:crypto";
import { type ApiHttpContext, apiJson, createApiHttpContext } from "./api-http";

type ApiAuthEnv = Record<string, string | undefined>;

export type ApiAccessTier = "public" | "builder" | "partner" | "admin";

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

const API_KEY_HASHES_ENV = "NIPMOD_API_KEY_SHA256S";
const API_KEY_MIN_LENGTH = 24;

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

  const configured = readConfiguredKeys(env);
  if (configured.length === 0) {
    return unauthorized(context, "api keys are not enabled on this deployment");
  }

  const providedHash = sha256(provided);
  const match = configured.find((candidate) => constantTimeEqual(candidate.hash, providedHash));
  if (!match) {
    return unauthorized(context, "api key is invalid");
  }

  const access: ApiAccess = {
    authenticated: true,
    headers: {
      "x-nipmod-access-tier": match.tier,
      "x-nipmod-key-id": match.id
    },
    keyId: match.id,
    limitMultiplier: tierMultiplier(match.tier),
    subject: match.label,
    tier: match.tier
  };
  return { access, ok: true };
}

export function publicApiAccess(): ApiAccess {
  return PUBLIC_ACCESS;
}

export function fingerprintApiKey(rawKey: string): string {
  return `key_${sha256(rawKey).slice(0, 16)}`;
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
  tier: ApiAccessTier;
}

function readConfiguredKeys(env: ApiAuthEnv): ConfiguredKey[] {
  const raw = env[API_KEY_HASHES_ENV];
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((entry) => parseConfiguredKey(entry.trim()))
    .filter((entry): entry is ConfiguredKey => entry !== null);
}

function parseConfiguredKey(entry: string): ConfiguredKey | null {
  const [label, tierValue, hashValue] = entry.split(":");
  const tier = readTier(tierValue);
  const hash = hashValue?.toLowerCase();
  if (!label || !tier || !hash || !/^[a-f0-9]{64}$/.test(hash)) {
    return null;
  }
  return {
    hash,
    id: `key_${hash.slice(0, 16)}`,
    label: label.replace(/[^\w./-]/g, "").slice(0, 80) || "api-key",
    tier
  };
}

function readTier(value: string | undefined): ApiAccessTier | null {
  if (value === "builder" || value === "partner" || value === "admin" || value === "public") {
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
    case "builder":
      return 10;
    case "public":
      return 1;
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
