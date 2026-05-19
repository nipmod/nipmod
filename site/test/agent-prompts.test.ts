import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const siteRoot = join(import.meta.dirname, "..");
const prompts = JSON.parse(readFileSync(join(siteRoot, "public", "agent-prompts.json"), "utf8"));

describe("agent prompt pack", () => {
  test("publishes safe setup prompts for major hosts", () => {
    expect(prompts).toMatchObject({
      formatVersion: 1,
      type: "dev.nipmod.agent-prompts.v1"
    });
    expect(prompts.setup).toMatchObject({
      claudeCode: "nipmod setup claude",
      codex: "nipmod setup codex",
      opencode: "nipmod setup opencode",
      projectAgents: "nipmod setup agents"
    });
    expect(prompts.prompts.default).toContain("ask before writing files");
    expect(prompts.prompts.bankr).toContain("Do not trade");
    expect(JSON.stringify(prompts)).not.toMatch(/private key|token|ignore previous instructions/i);
  });
});
