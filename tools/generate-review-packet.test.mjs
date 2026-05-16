import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..");

describe("independent review packet generator", () => {
  test("writes a reproducible external review packet", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-review-packet-"));
    const outPath = join(dir, "packet.md");
    try {
      const result = spawnSync(process.execPath, ["tools/generate-review-packet.mjs", outPath], {
        cwd: root,
        encoding: "utf8"
      });
      expect(result.status, result.stderr || result.stdout).toBe(0);
      const payload = JSON.parse(result.stdout);
      expect(payload).toMatchObject({
        ok: true,
        type: "dev.nipmod.review-packet.v1"
      });

      const packet = await readFile(outPath, "utf8");
      expect(packet).toContain("node tools/verify-all.mjs --prod");
      expect(packet).toContain("https://nipmod.com/.well-known/security.txt");
      expect(packet).toContain("Do not claim adoption from page views alone");
      expect(packet).toContain("Conflicting digests fail closed");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
