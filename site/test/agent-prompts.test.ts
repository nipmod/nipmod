import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const siteRoot = join(import.meta.dirname, "..");
const prompts = JSON.parse(readFileSync(join(siteRoot, "public", "agent-prompts.json"), "utf8"));

describe("agent prompt pack", () => {
  test("publishes safe API first prompts", () => {
    expect(prompts).toMatchObject({
      formatVersion: 1,
      type: "dev.nipmod.agent-prompts.v1"
    });
    expect(prompts.setup).toMatchObject({
      archivePrepare: "GET https://nipmod.com/api/archive/prepare?source=npm&name=<package-name> with x-nipmod-api-key",
      betaKey: "POST https://nipmod.com/api/keys/beta",
      externalInspect: "GET https://nipmod.com/api/inspect?source=npm&name=<package-name> with x-nipmod-api-key",
      externalInstallPlan: "GET https://nipmod.com/api/install-plan?source=npm&name=<package-name> with x-nipmod-api-key",
      externalSearch: "GET https://nipmod.com/api/search?q=<query>&sources=npm,pypi,github,huggingface-model,huggingface-dataset,mcp with x-nipmod-api-key",
      localMcp: "nipmod mcp serve",
      remoteMcp: "https://nipmod.com/api/mcp"
    });
    expect(prompts.prompts.default).toContain("ask before writing files");
    expect(prompts.prompts.api).toContain("/api/search");
    expect(prompts.prompts.api).toContain("x-nipmod-api-key");
    expect(JSON.stringify(prompts)).not.toContain("cursor://");
    expect(JSON.stringify(prompts)).not.toMatch(/private key|token|ignore previous instructions/i);
  });
});
