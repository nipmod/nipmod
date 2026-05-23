import { expect, test } from "@playwright/test";

const removedIntegrationCopy = /Aeon|OpenHuman|OpenHume|Bankr skill|integrations\/bankr|review-only/i;

test("home page presents the API-first product", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Nipmod");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", "The package layer for AI agents.");
  await expect(page.locator('head link[rel="alternate"][type="text/plain"][href="/llms.txt"]')).toHaveCount(1);
  await expect(page.locator('head link[rel="alternate"][type="application/json"][href="/.well-known/nipmod.json"]')).toHaveCount(1);

  await expect(page.getByRole("heading", { name: /The package layer\s+for AI agents\./ })).toBeVisible();
  await expect(page.getByText("One hosted API for agents to search package sources")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open API docs" })).toHaveAttribute("href", "/api-access");
  await expect(page.getByRole("link", { name: "View sources" })).toHaveAttribute("href", "/sources");

  const siteNav = page.getByRole("navigation", { name: "Site" });
  await expect(siteNav.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/");
  await expect(siteNav.getByRole("link", { name: "API" })).toHaveAttribute("href", "/api-access");
  await expect(siteNav.getByRole("link", { name: "Sources" })).toHaveAttribute("href", "/sources");
  const archiveNav = siteNav.getByRole("link", { name: "Archive" });
  const trustNav = siteNav.getByRole("link", { name: "Trust" });
  if (await archiveNav.count()) {
    await expect(archiveNav).toHaveAttribute("href", "/packages");
  }
  if (await trustNav.count()) {
    await expect(trustNav).toHaveAttribute("href", "/trust");
  }
  if (await page.locator(".brand-socials").isVisible()) {
    await expect(page.getByRole("link", { name: "Open Nipmod Gitlawb profile in a new tab" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open Nipmod token page in a new tab" })).toHaveAttribute(
      "href",
      "https://token.nipmod.com"
    );
  }

  await expect(page.locator("body")).not.toContainText(removedIntegrationCopy);
});

test("API access page exposes one public package surface", async ({ page }) => {
  await page.goto("/api-access");

  await expect(page.getByRole("heading", { name: "One package API for agents." })).toBeVisible();
  await expect(page.getByText("The hosted API is the main product surface.")).toBeVisible();
  await expect(page.getByText("GET /api/search?q=<query>")).toBeVisible();
  await expect(page.getByText("GET /api/inspect?source=npm&name=undici")).toBeVisible();
  await expect(page.getByText("GET /api/install-plan?source=npm&name=undici")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(removedIntegrationCopy);
});

test("home CTAs navigate with real clicks", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "Open API docs" }).click();
  await expect(page).toHaveURL(/\/api-access$/);
  await expect(page.getByRole("heading", { name: "One package API for agents." })).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: "View sources" }).click();
  await expect(page).toHaveURL(/\/sources$/);
  await expect(page.getByRole("heading", { name: "Sources agents can search." })).toBeVisible();
});

