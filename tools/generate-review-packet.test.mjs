import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
      expect(packet).toContain("node tools/prod-synthetic-monitor.mjs");
      expect(packet).toContain("node tools/restore-drill.mjs");
      expect(packet).toContain("node tools/public-proof-loop.mjs --registry https://nipmod.com/registry/packages.json");
      expect(packet).toContain("## Catalog Depth");
      expect(packet).toContain("## Trust Model");
      expect(packet).toContain("https://nipmod.com/.well-known/security.txt");
      expect(packet).toContain("Do not claim adoption from page views alone");
      expect(packet).toContain("Conflicting digests fail closed");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("embeds required evidence outputs when an evidence directory is supplied", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-review-packet-"));
    const evidenceDir = join(dir, "evidence");
    const outPath = join(dir, "packet.md");
    const files = [
      "verify-all-prod.txt",
      "prod-load-smoke.txt",
      "prod-synthetic-monitor.txt",
      "restore-drill.txt",
      "supply-chain-check.txt",
      "browser-e2e.txt",
      "public-proof-loop.json"
    ];
    try {
      await mkdir(evidenceDir, { recursive: true });
      for (const file of files) {
        await writeFile(join(evidenceDir, file), `${file} ok\n`);
      }
      const result = spawnSync(process.execPath, ["tools/generate-review-packet.mjs", outPath, "--evidence-dir", evidenceDir], {
        cwd: root,
        encoding: "utf8"
      });
      expect(result.status, result.stderr || result.stdout).toBe(0);

      const packet = await readFile(outPath, "utf8");
      expect(packet).toContain("## Attached Evidence");
      expect(packet).toContain("verify-all-prod.txt ok");
      expect(packet).toContain("public-proof-loop.json ok");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
