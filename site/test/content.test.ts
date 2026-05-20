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
    expect(homeContent.headline).toBe("Package layer for agents");
    expect(homeContent.lead.length).toBeLessThanOrEqual(180);
  });

  test("links to the canonical X handle", () => {
    expect(homeContent.links.x).toBe("https://x.com/Nipmod");
  });

  test("links to the public Telegram group", () => {
    expect(homeContent.links.telegram).toBe("https://t.me/nipmod");
  });

  test("links to the Bankr coin", () => {
    expect(homeContent.links.bankrCoin).toBe("https://bankr.bot/launches/0x5155Eaa3B5784B829DeAD78189Eb4Bf69359dbA3");
  });

  test("links to the public GitHub mirror", () => {
    expect(homeContent.links.github).toBe("https://github.com/nipmod/nipmod");
  });

  test("links source review to the canonical Gitlawb repo page", () => {
    expect(homeContent.links.gitlawbProfile).toBe("https://gitlawb.com/z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R");
    expect(homeContent.links.gitlawbSource).toBe("https://gitlawb.com/node/repos/z6Mkwbud/nipmod");
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
    expect(homeContent.usage.map((item) => item.label)).toEqual(["Search", "Verify", "Install"]);
	    expect(homeContent.commands).toEqual([
	      "nipmod search gitlawb --online",
	      "nipmod inspect gitlawb-repo-reader",
	      "nipmod install gitlawb-repo-reader",
      "nipmod audit --online"
    ]);
  });

  test("states platform boundaries and package flow", () => {
    expect(homeContent.platformRoadmap.headline).toBe("Platform status");
    expect(homeContent.platformRoadmap.note).toContain("Only live and MCP ready");
    expect(homeContent.platformRoadmap.lead).toContain("Live means");
    expect(homeContent.platformRoadmap.items.map((item) => `${item.name}:${item.status}`)).toEqual([
      "Gitlawb:Live",
      "GitHub:Live",
      "MCP:MCP ready",
      "Codex:MCP ready",
      "Claude Code:MCP ready",
      "OpenCode:MCP ready"
    ]);
    expect(homeContent.platformRoadmap.items[3]?.text).toContain("Codex can register");
    expect(homeContent.claimFlow.steps.map((step) => step.label)).toEqual(["Prepare", "Verify", "Publish", "Use"]);
    expect(homeContent.startCards.map((card) => card.title)).toEqual(["Setup Nipmod", "Run demo", "Read status"]);
  });

  test("links to the human setup flow", () => {
    expect(homeContent.primaryAction).toBe("Setup Nipmod");
    expect(homeContent.links.install).toBe("/setup");
  });

  test("exposes a complete first run path", () => {
    expect(homeContent.quickstartSteps.map((step) => step.label)).toEqual([
      "Install CLI",
      "Verify",
      "Check",
      "Setup publish",
      "Find",
	      "Inspect",
      "Plan install",
	      "Install package",
	      "Add alias",
	      "Restore",
      "Update",
      "SBOM",
      "Explain",
      "Audit",
      "Publish"
    ]);
    expect(homeContent.quickstartSteps.find((step) => step.label === "Install CLI")?.command).toBe(
      "curl https://nipmod.com/i|bash"
    );
    expect(homeContent.quickstartSteps.find((step) => step.label === "Verify")?.command).toContain("install.sh.sha256");
    expect(homeContent.quickstartSteps.find((step) => step.label === "Install package")?.command).toContain("mkdir -p nipmod-demo");
    expect(homeContent.quickstartSteps.find((step) => step.label === "Plan install")?.command).toMatch(
      /^nipmod install --plan pkg:did:key:z[A-Za-z0-9]+\/gitlawb-repo-reader@0\.1\.0 --json$/
    );
	    expect(homeContent.quickstartSteps.find((step) => step.label === "Add alias")?.command).toBe(
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
    expect(homeContent.repoToPackage.headline).toBe("Publish your Gitlawb repo as an agent package");
    expect(homeContent.repoToPackage.steps.map((step) => step.label)).toEqual(["Choose", "Check", "Publish"]);
    expect(homeContent.repoToPackage.claim.text).toContain("Nipmod does not claim repos");
    expect(homeContent.repoToPackage.claim.text).not.toContain("login");
    expect(homeContent.repoToPackage.outputCommand).toContain("nipmod package pr gitlawb://did:key:z6Mk.../your-repo --dir your-repo-pr");
    expect(homeContent.repoToPackage.outputCommand).toContain("nipmod package doctor gitlawb://did:key:z6Mk.../your-repo --json");
    expect(homeContent.repoToPackage.outputCommand).toContain("nipmod claim verify gitlawb://did:key:z6Mk.../your-repo --json");
  });
});
