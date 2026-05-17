import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { proofContent } from "../app/proof/content";

const root = resolve(import.meta.dirname, "../..");
const blockedFixtureLabels = [
  "postinstall",
  "exec",
  "broad network",
  "secret env",
  "secret scope",
  "write path",
  "prompt injection metadata"
];

describe("public proof content", () => {
  test("shows the canonical public proof loop without marketing filler", () => {
    expect(proofContent.headline).toBe("Proof you can run");
    expect(proofContent.lead.length).toBeLessThanOrEqual(120);
    expect(JSON.stringify(proofContent)).not.toMatch(/unlock|supercharge|revolutionary|magical|seamless/i);
  });

  test("uses live package manager commands and exact block cases", () => {
    expect(proofContent.safeCommands[0]).toMatch(
      /^nipmod inspect pkg:did:key:z[A-Za-z0-9]+\/gitlawb-release-review@0\.1\.0$/
    );
    expect(proofContent.safeCommands.slice(1)).toEqual([
      "nipmod install gitlawb-release-review",
      "nipmod audit --online",
      "nipmod ci --online"
    ]);
    expect(proofContent.blockedCases.map((item) => item.label)).toEqual([
      "postinstall",
      "exec",
      "broad network",
      "secret env",
      "secret scope",
      "write path",
      "prompt injection metadata"
    ]);
  });

  test("pins the current public proof state", () => {
    expect(proofContent.registry.count).toBe(28);
    expect(proofContent.registry.trust).toBe("verified/100");
    expect(proofContent.registry.treeSize).toBe(32);
    expect(proofContent.registry.rootHash).toMatch(/^[a-f0-9]{64}$/);
    expect(proofContent.transcript).toBe("/proof/transcript.json");
  });

  test("keeps the public proof transcript aligned with registry data and unsafe fixtures", async () => {
    const [registry, transcript] = await Promise.all([
      readJson("site/app/registry-data.json"),
      readJson("site/public/proof/transcript.json")
    ]);

    expect(transcript.registry.packages).toBe(registry.packages.length);
    expect(transcript.registry.treeSize).toBe(registry.transparencyLog.treeHead.treeSize);
    expect(transcript.blocked.map((item: { label: string }) => item.label)).toEqual(blockedFixtureLabels);
    expect(transcript.blocked.every((item: { ok: boolean; exitCode: number }) => item.ok && item.exitCode !== 0)).toBe(
      true
    );
  });
});

async function readJson(path: string) {
  return JSON.parse(await readFile(join(root, path), "utf8"));
}
