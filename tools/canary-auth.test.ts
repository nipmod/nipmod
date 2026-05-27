import { afterEach, describe, expect, test, vi } from "vitest";
import { readCanaryApiKey, resetCanaryAuthCacheForTests } from "./canary-auth.ts";

describe("canary auth", () => {
  afterEach(() => {
    resetCanaryAuthCacheForTests();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test("reuses one issued beta key across canary calls in the same process", async () => {
    const fetchFn = vi.fn(async () => Response.json({ key: "nka_beta_cached" }));
    vi.stubGlobal("fetch", fetchFn);

    const first = await readCanaryApiKey({
      baseUrl: "https://nipmod.test",
      fetchFn: fetch,
      label: "source-depth",
      userAgent: "nipmod-canary-test"
    });
    const second = await readCanaryApiKey({
      baseUrl: "https://nipmod.test",
      fetchFn: fetch,
      label: "install-plan",
      userAgent: "nipmod-canary-test"
    });

    expect(first).toBe("nka_beta_cached");
    expect(second).toBe("nka_beta_cached");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test("does not cache failed beta key issuance", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ error: "limited" }, { status: 429 }))
      .mockResolvedValueOnce(Response.json({ key: "nka_beta_retry" }));
    vi.stubGlobal("fetch", fetchFn);

    await expect(
      readCanaryApiKey({
        baseUrl: "https://nipmod.test",
        fetchFn: fetch,
        label: "source-depth",
        userAgent: "nipmod-canary-test"
      })
    ).rejects.toThrow("could not issue canary beta key: 429");

    await expect(
      readCanaryApiKey({
        baseUrl: "https://nipmod.test",
        fetchFn: fetch,
        label: "source-depth",
        userAgent: "nipmod-canary-test"
      })
    ).resolves.toBe("nka_beta_retry");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
