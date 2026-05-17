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
    expect(homeContent.brand).toBe("Nipmod");
    expect(homeContent.headline).toBe("Packages agents can trust");
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
    const ecosystemCopy =
      homeContent.ecosystemPackages?.map(({ command: _command, name: _name, ...copy }) => copy) ?? [];
    const demoCopy = homeContent.demoFlow?.map(({ command: _command, ...copy }) => copy) ?? [];
    const text = collectText({
      ...homeContent,
      commands: [],
      demoFlow: demoCopy,
      ecosystemPackages: ecosystemCopy,
      quickstartSteps: quickstartCopy,
      repoToPackage: repoCopy
    }).join(" ");

    expect(text).not.toMatch(/[-–—]/);
    for (const word of bannedWords) {
      expect(text.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });

  test("states what people can do on the site", () => {
    expect(homeContent.usage.map((item) => item.label)).toEqual(["Search", "Inspect", "Install"]);
	    expect(homeContent.commands).toEqual([
	      "nipmod search gitlawb --online",
	      "nipmod inspect gitlawb-repo-reader",
	      "nipmod install gitlawb-repo-reader",
      "nipmod audit --online"
    ]);
  });

  test("links to the human install flow", () => {
    expect(homeContent.primaryAction).toBe("Install");
    expect(homeContent.links.install).toBe("/quickstart#install");
  });

  test("exposes a complete first run path", () => {
    expect(homeContent.quickstartSteps.map((step) => step.label)).toEqual([
      "Install CLI",
      "Verify",
      "Check",
      "Find",
	      "Inspect",
	      "Install package",
	      "Add package",
	      "Restore",
      "Update",
      "SBOM",
      "Explain",
      "Audit",
      "Publish"
    ]);
    expect(homeContent.quickstartSteps.find((step) => step.label === "Install CLI")?.command).toBe(
      "curl -fsSLO https://nipmod.com/install.sh && bash install.sh"
    );
    expect(homeContent.quickstartSteps.find((step) => step.label === "Verify")?.command).toContain("install.sh.sha256");
	    expect(homeContent.quickstartSteps.find((step) => step.label === "Install package")?.command).toContain("mkdir -p nipmod-demo");
	    expect(homeContent.quickstartSteps.find((step) => step.label === "Add package")?.command).toBe(
	      "nipmod add gitlawb-repo-reader --online"
	    );
    expect(homeContent.quickstartSteps.find((step) => step.label === "Restore")?.command).toBe("nipmod install");
    expect(homeContent.quickstartSteps.find((step) => step.label === "Update")?.command).toBe(
      "nipmod update --plan\nnipmod update"
    );
    expect(homeContent.quickstartSteps.find((step) => step.label === "SBOM")?.command).toBe("nipmod sbom --json");
    expect(homeContent.quickstartSteps.find((step) => step.label === "Explain")?.command).toBe(
      "nipmod explain gitlawb-repo-reader --json"
    );
    expect(homeContent.quickstartSteps.find((step) => step.label === "Inspect")?.command).toMatch(
      /^nipmod inspect pkg:did:key:z[A-Za-z0-9]+\/gitlawb-repo-reader@0\.1\.0$/
    );
  });

  test("explains the package ecosystem without hype", () => {
    expect(homeContent.packageUseCases.map((item) => item.label)).toEqual(["Read", "Guard", "Connect"]);
    expect(homeContent.operatorChecks.map((item) => item.label)).toEqual(["Monitor", "Restore", "Respond"]);
  });

  test("exposes launch proof, founder outreach and real package content", () => {
    expect(homeContent.launchReadiness.map((item) => item.label)).toEqual([
      "Founder review",
      "Demo flow",
      "Public proof",
      "Agent setup"
    ]);
    expect(homeContent.founderOutreach.post).toContain("package layer");
    expect(homeContent.founderOutreach.dm).toContain("sanity check");
    expect(homeContent.demoFlow.map((item) => item.label)).toEqual(["Find", "Inspect", "Install", "Restore", "Publish dry run"]);
    expect(homeContent.ecosystemPackages.length).toBeGreaterThanOrEqual(28);
    expect(homeContent.ecosystemPackages.every((pkg) => pkg.command.startsWith("nipmod install "))).toBe(true);
  });

  test("defines the Gitlawb repo to package flow without claiming ownership", () => {
    expect(homeContent.repoToPackage.headline).toBe("Turn a Gitlawb repo into an agent package");
    expect(homeContent.repoToPackage.steps.map((step) => step.label)).toEqual(["Paste", "Draft", "Claim"]);
    expect(homeContent.repoToPackage.claim.text).toContain("DID signature");
    expect(homeContent.repoToPackage.claim.text).not.toContain("login");
    expect(homeContent.repoToPackage.outputCommand).toContain("nipmod package gitlawb://did:key:z6Mk.../repo --dir repo");
  });
});
