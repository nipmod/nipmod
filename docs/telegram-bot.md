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

## Commands

```text
/help
/search <term>
/packages
/install
/codex
/claude
/submit
/status
```

The bot also answers plain text only when the message directly mentions `@nipmodbot` or starts with `nipmod`.
This keeps the community chat quiet while still making the archive easy to query.
