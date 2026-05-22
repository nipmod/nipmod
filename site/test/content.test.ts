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
    return Object.entries(value)
      .filter(([key]) => !["href", "url"].includes(key))
      .flatMap(([, nested]) => collectText(nested));
  }

  return [];
}

describe("home content", () => {
  test("keeps the product message short and direct", () => {
    expect(homeContent.brand).toBe("Nipmod");
    expect(homeContent.headline).toBe("The package layer for AI agents.");
    expect(homeContent.lead.length).toBeLessThanOrEqual(180);
  });

  test("links to the canonical X handle", () => {
    expect(homeContent.links.x).toBe("https://x.com/Nipmod");
  });

  test("links to the public Telegram group", () => {
    expect(homeContent.links.telegram).toBe("https://t.me/nipmod");
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
    const { links: _links, ...contentWithoutLinks } = homeContent;
    const text = collectText({
      ...contentWithoutLinks,
      commands: [],
      terminalOutput: [],
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
    expect(homeContent.usage.map((item) => item.label)).toEqual(["Resolve", "Check", "Plan"]);
    expect(homeContent.commands).toEqual(["curl 'https://nipmod.com/api/resolve?q=package%20for%20http%20requests&limit=3'"]);
    expect(homeContent.terminalOutput[0]).toBe("Searching npm, PyPI, GitHub, Hugging Face and MCP");
  });

  test("states source boundaries and package flow", () => {
    expect(homeContent.platformRoadmap.headline).toBe("Source coverage");
    expect(homeContent.platformRoadmap.note).toContain("original source");
    expect(homeContent.platformRoadmap.lead).toContain("call the API");
    expect(homeContent.platformRoadmap.items.map((item) => `${item.name}:${item.status}`)).toEqual([
      "npm:Live",
      "PyPI:Live",
      "GitHub:Live",
      "Hugging Face:Live",
      "MCP:Live",
      "Nipmod archive:Live"
    ]);
    expect(homeContent.platformRoadmap.items[3]?.text).toContain("models and datasets");
    expect(homeContent.claimFlow.steps.map((step) => step.label)).toEqual(["Prepare", "Verify", "Publish", "Use"]);
    expect(homeContent.startCards.map((card) => card.title)).toEqual(["Use the API", "View sources", "Read status"]);
  });

  test("links to the API first flow", () => {
    expect(homeContent.primaryAction).toBe("Get API access");
    expect(homeContent.links.api).toBe("/api-access");
    expect(homeContent.links.install).toBe("/api-access");
  });

  test("exposes a complete API first run path", () => {
    expect(homeContent.quickstartSteps.map((step) => step.label)).toEqual([
      "Search API",
      "Inspect API",
      "Install plan API",
      "Prepare archive",
      "Archive status",
      "Local CLI",
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
    expect(homeContent.quickstartSteps.find((step) => step.label === "Search API")?.command).toContain("/api/resolve");
    expect(homeContent.quickstartSteps.find((step) => step.label === "Install plan API")?.command).toContain("/api/install-plan");
    expect(homeContent.quickstartSteps.find((step) => step.label === "Local CLI")?.command).toBe("curl https://nipmod.com/i|bash");
    expect(homeContent.quickstartSteps.find((step) => step.label === "Install package")?.command).toContain("mkdir -p nipmod-demo");
    expect(homeContent.quickstartSteps.find((step) => step.label === "Plan install")?.command).toBe(
      "nipmod install --plan <package-specifier> --json"
    );
    expect(homeContent.quickstartSteps.find((step) => step.label === "Add alias")?.command).toBe(
      "nipmod add <package-specifier> --online"
    );
    expect(homeContent.quickstartSteps.find((step) => step.label === "Restore")?.command).toBe("nipmod install");
    expect(homeContent.quickstartSteps.find((step) => step.label === "Update")?.command).toBe(
      "nipmod update --plan\nnipmod update"
    );
    expect(homeContent.quickstartSteps.find((step) => step.label === "SBOM")?.command).toBe("nipmod sbom --json");
    expect(homeContent.quickstartSteps.find((step) => step.label === "Explain")?.command).toBe(
      "nipmod explain <package-name> --json"
    );
    expect(homeContent.quickstartSteps.find((step) => step.label === "Inspect")?.command).toBe(
      "nipmod inspect <package-specifier> --json"
    );
  });

  test("explains the package ecosystem without hype", () => {
    expect(homeContent.packageUseCases.map((item) => item.label)).toEqual(["Read", "Guard", "Connect"]);
    expect(homeContent.operatorChecks.map((item) => item.label)).toEqual(["Monitor", "Restore", "Respond"]);
  });

  test("exposes launch proof and founder outreach without stale package content", () => {
    expect(homeContent.launchReadiness.map((item) => item.label)).toEqual([
      "Founder review",
      "Demo flow",
      "Public proof",
      "API access"
    ]);
    expect(homeContent.founderOutreach.post).toContain("package layer");
    expect(homeContent.founderOutreach.dm).toContain("sanity check");
    expect(homeContent.demoFlow.map((item) => item.label)).toEqual(["Find", "Inspect", "Install", "Restore", "Publish dry run"]);
    expect(homeContent.ecosystemPackages).toEqual([]);
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
