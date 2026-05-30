import { describe, expect, test } from "vitest";
import { analyzeAccountChatIntent, buildAccountChatAnswer, detectAccountChatLanguage } from "../lib/account-chat";

describe("account chat intent", () => {
  test("does not run package search for greetings", () => {
    const intent = analyzeAccountChatIntent("hey");

    expect(intent).toMatchObject({
      category: "greeting",
      language: "en",
      mode: "conversation",
      searchQuery: ""
    });
    expect(buildAccountChatAnswer("hey", null, [], null, intent)).toContain("Ask me");
  });

  test("keeps German greetings in German", () => {
    const intent = analyzeAccountChatIntent("hallo");

    expect(intent).toMatchObject({
      category: "greeting",
      language: "de",
      mode: "conversation"
    });
    expect(buildAccountChatAnswer("hallo", null, [], null, intent)).toContain("Frag mich");
  });

  test("answers capability questions without pretending they are package names", () => {
    const intent = analyzeAccountChatIntent("was kannst du?");

    expect(intent).toMatchObject({
      category: "capability",
      language: "de",
      mode: "conversation"
    });
    expect(buildAccountChatAnswer("was kannst du?", null, [], null, intent)).toContain("vor einer Installation");
  });

  test("answers German small talk instead of searching packages", () => {
    const intent = analyzeAccountChatIntent("wie gehts?");

    expect(intent).toMatchObject({
      category: "small-talk",
      language: "de",
      mode: "conversation",
      searchQuery: ""
    });
    expect(buildAccountChatAnswer("wie gehts?", null, [], null, intent)).toContain("Mir geht");
  });

  test("answers English small talk instead of searching packages", () => {
    const intent = analyzeAccountChatIntent("how are you?");

    expect(intent).toMatchObject({
      category: "small-talk",
      language: "en",
      mode: "conversation",
      searchQuery: ""
    });
    expect(buildAccountChatAnswer("how are you?", null, [], null, intent)).toContain("Doing well");
  });

  test("keeps German search questions in German", () => {
    expect(detectAccountChatLanguage("was ist so standart pakete für webdesign")).toBe("de");
    expect(analyzeAccountChatIntent("was ist so standart pakete für webdesign")).toMatchObject({
      category: "web-design",
      language: "de",
      mode: "search"
    });
  });

  test("routes Hugging Face ecosystem questions to a better search query", () => {
    const intent = analyzeAccountChatIntent("was ist das bekannteste paket bei huggingface");

    expect(intent).toMatchObject({
      category: "hugging-face",
      language: "de",
      mode: "search"
    });
    expect(intent.searchQuery).toContain("transformers");
  });
});
