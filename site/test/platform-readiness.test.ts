import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..", "..");
const siteRoot = join(root, "site");
const readiness = JSON.parse(readFileSync(join(siteRoot, "public", "compatibility", "platform-readiness.json"), "utf8"));
const discovery = JSON.parse(readFileSync(join(siteRoot, "public", ".well-known", "nipmod.json"), "utf8"));
const llms = readFileSync(join(siteRoot, "public", "llms.txt"), "utf8");
const claudeConfig = JSON.parse(readFileSync(join(root, ".mcp.json"), "utf8"));
const opencodeConfig = JSON.parse(readFileSync(join(root, "opencode.json"), "utf8"));

describe("platform readiness receipt", () => {
  test("publishes the complete current platform set without adoption overclaiming", () => {
    expect(readiness).toMatchObject({
      formatVersion: 1,
      type: "dev.nipmod.platform-readiness.v1"
    });
    expect(readiness.platforms.map((platform: { id: string }) => platform.id)).toEqual([
      "github",
      "gitlawb",
      "codex",
      "claude-code",
      "opencode",
      "bankr"
    ]);
    expect(readiness.platforms.every((platform: { productReadiness: number }) => platform.productReadiness === 100)).toBe(
      true
    );
    expect(readiness.meaning).toContain("does not claim third-party adoption");
    expect(readiness.notClaimed).toContain("Bankr has accepted the skill into a native marketplace");
    expect(readiness.notClaimed).toContain("Bankr Agent API smoke has run unless BANKR_API_KEY is provided");
  });

  test("binds readiness proof to public discovery and agent entrypoints", () => {
    expect(discovery.review.platformReadiness).toBe("https://nipmod.com/compatibility/platform-readiness.json");
    expect(llms).toContain("Platform readiness receipt: https://nipmod.com/compatibility/platform-readiness.json");
    expect(readiness.archive).toEqual({
      discovery: "https://nipmod.com/.well-known/nipmod.json",
      llms: "https://nipmod.com/llms.txt",
      registry: "https://nipmod.com/registry/packages.json",
      setup: "https://nipmod.com/setup"
    });
  });

  test("ships project configs for Claude Code and OpenCode", () => {
    expect(claudeConfig).toEqual({
      mcpServers: {
        nipmod: {
          args: ["mcp", "serve"],
          command: "nipmod",
          env: {},
          type: "stdio"
        }
      }
    });
    expect(opencodeConfig).toEqual({
      $schema: "https://opencode.ai/config.json",
      mcp: {
        nipmod: {
          command: ["nipmod", "mcp", "serve"],
          enabled: true,
          type: "local"
        }
      }
    });
  });

  test("keeps Bankr readiness scoped to safe package workflows", () => {
    const bankr = readiness.platforms.find((platform: { id: string }) => platform.id === "bankr");

    expect(bankr.status).toBe("agent-proof-ready");
    expect(bankr.claim).toContain("without wallet actions");
    expect(bankr.externalDependency).toContain("not claimed");
    expect(bankr.runtimeSmoke).toBe("BANKR_API_KEY=bk_... node tools/bankr-agent-smoke.mjs --require-auth");
    expect(bankr.checks).toContain("real Bankr Agent API smoke is available with BANKR_API_KEY");
    expect(bankr.checks).toContain("core package workflows do not require x402 or Nipmod payment");
    expect(JSON.stringify(bankr)).not.toMatch(/paymentScheme|walletTransfer|trade|swap/i);
  });
});
