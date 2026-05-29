import { describe, expect, test } from "vitest";
import { normalizeAccountEmail, safeAccountNextPath } from "../lib/account-auth";

describe("account auth helpers", () => {
  test("normalizes email login input", () => {
    expect(normalizeAccountEmail(" HAZAR@NIPMOD.COM ")).toBe("hazar@nipmod.com");
    expect(normalizeAccountEmail("not-an-email")).toBeNull();
    expect(normalizeAccountEmail("a@b")).toBeNull();
    expect(normalizeAccountEmail("x".repeat(245) + "@example.com")).toBeNull();
  });

  test("keeps account redirects local and away from auth routes", () => {
    expect(safeAccountNextPath("/account")).toBe("/account");
    expect(safeAccountNextPath("/account?tab=keys")).toBe("/account?tab=keys");
    expect(safeAccountNextPath("https://evil.example/account")).toBe("/account");
    expect(safeAccountNextPath("//evil.example/account")).toBe("/account");
    expect(safeAccountNextPath("/auth/logout")).toBe("/account");
  });
});
