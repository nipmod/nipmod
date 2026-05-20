import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildAiSystemPrompt,
  createTelegramBotReply,
  isChatAllowed,
  isQuestionLike,
  isRelevantGroupQuestion,
  matchesAny,
  parseTelegramCommand,
  renderAiReply,
  renderPlainTextReply,
  sanitizeAiReply,
  searchRegistryPackages,
  shouldAnswerGroupText,
  shouldReplyToPlainText
} from "./telegram-bot.mjs";

const packages = [
  {
    canonical: "pkg:did:key:z6Mk/gitlawb-repo-reader",
    description: "Read public Gitlawb repo metadata for agents.",
    name: "gitlawb-repo-reader",
    version: "0.1.0"
  },
  {
    canonical: "pkg:did:key:z6Mk/prompt-injection-scan",
    description: "Scan package prompts for injection risk.",
    name: "prompt-injection-scan",
    version: "0.1.0"
  }
];

describe("telegram bot command parsing", () => {
  test("accepts commands addressed to nipmodbot", () => {
    assert.deepEqual(parseTelegramCommand("/search@nipmodbot gitlawb", "nipmodbot"), {
      args: "gitlawb",
      mentionedBot: "nipmodbot",
      name: "search"
    });
  });

  test("ignores commands addressed to another bot", () => {
    assert.equal(parseTelegramCommand("/search@otherbot gitlawb", "nipmodbot"), null);
  });

  test("answers only direct mentions or explicit nipmod text", () => {
    assert.equal(shouldReplyToPlainText("hello everyone", "nipmodbot"), false);
    assert.equal(shouldReplyToPlainText("@nipmodbot how do I install?", "nipmodbot"), true);
    assert.equal(shouldReplyToPlainText("nipmod install help", "nipmodbot"), true);
  });

  test("answers relevant group questions without requiring a mention", () => {
    assert.equal(isRelevantGroupQuestion("how do I install this?"), true);
    assert.equal(isRelevantGroupQuestion("does this work with Codex?"), true);
    assert.equal(isRelevantGroupQuestion("where are the GitHub links?"), true);
    assert.equal(isRelevantGroupQuestion("what time is it?"), false);
    assert.equal(isQuestionLike("what time is it?"), true);
    assert.equal(shouldAnswerGroupText("what time is it?"), true);
    assert.equal(shouldAnswerGroupText("github link bitte"), true);
    assert.equal(shouldAnswerGroupText("hello everyone"), false);
    assert.equal(shouldReplyToPlainText("does this work with Codex?", "nipmodbot"), true);
    assert.equal(shouldReplyToPlainText("does this work with Codex?", "nipmodbot", { answerGroupQuestions: false }), false);
  });

  test("answers bot support messages without a mention", () => {
    assert.equal(shouldReplyToPlainText("der bot reagiert nicht auf meine fragen", "nipmodbot"), true);
    assert.equal(shouldReplyToPlainText("warum reagiert der bot nicht?", "nipmodbot"), true);
    assert.equal(shouldReplyToPlainText("was kann das?", "nipmodbot"), true);
  });

  test("understands typos and casual wording", () => {
    assert.equal(matchesAny("githb link bitte", ["github"]), true);
    assert.equal(matchesAny("banr coin?", ["bankr"]), true);
    assert.equal(matchesAny("cluade code setup?", ["claude"]), true);
    assert.equal(matchesAny("geht das mit coedx?", ["codex", "coedx"]), true);
    assert.equal(shouldReplyToPlainText("wi instalier ich das", "nipmodbot"), true);
    assert.equal(shouldReplyToPlainText("linsk bitte", "nipmodbot"), true);
  });
});

describe("telegram bot group binding", () => {
  test("binds first group only after /start", async () => {
    const reply = await createTelegramBotReply(groupUpdate("/start@nipmodbot"), {
      bindFirstGroup: true,
      groupOnly: true,
      username: "nipmodbot"
    });

    assert.equal(reply.statePatch.allowedChatId, "-100123");
    assert.match(reply.text, /bound to this group/);
  });

  test("ignores private chats when group-only mode is enabled", async () => {
    const reply = await createTelegramBotReply(
      {
        message: {
          chat: { id: 123, type: "private" },
          text: "/start"
        },
        update_id: 1
      },
      {
        bindFirstGroup: true,
        groupOnly: true,
        username: "nipmodbot"
      }
    );

    assert.equal(reply.ignored, true);
    assert.equal(reply.reason, "waiting-for-group-start");
  });

  test("ignores other groups after binding", async () => {
    const reply = await createTelegramBotReply(groupUpdate("/help", "-100999"), {
      allowedChatId: "-100123",
      bindFirstGroup: true,
      groupOnly: true,
      username: "nipmodbot"
    });

    assert.equal(reply.ignored, true);
    assert.equal(reply.reason, "chat-not-allowed");
  });

  test("allows the bound group", () => {
    assert.equal(isChatAllowed({ id: "-100123", type: "supergroup" }, { allowedChatId: "-100123" }), true);
  });
});

