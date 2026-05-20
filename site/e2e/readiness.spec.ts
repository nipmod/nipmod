import { expect, test } from "@playwright/test";

test("home registry search stays usable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Package layer for agents" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Live package count" })).toBeVisible();
  await expect(page.locator(".live-status")).toContainText(/Live archive|Local archive/);
  await expect(page.locator(".live-stat-grid").getByText("Nipmod archive packages", { exact: true })).toBeVisible();
  await expect(page.getByText("Repos scanned")).toHaveCount(0);
  await expect(page.getByText("Scan interval")).toHaveCount(0);
  await expect(page.getByText("Scout running every")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open Nipmod Gitlawb profile in a new tab" })).toHaveAttribute(
    "href",
    "https://gitlawb.com/z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R"
  );
  await expect(page.getByRole("link", { name: "Open Nipmod on X in a new tab" })).toHaveAttribute(
    "href",
    "https://x.com/Nipmod"
  );
  await expect(page.locator(".brand-socials").getByRole("link", { name: "Open Nipmod Telegram group in a new tab" })).toHaveAttribute(
    "href",
    "https://t.me/nipmod"
  );
  await expect(page.locator(".brand-socials").getByRole("link", { name: "Open Nipmod GitHub repository in a new tab" })).toHaveAttribute(
    "href",
    "https://github.com/nipmod/nipmod"
  );
  await expect(page.locator(".brand-socials").getByRole("link", { name: "Open Nipmod Bankr coin in a new tab" })).toHaveAttribute(
    "href",
    "https://bankr.bot/launches/0x5155Eaa3B5784B829DeAD78189Eb4Bf69359dbA3"
  );
  const siteNav = page.getByRole("navigation", { name: "Site" });
  const viewport = page.viewportSize();
  if (viewport?.width && viewport.width < 560) {
    await expect(siteNav.locator('a[href="/packages"]:visible')).toHaveCount(0);
  } else {
    await expect(siteNav.getByRole("link", { name: "Packages" })).toBeVisible();
  }
  await expect(siteNav.locator('a[href="/quickstart#docs"]')).toHaveCount(2);
  await expect(siteNav.getByRole("link", { name: "Setup" })).toBeVisible();
  await expect(siteNav.locator(".nav-link:visible")).toHaveCount(viewport?.width && viewport.width < 560 ? 1 : 3);
  if ((await page.locator('a[href="/security"]:visible').count()) === 0) {
    await page.locator(".more-menu summary").click();
  }
  await expect(page.locator('a[href="/security"]:visible').first()).toBeVisible();
  await expect(siteNav.locator('a[href="/trust"]:visible').first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Setup" }).first()).toHaveAttribute("href", "/setup");
  await expect(page.getByText("nipmod install gitlawb-repo-reader").first()).toBeVisible();
  await expect(page.getByText("Signed", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Digest pinned", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Witnessed", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Advisory checked", { exact: true })).toHaveCount(0);

  await page.getByLabel("Search packages").fill("repo");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page).toHaveURL(/q=repo/);
  await expect(page.locator("#registry .package-card").first()).toContainText("verified");
  await expect(page.locator("#registry .package-card").first().getByRole("link", { name: "Git source" })).toHaveAttribute(
    "href",
    /^https:\/\/gitlawb\.com\/node\/repos\/z[A-Za-z0-9]+\/[a-z0-9][a-z0-9._-]*$/
  );
  await expect(page.locator("#registry .package-card").first().getByRole("link", { name: "Repo status" })).toHaveAttribute(
    "href",
    /^\/gitlawb\/z[A-Za-z0-9]+\/[a-z0-9][a-z0-9._-]*$/
  );
});

test("packages page exposes one central human archive", async ({ page, request }) => {
  const registryResponse = await request.get("/registry/packages.json");
  await expect(registryResponse).toBeOK();
  const registry = await registryResponse.json();

  await page.goto("/packages");

  await expect(page.getByRole("heading", { name: "Agent package archive." })).toBeVisible();
  await expect(page.getByText("Search packages, check trust")).toBeVisible();
  await expect(page.getByText("Published package source today is Gitlawb.")).toBeVisible();
  await expect(page.getByText("Codex + Claude Code + Cursor + OpenCode + Hermes")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Nipmod registry machine file" })).toHaveAttribute(
    "href",
    "/registry/packages.json",
  );

  await expect(page.locator(".archive-package-row")).toHaveCount(registry.packages.length);
  await expect(page.locator(".archive-package-row").first()).toContainText("Gitlawb");
  await expect(page.locator(".archive-package-row").first()).toContainText("Plan first");
  await expect(page.locator(".archive-package-row").first().getByRole("link", { name: "View package" })).toHaveAttribute(
    "href",
    /^\/packages\/z[A-Za-z0-9]+-[a-z0-9][a-z0-9._-]*$/,
  );
  await expect(page.locator(".archive-package-row").first().getByRole("link", { name: "Git source" })).toHaveAttribute(
    "href",
    /^https:\/\/gitlawb\.com\/node\/repos\/z[A-Za-z0-9]+\/[a-z0-9][a-z0-9._-]*$/
  );

  await page.getByRole("navigation", { name: "Package source filters" }).getByRole("link", { name: "Gitlawb" }).click();
  await expect(page).toHaveURL(/source=Gitlawb/);
  await expect(page.locator(".archive-package-row")).toHaveCount(registry.packages.length);
});

test("homepage answers post traffic questions", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Package layer for agents."
  );
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    "content",
    "Search, inspect and install verified agent packages."
  );
  await expect(page.getByText("Search, inspect and install verified agent packages from one shared archive.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Live package count" })).toBeVisible();
  await expect(page.getByText("Current package count from the public Nipmod archive.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Packages made for agent workflows." })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Why Gitlawb first?" })).toHaveCount(0);

  await expect(page.getByRole("heading", { name: "Platform status" })).toBeVisible();
  const platformRoadmap = page.getByLabel("Nipmod platform roadmap");
  await expect(platformRoadmap.getByRole("heading", { name: "Gitlawb" })).toBeVisible();
  await expect(platformRoadmap.getByText("Live", { exact: true })).toHaveCount(3);
  await expect(platformRoadmap.getByRole("heading", { name: "GitHub" })).toBeVisible();
  await expect(platformRoadmap.getByRole("heading", { exact: true, name: "MCP" })).toBeVisible();
  await expect(platformRoadmap.getByRole("heading", { name: "Codex" })).toBeVisible();
  await expect(platformRoadmap.getByRole("heading", { name: "Claude Code" })).toBeVisible();
  await expect(platformRoadmap.getByRole("heading", { name: "Cursor" })).toBeVisible();
  await expect(platformRoadmap.getByRole("heading", { name: "OpenCode" })).toBeVisible();
  await expect(platformRoadmap.getByRole("heading", { name: "Hermes" })).toBeVisible();
  await expect(platformRoadmap.getByText("MCP ready", { exact: true })).toHaveCount(5);
  await expect(platformRoadmap.getByRole("heading", { name: "Bankr" })).toHaveCount(0);
  await expect(platformRoadmap.getByRole("heading", { name: "Aeon" })).toHaveCount(0);
  await expect(platformRoadmap.getByText("Under review", { exact: true })).toHaveCount(0);
  await expect(platformRoadmap.getByText("Candidate", { exact: true })).toHaveCount(0);
  await expect(platformRoadmap.getByText("Review needed", { exact: true })).toHaveCount(0);
  await expect(platformRoadmap.getByText("Codex can register Nipmod as a local stdio MCP server")).toBeVisible();
  await expect(platformRoadmap.getByText("Native Bankr acceptance is still external.")).toHaveCount(0);
  await expect(page.getByText("Only live and MCP ready paths are shown here.")).toBeVisible();
  await expect(platformRoadmap.getByRole("link", { name: "Review path" })).toHaveCount(0);
  await expect(platformRoadmap.getByRole("link", { name: "Open path" })).toHaveCount(8);

  await expect(page.getByRole("heading", { name: "Publish your repo as a package." })).toBeVisible();
  await expect(page.getByText("The source owner runs the package flow. Nipmod verifies the claim and never takes ownership.")).toBeVisible();
  await expect(page.getByText("Start from your own Gitlawb repo and run the package preflight locally.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Create package" }).first()).toHaveAttribute("href", "/package");

  await expect(page.getByRole("heading", { name: "Quick answers" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Is this only for Gitlawb?" })).toHaveCount(0);

  await expect(page.getByRole("heading", { name: "Start here" })).toBeVisible();
  await expect(page.locator(".start-grid").getByRole("link", { name: "Setup Nipmod" })).toHaveAttribute("href", "/setup");
  await expect(page.getByRole("link", { name: "Run demo" })).toHaveAttribute("href", "/demo");
  await expect(page.getByRole("link", { name: "Read status" })).toHaveAttribute("href", "/status");
});

test("docs and setup navigation have distinct, correct destinations", async ({ page }) => {
  await page.goto("/");
  const siteNav = page.getByRole("navigation", { name: "Site" });
  if ((await siteNav.locator('a[href="/quickstart#docs"]:visible').count()) === 0) {
    await siteNav.locator(".more-menu summary").click();
  }

  await expect(siteNav.locator('a[href="/quickstart#docs"]:visible').first()).toBeVisible();
  await expect(siteNav.locator(".nav-install")).toHaveAttribute("href", "/setup");

  await siteNav.locator('a[href="/quickstart#docs"]:visible').first().click();
  await expect(page).toHaveURL(/\/quickstart#docs$/);
  await expect(page.locator("#docs")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Docs" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Install the CLI" })).toBeVisible();
  await expect(page.getByLabel("Docs sections").getByRole("link", { name: "MCP" })).toHaveAttribute("href", "/mcp");

  await page.goto("/");
  await page.getByRole("navigation", { name: "Site" }).locator(".nav-install").click();
  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.locator("#install")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Connect your agent" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Install Nipmod once" })).toBeVisible();
});

