import { expect, test } from "@playwright/test";

test("home registry search stays usable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Package layer for agent built software" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Registry and Scout counts" })).toBeVisible();
  await expect(page.getByText(/Live registry \+ Scout|Registry snapshot/)).toBeVisible();
  await expect(page.locator(".live-stat-grid").getByText("Published packages", { exact: true })).toBeVisible();
  await expect(page.locator(".live-stat-grid").getByText("Claimable drafts", { exact: true })).toBeVisible();
  await expect(page.getByText("not published packages yet")).toBeVisible();
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
    "https://t.me/+05Kux7Iyah9jZjAy"
  );
  await expect(page.locator(".actions").getByRole("link", { name: "Open Nipmod Telegram group in a new tab" })).toHaveAttribute(
    "href",
    "https://t.me/+05Kux7Iyah9jZjAy"
  );
  await expect(page.locator(".brand-socials").getByRole("link", { name: "Open Nipmod GitHub repository in a new tab" })).toHaveAttribute(
    "href",
    "https://github.com/nipmod/nipmod"
  );
  await expect(page.locator(".actions").getByRole("link", { name: "Open Nipmod GitHub repository in a new tab" })).toHaveAttribute(
    "href",
    "https://github.com/nipmod/nipmod"
  );
  await expect(page.locator(".brand-socials").getByRole("link", { name: "Open Nipmod Bankr coin in a new tab" })).toHaveAttribute(
    "href",
    "https://bankr.bot/launches/0x5155Eaa3B5784B829DeAD78189Eb4Bf69359dbA3"
  );
  await expect(page.locator(".actions").getByRole("link", { name: "Open Nipmod Bankr coin in a new tab" })).toHaveAttribute(
    "href",
    "https://bankr.bot/launches/0x5155Eaa3B5784B829DeAD78189Eb4Bf69359dbA3"
  );
  const siteNav = page.getByRole("navigation", { name: "Site" });
  await expect(siteNav.getByRole("link", { name: "Packages" })).toBeVisible();
  await expect(siteNav.locator('a[href="/quickstart#docs"]')).toHaveCount(2);
  await expect(siteNav.getByRole("link", { name: "Setup" })).toBeVisible();
  const viewport = page.viewportSize();
  await expect(siteNav.locator(".nav-link:visible")).toHaveCount(viewport?.width && viewport.width < 560 ? 2 : 3);
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

  await expect(page.getByRole("heading", { name: "Verified packages for agents." })).toBeVisible();
  await expect(page.getByText("Search one clean registry.")).toBeVisible();
  await expect(page.getByText("Published package source today is Gitlawb.")).toBeVisible();
  await expect(page.getByText("Codex + Claude Code")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Nipmod registry machine file" })).toHaveAttribute(
    "href",
    "/registry/packages.json",
  );

  await expect(page.locator(".archive-package-row")).toHaveCount(registry.packages.length);
  await expect(page.locator(".archive-package-row").first()).toContainText("Gitlawb");
  await expect(page.locator(".archive-package-row").first()).toContainText("Install");
  await expect(page.locator(".archive-package-row").first().getByRole("link", { name: "Details" })).toHaveAttribute(
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
    "Package layer for agent built software."
  );
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    "content",
    "Nipmod makes agent code installable, verifiable and reusable."
  );
  await expect(page.getByText("Nipmod makes agent code installable, verifiable and reusable.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Existing package tools are built for humans. Nipmod is built for agent code." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Human package tools" })).toBeVisible();
  await expect(page.getByRole("heading", { exact: true, name: "Nipmod" })).toBeVisible();
  await expect(page.getByText("Fast installs, familiar package names and public distribution for human maintained projects.")).toBeVisible();
  await expect(page.getByText("Agent owned code, signed source history, package claims, audit data and safe agent installs.")).toBeVisible();

  await expect(page.getByRole("heading", { name: "Why Gitlawb first?" })).toBeVisible();
  await expect(page.getByText("Gitlawb already gives agents source identity, signed pushes and public provenance.")).toBeVisible();

  await expect(page.getByRole("heading", { name: "Platform status" })).toBeVisible();
  const platformRoadmap = page.getByLabel("Nipmod platform roadmap");
  await expect(platformRoadmap.getByRole("heading", { name: "Gitlawb" })).toBeVisible();
  await expect(platformRoadmap.getByText("Live", { exact: true })).toBeVisible();
  await expect(platformRoadmap.getByRole("heading", { name: "Bankr" })).toBeVisible();
  await expect(platformRoadmap.getByText("PR open", { exact: true })).toBeVisible();
  await expect(platformRoadmap.getByRole("heading", { name: "Agent hosts" })).toBeVisible();
  await expect(platformRoadmap.getByText("MCP ready", { exact: true })).toBeVisible();
  await expect(platformRoadmap.getByText("Codex, Claude Code and OpenCode can use Nipmod through MCP")).toBeVisible();
  await expect(platformRoadmap.getByText("controlled install")).toBeVisible();
  await expect(page.getByText("Statuses describe Nipmod integration work, not partner approval.")).toBeVisible();
  await expect(platformRoadmap.getByRole("link", { name: "View Bankr path" })).toHaveAttribute("href", "/bankr");
  await expect(platformRoadmap.getByRole("link", { name: "Setup agent" })).toHaveAttribute("href", "/setup");

  await expect(page.getByRole("heading", { name: "Found your repo? Claim the package." })).toBeVisible();
  await expect(page.getByText("Scout finds public Gitlawb repos that can become packages.")).toBeVisible();
  await expect(page.getByText("The repo owner signs the claim with the Gitlawb DID.")).toBeVisible();
  await expect(page.getByRole("link", { name: "View package candidates" })).toHaveAttribute("href", "/candidates");

  await expect(page.getByRole("heading", { name: "Quick answers" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Is this only for Gitlawb?" })).toBeVisible();
  await expect(page.getByText("Gitlawb is the first canonical source network. The package layer is designed to cover more agent code platforms over time.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Can agents use it directly?" })).toBeVisible();
  await expect(page.getByText("Yes. Install once, connect the MCP server, then tell the agent to use Nipmod before package installs.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Who owns packages?" })).toBeVisible();
  await expect(page.getByText("The source owner does. Nipmod verifies claims and ranks trust. It does not take ownership of Gitlawb repos.")).toBeVisible();

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
  await expect(page.getByRole("heading", { name: "Use Nipmod in your agent" })).toBeVisible();
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
  expect(body.agent.commands.search).toBe("nipmod search gitlawb --online");
  expect(body.mcp.serverCommand).toBe("nipmod mcp serve");
  expect(body.mcp.tools).toContain("nipmod.install");
  expect(body.mcp.tools).toContain("nipmod.demo");
});

test("agent runbook exposes claim conversion entrypoints", async ({ page }) => {
  await page.goto("/agents");

  await expect(page.getByRole("heading", { name: "One link. Full package workflow." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Setup agent" })).toHaveAttribute("href", "/setup");
  await expect(page.getByRole("heading", { name: "Tell your agent once" })).toBeVisible();
  await expect(page.getByText("Read https://nipmod.com/llms.txt and https://nipmod.com/.well-known/nipmod.json.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "MCP demo" })).toBeVisible();
  await expect(page.getByText("nipmod.demo")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Claim drafts" })).toBeVisible();
  await expect(page.getByText("Use Scout candidates when an existing Gitlawb repo should become a claimed package.")).toBeVisible();
  await expect(page.getByText("curl -fsS https://nipmod.com/scout/candidates")).toBeVisible();
  await expect(page.getByText("curl -fsS https://nipmod.com/scout/health")).toBeVisible();
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

  await expect(page.getByRole("heading", { name: "Use Nipmod in your agent" })).toBeVisible();
  await expect(page.getByText("Install once, connect your agent once")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Open Terminal" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Install Nipmod once" })).toBeVisible();
  await expect(
    page.getByLabel("First setup command").getByText("curl -fsSLO https://nipmod.com/install.sh && bash install.sh")
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose your agent" })).toBeVisible();
  await expect(page.getByText("nipmod setup agents")).toBeVisible();
  await expect(page.getByText("nipmod setup codex")).toBeVisible();
  await expect(page.getByText("nipmod setup claude")).toBeVisible();
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
  await expect(page.getByText("Use a prepared draft when Scout found one. Package another public repo when it has no draft yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Package another repo" })).toHaveAttribute("href", "/package");
  await expect(page.getByText(owner).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Published packages" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Claimable drafts" })).toBeVisible();
  await expect(page.getByText("nipmod claim index --node https://node.nipmod.com --json")).toBeVisible();
  await expect(page.getByRole("link", { name: "Repo status" }).first()).toHaveAttribute(
    "href",
    /^\/gitlawb\/z[A-Za-z0-9]+\/[a-z0-9][a-z0-9._-]*$/
  );

  const manifest = await request.get("/.well-known/nipmod.json");
  const body = await manifest.json();
  expect(body.registry.gitlawbOwnerPageTemplate).toBe("https://nipmod.com/gitlawb/{owner}");
});

test("candidate claim page guides owners from repo to verified package", async ({ page }) => {
  await page.goto("/candidates");

  await expect(page.getByRole("heading", { name: "Find your repo. Claim the package." })).toBeVisible();
  await expect(page.getByText("Search by repo name, DID owner or package id.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Package one repo manually" })).toHaveAttribute("href", "/package");
  await expect(page.getByRole("heading", { name: "Claim conversion" })).toBeVisible();
  const conversionStats = page.getByLabel("Claim conversion stats");
  await expect(conversionStats.getByText("Found", { exact: true })).toBeVisible();
  await expect(conversionStats.getByText("Draft ready", { exact: true })).toBeVisible();
  await expect(conversionStats.getByText("Owner noticed", { exact: true })).toBeVisible();
  await expect(conversionStats.getByText("Claimed", { exact: true })).toBeVisible();
  await expect(conversionStats.getByText("Published", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Notice dashboard" })).toBeVisible();
  const noticeStats = page.getByLabel("Scout notice stats");
  await expect(noticeStats.getByText("Notice planned", { exact: true })).toBeVisible();
  await expect(noticeStats.getByText("Sent", { exact: true })).toBeVisible();
  await expect(noticeStats.getByText("Deduped", { exact: true })).toBeVisible();
  await expect(noticeStats.getByText("Failed", { exact: true })).toBeVisible();
  await expect(noticeStats.getByText("Claimed after notice", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Public update" })).toBeVisible();
  await expect(page.getByText("Nipmod Scout update:")).toBeVisible();
  await expect(page.getByText("Ready to claim").first()).toBeVisible();
  const firstCandidate = page.locator(".candidate-card").first();
  await expect(firstCandidate.getByText("Claim link", { exact: true })).toBeVisible();
  await expect(firstCandidate.getByText("Notice status", { exact: true })).toBeVisible();
  await expect(firstCandidate.getByText("Owner outreach")).toBeVisible();
  await expect(firstCandidate.getByText("Nipmod Scout prepared a package draft").first()).toBeVisible();
  await expect(firstCandidate.getByRole("link", { name: "Ready claim link" })).toHaveAttribute("href", /^\/package\?repo=/);
  await expect(firstCandidate.getByRole("link", { name: "Claim package" })).toHaveAttribute("href", /^\/package\?repo=/);
  await expect(firstCandidate.getByRole("link", { name: "Owner page" })).toHaveAttribute(
    "href",
    /^\/gitlawb\/z[A-Za-z0-9]+$/
  );
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
    "https://t.me/+05Kux7Iyah9jZjAy"
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
  await expect(page.getByText("Gitlawb draft ready")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Free services" })).toBeVisible();
  await expect(page.getByText("Core Nipmod workflows stay free for Bankr agents.")).toBeVisible();
  await expect(page.getByText("Free package search")).toBeVisible();
  await expect(page.getByText("Free package audit")).toBeVisible();
  await expect(page.getByText("Free repo draft")).toBeVisible();

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

test("package draft converts a Gitlawb repo into commands", async ({ page }) => {
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

  await expect(page.getByText("Drafting as gitlawb-repo-reader")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Package path" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Draft locally" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Verify owner claim" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dry run publish" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse prepared drafts" })).toHaveAttribute("href", "/candidates");
  await expect(
    page.getByText(
      "nipmod package pr gitlawb://did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader --dir gitlawb-repo-reader-pr"
    )
  ).toBeVisible();
  await expect(page.getByText("nipmod publish gitlawb-repo-reader-pr --dry-run --json")).toBeVisible();
  await page.getByRole("button", { name: "Copy draft commands" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as Window & { __nipmodCopied?: string }).__nipmodCopied ?? "")).toContain(
    "nipmod publish gitlawb-repo-reader-pr --dry-run --json"
  );

  await page.getByRole("textbox", { name: "Gitlawb repo" }).fill("not a repo");
  await expect(page.getByText("Enter a Gitlawb DID path or Gitlawb repo URL.")).toBeVisible();
  await expect(page.getByText("No draft yet.")).toBeVisible();
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