describe("telegram bot package search", () => {
  test("ranks package name matches before descriptions", () => {
    assert.deepEqual(
      searchRegistryPackages("gitlawb", packages).map((pkg) => pkg.name),
      ["gitlawb-repo-reader"]
    );
  });

  test("renders search results from the registry fixture", async () => {
    const reply = await createTelegramBotReply(groupUpdate("/search gitlawb"), {
      allowedChatId: "-100123",
      bindFirstGroup: true,
      groupOnly: true,
      packages,
      username: "nipmodbot"
    });

    assert.match(reply.text, /gitlawb-repo-reader@0\.1\.0/);
    assert.match(reply.text, /nipmod inspect pkg:did:key:z6Mk\/gitlawb-repo-reader@0\.1\.0/);
  });
});

describe("telegram bot knowledge base", () => {
  test("lists all important public links without dash list separators", async () => {
    const reply = await createTelegramBotReply(groupUpdate("/links"), {
      allowedChatId: "-100123",
      bindFirstGroup: true,
      groupOnly: true,
      packages,
      username: "nipmodbot"
    });

    assert.match(reply.text, /Website https:\/\/nipmod\.com/);
    assert.match(reply.text, /GitHub https:\/\/github\.com\/nipmod\/nipmod/);
    assert.match(reply.text, /Gitlawb https:\/\/gitlawb\.com\/node\/repos\/z6Mkwbud\/nipmod/);
    assert.match(reply.text, /Install script https:\/\/nipmod\.com\/install\.sh/);
    assert.match(reply.text, /Demo https:\/\/nipmod\.com\/demo/);
    assert.match(reply.text, /Bankr coin https:\/\/bankr\.bot\/launches\/0x5155Eaa3B5784B829DeAD78189Eb4Bf69359dbA3/);
    assert.doesNotMatch(reply.text, / - /);
  });

  test("answers Bankr questions directly", async () => {
    const reply = await createTelegramBotReply(groupUpdate("@nipmodbot bankr"), {
      allowedChatId: "-100123",
      bindFirstGroup: true,
      groupOnly: true,
      packages,
      username: "nipmodbot"
    });

    assert.match(reply.text, /Bankr has a Nipmod page and skill/);
    assert.match(reply.text, /https:\/\/nipmod\.com\/bankr/);
    assert.match(reply.text, /https:\/\/bankr\.bot\/launches\/0x5155Eaa3B5784B829DeAD78189Eb4Bf69359dbA3/);
  });

  test("answers a plain install question without a mention", async () => {
    const reply = await createTelegramBotReply(groupUpdate("how do I install this?"), {
      allowedChatId: "-100123",
      answerGroupQuestions: true,
      bindFirstGroup: true,
      groupOnly: true,
      packages,
      username: "nipmodbot"
    });

    assert.match(reply.text, /Install Nipmod/);
    assert.match(reply.text, /curl -fsSLO https:\/\/nipmod\.com\/install\.sh/);
  });

  test("answers off-topic questions with a concise fallback", async () => {
    const reply = await createTelegramBotReply(groupUpdate("what time is it?"), {
      allowedChatId: "-100123",
      answerGroupQuestions: true,
      bindFirstGroup: true,
      groupOnly: true,
      packages,
      username: "nipmodbot"
    });

    assert.match(reply.text, /I cannot answer that cleanly/);
  });

  test("answers bot support questions directly", async () => {
    const reply = await createTelegramBotReply(groupUpdate("der bot reagiert nicht auf meine fragen"), {
      allowedChatId: "-100123",
      answerGroupQuestions: true,
      bindFirstGroup: true,
      groupOnly: true,
      packages,
      username: "nipmodbot"
    });

    assert.match(reply.text, /I answer normal group questions/);
  });

  test("routes typo heavy questions to the right answers", async () => {
    const cases = [
      ["githb link bitte", /GitHub is the public mirror/],
      ["banr coin?", /Bankr has a Nipmod page and skill/],
      ["cluade code setup?", /Claude Code Setup/],
      ["geht das mit coedx?", /Codex Setup/],
      ["wi instalier ich das", /Install Nipmod/],
      ["linsk bitte", /Official Nipmod links/]
    ];

    for (const [text, expected] of cases) {
      const reply = await createTelegramBotReply(groupUpdate(text), {
        allowedChatId: "-100123",
        answerGroupQuestions: true,
        bindFirstGroup: true,
        groupOnly: true,
        packages,
        username: "nipmodbot"
      });

      assert.match(reply.text, expected);
    }
  });

  test("answers API key questions as security questions", async () => {
    const reply = await createTelegramBotReply(groupUpdate("@nipmodbot where do I put api keys?"), {
      allowedChatId: "-100123",
      bindFirstGroup: true,
      groupOnly: true,
      packages,
      username: "nipmodbot"
    });

    assert.match(reply.text, /Nipmod never needs private keys/);
    assert.doesNotMatch(reply.text, /Bankr has a Nipmod page and skill/);
  });

  test("returns a clean registry failure answer", async () => {
    const reply = await createTelegramBotReply(groupUpdate("/search gitlawb"), {
      allowedChatId: "-100123",
      bindFirstGroup: true,
      fetchFn: async () => new Response("down", { status: 503 }),
      groupOnly: true,
      username: "nipmodbot"
    });

    assert.match(reply.text, /Search unavailable/);
    assert.match(reply.text, /https:\/\/nipmod\.com\/status/);
  });

  test("uses concise fallback instead of fake certainty", async () => {
    const reply = await createTelegramBotReply(groupUpdate("@nipmodbot tell me something random"), {
      allowedChatId: "-100123",
      bindFirstGroup: true,
      groupOnly: true,
      packages,
      username: "nipmodbot"
    });

    assert.match(reply.text, /I cannot answer that cleanly/);
    assert.doesNotMatch(reply.text, /Unknown command/);
  });

  test("help text has no dash list separators", async () => {
    const reply = await createTelegramBotReply(groupUpdate("/help"), {
      allowedChatId: "-100123",
      bindFirstGroup: true,
      groupOnly: true,
      packages,
      username: "nipmodbot"
    });

    assert.match(reply.text, /Nipmod commands/);
    assert.match(reply.text, /\/links shows official links/);
    assert.doesNotMatch(reply.text, / - /);
  });
});