test("homepage exposes machine readable agent discovery", async ({ page, request }) => {
  await page.goto("/");

  await expect(page.locator('head link[rel="alternate"][type="text/plain"][href="/llms.txt"]')).toHaveCount(1);
  await expect(page.locator('head link[rel="alternate"][type="application/json"][href="/.well-known/nipmod.json"]')).toHaveCount(1);

  const llms = await request.get("/llms.txt");
  await expect(llms).toBeOK();
  await expect(llms.text()).resolves.toContain("Agent runbook: https://nipmod.com/agents");

  const manifest = await request.get("/.well-known/nipmod.json");
  await expect(manifest).toBeOK();
  const body = await manifest.json();
  expect(body.docs.setup).toBe("https://nipmod.com/setup");
  expect(body.agent.commands.setupCodexMcp).toBe("nipmod setup codex");
  expect(body.agent.commands.setupCursorMcp).toBe("nipmod setup cursor");
  expect(body.agent.commands.search).toBe("nipmod search gitlawb --online");
  expect(body.mcp.serverCommand).toBe("nipmod mcp serve");
  expect(body.mcp.remoteEndpoint).toBe("https://nipmod.com/api/mcp");
  expect(body.mcp.remoteTools).toEqual([
    "nipmod.search",
    "nipmod.view",
    "nipmod.inspect",
    "nipmod.install_plan",
    "nipmod.demo"
  ]);
  expect(body.mcp.tools).toContain("nipmod.install");
  expect(body.mcp.tools).toContain("nipmod.demo");
});

