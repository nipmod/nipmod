import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import nextConfig from "../next.config";

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

  test("root security policy documents decentralized quarantine limits", async () => {
    const policy = await readFile(join(root, "SECURITY.md"), "utf8");

    expect(policy).toContain("nipmod cannot delete decentralized Gitlawb content");
    expect(policy).toContain("publish signed advisories");
    expect(policy).toContain("quarantined");
    expect(policy).toContain("third party audit status");
  });

  test("Next.js sends baseline browser security headers", async () => {
    const headers = await nextConfig.headers?.();
    const globalHeaders = Object.fromEntries(headers?.find((entry) => entry.source === "/(.*)")?.headers.map((header) => [header.key, header.value]) ?? []);

    expect(globalHeaders["Strict-Transport-Security"]).toContain("max-age=63072000");
    expect(globalHeaders["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(globalHeaders["X-Content-Type-Options"]).toBe("nosniff");
    expect(globalHeaders["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(globalHeaders["Permissions-Policy"]).toContain("camera=()");
  });
});
