import { describe, expect, test } from "vitest";
import { runExcellenceAutomode } from "./excellence-automode.ts";

describe("excellence automode", () => {
  test("answers the hard product questions with concrete gates", async () => {
    const result = await runExcellenceAutomode();

    expect(result.type).toBe("dev.nipmod.excellence-automode.v1");
    expect(result.ok).toBe(true);
    expect(result.summary.fail).toBe(0);
    expect(result.summary.pass).toBeGreaterThanOrEqual(11);
    expect(result.summary.score).toBeGreaterThanOrEqual(95);
    expect(result.checks).toContainEqual(expect.objectContaining({
      question: "Are public API and admin surfaces closed by default?",
      status: "pass"
    }));
    expect(result.checks.map((check) => check.category)).toEqual(expect.arrayContaining([
      "archive",
      "claims",
      "install",
      "operations",
      "prompt-boundary",
      "search",
      "security",
      "sources"
    ]));
  });

  test("keeps the report public-safe and honest", async () => {
    const result = await runExcellenceAutomode();
    const text = JSON.stringify(result);

    expect(text).not.toMatch(/nka_(?:beta|partner|admin)_[A-Za-z0-9_-]+/);
    expect(text).not.toMatch(/service[-_ ]?role|private key|seed phrase|mnemonic/i);
    expect(text).toContain("No honest package layer can prove malware-free output.");
    expect(text).toContain("Hosted Nipmod should remain read-only");
    expect(result.researchControls.map((control) => control.url)).toContain("https://osv.dev/");
  });
});
