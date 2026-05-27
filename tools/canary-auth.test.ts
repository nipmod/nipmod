import { afterEach, describe, expect, test, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readCanaryApiKey, resetCanaryAuthCacheForTests } from "./canary-auth.ts";

describe("canary auth", () => {
  afterEach(async () => {
    const cacheFile = process.env.NIPMOD_CANARY_KEY_CACHE_FILE;
    resetCanaryAuthCacheForTests();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    if (cacheFile) {
      await rm(cacheFile, { force: true });
    }
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
      userAgent: "nipmod-install-plan-canary-test"
    });
    const third = await readCanaryApiKey({
      baseUrl: "https://nipmod.test/",
      fetchFn: fetch,
      label: "archive",
      userAgent: "nipmod-archive-canary-test"
    });

    expect(first).toBe("nka_beta_cached");
    expect(second).toBe("nka_beta_cached");
    expect(third).toBe("nka_beta_cached");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test("reuses a persisted beta key across canary processes", async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), "nipmod-canary-auth-test-"));
    vi.stubEnv("NIPMOD_CANARY_KEY_CACHE_FILE", join(cacheDir, "canary-key.json"));
    const fetchFn = vi.fn(async () => Response.json({ key: "nka_beta_persisted" }));
    vi.stubGlobal("fetch", fetchFn);

    await expect(
      readCanaryApiKey({
        baseUrl: "https://nipmod.test",
        fetchFn: fetch,
        label: "source-depth",
        userAgent: "nipmod-canary-test"
      })
    ).resolves.toBe("nka_beta_persisted");

    resetCanaryAuthCacheForTests();

    await expect(
      readCanaryApiKey({
        baseUrl: "https://nipmod.test",
        fetchFn: fetch,
        label: "install-plan",
        userAgent: "nipmod-install-plan-canary-test"
      })
    ).resolves.toBe("nka_beta_persisted");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await rm(cacheDir, { force: true, recursive: true });
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
