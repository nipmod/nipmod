import { expect, test } from "@playwright/test";

test("home registry search stays usable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Verifiable packages for agents" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Security" })).toBeVisible();

  await page.getByLabel("Search packages").fill("repo");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page).toHaveURL(/q=repo/);
  await expect(page.locator("#registry .package-card").first()).toContainText("verified");
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
  await expect(page.getByRole("link", { name: "https://nipmod.com/security" })).toBeVisible();

  await page.goto("/security");
  await expect(page.getByRole("heading", { name: "Report with proof." })).toBeVisible();
  await expect(page.getByRole("link", { name: "security.txt" })).toHaveAttribute("href", "/.well-known/security.txt");

  const response = await page.request.get("/.well-known/security.txt");
  await expect(response).toBeOK();
  await expect(response.text()).resolves.toContain("Policy: https://nipmod.com/security");
});

test("launch page exposes adoption, review and multi source paths", async ({ page }) => {
  await page.goto("/launch");

  await expect(page.getByRole("heading", { name: "Use it. Publish into it. Review it." })).toBeVisible();
  await expect(page.getByText("nipmod publish repo --dry-run --json")).toBeVisible();
  await expect(page.getByText("node tools/verify-all.mjs --prod")).toBeVisible();
  await expect(page.getByText("nipmod search policy --registries")).toBeVisible();
  await expect(page.getByText("2 alert destinations outside Vercel and Fly")).toBeVisible();
});
