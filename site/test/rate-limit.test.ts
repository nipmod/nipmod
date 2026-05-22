import { describe, expect, test } from "vitest";
import { createApiHttpContext } from "../lib/api-http";
import { checkRateLimit } from "../lib/rate-limit";

describe("API rate limits", () => {
  test("returns the public API error contract with request headers", async () => {
    const request = new Request("https://nipmod.com/api/search", {
      headers: {
        "user-agent": "rate-limit-test",
        "x-forwarded-for": `203.0.113.${Math.floor(Math.random() * 200) + 1}`,
        "x-request-id": "test-request-1"
      }
    });
    const context = createApiHttpContext(request);

    expect(checkRateLimit(request, { limit: 1, name: "test-rate-limit", windowMs: 60_000 }, context).ok).toBe(true);
    const limited = checkRateLimit(request, { limit: 1, name: "test-rate-limit", windowMs: 60_000 }, context);

    expect(limited.ok).toBe(false);
    expect(limited.response?.status).toBe(429);
    expect(limited.response?.headers.get("access-control-allow-origin")).toBe("*");
    expect(limited.response?.headers.get("retry-after")).toBeTruthy();
    expect(limited.response?.headers.get("x-nipmod-request-id")).toBe("test-request-1");
    await expect(limited.response?.json()).resolves.toMatchObject({
      code: "rate_limited",
      retryable: true,
      source: null,
      status: 429,
      type: "dev.nipmod.api-error.v1"
    });
  });
});
