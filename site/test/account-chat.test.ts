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

  test("answers typo-heavy German source access questions in German", () => {
    const intent = analyzeAccountChatIntent("hast du auf huggingsfaceaich zugriff");

    expect(intent).toMatchObject({
      category: "capability",
      language: "de",
      mode: "conversation"
    });
    expect(buildAccountChatAnswer("hast du auf huggingsfaceaich zugriff", null, [], null, intent)).toContain("Hugging Face Models");
  });

  test("routes Base coin trading package requests to onchain SDK search", () => {
    const intent = analyzeAccountChatIntent("find mir das betse package für base coins zu traden");

    expect(intent).toMatchObject({
      category: "onchain-trading",
      language: "de",
      mode: "search"
    });
    expect(intent.searchQuery).toContain("onchainkit");
    expect(intent.sources).toEqual(["npm", "github", "mcp"]);
  });

  test("asks a clarifying question for broad trading package requests", () => {
    const intent = analyzeAccountChatIntent("welches package ist am besten für trading");

    expect(intent).toMatchObject({
      category: "clarify-trading",
      language: "de",
      mode: "conversation"
    });
    expect(buildAccountChatAnswer("welches package ist am besten für trading", null, [], null, intent)).toContain("Für welche Art von Trading");
  });

  test("asks a clarifying question for broad security package requests", () => {
    const intent = analyzeAccountChatIntent("was sind die besten security pakete");

    expect(intent).toMatchObject({
      category: "clarify-security",
      language: "de",
      mode: "conversation"
    });
    expect(buildAccountChatAnswer("was sind die besten security pakete", null, [], null, intent)).toContain("Stack und Ziel");
  });

  test("routes concrete security package requests by stack", () => {
    const node = analyzeAccountChatIntent("ich brauche security pakete für eine Node API");
    const python = analyzeAccountChatIntent("best security packages for python fastapi");

    expect(node).toMatchObject({
      category: "security-stack",
      language: "de",
      mode: "search",
      sources: ["npm", "github", "pypi"]
    });
    expect(node.searchQuery).toContain("helmet");
    expect(python).toMatchObject({
      category: "security-stack",
      language: "en",
      mode: "search",
      sources: ["pypi", "github", "npm"]
    });
    expect(python.searchQuery).toContain("pip-audit");
  });

  test("routes React form requests to form stack candidates", () => {
    const intent = analyzeAccountChatIntent("ich brauche ein paket für forms in react mit validation");

    expect(intent).toMatchObject({
      category: "form-stack",
      language: "de",
      mode: "search",
      sources: ["npm", "github"]
    });
    expect(intent.searchQuery).toContain("react-hook-form");
  });

  test("keeps Hugging Face top list requests source scoped and larger than normal", () => {
    const models = analyzeAccountChatIntent("top 10 models bei Hugging Face");
    const datasets = analyzeAccountChatIntent("top 10 datasets bei huggingface");

    expect(models).toMatchObject({
      category: "hugging-face",
      language: "de",
      mode: "search",
      resultLimit: 10,
      sources: ["huggingface-model", "pypi", "npm", "huggingface-dataset"]
    });
    expect(datasets).toMatchObject({
      category: "hugging-face",
      mode: "search",
      resultLimit: 10,
      sources: ["huggingface-dataset", "huggingface-model", "pypi", "npm"]
    });
  });

  test("routes MCP server discovery to MCP first", () => {
    const intent = analyzeAccountChatIntent("find me the best MCP server for docs");

    expect(intent).toMatchObject({
      category: "mcp",
      language: "en",
      mode: "search",
      sources: ["mcp", "github", "npm"]
    });
  });

  test("routes package comparisons even when the user only names packages", () => {
    const intent = analyzeAccountChatIntent("zod vs yup");

    expect(intent).toMatchObject({
      category: "compare",
      mode: "search",
      searchQuery: "zod vs yup"
    });
  });

  test("routes Solana trading separately from Base trading", () => {
    const intent = analyzeAccountChatIntent("best package for solana wallet swap trading sdk");

    expect(intent).toMatchObject({
      category: "onchain-trading",
      mode: "search"
    });
    expect(intent.searchQuery).toContain("@solana/web3.js");
  });

  test("keeps general non-package questions out of fallback search", () => {
    const intent = analyzeAccountChatIntent("was ist npm eigentlich?");

    expect(intent).toMatchObject({
      category: "general",
      language: "de",
      mode: "conversation",
      searchQuery: ""
    });
    expect(buildAccountChatAnswer("was ist npm eigentlich?", null, [], null, intent)).toContain("Paket-Intelligence");
  });

  test("still searches when a user asks for a package decision", () => {
    expect(analyzeAccountChatIntent("ich brauche ein paket für pdf parsing")).toMatchObject({
      category: "generic",
      language: "de",
      mode: "search"
    });
    expect(analyzeAccountChatIntent("is zod safe to install?")).toMatchObject({
      category: "generic",
      language: "en",
      mode: "search"
    });
  });
});
