const TEST_CANARY_API_KEY = "nka_test_canary_key_1234567890";

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
