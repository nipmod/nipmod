import { describe, expect, test } from "vitest";
import { homeContent } from "../app/content";

const bannedWords = ["unlock", "supercharge", "revolutionary", "magical", "seamless", "AI powered"];

function collectText(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectText);
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectText);
  }

  return [];
}

describe("home content", () => {
  test("keeps the product message short and direct", () => {
    expect(homeContent.brand).toBe("nipmod");
    expect(homeContent.headline).toBe("Verifiable packages for agents");
    expect(homeContent.lead.length).toBeLessThanOrEqual(110);
  });

  test("links to the canonical X handle", () => {
    expect(homeContent.links.x).toBe("https://x.com/Nipmod");
  });

  test("uses clean English copy without hyphen punctuation or slop words", () => {
    const quickstartCopy =
      homeContent.quickstartSteps?.map(({ command: _command, ...copy }) => copy) ?? [];
    const { inputPlaceholder: _inputPlaceholder, outputCommand: _outputCommand, ...repoCopy } =
      homeContent.repoToPackage;
    const text = collectText({
      ...homeContent,
      commands: [],
      quickstartSteps: quickstartCopy,
      repoToPackage: repoCopy
    }).join(" ");

    expect(text).not.toMatch(/[-–—]/);
    for (const word of bannedWords) {
      expect(text.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });

  test("states what people can do on the site", () => {
    expect(homeContent.usage.map((item) => item.label)).toEqual(["Terminal", "Website", "Codex"]);
    expect(homeContent.commands).toEqual([
      "curl -fL https://nipmod.com/install.sh -o install.sh",
      "curl -fL https://nipmod.com/install.sh.sha256 -o install.sh.sha256",
      "shasum -a 256 -c install.sh.sha256",
      "bash install.sh",
      "nipmod doctor",
      "nipmod package gitlawb://did:key:z6Mk.../repo --dir repo",
      "nipmod search skill --online",
      "nipmod add pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0 --online",
      "nipmod audit --online",
      "nipmod publish . --dry-run"
    ]);
  });

  test("links to the installer script", () => {
    expect(homeContent.primaryAction).toBe("Install");
    expect(homeContent.links.install).toBe("/install.sh");
  });

  test("exposes a complete first run path", () => {
    expect(homeContent.quickstartSteps.map((step) => step.label)).toEqual([
      "Install",
      "Check",
      "Find",
      "Inspect",
      "Add",
      "Audit",
      "Publish"
    ]);
    expect(homeContent.quickstartSteps.every((step) => step.command.startsWith("nipmod") || step.command.startsWith("bash"))).toBe(
      true
    );
    expect(homeContent.quickstartSteps.find((step) => step.label === "Inspect")?.command).toMatch(
      /^nipmod inspect pkg:did:key:z[A-Za-z0-9]+\/gitlawb-repo-reader@0\.1\.0 --online$/
    );
  });

  test("explains the package ecosystem without hype", () => {
    expect(homeContent.packageUseCases.map((item) => item.label)).toEqual(["Read", "Guard", "Connect"]);
    expect(homeContent.operatorChecks.map((item) => item.label)).toEqual(["Monitor", "Restore", "Respond"]);
  });

  test("defines the Gitlawb repo to package flow without claiming ownership", () => {
    expect(homeContent.repoToPackage.headline).toBe("Turn a Gitlawb repo into an agent package");
    expect(homeContent.repoToPackage.steps.map((step) => step.label)).toEqual(["Paste", "Draft", "Claim"]);
    expect(homeContent.repoToPackage.claim.text).toContain("DID signature");
    expect(homeContent.repoToPackage.claim.text).not.toContain("login");
    expect(homeContent.repoToPackage.outputCommand).toContain("nipmod package gitlawb://did:key:z6Mk.../repo --dir repo");
  });
});
