import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import nextConfig from "../next.config";
import { adminContentSecurityPolicy } from "../proxy";

const root = resolve(import.meta.dirname, "../..");
const siteRoot = join(root, "site");

describe("public security policy", () => {
  test("publishes security.txt with canonical policy contacts", async () => {
    const securityTxt = await readFile(join(siteRoot, "public", ".well-known", "security.txt"), "utf8");

    expect(securityTxt).toContain("Contact: https://nipmod.com/security");
    expect(securityTxt).toContain("Contact: https://x.com/Nipmod");
    expect(securityTxt).toContain("Canonical: https://nipmod.com/.well-known/security.txt");
    expect(securityTxt).toContain("Policy: https://nipmod.com/security");
    expect(securityTxt).toContain("Expires: 2027-05-16T00:00:00.000Z");
  });

  test("root security policy documents third party source quarantine limits", async () => {
    const policy = await readFile(join(root, "SECURITY.md"), "utf8");

    expect(policy).toContain("Nipmod cannot delete third-party packages from their original source");
    expect(policy).toContain("publish signed advisories");
    expect(policy).toContain("quarantined");
    expect(policy).toContain("third party audit status");
  });

  test("Next.js sends baseline browser security headers", async () => {
    const headers = await nextConfig.headers?.();
    const globalHeaders = Object.fromEntries(headers?.find((entry) => entry.source === "/(.*)")?.headers.map((header) => [header.key, header.value]) ?? []);

    expect(globalHeaders["Strict-Transport-Security"]).toContain("max-age=63072000");
    expect(globalHeaders["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(globalHeaders["Content-Security-Policy"]).not.toContain("'unsafe-eval'");
    expect(globalHeaders["Content-Security-Policy"]).toContain("script-src 'self' 'unsafe-inline'");
    expect(globalHeaders["Content-Security-Policy"]).toContain("script-src-attr 'none'");
    expect(globalHeaders["Content-Security-Policy"]).toContain(
      "connect-src 'self' https://node.nipmod.com https://nipmod-witness.fly.dev"
    );
    expect(nextConfig.experimental?.sri?.algorithm).toBe("sha256");
    expect(globalHeaders["X-Content-Type-Options"]).toBe("nosniff");
    expect(globalHeaders["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(globalHeaders["Permissions-Policy"]).toContain("camera=()");
  });

  test("admin CSP is nonce based and does not allow inline scripts by default", () => {
    const policy = adminContentSecurityPolicy("test-nonce", false);

    expect(policy).toContain("script-src 'self' 'nonce-test-nonce' 'strict-dynamic'");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).toContain("script-src-attr 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
  });
});
