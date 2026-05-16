import { describe, expect, test } from "vitest";
import { assertProofLoopResult, blockedFixtureCases } from "./public-proof-loop.mjs";

describe("public proof loop contract", () => {
  test("covers the public unsafe manifest block matrix", () => {
    expect(blockedFixtureCases().map((item) => item.label)).toEqual([
      "postinstall",
      "exec",
      "broad network",
      "secret env",
      "secret scope",
      "write path",
      "prompt injection metadata"
    ]);
  });

  test("requires clean safe flow and every unsafe fixture to fail closed", () => {
    const result = {
      blocked: blockedFixtureCases().map((item) => ({
        exitCode: 1,
        label: item.label,
        ok: true
      })),
      safe: [
        { command: "inspect", exitCode: 0, ok: true },
        { command: "add", exitCode: 0, ok: true },
        { command: "audit", exitCode: 0, ok: true },
        { command: "ci", exitCode: 0, ok: true }
      ]
    };

    expect(assertProofLoopResult(result)).toBeUndefined();
    expect(() =>
      assertProofLoopResult({
        ...result,
        blocked: result.blocked.slice(1)
      })
    ).toThrow("missing blocked proof");
    expect(() =>
      assertProofLoopResult({
        ...result,
        safe: [{ command: "inspect", exitCode: 1, ok: false }]
      })
    ).toThrow("safe proof failed");
  });
});
