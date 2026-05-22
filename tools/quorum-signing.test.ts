import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  assertQuorumReceiptIndexMatchesPackages,
  buildQuorumReceiptIndex,
  ensureQuorumSignerSet,
  quorumStatusForPackage
} from "./quorum-signing.ts";

describe("quorum signing", () => {
  test("passes only when release and security approvals match the exact package tuple", async () => {
    const keyDir = await mkdtemp(join(tmpdir(), "nipmod-quorum-test-"));
    try {
      const pkg = packageFixture();
      const { privateKeys, signersDocument } = await ensureQuorumSignerSet({
        generatedAt: "2026-05-20T00:00:00.000Z",
        keyDir
      });
      const receiptIndex = buildQuorumReceiptIndex({
        generatedAt: "2026-05-20T00:00:00.000Z",
        packages: [pkg],
        privateKeys,
        signersDocument
      });

      const status = quorumStatusForPackage(pkg, receiptIndex);
      expect(status).toMatchObject({
        approvedRoles: ["release", "security"],
        approvals: 2,
        status: "passed",
        threshold: 2
      });
      expect(() => assertQuorumReceiptIndexMatchesPackages([pkg], receiptIndex)).not.toThrow();

      const tampered = { ...pkg, digest: "b".repeat(64) };
      expect(quorumStatusForPackage(tampered, receiptIndex)).toMatchObject({
        approvals: 0,
        status: "failed"
      });
    } finally {
      await rm(keyDir, { force: true, recursive: true });
    }
  });
});

function packageFixture() {
  return {
    canonical: "pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader",
    digest: "a".repeat(64),
    sourceCommit: "1".repeat(40),
    sourceRepo: "https://node.nipmod.com/z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader.git",
    sourceTag: "v0.1.0",
    version: "0.1.0"
  };
}
