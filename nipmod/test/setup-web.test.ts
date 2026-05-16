import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { type CloudflareValidation, startSetupServer, type SetupServer } from "../src/setup-web.js";

let server: SetupServer | null = null;

afterEach(async () => {
  if (server) {
    await server.close();
    server = null;
  }
});

describe("setup web server", () => {
  test("serves the Cloudflare setup form", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-setup-web-"));
    server = await startSetupServer({
      envPath: join(dir, ".env.local"),
      port: 0
    });

    const response = await fetch(server.url);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Cloudflare");
    expect(html).toContain("nipmod.com");
  });

  test("validates and saves credentials through the local API", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-setup-save-"));
    const validation: CloudflareValidation = async () => ({
      accountId: "account-id",
      tokenId: "token-id",
      zoneId: "zone-id",
      zoneName: "nipmod.com"
    });
    server = await startSetupServer({
      envPath: join(dir, ".env.local"),
      port: 0,
      validateCloudflare: validation
    });

    const response = await fetch(`${server.url}/api/cloudflare`, {
      body: JSON.stringify({
        apiToken: "cf-secret-token",
        zoneName: "nipmod.com",
        validate: true
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    const body = (await response.json()) as { ok: true; token: string; zoneId: string };
    const env = await readFile(join(dir, ".env.local"), "utf8");

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.token).toBe("********oken");
    expect(body.zoneId).toBe("zone-id");
    expect(env).toContain("CLOUDFLARE_API_TOKEN=cf-secret-token");
    expect(env).toContain("CLOUDFLARE_ZONE_ID=zone-id");
  });
});