describe("telegram bot AI fallback", () => {
  test("uses AI fallback for broad questions when a key is configured", async () => {
    const calls = [];
    const reply = await createTelegramBotReply(groupUpdate("kannst du das grob einordnen?"), {
      allowedChatId: "-100123",
      aiApiKey: "sk-test",
      aiBaseUrl: "https://ai.example/v1/",
      aiModel: "test-model",
      answerGroupQuestions: true,
      bindFirstGroup: true,
      fetchFn: async (url, init) => {
        calls.push({ body: JSON.parse(init.body), url });
        return jsonResponse({
          choices: [
            {
              message: {
                content: "Nipmod is the package layer for agents.\nUse /links for official links."
              }
            }
          ]
        });
      },
      groupOnly: true,
      packages,
      username: "nipmodbot"
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://ai.example/v1/chat/completions");
    assert.equal(calls[0].body.model, "test-model");
    assert.match(calls[0].body.messages[0].content, /Official links:/);
    assert.match(reply.text, /package layer for agents/);
  });

  test("keeps exact local answers ahead of AI fallback", async () => {
    const reply = await renderPlainTextReply("githb link bitte", {
      aiApiKey: "sk-test",
      fetchFn: async () => {
        throw new Error("AI should not be called");
      },
      packages
    });

    assert.match(reply, /GitHub is the public mirror/);
  });

  test("falls back cleanly when AI is unavailable", async () => {
    const reply = await renderPlainTextReply("kannst du das grob einordnen?", {
      aiApiKey: "sk-test",
      fetchFn: async () => new Response("down", { status: 503 }),
      packages
    });

    assert.match(reply, /I cannot answer that cleanly/);
  });

  test("sanitizes AI dash bullets", () => {
    assert.equal(sanitizeAiReply("- Website https://nipmod.com\n- GitHub https://github.com/nipmod/nipmod"), "Website https://nipmod.com\nGitHub https://github.com/nipmod/nipmod");
  });

  test("AI prompt contains hard boundaries and official links", () => {
    const prompt = buildAiSystemPrompt(packages);
    assert.match(prompt, /Do not give trading advice/);
    assert.match(prompt, /Website: https:\/\/nipmod\.com/);
    assert.match(prompt, /GitHub: https:\/\/github\.com\/nipmod\/nipmod/);
    assert.match(prompt, /Live archive package count: 2/);
  });
});

function groupUpdate(text, id = "-100123") {
  return {
    message: {
      chat: {
        id,
        title: "Nipmod",
        type: "supergroup"
      },
      text
    },
    update_id: 1
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json"
    },
    status
  });
}
