import { afterEach, describe, expect, test, vi } from "vitest";
import { OPTIONS, POST } from "../app/api/admin/keys/route";
import { deriveAdminPasswordHash } from "../lib/admin-access";
import { deriveApiKeyDigestForStorage } from "../lib/api-auth";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("admin keys route", () => {
  test("uses restricted CORS for admin preflights", () => {
    const response = OPTIONS(
      new Request("https://nipmod.com/api/admin/keys", {
        headers: {
          origin: "https://evil.example"
        }
      })
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://nipmod.com");
    expect(response.headers.get("vary")).toContain("Origin");
  });

  test("requires admin access", async () => {
    const response = await POST(
      new Request("https://nipmod.com/api/admin/keys", {
        body: JSON.stringify({ action: "cleanup-stale-beta" }),
        headers: {
          "content-type": "application/json",
          origin: "https://nipmod.com"
        },
        method: "POST"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://nipmod.com");
    expect(body).toMatchObject({
      code: "insufficient_api_access",
      status: 403,
      type: "dev.nipmod.api-error.v1"
    });
  });

  test("accepts configured admin password for key management", async () => {
    const password = "test-admin";
    const salt = "test-admin-password-salt";
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/rest/v1/api_keys?") && init?.method === "PATCH") {
        return Response.json([]);
      }
      return Response.json({ error: "unexpected test URL" }, { status: 500 });
    }) as unknown as typeof fetch;

    vi.stubEnv("NIPMOD_ADMIN_PASSWORD_HASH", deriveAdminPasswordHash(password, salt));
    vi.stubEnv("NIPMOD_ADMIN_PASSWORD_SALT", salt);
    vi.stubEnv("NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    vi.stubEnv("NIPMOD_ARCHIVE_SUPABASE_URL", "https://db.example.test");
    vi.stubEnv("NIPMOD_RATE_LIMIT_STORE", "memory");
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("https://nipmod.com/api/admin/keys", {
        body: JSON.stringify({ action: "cleanup-stale-beta", olderThanHours: 24 }),
        headers: {
          authorization: `Bearer ${password}`,
          "content-type": "application/json"
        },
        method: "POST"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-nipmod-access-tier")).toBe("admin");
    expect(body).toMatchObject({
      action: "cleanup-stale-beta",
      affectedCount: 0,
      ok: true
    });
    expect(JSON.stringify(body)).not.toContain(password);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("revokes a key without returning raw key material", async () => {
    const rawKey = "nka_test_admin_key_for_key_management_123456";
    const hashSecret = "test-admin-key-management-secret";
    const hash = deriveApiKeyDigestForStorage(rawKey, hashSecret);
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/rest/v1/api_keys?") && init?.method === "PATCH") {
        const parsed = new URL(url);
        expect(parsed.searchParams.get("id")).toBe("eq.key_1234567890abcdef");
        expect(parsed.searchParams.get("status")).toBe("eq.active");
        expect(parsed.searchParams.get("select")).toContain("id,label,tier,status");
        expect(init.headers).toMatchObject({ Prefer: "return=representation" });
        expect(JSON.parse(String(init.body))).toMatchObject({ status: "revoked" });
        return Response.json([
          {
            created_at: "2026-05-24T00:00:00.000Z",
            expires_at: "2026-08-22T00:00:00.000Z",
            id: "key_1234567890abcdef",
            label: "self-serve/agent",
            rate_limit_multiplier: 10,
            revoked_at: "2026-05-25T00:00:00.000Z",
            status: "revoked",
            tier: "beta"
          }
        ]);
      }
      if (url.endsWith("/rest/v1/api_usage_events")) {
        return new Response(null, { status: 204 });
      }
      return Response.json({ error: "unexpected test URL" }, { status: 500 });
    }) as unknown as typeof fetch;

    vi.stubEnv("NIPMOD_API_KEY_HASH_SECRET", hashSecret);
    vi.stubEnv("NIPMOD_API_KEY_HASHES", `ops:admin:${hash}`);
    vi.stubEnv("NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    vi.stubEnv("NIPMOD_ARCHIVE_SUPABASE_URL", "https://db.example.test");
    vi.stubEnv("NIPMOD_RATE_LIMIT_STORE", "memory");
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("https://nipmod.com/api/admin/keys", {
        body: JSON.stringify({ action: "revoke", keyId: "key_1234567890abcdef" }),
        headers: {
          authorization: `Bearer ${rawKey}`,
          "content-type": "application/json",
          origin: "https://nipmod.com"
        },
        method: "POST"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://nipmod.com");
    expect(body).toMatchObject({
      action: "revoke",
      affectedCount: 1,
      keys: [{ id: "key_1234567890abcdef", status: "revoked" }],
      ok: true,
      type: "dev.nipmod.admin-key-action.v1"
    });
    expect(JSON.stringify(body)).not.toContain(rawKey);
    expect(JSON.stringify(body)).not.toContain(hash);
    expect(JSON.stringify(body)).not.toContain("service-role-key");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("cleans stale self-serve beta keys only", async () => {
    const rawKey = "nka_test_admin_key_for_cleanup_123456";
    const hashSecret = "test-admin-cleanup-secret";
    const hash = deriveApiKeyDigestForStorage(rawKey, hashSecret);
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/rest/v1/api_keys?") && init?.method === "PATCH") {
        const parsed = new URL(url);
        expect(parsed.searchParams.get("tier")).toBe("eq.beta");
        expect(parsed.searchParams.get("status")).toBe("eq.active");
        expect(parsed.searchParams.get("label")).toBe("like.self-serve/%");
        expect(parsed.searchParams.get("created_at")).toMatch(/^lt\./);
        return Response.json([]);
      }
      if (url.endsWith("/rest/v1/api_usage_events")) {
        return new Response(null, { status: 204 });
      }
      return Response.json({ error: "unexpected test URL" }, { status: 500 });
    }) as unknown as typeof fetch;

    vi.stubEnv("NIPMOD_API_KEY_HASH_SECRET", hashSecret);
    vi.stubEnv("NIPMOD_API_KEY_HASHES", `ops:admin:${hash}`);
    vi.stubEnv("NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    vi.stubEnv("NIPMOD_ARCHIVE_SUPABASE_URL", "https://db.example.test");
    vi.stubEnv("NIPMOD_RATE_LIMIT_STORE", "memory");
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("https://nipmod.com/api/admin/keys", {
        body: JSON.stringify({ action: "cleanup-stale-beta", olderThanHours: 24 }),
        headers: {
          authorization: `Bearer ${rawKey}`,
          "content-type": "application/json"
        },
        method: "POST"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      action: "cleanup-stale-beta",
      affectedCount: 0,
      ok: true
    });
  });

  test("blocks current admin key self-modification", async () => {
    const rawKey = "nka_test_admin_key_self_modify_123456";
    const hashSecret = "test-admin-self-secret";
    const hash = deriveApiKeyDigestForStorage(rawKey, hashSecret);
    const currentKeyId = `key_${hash.slice(0, 16)}`;
    const fetchMock = vi.fn(async () => {
      return Response.json({ error: "unexpected patch" }, { status: 500 });
    }) as unknown as typeof fetch;

    vi.stubEnv("NIPMOD_API_KEY_HASH_SECRET", hashSecret);
    vi.stubEnv("NIPMOD_API_KEY_HASHES", `ops:admin:${hash}`);
    vi.stubEnv("NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    vi.stubEnv("NIPMOD_ARCHIVE_SUPABASE_URL", "https://db.example.test");
    vi.stubEnv("NIPMOD_RATE_LIMIT_STORE", "memory");
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("https://nipmod.com/api/admin/keys", {
        body: JSON.stringify({ action: "revoke", keyId: currentKeyId }),
        headers: {
          authorization: `Bearer ${rawKey}`,
          "content-type": "application/json"
        },
        method: "POST"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      code: "cannot_modify_current_admin_key",
      status: 400,
      type: "dev.nipmod.api-error.v1"
    });
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });
});
