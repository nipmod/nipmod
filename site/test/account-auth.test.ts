import { describe, expect, test } from "vitest";
import { normalizeAccountEmail, normalizeAccountEmailCode, safeAccountLoginPath, safeAccountNextPath } from "../lib/account-auth";

describe("account auth helpers", () => {
  test("normalizes email login input", () => {
    expect(normalizeAccountEmail(" HAZAR@NIPMOD.COM ")).toBe("hazar@nipmod.com");
    expect(normalizeAccountEmail("not-an-email")).toBeNull();
    expect(normalizeAccountEmail("a@b")).toBeNull();
    expect(normalizeAccountEmail("x".repeat(245) + "@example.com")).toBeNull();
  });

  test("normalizes email login codes", () => {
    expect(normalizeAccountEmailCode(" 123 456 ")).toBe("123456");
    expect(normalizeAccountEmailCode("abc-def")).toBe("abcdef");
    expect(normalizeAccountEmailCode("12")).toBeNull();
    expect(normalizeAccountEmailCode("12345678901234567")).toBeNull();
    expect(normalizeAccountEmailCode("123<script>")).toBeNull();
  });

  test("keeps account redirects local and away from auth routes", () => {
    expect(safeAccountNextPath("/account")).toBe("/account");
    expect(safeAccountNextPath("/")).toBe("/");
    expect(safeAccountNextPath("/account?tab=keys")).toBe("/account?tab=keys");
    expect(safeAccountNextPath("https://evil.example/account")).toBe("/account");
    expect(safeAccountNextPath("//evil.example/account")).toBe("/account");
    expect(safeAccountNextPath("/auth/logout")).toBe("/account");
  });

  test("keeps email-code login errors on the selected public surface", () => {
    expect(safeAccountLoginPath("/")).toBe("/");
    expect(safeAccountLoginPath("/account")).toBe("/account");
    expect(safeAccountLoginPath("/docs")).toBe("/account");
    expect(safeAccountLoginPath("//evil.example")).toBe("/account");
    expect(safeAccountLoginPath("https://evil.example/account")).toBe("/account");
  });
});
