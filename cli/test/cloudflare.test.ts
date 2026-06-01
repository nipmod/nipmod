import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  maskToken,
  normalizeCloudflareToken,
  saveCloudflareEnv,
  upsertEnvVars,
  validateCloudflareToken
} from "../src/cloudflare.js";

describe("cloudflare setup", () => {
  test("masks tokens without exposing the secret", () => {
    expect(maskToken("abc123456789")).toBe("********6789");
    expect(maskToken("short")).toBe("********");
  });

  test("normalizes pasted Bearer tokens", () => {
    expect(normalizeCloudflareToken("Bearer cf-secret-token")).toBe("cf-secret-token");
    expect(normalizeCloudflareToken("Authorization: Bearer cf-secret-token")).toBe("cf-secret-token");
    expect(normalizeCloudflareToken('CLOUDFLARE_API_TOKEN="cf-secret-token"')).toBe("cf-secret-token");
    expect(normalizeCloudflareToken("  cf-secret-token  ")).toBe("cf-secret-token");
  });

  test("upserts env vars while preserving unrelated values", () => {
    expect(
      upsertEnvVars("EXISTING=1\nCLOUDFLARE_API_TOKEN=old\n", {
        CLOUDFLARE_API_TOKEN: "new",
        CLOUDFLARE_ZONE_NAME: "nipmod.com"
      })
    ).toBe("EXISTING=1\nCLOUDFLARE_API_TOKEN=new\nCLOUDFLARE_ZONE_NAME=nipmod.com\n");
  });

  test("saves Cloudflare credentials to a chmod 600 env file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-cf-env-"));
    const envPath = join(dir, ".env.local");

    await saveCloudflareEnv(envPath, {
      apiToken: "token",
      accountId: "account",
      zoneId: "zone",
      zoneName: "nipmod.com"
    });

    const content = await readFile(envPath, "utf8");
    const mode = (await stat(envPath)).mode & 0o777;

    expect(content).toContain("CLOUDFLARE_API_TOKEN=token");
    expect(content).toContain("CLOUDFLARE_ZONE_NAME=nipmod.com");
    expect(content).toContain("CLOUDFLARE_ZONE_ID=zone");
    expect(content).toContain("CLOUDFLARE_ACCOUNT_ID=account");
    expect(mode).toBe(0o600);
  });

  test("validates token and resolves nipmod.com zone", async () => {
    const calls: string[] = [];
    const authHeaders: string[] = [];
    const fakeFetch: typeof fetch = async (url, init) => {
      calls.push(String(url));
      authHeaders.push(new Headers(init?.headers).get("authorization") ?? "");
      if (String(url).includes("/user/tokens/verify")) {
        return jsonResponse({ success: true, result: { id: "token-id", status: "active" } });
      }

      return jsonResponse({
        success: true,
        result: [{ id: "zone-id", account: { id: "account-id" }, name: "nipmod.com" }]
      });
    };

    const result = await validateCloudflareToken(
      { apiToken: "Bearer token", zoneName: "nipmod.com" },
      { fetch: fakeFetch }
    );

    expect(result.zoneId).toBe("zone-id");
    expect(result.accountId).toBe("account-id");
    expect(calls.some((url) => url.includes("name=nipmod.com"))).toBe(true);
    expect(authHeaders).toEqual(["Bearer token", "Bearer token"]);
  });

  test("surfaces Cloudflare API error messages on failed responses", async () => {
    const fakeFetch: typeof fetch = async () =>
      jsonResponse(
        {
          errors: [{ code: 10000, message: "Authentication error" }],
          success: false
        },
        400
      );

    await expect(
      validateCloudflareToken({ apiToken: "bad-token", zoneName: "nipmod.com" }, { fetch: fakeFetch })
    ).rejects.toThrow(/400.*Authentication error/i);
  });

  test("rejects whitespace tokens before making a request", async () => {
    let called = false;
    const fakeFetch: typeof fetch = async () => {
      called = true;
      return jsonResponse({ success: true });
    };

    await expect(
      validateCloudflareToken({ apiToken: "not a cloudflare token", zoneName: "nipmod.com" }, { fetch: fakeFetch })
    ).rejects.toThrow(/cannot contain whitespace/i);
    expect(called).toBe(false);
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status
  });
}
