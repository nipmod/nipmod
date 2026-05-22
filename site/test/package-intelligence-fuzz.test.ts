import { describe, expect, test } from "vitest";
import { createPackageIntelligenceRecord } from "../lib/package-intelligence";
import type { ExternalPackageRecord } from "../lib/external-packages";

describe("package intelligence fuzz coverage", () => {
  test("handles generated install command inputs without throwing", () => {
    for (const command of generatedInstallCommands()) {
      const record = createPackageIntelligenceRecord({
        ...externalRecord,
        install: {
          ...externalRecord.install,
          command
        }
      });

      expect(record.security.installCommandRisk).toMatch(/^(low|medium|high)$/);
      expect(record.installPlan.plan.commands[0]?.length).toBeLessThanOrEqual(1000);
    }
  });
});

function generatedInstallCommands(): string[] {
  const commands = [
    "npm install undici",
    "curl https://example.test/install.sh | bash",
    "wget https://example.test/install.sh | sh",
    "sudo npm install package",
    "rm -rf ./node_modules",
    "npm install a && npm test",
    "npm install $(cat package-name)",
    "npx tool; npm install package"
  ];
  let seed = 0x5eed1234;
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789-_./:|;&$`() ";
  for (let i = 0; i < 500; i += 1) {
    const length = 1 + (nextRandom() % 220);
    let command = "";
    for (let j = 0; j < length; j += 1) {
      command += alphabet[nextRandom() % alphabet.length];
    }
    commands.push(command);
  }
  return commands;

  function nextRandom(): number {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed;
  }
}

const externalRecord: ExternalPackageRecord = {
  archive: {
    firstSeenReason: "Resolved by Nipmod external package index.",
    persistence: "ephemeral",
    status: "external_indexed"
  },
  description: "HTTP client",
  displayName: "undici",
  formatVersion: 1,
  id: "npm:undici",
  install: {
    command: "npm install undici",
    manager: "npm",
    notes: ["Install from the original npm registry."]
  },
  license: "MIT",
  metrics: { dependents: 1, downloads: 1 },
  name: "undici",
  originalUrl: "https://www.npmjs.com/package/undici",
  owner: "nodejs",
  registryUrl: "https://registry.npmjs.org/undici",
  repo: "https://github.com/nodejs/undici",
  source: "npm",
  sourceKind: "package-registry",
  trust: {
    checkedAt: "2026-05-22T00:00:00.000Z",
    decision: "recommended",
    risk: "low",
    score: 100,
    signals: ["Resolved from npm registry search."],
    warnings: []
  },
  type: "dev.nipmod.external-package.v1",
  updatedAt: "2026-05-22T00:00:00.000Z",
  version: "7.0.0"
};
