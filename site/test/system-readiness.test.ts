import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..", "..");
const siteRoot = join(root, "site");
const readiness = JSON.parse(readFileSync(join(siteRoot, "public", "compatibility", "system-readiness.json"), "utf8"));
const platformReadiness = JSON.parse(readFileSync(join(siteRoot, "public", "compatibility", "platform-readiness.json"), "utf8"));
const discovery = JSON.parse(readFileSync(join(siteRoot, "public", ".well-known", "nipmod.json"), "utf8"));
const registry = JSON.parse(readFileSync(join(siteRoot, "public", "registry", "packages.json"), "utf8"));
const appRegistry = JSON.parse(readFileSync(join(siteRoot, "app", "registry-data.json"), "utf8"));
const llms = readFileSync(join(siteRoot, "public", "llms.txt"), "utf8");

describe("system readiness receipt", () => {
  test("publishes one API first system proof without overclaiming adoption", () => {
    expect(readiness).toMatchObject({
      formatVersion: 1,
      type: "dev.nipmod.system-readiness.v1"
    });
    expect(readiness.sharedArchive).toMatchObject({
      packageCount: 0,
      quorumReceipts: "https://nipmod.com/quorum/receipts.json",
      registry: "https://nipmod.com/registry/packages.json",
      trustRequirement: "public packages must pass signature, source, witness and quorum gates before listing"
    });
    expect(readiness.meaning).toContain("API-first system surface");
    expect(readiness.meaning).toContain("public verified archive is intentionally empty");
    expect(readiness.notClaimed).toContain("Nipmod owns or controls external source packages");
    expect(readiness.notClaimed).toContain("public callers can create durable archive records without an authorized Nipmod server writer");
    expect(JSON.stringify(readiness)).not.toContain("/integrations/");
  });

  test("binds system proof into public discovery and llms entrypoints", () => {
    expect(discovery.review.systemReadiness).toBe("https://nipmod.com/compatibility/system-readiness.json");
    expect(discovery.review.platformReadiness).toBe("https://nipmod.com/compatibility/platform-readiness.json");
    expect(discovery.quorum.receipts).toBe("https://nipmod.com/quorum/receipts.json");
    expect(llms).toContain("System readiness receipt: https://nipmod.com/compatibility/system-readiness.json");
    expect(llms).toContain("Quorum receipts: https://nipmod.com/quorum/receipts.json");
    expect(readiness.entrypoints).toMatchObject({
      agentPrompts: "https://nipmod.com/agent-prompts.json",
      agentText: "https://nipmod.com/llms.txt",
      demo: "https://nipmod.com/demo",
      machineManifest: "https://nipmod.com/.well-known/nipmod.json",
      platformReadiness: "https://nipmod.com/compatibility/platform-readiness.json",
      remoteMcp: "https://nipmod.com/api/mcp",
      status: "https://nipmod.com/status",
      systemReadiness: "https://nipmod.com/compatibility/system-readiness.json"
    });
    expect(readiness.entrypoints.cursor).toBeUndefined();
  });

  test("keeps app registry, public registry and readiness package count aligned", () => {
    expect(appRegistry.packages).toEqual(registry.packages);
    expect(registry.packages).toHaveLength(readiness.sharedArchive.packageCount);
    for (const pkg of registry.packages) {
      expect(pkg.trust).toMatchObject({ level: "verified", score: 100 });
      expect(pkg.quorum).toMatchObject({ approvals: 2, status: "passed", threshold: 2 });
      expect(pkg.proof).toBeTruthy();
      expect(pkg.digest).toBe(pkg.artifactSha256);
    }
  });

  test("covers the full CLI and MCP surface used by agents", () => {
    expect(readiness.cliCommands).toContain("mcp");
    expect(readiness.cliCommands).toContain("search");
    expect(readiness.cliCommands).toContain("install");
    expect(readiness.mcpTools).toContain("nipmod.install");
    expect(readiness.remoteMcpTools).toEqual([
      "nipmod.search",
      "nipmod.resolve",
      "nipmod.view",
      "nipmod.inspect",
      "nipmod.install_plan",
      "nipmod.external_install_plan",
      "nipmod.demo"
    ]);
    expect(readiness.remoteMcpNotExposed).toContain("nipmod.install");
  });

  test("connects API, source and MCP paths to the same archive story", () => {
    expect(readiness.agentHosts).toMatchObject({
      mcp: {
        setup: "nipmod mcp serve",
        remoteEndpoint: "https://nipmod.com/api/mcp",
        status: "Live"
      }
    });
    expect(Object.keys(readiness.agentHosts).sort()).toEqual(["claudeCode", "codex", "cursor", "mcp", "openCode"]);
    expect(platformReadiness.platforms.map((platform: { id: string }) => platform.id).sort()).toEqual([
      "api",
      "archive",
      "github",
      "gitlawb",
      "mcp",
      "sources"
    ]);
    expect(readiness.parallelAccessProof.checkedBy).toBe("node --experimental-strip-types tools/system-readiness-check.ts --live --parallel");
    expect(readiness.parallelAccessProof.surfaces).toContain("Hosted MCP tools/list");
    expect(readiness.writeBoundaries).toContain("install writes only after confirmInstall is write-lockfile");
    expect(readiness.writeBoundaries).toContain("hosted read-only MCP exposes no workspace-write, local-file or publish tools");
    expect(readiness.writeBoundaries).toContain("archive confirm requires an authorized Nipmod server writer before durable persistence");
    expect(readiness.writeBoundaries).toContain("install writes a local receipt under .nipmod/receipts");
  });
});
