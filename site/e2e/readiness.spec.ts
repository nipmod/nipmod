import { expect, test } from "@playwright/test";

test("home registry search stays usable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Packages agents can verify" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Nipmod Gitlawb profile in a new tab" })).toHaveAttribute(
    "href",
    "https://gitlawb.com/z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R"
  );
  await expect(page.getByRole("link", { name: "Open Nipmod on X in a new tab" })).toHaveAttribute(
    "href",
    "https://x.com/Nipmod"
  );
  await expect(page.getByRole("link", { name: "Open Nipmod coin on Bankr in a new tab" })).toHaveAttribute(
    "href",
    "https://bankr.bot/launches/0x5155Eaa3B5784B829DeAD78189Eb4Bf69359dbA3"
  );
  const siteNav = page.getByRole("navigation", { name: "Site" });
  await expect(siteNav.getByRole("link", { name: "Packages" })).toBeVisible();
  await expect(siteNav.locator('a[href="/quickstart#docs"]')).toHaveCount(2);
  await expect(siteNav.getByRole("link", { name: "Install" })).toBeVisible();
  const viewport = page.viewportSize();
  await expect(siteNav.locator(".nav-link:visible")).toHaveCount(viewport?.width && viewport.width < 560 ? 2 : 3);
  if ((await page.locator('a[href="/security"]:visible').count()) === 0) {
    await page.locator(".more-menu summary").click();
  }
  await expect(page.locator('a[href="/security"]:visible').first()).toBeVisible();
  await expect(siteNav.locator('a[href="/trust"]:visible').first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Install" }).first()).toHaveAttribute("href", "/quickstart#install");
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
});

test("docs and install navigation have distinct, correct destinations", async ({ page }) => {
  await page.goto("/");
  const siteNav = page.getByRole("navigation", { name: "Site" });
  if ((await siteNav.locator('a[href="/quickstart#docs"]:visible').count()) === 0) {
    await siteNav.locator(".more-menu summary").click();
  }

  await expect(siteNav.locator('a[href="/quickstart#docs"]:visible').first()).toBeVisible();
  await expect(siteNav.getByRole("link", { name: "Install" })).toHaveAttribute("href", "/quickstart#install");

  await siteNav.locator('a[href="/quickstart#docs"]:visible').first().click();
  await expect(page).toHaveURL(/\/quickstart#docs$/);
  await expect(page.locator("#docs")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Docs" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Install the CLI" })).toBeVisible();
  await expect(page.getByLabel("Docs sections").getByRole("link", { name: "MCP" })).toHaveAttribute("href", "/mcp");

  await page.goto("/");
  await page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "Install" }).click();
  await expect(page).toHaveURL(/\/quickstart#install$/);
  await expect(page.locator("#install")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Install CLI" })).toBeVisible();
});

test("homepage exposes machine readable agent discovery", async ({ page, request }) => {
  await page.goto("/");

  await expect(page.locator('head link[rel="alternate"][type="text/plain"][href="/llms.txt"]')).toHaveCount(1);
  await expect(page.locator('head link[rel="alternate"][type="application/json"][href="/.well-known/nipmod.json"]')).toHaveCount(1);

  const llms = await request.get("/llms.txt");
  await expect(llms).toBeOK();
  await expect(llms.text()).resolves.toContain("Agent runbook: https://nipmod.com/quickstart#agents");

  const manifest = await request.get("/.well-known/nipmod.json");
  await expect(manifest).toBeOK();
  const body = await manifest.json();
  expect(body.agent.commands.search).toBe("nipmod search gitlawb --online");
  expect(body.mcp.serverCommand).toBe("nipmod mcp serve");
});

test("internal button and navigation links resolve to existing pages and anchors", async ({ page, request }) => {
  test.setTimeout(60_000);

  const routes = [
    "/",
    "/quickstart",
    "/package",
    "/packages",
    "/packages/z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD-gitlawb-repo-reader",
    "/trust",
    "/security",
    "/launch",
    "/proof",
    "/mcp",
    "/evidence"
  ];

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
      const response = await request.get(`${target.pathname}${target.search}`);
      expect(response.ok(), `${route} links to ${href}`).toBe(true);

      if (target.hash) {
        await page.goto(`${target.pathname}${target.search}${target.hash}`);
        await expect(page.locator(target.hash)).toBeVisible();
      }
    }
  }
});

test("mobile more menu exposes secondary navigation", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/");

  await expect(page.locator(".more-menu summary")).toBeVisible();
  await page.locator(".more-menu summary").click();
  const panel = page.locator(".more-menu-panel");
  await expect(panel.getByRole("link", { name: "Create" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Launch" })).toHaveAttribute("href", "/launch");
  await expect(panel.getByRole("link", { name: "Security" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Trust" })).toHaveAttribute("href", "/trust");
  await expect(panel.getByRole("link", { name: "MCP" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Source" })).toBeVisible();
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
    "/packages",
    "/packages/z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD-gitlawb-repo-reader",
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
