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
NIPMOD_TELEGRAM_ADMIN_USER_IDS=<optional-comma-separated-admin-user-ids>
NIPMOD_TELEGRAM_DISABLED=0
NIPMOD_TELEGRAM_AI_ENABLED=1
NIPMOD_TELEGRAM_AI_PROVIDER=anthropic
NIPMOD_TELEGRAM_AI_MODEL=claude-sonnet-4-5
NIPMOD_TELEGRAM_ANTHROPIC_API_KEY=<anthropic-key>
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
/botstatus
/pause
/resume
```

The bot answers plain text when the message directly mentions `@nipmodbot`, starts with `nipmod`, mentions a Nipmod related topic, looks like a normal question, or asks for a link/action.
Question routing is typo tolerant for common words such as GitHub, Gitlawb, Bankr, Codex, Claude Code, install and links.
If the bot cannot answer cleanly, it says so and points to `/help` and `/links`.
Non question group chatter is ignored.

## AI layer

The local knowledge base answers exact public facts first.
When `NIPMOD_TELEGRAM_ANTHROPIC_API_KEY` or `ANTHROPIC_API_KEY` is present and `NIPMOD_TELEGRAM_AI_PROVIDER=anthropic`, broad questions fall through to Anthropic's Messages API.
OpenAI compatible chat completions are still supported through `NIPMOD_TELEGRAM_AI_PROVIDER=openai`.
The AI system prompt is restricted to Nipmod, official links, Gitlawb, GitHub, Bankr, Codex, Claude Code, MCP, install, packages, registry, safety and status.
If the question is outside scope, the AI must use the same short fallback.

## Safety controls

Incoming messages are checked before local routing or AI.
The bot blocks posted secrets, prompt extraction attempts, seed phrase requests, wallet secret handling, token price calls and buy or sell recommendations.
AI replies are checked again before sending.
The bot rate limits users by Telegram user id and stores only timestamps, never message text.
`/pause`, `/resume`, `/kill`, `/disable`, `/enable` and `/botstatus` are admin controls.
Admins are resolved from Telegram group admins or `NIPMOD_TELEGRAM_ADMIN_USER_IDS`.
`NIPMOD_TELEGRAM_DISABLED=1` starts the bot paused.

## Voice

The bot answers short and factual. It avoids filler language, avoids dash separated list copy and points to official links instead of guessing.
