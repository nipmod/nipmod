import { expect, test } from "@playwright/test";

test("home registry search stays usable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Verifiable packages for agents" })).toBeVisible();
  if ((await page.locator('a[href="/security"]:visible').count()) === 0) {
    await page.locator(".more-menu summary").click();
  }
  await expect(page.locator('a[href="/security"]:visible').first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Install" }).first()).toHaveAttribute("href", "/quickstart#install");

  await page.getByLabel("Search packages").fill("repo");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page).toHaveURL(/q=repo/);
  await expect(page.locator("#registry .package-card").first()).toContainText("verified");
});

test("mobile more menu exposes secondary navigation", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/");

  await expect(page.locator(".more-menu summary")).toBeVisible();
  await page.locator(".more-menu summary").click();
  const panel = page.locator(".more-menu-panel");
  await expect(panel.getByRole("link", { name: "Package" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Security" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Launch" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Proof" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "MCP" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Source" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "X" })).toBeVisible();
});

test("package draft converts a Gitlawb repo into commands", async ({ page }) => {
  await page.goto("/package");
  await page.getByRole("textbox", { name: "Gitlawb repo" }).fill("gitlawb://did:key:z6Mktest/Nip Mod.git");

  await expect(page.getByText("Drafting as nip-mod")).toBeVisible();
  await expect(page.getByText("nipmod package 'gitlawb://did:key:z6Mktest/Nip Mod.git' --dir nip-mod")).toBeVisible();
  await expect(page.getByText("nipmod publish nip-mod --dry-run --json")).toBeVisible();
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

test("human pages do not promote raw artifact links", async ({ page }) => {
  const routes = [
    "/",
    "/quickstart",
    "/package",
    "/trust",
    "/security",
    "/launch",
    "/proof",
    "/mcp",
    "/evidence",
    "/evidence/package/gitlawb-release-review"
  ];
  const rawPath = /^(\/install\.sh|\/\.well-known\/(?:nipmod\.json|security\.txt)|\/registry\/|\/transparency\/|\/releases\/.*(?:\.tgz|\.tgz\.sig)|\/advisories\.json|\/proof\/transcript\.json|\/compatibility\/.*\.json)/;

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
  await expect(page.getByText("nipmod publish repo --dry-run --json")).toBeVisible();
  await expect(page.getByText("node tools/verify-all.mjs --prod")).toBeVisible();
  await expect(page.getByText("nipmod search policy --registries")).toBeVisible();
  await expect(page.getByText("2 alert destinations outside Vercel and Fly")).toBeVisible();
});
