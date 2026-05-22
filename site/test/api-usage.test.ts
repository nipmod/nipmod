import { describe, expect, test, vi } from "vitest";
import { createApiHttpContext } from "../lib/api-http";
import { publicApiAccess } from "../lib/api-auth";
import { recordApiUsage, usageStoreStatus } from "../lib/api-usage";

describe("API usage logging", () => {
  test("stores hashed usage fields without raw query, package, client or key data", async () => {
    const rows: unknown[] = [];
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      rows.push(JSON.parse(String(init?.body))[0]);
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;
    const request = new Request("https://nipmod.com/api/search?q=secret%20package&sources=npm,pypi&limit=2", {
      headers: {
        "user-agent": "raw-user-agent",
        "x-forwarded-for": "203.0.113.20",
        "x-request-id": "usage-test"
      }
    });
    const context = createApiHttpContext(request);

    await recordApiUsage(
      {
        access: publicApiAccess(),
        context,
        request,
        responseBody: {
          records: [],
          sources: ["npm", "pypi"],
          total: 0,
          type: "dev.nipmod.external-search.v1"
        },
        route: "/api/search",
        status: 200
      },
      {
        NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        NIPMOD_ARCHIVE_SUPABASE_URL: "https://db.example.test",
        NIPMOD_USAGE_HASH_SALT: "test-salt"
      },
      fetchMock
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      access_tier: "public",
      method: "GET",
      request_id: "usage-test",
      result_count: 0,
      route: "/api/search",
      sources: ["npm", "pypi"],
      status: 200
    });
    expect(JSON.stringify(rows[0])).not.toContain("secret package");
    expect(JSON.stringify(rows[0])).not.toContain("raw-user-agent");
    expect(JSON.stringify(rows[0])).not.toContain("203.0.113.20");
    expect(JSON.stringify(rows[0])).not.toContain("service-role-key");
  });

  test("reports usage store status without secrets", () => {
    expect(usageStoreStatus({})).toMatchObject({
      configured: false,
      driver: "supabase-rest",
      type: "dev.nipmod.usage-store-status.v1"
    });
  });
});
