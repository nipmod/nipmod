import { generateKeyPairSync } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { createAdvisoryPublicKeyInfo } from "./advisory-signing.ts";
import { runAdvisoryDrill } from "./advisory-drill.ts";

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
    const registryPath = join(dir, "packages.json");
    await writeFile(registryPath, `${JSON.stringify(registryFixture(), null, 2)}\n`);

    const result = await runAdvisoryDrill({
      advisoryPrivateKeyPath: privateKeyPath,
      advisoryPublicKeyPath: publicKeyPath,
      outputDir: dir,
      registrySource: pathToFileURL(registryPath).href,
      runCommand: mockNipmodCommand,
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

function registryFixture() {
  return {
    formatVersion: 1,
    generatedAt: "2026-05-22T00:00:00.000Z",
    packages: [
      {
        canonical: "pkg:did:key:z6Mk/repo-readme-audit",
        digest: "a".repeat(64),
        name: "repo-readme-audit",
        publisher: "did:key:z6Mk",
        repo: "repo-readme-audit",
        trust: {
          level: "verified",
          score: 100
        },
        version: "1.0.0"
      }
    ],
    source: "test",
    transparencyLog: {
      treeHead: {
        logId: "did:key:z6Mktestlog"
      },
      witnesses: [
        {
          witness: "did:key:z6Mktestwitness"
        }
      ]
    }
  };
}

async function mockNipmodCommand(args) {
  const command = args[0];
  const advisoryFinding = "NIPMOD-2026-9001: Quarantine dry-run advisory";
  if (command === "audit") {
    return {
      data: {
        packages: [{ findings: [advisoryFinding] }],
        ready: false,
        summary: { fail: 1, ok: 0, total: 1, warn: 0 }
      },
      exitCode: 6
    };
  }
  if (command === "ci") {
    return {
      data: {
        ready: false,
        violations: [{ findings: [advisoryFinding] }]
      },
      exitCode: 8
    };
  }
  if (command === "inspect") {
    return {
      data: {
        report: {
          findings: [`package is quarantined: ${advisoryFinding}`],
          readyToInstall: false
        }
      },
      exitCode: 7
    };
  }
  if (command === "install") {
    return {
      data: {
        plan: {
          readyToInstall: false,
          trustReport: {
            findings: [`package is quarantined: ${advisoryFinding}`]
          }
        }
      },
      exitCode: 7
    };
  }
  throw new Error(`unexpected mocked command: ${command}`);
}
