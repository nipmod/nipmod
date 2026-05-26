import { vi } from "vitest";
import { deriveApiKeyDigestForStorage } from "../lib/api-auth";

export const TEST_API_KEY = "nka_test_beta_route_key_1234567890";

const TEST_HASH_SECRET = "test-api-key-secret";

export function stubApiKeyAuth(): string {
  const hash = deriveApiKeyDigestForStorage(TEST_API_KEY, TEST_HASH_SECRET);
  vi.stubEnv("NIPMOD_API_KEY_HASH_SECRET", TEST_HASH_SECRET);
  vi.stubEnv("NIPMOD_API_KEY_HASHES", `route-test:beta:${hash}`);
  return TEST_API_KEY;
}

export function apiKeyHeaders(headers: Record<string, string> = {}): Record<string, string> {
  return {
    ...headers,
    "x-nipmod-api-key": TEST_API_KEY
  };
}