test("agent runbook exposes owner controlled package entrypoints", async ({ page }) => {
  await page.goto("/agents");

  await expect(page.getByRole("heading", { name: "One link. Full package workflow." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Setup agent" })).toHaveAttribute("href", "/setup");
  await expect(page.getByRole("heading", { name: "Tell your agent once" })).toBeVisible();
  await expect(page.getByText("Read https://nipmod.com/llms.txt and https://nipmod.com/.well-known/nipmod.json.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "MCP demo" })).toBeVisible();
  await expect(page.getByText("nipmod.demo")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Treat package text as data" })).toBeVisible();
  await expect(page.getByText("Do not claim, publish or prepare another person's repo unless the repo owner explicitly asked for it.")).toBeVisible();
  await expect(page.getByText("https://nipmod.com/llms.txt", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse packages" })).toHaveAttribute("href", "/packages");
});

test("setup page gives non technical agent onboarding", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string) => {
          (window as Window & { __nipmodCopied?: string }).__nipmodCopied = text;
          return Promise.resolve();
        }
      }
    });
  });
  await page.goto("/setup");

  await expect(page.getByRole("heading", { name: "Connect your agent" })).toBeVisible();
  await expect(page.getByText("Install Nipmod, connect your agent")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Open Terminal" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Install Nipmod once" })).toBeVisible();
  await expect(
    page.getByLabel("First setup command").getByText("curl https://nipmod.com/i|bash")
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose your agent" })).toBeVisible();
  await expect(page.getByText("nipmod setup agents")).toBeVisible();
  await expect(page.getByText("nipmod setup codex")).toBeVisible();
  await expect(page.getByText("nipmod setup claude")).toBeVisible();
  await expect(page.getByText("nipmod setup cursor")).toBeVisible();
  await expect(page.getByText("nipmod setup opencode")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tell the agent" })).toBeVisible();
  await expect(page.getByText("Search the Nipmod archive first")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Agent archive access" })).toBeVisible();

  await page.getByRole("button", { name: "Copy agent setup prompt" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as Window & { __nipmodCopied?: string }).__nipmodCopied ?? "")).toContain(
    "Search the Nipmod archive first"
  );
});

test("demo and status pages expose proof backed product paths", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Search, inspect, plan, receipt." })).toBeVisible();
  await expect(page.getByText("ls .nipmod/receipts")).toBeVisible();
  await expect(page.getByText("nipmod install --plan")).toBeVisible();

  await page.goto("/status");
  await expect(page.getByRole("heading", { name: "Public proof dashboard" })).toBeVisible();
  await expect(page.getByText("System readiness")).toBeVisible();
  await expect(page.getByText("Platform readiness")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open JSON receipt" }).first()).toHaveAttribute(
    "href",
    "/compatibility/system-readiness.json"
  );
});