test("sources page lists source registries without implying partnerships", async ({ page }) => {
  await page.goto("/sources");

  await expect(page.getByRole("heading", { name: "Sources agents can search." })).toBeVisible();
  for (const source of ["npm", "PyPI", "GitHub", "Hugging Face", "MCP"]) {
    await expect(page.getByRole("heading", { name: source })).toBeVisible();
  }
  await expect(page.getByText("Nipmod archive")).toBeVisible();
  await expect(page.getByText("external retained")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(removedIntegrationCopy);
});

test("package archive reflects the real public registry", async ({ page, request }) => {
  const registryResponse = await request.get("/registry/packages.json");
  await expect(registryResponse).toBeOK();
  const registry = await registryResponse.json();

  await page.goto("/packages");

  await expect(page.getByRole("heading", { name: "Confirmed package records." })).toBeVisible();
  await expect(page.getByText("The archive contains confirmed package records")).toBeVisible();
  await expect(page.getByText(String(registry.packages.length), { exact: true }).first()).toBeVisible();

  const cards = page.locator(".archive-pro-card");
  await expect(cards).toHaveCount(registry.packages.length);
  if (registry.packages.length === 0) {
    await expect(page.getByRole("heading", { name: "No public packages yet" })).toBeVisible();
    await expect(page.getByText("The public archive is intentionally clean.")).toBeVisible();
  }

  await expect(page.locator("body")).not.toContainText(removedIntegrationCopy);
});

test("machine discovery points agents at API and MCP surfaces", async ({ request }) => {
  const llms = await request.get("/llms.txt");
  await expect(llms).toBeOK();
  const llmsText = await llms.text();
  expect(llmsText).toContain("API access: https://nipmod.com/api-access");
  expect(llmsText).toContain("Public package archive registry: https://nipmod.com/registry/packages.json");
  expect(llmsText).toContain("Hosted read-only MCP endpoint: https://nipmod.com/api/mcp");
  expect(llmsText).not.toMatch(removedIntegrationCopy);

  const manifest = await request.get("/.well-known/nipmod.json");
  await expect(manifest).toBeOK();
  const body = await manifest.json();
  expect(body.docs.api).toBe("https://nipmod.com/api-access");
  expect(body.docs.sources).toBe("https://nipmod.com/sources");
  expect(body.agent.commands.externalSearch).toBe(
    "GET https://nipmod.com/api/search?q=<query>&sources=npm,pypi,github,huggingface-model,huggingface-dataset,mcp"
  );
  expect(body.agent.commands.externalInspect).toBe("GET https://nipmod.com/api/inspect?source=npm&name=<package-name>");
  expect(body.agent.commands.externalInstallPlan).toBe("GET https://nipmod.com/api/install-plan?source=npm&name=<package-name>");
  expect(body.mcp.remoteEndpoint).toBe("https://nipmod.com/api/mcp");
  expect(body.mcp.remoteTools).toContain("nipmod.resolve");
  expect(body.mcp.remoteTools).toContain("nipmod.external_install_plan");
});

test("hosted API routes answer with safe boundaries", async ({ request }) => {
  const search = await request.get("/api/search?q=react&sources=npm&limit=2");
  await expect(search).toBeOK();
  const searchBody = await search.json();
  expect(searchBody.archivePolicy.externalRecords).toContain("Stored as external_indexed records");
  expect(searchBody.records.length).toBeLessThanOrEqual(2);

  const inspect = await request.get("/api/inspect?source=npm&name=undici");
  await expect(inspect).toBeOK();
  const inspectBody = await inspect.json();
  expect(inspectBody.type).toBe("dev.nipmod.external-inspect.v1");
  expect(inspectBody.record.source).toBe("npm");
  expect(inspectBody.record.name).toBe("undici");

  const plan = await request.get("/api/install-plan?source=npm&name=undici");
  await expect(plan).toBeOK();
  const planBody = await plan.json();
  expect(planBody.type).toBe("dev.nipmod.external-install-plan.v1");
  expect(planBody.plan.requiresApprovalBeforeWrite).toBe(true);
  expect(planBody.package.source).toBe("npm");

  const archiveStatus = await request.get("/api/archive/status");
  await expect(archiveStatus).toBeOK();
  const archiveStatusBody = await archiveStatus.json();
  expect(["durable-archive-enabled", "resolver-only-safe-mode"]).toContain(archiveStatusBody.mode);
  expect(archiveStatusBody.writeBoundary).toContain("authorized server writer");
});

test("status and platform pages expose current proof paths only", async ({ page }) => {
  await page.goto("/status");
  await expect(page.getByRole("heading", { name: "Public status." })).toBeVisible();
  await expect(page.getByText("A compact view of the live API surface")).toBeVisible();
  await expect(page.getByText("Archive records")).toBeVisible();
  await expect(page.getByText("Source health")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(removedIntegrationCopy);

  await page.goto("/platforms");
  await expect(page.getByRole("heading", { name: "Source and access paths." })).toBeVisible();
  await expect(page.getByText("The public product surface is source coverage plus one agent API.")).toBeVisible();
  await expect(page.getByText("Native integrations", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/Aeon|OpenHuman|OpenHume|Bankr skill|integrations\/bankr/i);
});

test("optional local setup stays available but is not the core integration story", async ({ page }) => {
  await page.goto("/setup");

  await expect(page.getByRole("heading", { name: "Local setup is optional." })).toBeVisible();
  await expect(page.getByText("curl https://nipmod.com/i|bash")).toBeVisible();
  await expect(page.getByText("nipmod doctor --online")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(removedIntegrationCopy);
});

test("trust and security pages keep public proof readable", async ({ page, request }) => {
  await page.goto("/trust");
  await expect(page.getByRole("heading", { name: "Trust signals for package decisions." })).toBeVisible();
  await expect(page.getByText("Do not trust package text")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(removedIntegrationCopy);

  await page.goto("/security");
  await expect(page.getByRole("heading", { name: "Security policy." })).toBeVisible();
  await expect(page.getByRole("link", { name: "security.txt" })).toHaveAttribute("href", "/.well-known/security.txt");

  const response = await request.get("/.well-known/security.txt");
  await expect(response).toBeOK();
  await expect(response.text()).resolves.toContain("Policy: https://nipmod.com/security");
});

test("internal public links resolve", async ({ page, request }) => {
  test.setTimeout(90_000);

  const routes = [
    "/",
    "/api-access",
    "/sources",
    "/packages",
    "/setup",
    "/agents",
    "/status",
    "/platforms",
    "/trust",
    "/security",
    "/proof",
    "/mcp",
    "/demo",
    "/quickstart",
    "/launch",
    "/launch-kit",
    "/package",
    "/evidence"
  ];

  const checked = new Set<string>();
  for (const route of routes) {
    const pageResponse = await request.get(route);
    expect(pageResponse.ok(), route).toBe(true);

    await page.goto(route);
    const hrefs = await page
      .locator("a[href]")
      .evaluateAll((links) =>
        [...new Set(links.map((link) => link.getAttribute("href")).filter((href): href is string => Boolean(href)))]
      );

    for (const href of hrefs) {
      if (/^(https?:|mailto:|cursor:)/.test(href)) continue;
      const target = new URL(href, `https://nipmod.com${route}`);
      const key = `${target.pathname}${target.search}`;
      if (checked.has(key)) continue;
      const response = await request.get(key);
      expect(response.ok(), `${route} links to ${href}`).toBe(true);
      checked.add(key);
    }
  }
});

test("mobile header stays compact and API-first", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/");

  const siteNav = page.getByRole("navigation", { name: "Site" });
  await expect(siteNav.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/");
  await expect(siteNav.getByRole("link", { name: "API" })).toHaveAttribute("href", "/api-access");
  await expect(siteNav.getByRole("link", { name: "Sources" })).toHaveAttribute("href", "/sources");
  await expect(siteNav.getByRole("link", { name: "Archive" })).toHaveCount(0);
  await expect(siteNav.getByRole("link", { name: "Trust" })).toHaveCount(0);
});
