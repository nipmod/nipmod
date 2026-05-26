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
  test("keeps the shared header content minimal", () => {
    expect(homeContent.brand).toBe("Nipmod");
    expect(Object.keys(homeContent)).toEqual(["brand", "links"]);
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

  test("links to the public contact email", () => {
    expect(homeContent.links.email).toBe("mailto:info@nipmod.com");
  });

  test("links to the public token surface", () => {
    expect(homeContent.links.bankrCoin).toBe("https://token.nipmod.com");
  });

  test("uses clean English copy without hyphen punctuation or slop words", () => {
    const { links: _links, ...contentWithoutLinks } = homeContent;
    const text = collectText(contentWithoutLinks).join(" ");

    expect(text).not.toMatch(/[-–—]/);
    for (const word of bannedWords) {
      expect(text.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });
});