test("internal button and navigation links resolve to existing pages and anchors", async ({ page, request }) => {
  test.setTimeout(180_000);

  const routes = [
    "/",
    "/quickstart",
    "/package",
    "/candidates",
    "/packages",
    "/packages/z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD-gitlawb-repo-reader",
    "/gitlawb/z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD",
    "/gitlawb/z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader",
    "/agents",
    "/setup",
    "/demo",
    "/status",
    "/examples",
    "/audit",
    "/bankr",
    "/trust",
    "/security",
    "/launch",
    "/launch-kit",
    "/proof",
    "/mcp",
    "/evidence"
  ];
  const checkedPages = new Set<string>();
  const checkedAnchors = new Set<string>();

  for (const route of routes) {
    await page.goto(route);
    if ((await page.locator(".more-menu summary").isVisible()) && (await page.locator(".more-menu-panel a:visible").count()) === 0) {
      await page.locator(".more-menu summary").click();
    }

    const hrefs = await page
      .locator("a[href]")
      .evaluateAll((links) =>
        [...new Set(links.map((link) => link.getAttribute("href")).filter((href): href is string => Boolean(href)))]
      );

    for (const href of hrefs) {
      if (/^(https?:|mailto:)/.test(href)) {
        continue;
      }

      const target = new URL(href, `https://nipmod.com${route}`);
      const pageKey = `${target.pathname}${target.search}`;
      if (!checkedPages.has(pageKey)) {
        const response = await request.get(pageKey);
        expect(response.ok(), `${route} links to ${href}`).toBe(true);
        checkedPages.add(pageKey);
      }

      if (target.hash) {
        const anchorKey = `${pageKey}${target.hash}`;
        if (!checkedAnchors.has(anchorKey)) {
          await page.goto(anchorKey);
          await expect(page.locator(target.hash)).toBeVisible();
          checkedAnchors.add(anchorKey);
        }
      }
    }
  }
});

