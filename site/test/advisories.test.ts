import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const siteRoot = join(import.meta.dirname, "..");
const feed = JSON.parse(readFileSync(join(siteRoot, "public", "advisories.json"), "utf8"));

describe("public advisory feed", () => {
  test("publishes a stable empty feed before any package is flagged", () => {
    expect(feed).toEqual({
      advisories: [],
      expiresAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      formatVersion: 1,
      generatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      type: "dev.nipmod.advisories.v1"
    });
  });

  test("does not expose local paths or secrets", () => {
    expect(JSON.stringify(feed)).not.toMatch(/token|secret|private|file:|localhost|127\.0\.0\.1/i);
  });
});
