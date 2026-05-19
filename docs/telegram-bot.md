# Telegram Bot

`@nipmodbot` is a small group helper for the Nipmod Telegram community.
It uses long polling, stores secrets only in local ignored files and binds to one group chat before answering.

## Setup

Store the bot token in `.env.local`:

```bash
TELEGRAM_BOT_TOKEN=<botfather-token>
NIPMOD_TELEGRAM_BOT_USERNAME=nipmodbot
NIPMOD_TELEGRAM_GROUP_ONLY=1
NIPMOD_TELEGRAM_BIND_FIRST_GROUP=1
NIPMOD_TELEGRAM_ANSWER_GROUP_QUESTIONS=1
```

`.env.local` is ignored by git and skipped by the secret scan.

Start the bot:

```bash
node tools/telegram-bot.mjs
```

Add `@nipmodbot` to the Telegram group and send:

```text
/start@nipmodbot
```

The first group that sends `/start@nipmodbot` is saved in `.nipmod/telegram-bot-state.json`.
After that the bot ignores private chats and other groups unless `NIPMOD_TELEGRAM_ALLOWED_CHAT_ID` is explicitly changed.

To let the bot see normal group questions without `@nipmodbot`, disable Telegram privacy mode in BotFather:

```text
/setprivacy
@nipmodbot
Disable
```

With privacy enabled, Telegram only sends commands, mentions and selected bot events to the bot.

## Commands

```text
/help
/links
/search <term>
/packages
/install
/codex
/claude
/github
/gitlawb
/bankr
/mcp
/security
/submit
/status
```

The bot answers plain text when the message directly mentions `@nipmodbot`, starts with `nipmod`, or looks like a relevant Nipmod question.
Off topic group chatter is ignored.

## Voice

The bot answers short and factual. It avoids filler language, avoids dash separated list copy and points to official links instead of guessing.