test("Gitlawb owner page gives repo owners a complete claim overview", async ({ page, request }) => {
  const owner = "z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD";
  await page.goto(`/gitlawb/${owner}`);

  await expect(page.getByRole("heading", { name: "Owner package status" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Owner next steps" })).toBeVisible();
  await expect(page.getByText("Use this flow for repos controlled by this owner. Nipmod verifies ownership before a package becomes trusted.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Create package" }).first()).toHaveAttribute("href", "/package");
  await expect(page.getByText(owner).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Published packages" })).toBeVisible();
  await expect(page.getByText("nipmod claim index --node https://node.nipmod.com --json")).toBeVisible();
  await expect(page.getByRole("link", { name: "Repo status" }).first()).toHaveAttribute(
    "href",
    /^\/gitlawb\/z[A-Za-z0-9]+\/[a-z0-9][a-z0-9._-]*$/
  );

  const manifest = await request.get("/.well-known/nipmod.json");
  const body = await manifest.json();
  expect(body.registry.gitlawbOwnerPageTemplate).toBe("https://nipmod.com/gitlawb/{owner}");
});

test("candidate page redirects owners to self service package flow", async ({ page }) => {
  await page.goto("/candidates");

  await expect(page).toHaveURL(/\/package$/);
  await expect(page.getByRole("heading", { name: "Create a package from your Gitlawb repo." })).toBeVisible();
  await expect(page.getByText("Paste a repo you own. Get source checks, local package files, owner verification and a publish dry run.")).toBeVisible();
});

test("mobile more menu exposes secondary navigation", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/");

  await expect(page.locator(".more-menu summary")).toBeVisible();
  await page.locator(".more-menu summary").click();
  const panel = page.locator(".more-menu-panel");
  await expect(panel.getByRole("link", { name: "Setup" })).toHaveAttribute("href", "/setup");
  await expect(panel.getByRole("link", { name: "Create" })).toBeVisible();
  await expect(panel.getByRole("link", { exact: true, name: "Agents" })).toHaveAttribute("href", "/agents");
  await expect(panel.getByRole("link", { name: "Audit" })).toHaveAttribute("href", "/audit");
  await expect(panel.getByRole("link", { exact: true, name: "Launch" })).toHaveAttribute("href", "/launch");
  await expect(panel.getByRole("link", { name: "Security" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Trust" })).toHaveAttribute("href", "/trust");
  await expect(panel.getByRole("link", { name: "MCP" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Bankr agents" })).toHaveAttribute("href", "/bankr");
  await expect(panel.getByRole("link", { name: "Open Nipmod GitHub repository in a new tab" })).toHaveAttribute(
    "href",
    "https://github.com/nipmod/nipmod"
  );
  await expect(panel.getByRole("link", { name: "Open Nipmod Bankr coin in a new tab" })).toHaveAttribute(
    "href",
    "https://bankr.bot/launches/0x5155Eaa3B5784B829DeAD78189Eb4Bf69359dbA3"
  );
  await expect(panel.getByRole("link", { name: "Open Nipmod Telegram group in a new tab" })).toHaveAttribute(
    "href",
    "https://t.me/nipmod"
  );
  await expect(panel.getByRole("link", { name: "Source" })).toBeVisible();
});

test("Bankr page gives agents a complete local integration path", async ({ page, request }) => {
  await page.goto("/bankr");

  await expect(page.getByRole("heading", { name: "Nipmod for Bankr agents" })).toBeVisible();
  await expect(page.getByText("A free Bankr-ready integration pack for agent skills")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Bankr skill file" })).toHaveAttribute(
    "href",
    "/integrations/bankr/nipmod/SKILL.md"
  );
  await expect(page.getByRole("link", { name: "Open free service map" })).toHaveAttribute(
    "href",
    "/integrations/bankr/bankr.free.json"
  );
  await expect(page.getByRole("link", { name: "Open agent proof" })).toHaveAttribute(
    "href",
    "/integrations/bankr/bankr.agent-proof.json"
  );
  await expect(page.getByRole("heading", { name: "Install the skill" })).toBeVisible();
  await expect(page.getByText("The skill follows the Bankr")).toBeVisible();
  await expect(page.getByText("Tell your agent")).toBeVisible();
  await expect(
    page.getByText("Read https://nipmod.com/integrations/bankr/nipmod/SKILL.md and use Nipmod before installing agent packages.", {
      exact: true
    })
  ).toBeVisible();
  await expect(page.getByText("Catalog packet")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Agent proof workflow" })).toBeVisible();
  await expect(page.getByText("Prove the Nipmod workflow by returning JSON")).toBeVisible();
  await expect(page.getByText("Trust checked")).toBeVisible();
  await expect(page.getByText("Install plan only")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Free services" })).toBeVisible();
  await expect(page.getByText("Core Nipmod workflows stay free for Bankr agents.")).toBeVisible();
  await expect(page.getByText("Free package search")).toBeVisible();
  await expect(page.getByText("Free package audit")).toBeVisible();
  await expect(page.getByText("Free install plan")).toBeVisible();

  const skill = await request.get("/integrations/bankr/nipmod/SKILL.md");
  await expect(skill).toBeOK();
  await expect(skill.text()).resolves.toContain("name: nipmod");

  const submission = await request.get("/integrations/bankr/CATALOG_SUBMISSION.md");
  await expect(submission).toBeOK();
  await expect(submission.text()).resolves.toContain("Bankr Skill Catalog Submission");

  const config = await request.get("/integrations/bankr/bankr.free.json");
  await expect(config).toBeOK();
  expect((await config.json()).pricing).toBe("free");

  const proof = await request.get("/integrations/bankr/bankr.agent-proof.json");
  await expect(proof).toBeOK();
  expect((await proof.json()).type).toBe("dev.nipmod.bankr.agent-proof.v1");
});

test("package page converts an owned Gitlawb repo into commands", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string) => {
          (window as Window & { __nipmodCopied?: string }).__nipmodCopied = text;
          return Promise.resolve();
        }
      }
    });
  });
  await page.goto("/package");
  await page.getByRole("textbox", { name: "Gitlawb repo" }).fill(
    "gitlawb://did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader"
  );

  await expect(page.getByText("Preparing gitlawb-repo-reader")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Package path" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Prepare locally" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Verify owner claim" })).toBeVisible();
  await expect(page.getByLabel("Package path").getByRole("heading", { name: "Dry run publish" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Read docs" }).first()).toHaveAttribute("href", "/quickstart#docs");
  await expect(
    page.getByText(
      "nipmod package pr gitlawb://did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader --dir gitlawb-repo-reader-pr"
    )
  ).toBeVisible();
  await expect(page.getByText("nipmod publish gitlawb-repo-reader-pr --dry-run --json")).toBeVisible();
  await page.getByRole("button", { name: "Copy package commands" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as Window & { __nipmodCopied?: string }).__nipmodCopied ?? "")).toContain(
    "nipmod publish gitlawb-repo-reader-pr --dry-run --json"
  );

  await page.getByRole("textbox", { name: "Gitlawb repo" }).fill("not a repo");
  await expect(page.getByText("Enter a Gitlawb DID path or Gitlawb repo URL.")).toBeVisible();
  await expect(page.getByText("Enter a valid Gitlawb repo before copying commands.")).toBeVisible();
});

test("trust and security proof links are public", async ({ page }) => {
  await page.goto("/trust");
  await expect(page.getByRole("heading", { name: "Current public roots" })).toBeVisible();
  await page.getByRole("link", { exact: true, name: "Checkpoint" }).click();
  await expect(page).toHaveURL(/\/evidence#checkpoint/);
  await expect(page.getByRole("heading", { name: "Proof humans can read." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Checkpoint" })).toBeVisible();

  await page.goto("/security");
  await expect(page.getByRole("heading", { name: "Report with proof." })).toBeVisible();
  await expect(page.getByRole("link", { name: "security.txt" })).toHaveAttribute("href", "/evidence#security");

  const response = await page.request.get("/.well-known/security.txt");
  await expect(response).toBeOK();
  await expect(response.text()).resolves.toContain("Policy: https://nipmod.com/security");
});

test("package evidence links stay on the human site", async ({ page }) => {
  await page.goto("/");
  await page.locator("#registry .package-card").first().getByRole("link", { name: "Evidence" }).click();

  await expect(page).toHaveURL(/\/evidence\/package\/.*#package-proof/);
  await expect(page.getByRole("heading", { name: "Proof humans can read." })).toBeVisible();
  await expect(page.getByText("Machine file").first()).toBeVisible();
});

test("package source links open Gitlawb human repo pages", async ({ page }) => {
  await page.goto("/packages/z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD-gitlawb-repo-reader");

  await expect(page.getByRole("link", { name: "Open gitlawb-repo-reader Git source in a new tab" })).toHaveAttribute(
    "href",
    "https://gitlawb.com/node/repos/z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader"
  );
});

test("human pages do not promote raw artifact links", async ({ page }) => {
  const routes = [
    "/",
    "/quickstart",
    "/package",
    "/candidates",
    "/packages",
    "/packages/z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD-gitlawb-repo-reader",
    "/gitlawb/z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD",
    "/agents",
    "/setup",
    "/audit",
    "/trust",
    "/security",
    "/launch",
    "/proof",
    "/mcp",
    "/evidence",
    "/evidence/package/z6MkfAZP5ayqPdX9biypAAZAjtDM1AbztFTmUFNGVqjpn41N-gitlawb-release-review"
  ];
  const rawPath = /^(\/install\.sh|\/\.well-known\/(?:nipmod\.json|security\.txt)|\/registry\/|\/transparency\/|\/releases\/.*(?:\.tgz|\.tgz\.sig)|\/advisories\.json|\/proof\/transcript\.json|\/review\/.*\.json|\/compatibility\/.*\.json)/;

  for (const route of routes) {
    await page.goto(route);
    const violations = await page.locator("a").evaluateAll((links, rawPatternSource) => {
      const rawPattern = new RegExp(rawPatternSource as string);
      return links.flatMap((link) => {
        const href = link.getAttribute("href") ?? "";
        const path = href.startsWith("http") ? new URL(href).pathname : href;
        const className = link.getAttribute("class") ?? "";
        const label = link.getAttribute("aria-label") ?? link.textContent?.trim() ?? "";
        const isRaw = rawPattern.test(path);
        const isDataLink = className.split(/\s+/).includes("data-link");
        const opensNewTab = link.getAttribute("target") === "_blank";
        const rel = link.getAttribute("rel") ?? "";
        const result: string[] = [];

        if (isRaw && !isDataLink) {
          result.push(`${label || href} opens raw artifact without data-link`);
        }
        if (isRaw && className.includes("button")) {
          result.push(`${label || href} is a button to raw artifact`);
        }
        if (opensNewTab && !rel.includes("noreferrer")) {
          result.push(`${label || href} opens a new tab without noreferrer`);
        }
        if (opensNewTab && !/new tab/i.test(label)) {
          result.push(`${label || href} opens a new tab without saying so`);
        }
        if (isDataLink && !link.getAttribute("aria-label")) {
          result.push(`${label || href} data link needs a specific aria-label`);
        }
        return result;
      });
    }, rawPath.source);

    expect(violations, route).toEqual([]);
  }
});

test("launch page exposes adoption, review and multi source paths", async ({ page }) => {
  await page.goto("/launch");

  await expect(page.getByRole("heading", { name: "Use it. Publish into it. Review it." })).toBeVisible();
  await expect(page.getByText("Catalog type coverage", { exact: true })).toBeVisible();
  await expect(page.getByText("Adoption workflow prepared", { exact: true })).toBeVisible();
  await expect(page.getByText("Gitlawb review signal", { exact: true })).toBeVisible();
  await expect(page.getByText("External human audit", { exact: true })).toBeVisible();
  await expect(page.getByText("Current ledger count is zero.")).toBeVisible();
  await expect(page.getByText("nipmod publish . --dry-run --json")).toBeVisible();
  await expect(page.getByText("node tools/verify-all.mjs --prod")).toBeVisible();
  await expect(page.getByText("nipmod search policy --registries")).toBeVisible();
  await expect(page.getByText("redacted external evidence ledger")).toBeVisible();
});
