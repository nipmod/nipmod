import { generateKeyPairSync } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { createAdvisoryPublicKeyInfo } from "./advisory-signing.mjs";
import { runAdvisoryDrill } from "./advisory-drill.mjs";

const root = resolve(import.meta.dirname, "..");

describe("advisory drill", () => {
  test("creates a signed quarantine advisory dry-run that blocks audit and ci without mutating the public feed", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-advisory-drill-"));
    const privateKeyPath = join(dir, "advisory-private.pem");
    const publicKeyPath = join(dir, "advisory-public.json");
    const beforePublicFeed = await readFile(join(root, "site", "public", "advisories.json"), "utf8");
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    await writeFile(privateKeyPath, privateKey.export({ format: "pem", type: "pkcs8" }));
    await writeFile(publicKeyPath, `${JSON.stringify(createAdvisoryPublicKeyInfo(publicKey), null, 2)}\n`);

    const result = await runAdvisoryDrill({
      advisoryPrivateKeyPath: privateKeyPath,
      advisoryPublicKeyPath: publicKeyPath,
      outputDir: dir,
      registrySource: pathToFileURL(join(root, "site", "public", "registry", "packages.json")).href,
      target: "repo-readme-audit"
    });

    expect(result.mode).toBe("dry-run");
    expect(result.target.name).toBe("repo-readme-audit");
    expect(result.advisory.severity).toBe("high");
    expect(result.audit.exitCode).toBe(6);
    expect(result.audit.summary).toEqual({ fail: 1, ok: 0, total: 1, warn: 0 });
    expect(result.audit.findings).toEqual(
      expect.arrayContaining([`${result.advisory.id}: Quarantine dry-run advisory`])
    );
    expect(result.ci.exitCode).toBe(8);
    expect(result.ci.ready).toBe(false);
    expect(result.ci.violations[0]?.findings).toEqual(
      expect.arrayContaining([`${result.advisory.id}: Quarantine dry-run advisory`])
    );
    expect(result.inspect.exitCode).toBe(7);
    expect(result.inspect.findings).toEqual(
      expect.arrayContaining([`package is quarantined: ${result.advisory.id}: Quarantine dry-run advisory`])
    );
    expect(result.installPlan.exitCode).toBe(7);
    expect(result.installPlan.readyToInstall).toBe(false);
    expect(await readFile(join(root, "site", "public", "advisories.json"), "utf8")).toBe(beforePublicFeed);
  }, 20_000);
});
