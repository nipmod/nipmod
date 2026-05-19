import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  createTelegramBotReply,
  isChatAllowed,
  parseTelegramCommand,
  searchRegistryPackages,
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
