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
  test("publishes one shared archive system proof without overclaiming adoption", () => {
    expect(readiness).toMatchObject({
      formatVersion: 1,
      type: "dev.nipmod.system-readiness.v1"
    });
    expect(readiness.sharedArchive).toMatchObject({
      packageCount: 28,
      quorumReceipts: "https://nipmod.com/quorum/receipts.json",
      registry: "https://nipmod.com/registry/packages.json",
      trustRequirement: "all public packages are verified/100 and quorum passed"
    });
    expect(readiness.meaning).toContain("one shared verified archive");
    expect(readiness.meaning).toContain("quorum approved package digests");
    expect(readiness.notClaimed).toContain("third-party users have already adopted every host");
    expect(readiness.notClaimed).toContain("Nipmod owns or controls Gitlawb repos");
    expect(readiness.notClaimed).toContain("Bankr Agent API smoke has run unless BANKR_API_KEY is provided");
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
      cursor: "https://nipmod.com/cursor",
      demo: "https://nipmod.com/demo",
      machineManifest: "https://nipmod.com/.well-known/nipmod.json",
      platformReadiness: "https://nipmod.com/compatibility/platform-readiness.json",
      remoteMcp: "https://nipmod.com/api/mcp",
      status: "https://nipmod.com/status",
      systemReadiness: "https://nipmod.com/compatibility/system-readiness.json"
    });
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
    expect(readiness.cliCommands).toEqual([
      "init",
      "pack",
      "package",
      "claim",
      "publish",
      "dist-tag",
      "deprecate",
      "yank",
      "manifest",
      "verify",
      "install",
      "add",
      "ls",
      "uninstall",
      "outdated",
      "update",
      "explain",
      "sbom",
      "doctor",
      "audit",
      "ci",
      "inspect",
      "search",
      "view",
      "policy",
      "mcp",
      "version",
      "setup",
      "setup-cloudflare"
    ]);
    expect(readiness.mcpTools).toEqual([
      "nipmod.search",
      "nipmod.view",
      "nipmod.inspect",
      "nipmod.install_plan",
      "nipmod.install",
      "nipmod.update_plan",
      "nipmod.demo",
      "nipmod.publish_plan",
      "nipmod.claim_verify",
      "nipmod.claim_index",
      "nipmod.verify",
      "nipmod.audit",
      "nipmod.sbom",
      "nipmod.explain"
    ]);
    expect(readiness.remoteMcpTools).toEqual([
      "nipmod.search",
      "nipmod.view",
      "nipmod.inspect",
      "nipmod.install_plan",
      "nipmod.demo"
    ]);
    expect(readiness.remoteMcpNotExposed).toContain("nipmod.install");
  });

  test("connects every platform to the same archive story", () => {
    expect(readiness.agentHosts).toMatchObject({
      bankr: {
        proof: "https://nipmod.com/integrations/bankr/bankr.agent-proof.json",
        runtimeSmoke: "BANKR_API_KEY=bk_... node tools/bankr-agent-smoke.mjs --require-auth",
        skill: "https://nipmod.com/integrations/bankr/nipmod/SKILL.md"
      },
      claudeCode: {
        setup: "nipmod setup claude",
        config: ".mcp.json"
      },
      codex: {
        setup: "nipmod setup codex"
      },
      cursor: {
        setup: "nipmod setup cursor",
        config: ".cursor/mcp.json",
        addToCursor: expect.stringContaining("cursor://anysphere.cursor-deeplink/mcp/install")
      },
      openCode: {
        setup: "nipmod setup opencode",
        config: "opencode.json"
      },
      hermes: {
        setup: "nipmod setup hermes",
        config: "~/.hermes/config.yaml"
      }
    });
    expect(platformReadiness.platforms.map((platform: { id: string }) => platform.id).sort()).toEqual([
      "aeon",
      "bankr",
      "claude-code",
      "codex",
      "cursor",
      "github",
      "gitlawb",
      "hermes",
      "mcp",
      "opencode"
    ]);
    expect(readiness.parallelAccessProof.checkedBy).toBe("node tools/system-readiness-check.mjs --live --parallel");
    expect(readiness.parallelAccessProof.surfaces).toContain("Hosted MCP search");
    expect(readiness.writeBoundaries).toContain("install writes only after confirmInstall is write-lockfile");
    expect(readiness.writeBoundaries).toContain("hosted read-only MCP exposes no workspace-write, local-file or publish tools");
    expect(readiness.writeBoundaries).toContain("install writes a local receipt under .nipmod/receipts");
  });
});
