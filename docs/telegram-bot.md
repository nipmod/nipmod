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
NIPMOD_TELEGRAM_LOG_UPDATES=1
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

The bot receives group messages, edited group messages and caption text.
It answers normal questions in the group, direct mentions, messages that start with `nipmod`, and Nipmod related requests.
Question routing is typo tolerant for common words such as GitHub, Gitlawb, Bankr, Codex, Claude Code, install and links.
If the bot cannot answer cleanly, it says so and points to `/help` and `/links`.
General non question chatter is ignored.
In topic based groups the bot replies in the same topic.

## AI layer

Commands, exact link requests, coin requests and security questions are handled locally for precision.
When `NIPMOD_TELEGRAM_ANTHROPIC_API_KEY` or `ANTHROPIC_API_KEY` is present and `NIPMOD_TELEGRAM_AI_PROVIDER=anthropic`, normal Nipmod questions go to Anthropic's Messages API with the local knowledge base injected into the system prompt.
If the AI request fails, the local knowledge base answers as a fallback.
OpenAI compatible chat completions are still supported through `NIPMOD_TELEGRAM_AI_PROVIDER=openai`.
The AI system prompt keeps Nipmod context for project questions while allowing harmless general community questions.
If the answer needs live data the bot does not have, it says that briefly instead of guessing.

## Safety controls

Incoming messages are checked before local routing or AI.
The bot blocks posted secrets, prompt extraction attempts, seed phrase requests, wallet secret handling, token price calls and buy or sell recommendations.
AI replies are checked again before sending.
The bot rate limits users by Telegram user id and stores only timestamps, never message text.
Runtime logs include update id, chat id, user id, message type, text presence, text length and topic id.
Runtime logs do not include the actual message text.
`/pause`, `/resume`, `/kill`, `/disable`, `/enable` and `/botstatus` are admin controls.
Admins are resolved from Telegram group admins or `NIPMOD_TELEGRAM_ADMIN_USER_IDS`.
`NIPMOD_TELEGRAM_DISABLED=1` starts the bot paused.

## Voice

The bot always replies in English, even when the question is written in German or typo heavy shorthand.
It answers short and factual, avoids filler language, avoids dash separated list copy and points to official links instead of guessing.
Outgoing Telegram messages are rendered with safe HTML: short headings are bold, command lines are code formatted and sections get breathing room.
