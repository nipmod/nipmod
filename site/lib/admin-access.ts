import { scryptSync, timingSafeEqual } from "node:crypto";
import type { ApiAccess } from "./api-auth";

type AdminAccessEnv = Record<string, string | undefined>;

const ADMIN_PASSWORD_HASH_ENV = "NIPMOD_ADMIN_PASSWORD_HASH";
const ADMIN_PASSWORD_SALT_ENV = "NIPMOD_ADMIN_PASSWORD_SALT";
const ADMIN_PASSWORD_MIN_LENGTH = 8;
const ADMIN_PASSWORD_MAX_LENGTH = 256;

export function readAdminPasswordAccess(request: Request, env: AdminAccessEnv = process.env): ApiAccess | null {
  const provided = readProvidedCredential(request);
  const expectedHash = env[ADMIN_PASSWORD_HASH_ENV]?.toLowerCase();
  const salt = env[ADMIN_PASSWORD_SALT_ENV];
  if (!provided || !expectedHash || !salt || !/^[a-f0-9]{64}$/.test(expectedHash)) {
    return null;
  }
  if (provided.length < ADMIN_PASSWORD_MIN_LENGTH || provided.length > ADMIN_PASSWORD_MAX_LENGTH) {
    return null;
  }

  const providedHash = deriveAdminPasswordHash(provided, salt);
  if (!constantTimeEqual(providedHash, expectedHash)) {
    return null;
  }

  return {
    authenticated: true,
    headers: {
      "x-nipmod-access-tier": "admin",
      "x-nipmod-key-id": "admin_password"
    },
    keyId: "admin_password",
    limitMultiplier: 200,
    subject: "admin-password",
    tier: "admin"
  };
}

export function deriveAdminPasswordHash(password: string, salt: string): string {
  return scryptSync(password, salt, 32).toString("hex");
}

function readProvidedCredential(request: Request): string | null {
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

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
