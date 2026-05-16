import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const siteRoot = join(import.meta.dirname, "..");
const registry = JSON.parse(readFileSync(join(siteRoot, "app", "registry-data.json"), "utf8"));
const publicRegistry = JSON.parse(readFileSync(join(siteRoot, "public", "registry", "packages.json"), "utf8"));
const receiptIndex = JSON.parse(readFileSync(join(siteRoot, "public", "compatibility", "receipts.json"), "utf8"));

describe("compatibility receipts", () => {
  test("publishes the three launch compatibility receipt formats", () => {
    expect(receiptIndex).toMatchObject({
      formatVersion: 1,
      type: "dev.nipmod.compatibility-receipts.v1"
    });
    expect(receiptIndex.receipts.map((receipt: { externalFormat: string }) => receipt.externalFormat).sort()).toEqual([
      "apm-package",
      "git-source-provenance",
      "mcp-server-json"
    ]);
  });

  test("binds every receipt to an exact verified registry package", () => {
    for (const receipt of receiptIndex.receipts) {
      const pkg = registry.packages.find(
        (candidate: { canonical: string; version: string }) =>
          candidate.canonical === receipt.package && candidate.version === receipt.version
      );

      expect(pkg, receipt.id).toBeTruthy();
      expect(pkg.trust).toMatchObject({ level: "verified", score: 100 });
      expect(receipt.packageDigest).toBe(pkg.digest);
      expect(receipt.sourceRepo).toBe(pkg.sourceRepo);
      expect(receipt.sourceCommit).toBe(pkg.sourceCommit);
      expect(receipt.sourceTag).toBe(pkg.sourceTag);
      expect(receipt.provenanceLoss).toEqual([]);
      expect(pkg.compatibilityReceipts).toContainEqual(expect.objectContaining({ id: receipt.id }));
    }
  });

  test("keeps receipt example hashes exact", () => {
    for (const receipt of receiptIndex.receipts) {
      const url = new URL(receipt.exampleUrl);
      expect(url.origin).toBe("https://nipmod.com");
      const filePath = join(siteRoot, "public", url.pathname);

      expect(receipt.externalInputSha256).toBe(sha256(filePath));
    }
  });

  test("keeps app and public registries in sync", () => {
    expect(publicRegistry.packages.map(packageKey)).toEqual(registry.packages.map(packageKey));
    for (const pkg of publicRegistry.packages) {
      const appPackage = registry.packages.find(
        (candidate: { canonical: string; version: string }) =>
          candidate.canonical === pkg.canonical && candidate.version === pkg.version
      );
      expect(pkg.compatibilityReceipts ?? []).toEqual(appPackage?.compatibilityReceipts ?? []);
    }
  });
});

function packageKey(pkg: { canonical: string; version: string }): string {
  return `${pkg.canonical}@${pkg.version}`;
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
