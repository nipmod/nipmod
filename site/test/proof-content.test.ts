import { describe, expect, test } from "vitest";
import { proofContent } from "../app/proof/content";

describe("public proof content", () => {
  test("shows the canonical public proof loop without marketing filler", () => {
    expect(proofContent.headline).toBe("Proof you can run");
    expect(proofContent.lead.length).toBeLessThanOrEqual(120);
    expect(JSON.stringify(proofContent)).not.toMatch(/unlock|supercharge|revolutionary|magical|seamless/i);
  });

  test("uses live package manager commands and exact block cases", () => {
    expect(proofContent.safeCommands[0]).toMatch(
      /^nipmod inspect pkg:did:key:z[A-Za-z0-9]+\/gitlawb-release-review@0\.1\.0 --online$/
    );
    expect(proofContent.safeCommands.slice(1)).toEqual([
      "nipmod add gitlawb-release-review --online",
      "nipmod audit --online",
      "nipmod ci --online"
    ]);
    expect(proofContent.blockedCases.map((item) => item.label)).toEqual([
      "postinstall",
      "exec",
      "broad network",
      "secret env",
      "secret scope",
      "write path"
    ]);
  });

  test("pins the current public proof state", () => {
    expect(proofContent.registry.count).toBe(12);
    expect(proofContent.registry.trust).toBe("verified/100");
    expect(proofContent.registry.treeSize).toBe(16);
    expect(proofContent.registry.rootHash).toMatch(/^[a-f0-9]{64}$/);
    expect(proofContent.transcript).toBe("/proof/transcript.json");
  });
});
