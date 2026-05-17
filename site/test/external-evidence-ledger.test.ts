import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("external evidence ledger", () => {
  test("does not claim adoption beyond redacted receipts", async () => {
    const ledger = JSON.parse(await readFile(join(root, "site", "public", "review", "evidence-ledger.json"), "utf8"));
    const receipts = ledger.receipts as Array<{ type?: string }>;

    expect(ledger.type).toBe("dev.nipmod.external-evidence-ledger.v1");
    expect(ledger.counts.firstUserReceipts).toBe(receipts.filter((receipt) => receipt.type === "first-user").length);
    expect(ledger.counts.packageAuthorDryRuns).toBe(receipts.filter((receipt) => receipt.type === "package-author-dry-run").length);
    expect(ledger.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "review-packet", url: "https://nipmod.com/review/packet.json" }),
        expect.objectContaining({ type: "evidence-manifest", url: "https://nipmod.com/review/evidence-manifest.json" }),
        expect.objectContaining({ type: "synthetic-monitor", url: "https://nipmod-monitor.fly.dev/last" })
      ])
    );
    expect(JSON.stringify(ledger)).not.toMatch(/sk-[A-Za-z0-9]|BEGIN PRIVATE KEY|TOKEN=/);
  });
});
