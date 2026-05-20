#!/usr/bin/env node
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const DEFAULT_ENV_PATH = join(root, ".env.local");
const DEFAULT_STATE_PATH = join(root, ".nipmod", "telegram-bot-state.json");
const DEFAULT_REGISTRY_URL = "https://nipmod.com/registry/packages.json";
const DEFAULT_BOT_USERNAME = "nipmodbot";
const DEFAULT_POLL_TIMEOUT_SECONDS = 45;
const DEFAULT_ANSWER_GROUP_QUESTIONS = true;
const DEFAULT_AI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_AI_MODEL = "gpt-4o-mini";
const DEFAULT_AI_PROVIDER = "openai";
const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-5";
const ANTHROPIC_VERSION = "2023-06-01";
const AI_TIMEOUT_MS = 12000;
const AI_REPLY_MAX_CHARS = 1200;
const DEFAULT_RATE_LIMIT_MAX = 6;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const ADMIN_COMMANDS = new Set(["pause", "resume", "kill", "disable", "enable", "botstatus"]);
const TELEGRAM_ALLOWED_UPDATES = ["message", "edited_message", "channel_post", "edited_channel_post"];
const OFFICIAL_LINKS = [
  ["Website", "https://nipmod.com"],
  ["Packages", "https://nipmod.com/packages"],
  ["Registry", "https://nipmod.com/registry/packages.json"],
  ["GitHub", "https://github.com/nipmod/nipmod"],
  ["Gitlawb", "https://gitlawb.com/node/repos/z6Mkwbud/nipmod"],
  ["Telegram", "https://t.me/+05Kux7Iyah9jZjAy"],
  ["X", "https://x.com/Nipmod"],
  ["Install script", "https://nipmod.com/install.sh"],
  ["Bankr coin", "https://bankr.bot/launches/0x5155Eaa3B5784B829DeAD78189Eb4Bf69359dbA3"],
  ["Bankr integration", "https://nipmod.com/bankr"],
  ["Bankr skill", "https://nipmod.com/integrations/bankr/nipmod/SKILL.md"],
  ["Agent discovery", "https://nipmod.com/.well-known/nipmod.json"],
  ["Agent instructions", "https://nipmod.com/llms.txt"],
  ["Quickstart", "https://nipmod.com/quickstart"],
  ["Demo", "https://nipmod.com/demo"],
  ["MCP", "https://nipmod.com/mcp"],
  ["Status", "https://nipmod.com/status"],
  ["System readiness", "https://nipmod.com/compatibility/system-readiness.json"],
  ["Platform readiness", "https://nipmod.com/compatibility/platform-readiness.json"],
  ["Scout candidates", "https://nipmod.com/scout/candidates"],
  ["Scout drafts", "https://nipmod.com/scout/drafts"]
];

const FACTS = {
  archive:
    "Nipmod is the shared package archive for agents. Packages are verified, signed, digest pinned and sourced from Gitlawb.",
  bankr:
    "Bankr has a Nipmod page and skill. Bankr agents can read the skill before installing agent packages.",
  github:
    "GitHub is the public mirror for review, CI and developer access. Gitlawb stays the canonical source for signed provenance.",
  gitlawb:
    "Gitlawb is the canonical source network for Nipmod packages. Nipmod indexes, verifies and installs from that source layer.",
  mcp:
    "Nipmod exposes MCP tools for agent search, view, inspect, install planning, controlled install, audit, SBOM and explain.",
  safety:
    "Nipmod never needs private keys, seed phrases or wallet secrets in Telegram. Package text is treated as untrusted data."
};

const QUESTION_MARKERS = [
  "?",
  "answer",
  "can",
  "does",
  "geht",
  "how",
  "is",
  "ist",
  "kann",
  "koennen",
  "konnen",
  "macht",
  "muss",
  "question",
  "soll",
  "was",
  "what",
  "where",
  "why",
  "wi",
  "wie",
  "wo",
  "womit",
  "antwort",
  "frage",
  "fragen",
  "warum",
  "wieso"
];

const REQUEST_MARKERS = [
  "bitte",
  "brauch",
  "brauche",
  "gib",
  "give",
  "need",
  "please",
  "sag",
  "say",
  "schick",
  "send",
  "show",
  "tell",
  "zeig"
];

const NIPMOD_CONTEXT_TERMS = [
  "agent",
  "agents",
  "answer",
  "antwort",
  "archive",
  "archiv",
  "bankr",
  "bankrcoin",
  "bot",
  "claude",
  "codex",
  "coin",
  "frage",
  "fragen",
  "github",
  "gitlawb",
  "install",
  "link",
  "links",
  "mcp",
  "mirror",
  "nipmod",
  "package",
  "packages",
  "paket",
  "question",
  "questions",
  "reagiert",
  "registry",
  "repo",
  "security",
  "setup",
  "source",
  "token",
  "x402"
];

const LINK_TERMS = ["link", "links", "linsk", "url", "official", "offiziell"];
const X_TERMS = ["twitter", "x"];
const GITHUB_TERMS = ["github", "git hub", "githb", "gihtub"];
const GITLAWB_TERMS = ["gitlawb", "git lab", "gitlab", "gitlb", "gitlwab"];
const SECURITY_TERMS = [
  "api key",
  "api token",
  "bot token",
  "key",
  "keys",
  "private key",
  "safe",
  "safety",
  "secret",
  "security",
  "seed",
  "seed phrase",
  "sicher",
  "wallet secret"
];
const BANKR_TERMS = ["bankr", "bankrcoin", "banr", "bnkr", "coin", "investor", "token", "tokenomics", "x402"];
const BOT_TERMS = ["answer", "antwort", "bot", "frage", "fragen", "question", "questions", "reagiert"];
const MCP_TERMS = ["mcp", "tool", "tools"];
const CODEX_TERMS = ["codex", "coedx", "cdoex"];
const CLAUDE_TERMS = ["claude", "claude code", "cluade", "cloude"];
const INSTALL_TERMS = ["einrichten", "install", "installieren", "instalieren", "instaliere", "instalier", "setup"];
const PACKAGE_TERMS = ["archive", "archiv", "package", "packages", "paket", "registry"];
const ABOUT_TERMS = ["how does", "nipmod", "was ist", "was kann", "what can", "what is", "wie funktioniert"];
const ONBOARDING_QUESTION_TERMS = [
  "how does this work",
  "how to use this",
  "was ist das",
  "was kann das",
  "what can it do",
  "what can this do",
  "what does it do",
  "what does this do",
  "what is it",
  "what is this",
  "wie benutze ich das",
  "wie funktioniert das"
];

const SECRET_VALUE_PATTERNS = [
  /\bsk-ant-[A-Za-z0-9_-]{20,}\b/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  /\b\d{7,}:[A-Za-z0-9_-]{20,}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:0x)?[a-f0-9]{64}\b/i
];

const SECRET_REQUEST_TERMS = [
  "api key",
  "api token",
  "bot token",
  "private key",
  "seed phrase",
  "secret key",
  "wallet key",
  "wallet secret"
];

const SECRET_ACTION_TERMS = [
  "dump",
  "gib",
  "give",
  "leak",
  "paste",
  "print",
  "reveal",
  "sag",
  "send",
  "share",
  "show",
  "zeige"
];

const PROMPT_INJECTION_TERMS = [
  "developer message",
  "ignore previous",
  "ignore your instructions",
  "jailbreak",
  "print your prompt",
  "reveal system",
  "system prompt",
  "systemnachricht",
  "vergiss deine anweisungen"
];

const TRADING_TERMS = [
  "buy",
  "dump",
  "entry",
  "financial advice",
  "moon",
  "preis",
  "price",
  "pump",
  "sell",
  "shill",
  "short",
  "target",
  "trading",
  "was kostet",
  "x kaufen"
];

export function isLikelyTelegramBotToken(value) {
  return /^[0-9]+:[A-Za-z0-9_-]{20,}$/.test(String(value ?? ""));
}

export function parseEnvText(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) {
      continue;
    }
    const [, key, rawValue] = match;
    env[key] = unquoteEnvValue(rawValue.trim());
  }
  return env;
}

export async function loadLocalEnv(path = DEFAULT_ENV_PATH) {
  if (!existsSync(path)) {
    return {};
  }
  return parseEnvText(await readFile(path, "utf8"));
}

export function normalizeBotUsername(username = DEFAULT_BOT_USERNAME) {
  return String(username).replace(/^@/, "").trim().toLowerCase() || DEFAULT_BOT_USERNAME;
}

export function parseTelegramCommand(text, username = DEFAULT_BOT_USERNAME) {
  const normalizedUsername = normalizeBotUsername(username);
  const match = /^\/([A-Za-z0-9_]+)(?:@([A-Za-z0-9_]+))?(?:\s+([\s\S]*))?$/.exec(String(text ?? "").trim());
  if (!match) {
    return null;
  }
  const [, name, mentionedBot, args = ""] = match;
  if (mentionedBot && mentionedBot.toLowerCase() !== normalizedUsername) {
    return null;
  }
  return {
    args: args.trim(),
    mentionedBot: mentionedBot ? mentionedBot.toLowerCase() : null,
    name: name.toLowerCase()
  };
}

export function isGroupChat(chat) {
  return chat?.type === "group" || chat?.type === "supergroup";
}

export function isChatAllowed(chat, { allowedChatId = null, groupOnly = true } = {}) {
  if (!chat) {
    return false;
  }
  if (groupOnly && !isGroupChat(chat)) {
    return false;
  }
  if (allowedChatId !== null && allowedChatId !== undefined && String(chat.id) !== String(allowedChatId)) {
    return false;
  }
  return true;
}

export function getTelegramUpdateMessage(update) {
  return update?.message ?? update?.edited_message ?? update?.channel_post ?? update?.edited_channel_post ?? null;
}

export function getTelegramMessageText(message) {
  if (typeof message?.text === "string") {
    return message.text;
  }
  if (typeof message?.caption === "string") {
    return message.caption;
  }
  return "";
}

export function getTelegramMessageType(message) {
  if (!message) {
    return "no-message";
  }
  if (typeof message.text === "string") {
    return "text";
  }
  if (typeof message.caption === "string") {
    return "caption";
  }
  const knownTypes = [
    "animation",
    "audio",
    "contact",
    "document",
    "forum_topic_closed",
    "forum_topic_created",
    "forum_topic_edited",
    "left_chat_member",
    "location",
    "message_auto_delete_timer_changed",
    "new_chat_members",
    "photo",
    "pinned_message",
    "poll",
    "sticker",
    "venue",
    "video",
    "video_note",
    "voice"
  ];
  return knownTypes.find((type) => message[type] !== undefined) ?? "other";
}

export function safeTelegramMessageLogMeta(update) {
  const message = getTelegramUpdateMessage(update);
  if (!message) {
    return `update=${update?.update_id ?? "unknown"} type=no-message`;
  }
  const text = getTelegramMessageText(message);
  const threadId = message.message_thread_id === undefined ? "none" : message.message_thread_id;
  const userId = message.from?.id === undefined ? "unknown" : message.from.id;
  const chatId = message.chat?.id === undefined ? "unknown" : message.chat.id;
  return [
    `update=${update?.update_id ?? "unknown"}`,
    `chat=${chatId}`,
    `user=${userId}`,
    `type=${getTelegramMessageType(message)}`,
    `hasText=${text ? "true" : "false"}`,
    `textLength=${text.length}`,
    `thread=${threadId}`
  ].join(" ");
}

export function shouldReplyToPlainText(text, username = DEFAULT_BOT_USERNAME, { answerGroupQuestions = true } = {}) {
  const normalized = String(text ?? "").trim().toLowerCase();
  const normalizedForMatching = normalizeTextForMatching(normalized);
  const botMention = `@${normalizeBotUsername(username)}`;
  return (
    normalized.includes(botMention) ||
    normalizedForMatching === "nipmod" ||
    normalizedForMatching.startsWith("nipmod ") ||
    (answerGroupQuestions && shouldAnswerGroupText(normalized))
  );
}

export function shouldAnswerGroupText(text) {
  const normalized = String(text ?? "").trim().toLowerCase();
  if (isQuestionLike(normalized) || isGeneralRequestLike(normalized) || isOnboardingQuestion(normalized)) {
    return true;
  }
  if (!hasNipmodContext(normalized)) {
    return false;
  }
  return (
    isQuestionLike(normalized) ||
    isRequestLike(normalized) ||
    matchesAny(normalized, LINK_TERMS) ||
    matchesAny(normalized, BOT_TERMS)
  );
}

export function isRelevantGroupQuestion(text) {
  const normalized = String(text ?? "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return isQuestionLike(normalized);
}

export function hasNipmodContext(text) {
  const normalized = String(text ?? "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return matchesAny(normalized, [
    ...NIPMOD_CONTEXT_TERMS,
    ...LINK_TERMS,
    ...X_TERMS,
    ...GITHUB_TERMS,
    ...GITLAWB_TERMS,
    ...SECURITY_TERMS,
    ...BANKR_TERMS,
    ...BOT_TERMS,
    ...MCP_TERMS,
    ...CODEX_TERMS,
    ...CLAUDE_TERMS,
    ...INSTALL_TERMS,
    ...PACKAGE_TERMS
  ]);
}

export function isOnboardingQuestion(text) {
  const normalized = String(text ?? "").trim().toLowerCase();
  if (!normalized || !isQuestionLike(normalized)) {
    return false;
  }
  return matchesAny(normalized, ONBOARDING_QUESTION_TERMS);
}

export function isQuestionLike(text) {
  const normalized = String(text ?? "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized.includes("?")) {
    return true;
  }
  return matchesAny(normalized, QUESTION_MARKERS);
}

export function isRequestLike(text) {
  const normalized = String(text ?? "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return matchesAny(normalized, REQUEST_MARKERS) && matchesAny(normalized, NIPMOD_CONTEXT_TERMS);
}

export function isGeneralRequestLike(text) {
  const normalized = String(text ?? "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return matchesAny(normalized, REQUEST_MARKERS) && normalizeTextForMatching(normalized).split(/\s+/).filter(Boolean).length >= 3;
}

export function classifyIncomingText(text) {
  const normalized = normalizeTextForMatching(text);
  if (SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(String(text ?? "")))) {
    return {
      ok: false,
      reason: "secret-value",
      text: "Do not post secrets in Telegram. Rotate that key if it was real."
    };
  }
  if (containsSafetyTerm(normalized, PROMPT_INJECTION_TERMS)) {
    return {
      ok: false,
      reason: "prompt-injection",
      text: "I cannot help with prompt extraction or instruction bypasses."
    };
  }
  if (containsSafetyTerm(normalized, SECRET_REQUEST_TERMS) && containsSafetyTerm(normalized, SECRET_ACTION_TERMS)) {
    return {
      ok: false,
      reason: "secret-request",
      text: "I cannot reveal or handle private keys, seed phrases, wallet secrets or API keys in Telegram."
    };
  }
  if (containsSafetyTerm(normalized, TRADING_TERMS)) {
    return {
      ok: false,
      reason: "trading",
      text: "I cannot give trading advice, token price calls or buy/sell recommendations."
    };
  }
  return { ok: true, reason: "ok" };
}

export function filterOutgoingReply(text) {
  const value = String(text ?? "");
  const incoming = classifyIncomingText(value);
  if (!incoming.ok && incoming.reason !== "trading") {
    return {
      ok: false,
      reason: `outgoing-${incoming.reason}`,
      text: "I blocked that response because it looked unsafe."
    };
  }
  if (containsSafetyTerm(normalizeTextForMatching(value), TRADING_TERMS)) {
    return {
      ok: false,
      reason: "outgoing-trading",
      text: "I cannot give trading advice, token price calls or buy/sell recommendations."
    };
  }
  return { ok: true, reason: "ok", text: value };
}

export async function createTelegramBotReply(update, options = {}) {
  const message = getTelegramUpdateMessage(update);
  const text = getTelegramMessageText(message);
  if (!message || !text) {
    return { ignored: true, reason: "no-text-message" };
  }

  const username = normalizeBotUsername(options.username);
  const command = parseTelegramCommand(text, username);
  const groupOnly = options.groupOnly !== false;
  const bindFirstGroup = options.bindFirstGroup !== false;
  const allowedChatId = options.allowedChatId ?? null;
  const answerGroupQuestions = options.answerGroupQuestions ?? DEFAULT_ANSWER_GROUP_QUESTIONS;
  const disabled = Boolean(options.disabled);
  const adminUserIds = normalizeIdSet(options.adminUserIds ?? []);
  const isAdmin = Boolean(options.isAdmin || adminUserIds.has(String(message.from?.id ?? "")));

  if (!allowedChatId && bindFirstGroup) {
    if (!isGroupChat(message.chat) || command?.name !== "start") {
      return { ignored: true, reason: "waiting-for-group-start" };
    }
    return {
      statePatch: {
        allowedChatId: String(message.chat.id),
        allowedChatTitle: message.chat.title ?? null,
        boundAt: options.now ?? new Date().toISOString()
      },
      text: startText({ newlyBound: true })
    };
  }

  if (!isChatAllowed(message.chat, { allowedChatId, groupOnly })) {
    return { ignored: true, reason: "chat-not-allowed" };
  }

  if (command && ADMIN_COMMANDS.has(command.name)) {
    return renderAdminCommandReply(command, { disabled, isAdmin });
  }

  if (disabled) {
    return { ignored: true, reason: "bot-disabled" };
  }

  const shouldAnswerPlainText = command
    ? true
    : shouldReplyToPlainText(text, username, { answerGroupQuestions });
  const inputSafety = classifyIncomingText(text);
  if (!inputSafety.ok) {
    if (!command && !shouldAnswerPlainText && inputSafety.reason !== "secret-value") {
      return { ignored: true, reason: "plain-text-not-addressed" };
    }
    return {
      safetyEvent: inputSafety.reason,
      text: inputSafety.text
    };
  }

  if (command) {
    return safeReply(await renderCommandReply(command, options));
  }

  if (!shouldAnswerPlainText) {
    return { ignored: true, reason: "plain-text-not-addressed" };
  }

  return safeReply(await renderPlainTextReply(text, options));
}

export async function renderCommandReply(command, options = {}) {
  switch (command.name) {
    case "start":
      return startText({ newlyBound: false });
    case "help":
      return helpText();
    case "links":
      return linksText();
    case "install":
      return installText();
    case "codex":
      return codexText();
    case "claude":
      return claudeText();
    case "github":
      return githubText();
    case "gitlawb":
      return gitlawbText();
    case "bankr":
      return bankrText();
    case "mcp":
      return mcpText();
    case "security":
      return securityText();
    case "packages":
      return packagesText(await getRegistryPackagesForReply(options));
    case "search":
      return searchText(command.args, await getRegistryPackagesForReply(options));
    case "submit":
      return submitText();
    case "status":
      return statusText();
    default:
      return conciseFallbackText();
  }
}

export function renderAdminCommandReply(command, { disabled = false, isAdmin = false } = {}) {
  if (!isAdmin) {
    return {
      adminAction: "unauthorized",
      text: "Only group admins can use bot control commands."
    };
  }
  switch (command.name) {
    case "pause":
    case "kill":
    case "disable":
      return {
        adminAction: "pause",
        text: "Bot paused. Admins can use /resume to enable replies again."
      };
    case "resume":
    case "enable":
      return {
        adminAction: "resume",
        text: "Bot resumed."
      };
    case "botstatus":
      return {
        adminAction: "status",
        text: disabled ? "Bot status: paused." : "Bot status: active."
      };
    default:
      return {
        adminAction: "unknown",
        text: "Unknown admin command."
      };
  }
}

function safeReply(text) {
  const safety = filterOutgoingReply(text);
  return {
    ...(safety.ok ? {} : { safetyEvent: safety.reason }),
    text: safety.text
  };
}

export async function renderPlainTextReply(text, options = {}) {
  const cleaned = String(text ?? "")
    .replace(new RegExp(`@${normalizeBotUsername(options.username)}`, "gi"), "")
    .trim();
  const immediateReply = await renderImmediatePlainTextReply(cleaned, options);
  if (immediateReply) {
    return immediateReply;
  }
  const aiReply = await renderAiReply(cleaned, options);
  if (aiReply) {
    return aiReply;
  }
  return (await renderKnownPlainTextReply(cleaned, options)) ?? conciseFallbackText();
}

export async function renderImmediatePlainTextReply(text, options = {}) {
  const cleaned = String(text ?? "").trim();
  const lower = cleaned.toLowerCase();

  if (isSpecificXRequest(lower)) {
    return xText();
  }
  if (isSpecificCoinRequest(lower)) {
    return coinText();
  }
  if (matchesAny(lower, SECURITY_TERMS)) {
    return securityText();
  }
  if (isSpecificOfficialLinksRequest(lower)) {
    return linksText();
  }
  if (isSpecificGithubRequest(lower)) {
    return githubText();
  }
  if (isSpecificGitlawbRequest(lower)) {
    return gitlawbText();
  }
  if (isSpecificInstallRequest(lower)) {
    return installText();
  }
  return null;
}

export async function renderKnownPlainTextReply(text, options = {}) {
  const cleaned = String(text ?? "").trim();
  const lower = cleaned.toLowerCase();

  if (isSpecificXRequest(lower)) {
    return xText();
  }
  if (isSpecificCoinRequest(lower)) {
    return coinText();
  }
  if (matchesAny(lower, GITHUB_TERMS) || matchesAny(lower, ["mirror"])) {
    return githubText();
  }
  if (matchesAny(lower, GITLAWB_TERMS) || matchesAny(lower, ["canonical", "quelle", "source"])) {
    return gitlawbText();
  }
  if (matchesAny(lower, SECURITY_TERMS)) {
    return securityText();
  }
  if (matchesAny(lower, BOT_TERMS)) {
    return botText();
  }
  if (matchesAny(lower, BANKR_TERMS)) {
    return bankrText();
  }
  if (matchesAny(lower, MCP_TERMS)) {
    return mcpText();
  }
  if (matchesAny(lower, CLAUDE_TERMS)) {
    return claudeText();
  }
  if (matchesAny(lower, CODEX_TERMS)) {
    return codexText();
  }
  if (matchesAny(lower, INSTALL_TERMS)) {
    return installText();
  }
  if (matchesAny(lower, PACKAGE_TERMS)) {
    return packagesText(await getRegistryPackagesForReply(options));
  }
  if (matchesAny(lower, ABOUT_TERMS)) {
    return aboutText();
  }
  if (matchesAny(lower, LINK_TERMS)) {
    return linksText();
  }
  return null;
}

export async function getRegistryPackages({ packages = null, registryUrl = DEFAULT_REGISTRY_URL, fetchFn = fetch } = {}) {
  if (Array.isArray(packages)) {
    return packages;
  }
  const response = await fetchFn(registryUrl, {
    headers: {
      accept: "application/json"
    }
  });
  if (!response.ok) {
    throw new Error(`registry request failed: ${response.status}`);
  }
  const body = await response.json();
  return Array.isArray(body.packages) ? body.packages : [];
}

async function getRegistryPackagesForReply(options) {
  try {
    return await getRegistryPackages(options);
  } catch {
    return null;
  }
}

export async function renderAiReply(text, options = {}) {
  const ai = resolveAiOptions(options);
  if (!ai.enabled || !ai.apiKey) {
    return null;
  }

  const packages = await getRegistryPackagesForReply(options);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ai.timeoutMs);
  try {
    const response = ai.provider === "anthropic"
      ? await callAnthropicMessagesApi({ ai, packages, signal: controller.signal, text })
      : await callOpenAiChatCompletionsApi({ ai, packages, signal: controller.signal, text });
    if (!response) {
      return null;
    }
    return sanitizeAiReply(response);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAiChatCompletionsApi({ ai, packages, signal, text }) {
  const response = await ai.fetchFn(`${ai.baseUrl}/chat/completions`, {
    body: JSON.stringify({
      max_tokens: 240,
      messages: [
        {
          content: buildAiSystemPrompt(packages),
          role: "system"
        },
        {
          content: String(text ?? "").slice(0, 1200),
          role: "user"
        }
      ],
      model: ai.model,
      temperature: 0.2
    }),
    headers: {
      authorization: `Bearer ${ai.apiKey}`,
      "content-type": "application/json"
    },
    method: "POST",
    signal
  });
  if (!response.ok) {
    return null;
  }
  const body = await response.json().catch(() => null);
  return body?.choices?.[0]?.message?.content ?? null;
}

async function callAnthropicMessagesApi({ ai, packages, signal, text }) {
  const response = await ai.fetchFn(`${ai.baseUrl}/messages`, {
    body: JSON.stringify({
      max_tokens: 240,
      messages: [
        {
          content: String(text ?? "").slice(0, 1200),
          role: "user"
        }
      ],
      model: ai.model,
      system: buildAiSystemPrompt(packages),
      temperature: 0.2
    }),
    headers: {
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
      "x-api-key": ai.apiKey
    },
    method: "POST",
    signal
  });
  if (!response.ok) {
    return null;
  }
  const body = await response.json().catch(() => null);
  return Array.isArray(body?.content)
    ? body.content.filter((part) => part?.type === "text").map((part) => part.text).join("\n").trim()
    : null;
}

export function resolveAiOptions(options = {}) {
  const apiKey = options.aiApiKey || options.openaiApiKey || null;
  const provider = normalizeAiProvider(options.aiProvider || DEFAULT_AI_PROVIDER);
  return {
    apiKey,
    baseUrl: trimTrailingSlash(
      options.aiBaseUrl || (provider === "anthropic" ? DEFAULT_ANTHROPIC_BASE_URL : DEFAULT_AI_BASE_URL)
    ),
    enabled: options.aiEnabled !== false && Boolean(apiKey),
    fetchFn: options.aiFetchFn || options.fetchFn || fetch,
    model: options.aiModel || (provider === "anthropic" ? DEFAULT_ANTHROPIC_MODEL : DEFAULT_AI_MODEL),
    provider,
    timeoutMs: options.aiTimeoutMs || AI_TIMEOUT_MS
  };
}

function normalizeAiProvider(provider) {
  const normalized = String(provider ?? "").trim().toLowerCase();
  return normalized === "anthropic" || normalized === "claude" ? "anthropic" : "openai";
}

export function buildAiSystemPrompt(packages = null) {
  const packageSummary = Array.isArray(packages)
    ? `Live archive package count: ${packages.length}. Known package names: ${packages
        .slice(0, 18)
        .map((pkg) => pkg.name)
        .join(", ")}.`
    : "Live archive package count is unavailable right now.";
  const links = OFFICIAL_LINKS.map(([label, url]) => `${label}: ${url}`).join("\n");
  return [
    "You are @nipmodbot in the Nipmod Telegram group.",
    "Answer as a precise project agent, not as a generic assistant.",
    "Always answer in English.",
    "If the user writes in German or another language, understand the request but still answer in English.",
    "Keep answers under 6 short lines.",
    "No hype, no filler, no invented roadmap, no fake certainty.",
    "Do not use markdown dash bullets.",
    "Do not use bullet symbols, en dashes or em dashes.",
    "Use plain short lines.",
    "Never ask for private keys, seed phrases, wallet secrets or API keys in Telegram.",
    "Do not give trading advice, token price predictions or financial recommendations.",
    "Answer normal community questions like a helpful human when they are harmless.",
    "For harmless small talk, simple jokes, wording help or casual requests, answer naturally and briefly.",
    "Keep Nipmod context when the question is about Nipmod, agents, packages, Gitlawb, GitHub, Bankr, Codex, Claude Code, MCP, install, registry, safety or status.",
    "If a question needs live data you do not have, say that briefly and give the safest useful answer.",
    "If you are not sure, answer exactly:",
    conciseFallbackText(),
    "",
    "Facts:",
    FACTS.archive,
    FACTS.gitlawb,
    FACTS.github,
    FACTS.bankr,
    FACTS.mcp,
    FACTS.safety,
    packageSummary,
    "",
    "Official links:",
    links
  ].join("\n");
}

export function sanitizeAiReply(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*•‣◦]\s+/, "").replace(/\s+[–—-]\s+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, AI_REPLY_MAX_CHARS)
    .trim();
}

export function searchRegistryPackages(query, packages, limit = 5) {
  const terms = String(query ?? "")
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
  if (terms.length === 0) {
    return [];
  }

  return packages
    .map((pkg) => ({ pkg, score: packageSearchScore(pkg, terms) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || String(a.pkg.name).localeCompare(String(b.pkg.name)))
    .slice(0, limit)
    .map((entry) => entry.pkg);
}

export async function readBotState(path = DEFAULT_STATE_PATH) {
  if (!existsSync(path)) {
    return {};
  }
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return {};
  }
}

export async function writeBotState(path, state) {
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await rename(tempPath, path);
  await chmod(path, 0o600).catch(() => {});
}

export function checkRateLimit(state, { userId, now = Date.now(), max = DEFAULT_RATE_LIMIT_MAX, windowMs = DEFAULT_RATE_LIMIT_WINDOW_MS } = {}) {
  if (!userId || max <= 0 || windowMs <= 0) {
    return { allowed: true, count: 0, retryAfterMs: 0 };
  }
  state.rateLimit ??= {};
  const key = String(userId);
  const recent = (state.rateLimit[key] ?? []).filter((timestamp) => now - timestamp < windowMs);
  if (recent.length >= max) {
    state.rateLimit[key] = recent;
    return {
      allowed: false,
      count: recent.length,
      retryAfterMs: Math.max(0, windowMs - (now - recent[0]))
    };
  }
  recent.push(now);
  state.rateLimit[key] = recent;
  return {
    allowed: true,
    count: recent.length,
    retryAfterMs: 0
  };
}

async function resolveTelegramAdmin({ adminUserIds, chatId, client, userId }) {
  if (!userId) {
    return false;
  }
  if (adminUserIds.has(String(userId))) {
    return true;
  }
  try {
    const admins = await client.getChatAdministrators(chatId);
    return admins.some((admin) => String(admin?.user?.id) === String(userId));
  } catch {
    return false;
  }
}

export class TelegramClient {
  constructor({ token, fetchFn = fetch }) {
    this.token = token;
    this.fetchFn = fetchFn;
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async call(method, body) {
    const response = await this.fetchFn(`${this.baseUrl}/${method}`, {
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      const description = payload?.description ?? `HTTP ${response.status}`;
      throw new Error(`Telegram ${method} failed: ${description}`);
    }
    return payload.result;
  }

  getUpdates({ offset = undefined, timeout = DEFAULT_POLL_TIMEOUT_SECONDS } = {}) {
    return this.call("getUpdates", {
      allowed_updates: TELEGRAM_ALLOWED_UPDATES,
      offset,
      timeout
    });
  }

  getChatAdministrators(chatId) {
    return this.call("getChatAdministrators", {
      chat_id: chatId
    });
  }

  sendMessage(chatId, text, { messageThreadId = undefined } = {}) {
    return this.call("sendMessage", {
      chat_id: chatId,
      disable_web_page_preview: true,
      ...(messageThreadId === undefined ? {} : { message_thread_id: messageThreadId }),
      text
    });
  }
}

export async function runTelegramBot({
  allowedChatId = null,
  adminUserIds = [],
  aiApiKey = null,
  aiBaseUrl = DEFAULT_AI_BASE_URL,
  aiEnabled = false,
  aiModel = DEFAULT_AI_MODEL,
  aiProvider = DEFAULT_AI_PROVIDER,
  bindFirstGroup = true,
  disabled = false,
  fetchFn = fetch,
  groupOnly = true,
  log = console.log,
  logUpdates = true,
  pollTimeout = DEFAULT_POLL_TIMEOUT_SECONDS,
  rateLimitMax = DEFAULT_RATE_LIMIT_MAX,
  rateLimitWindowMs = DEFAULT_RATE_LIMIT_WINDOW_MS,
  registryUrl = DEFAULT_REGISTRY_URL,
  signal = undefined,
  statePath = DEFAULT_STATE_PATH,
  token,
  username = DEFAULT_BOT_USERNAME,
  answerGroupQuestions = DEFAULT_ANSWER_GROUP_QUESTIONS
} = {}) {
  if (!isLikelyTelegramBotToken(token)) {
    throw new Error("TELEGRAM_BOT_TOKEN is missing or invalid");
  }

  const normalizedUsername = normalizeBotUsername(username);
  const client = new TelegramClient({ fetchFn, token });
  const state = await readBotState(statePath);
  const normalizedAdminUserIds = normalizeIdSet(adminUserIds);
  const activeState = {
    ...state,
    allowedChatId: allowedChatId ?? state.allowedChatId ?? null,
    disabled: Boolean(disabled || state.disabled),
    rateLimit: state.rateLimit ?? {},
    offset: Number.isSafeInteger(state.offset) ? state.offset : undefined
  };

  log(
    `[nipmod-telegram-bot] @${normalizedUsername} started; groupOnly=${groupOnly}; disabled=${activeState.disabled}; chat=${
      activeState.allowedChatId ?? "waiting-for-/start"
    }; answerGroupQuestions=${answerGroupQuestions}; ai=${aiEnabled && aiApiKey ? `${aiProvider}:${aiModel}` : "off"}`
  );

  while (!signal?.aborted) {
    try {
      const updates = await client.getUpdates({
        offset: activeState.offset,
        timeout: pollTimeout
      });
      for (const update of updates) {
        activeState.offset = update.update_id + 1;
        const message = getTelegramUpdateMessage(update);
        if (!message) {
          log(`[nipmod-telegram-bot] ignored reason=no-message update=${update.update_id}`);
          continue;
        }
        if (logUpdates) {
          log(`[nipmod-telegram-bot] received ${safeTelegramMessageLogMeta(update)}`);
        }
        const messageText = getTelegramMessageText(message);
        const command = parseTelegramCommand(messageText, normalizedUsername);
        const isAdminCommand = command && ADMIN_COMMANDS.has(command.name);
        const userId = message?.from?.id === undefined ? null : String(message.from.id);
        const isAdmin = isAdminCommand
          ? await resolveTelegramAdmin({
              adminUserIds: normalizedAdminUserIds,
              chatId: message.chat.id,
              client,
              userId
            })
          : normalizedAdminUserIds.has(String(userId));

        const reply = await createTelegramBotReply(update, {
          allowedChatId: activeState.allowedChatId,
          adminUserIds: normalizedAdminUserIds,
          aiApiKey,
          aiBaseUrl,
          aiEnabled,
          aiModel,
          aiProvider,
          bindFirstGroup,
          disabled: activeState.disabled,
          fetchFn,
          groupOnly,
          isAdmin,
          answerGroupQuestions,
          now: new Date().toISOString(),
          packages: null,
          registryUrl,
          username: normalizedUsername
        });
        if (reply.statePatch?.allowedChatId) {
          activeState.allowedChatId = reply.statePatch.allowedChatId;
          activeState.allowedChatTitle = reply.statePatch.allowedChatTitle;
          activeState.boundAt = reply.statePatch.boundAt;
          log(`[nipmod-telegram-bot] bound to group ${activeState.allowedChatTitle ?? activeState.allowedChatId}`);
        }
        if (reply.adminAction === "pause") {
          activeState.disabled = true;
          activeState.disabledAt = new Date().toISOString();
          activeState.disabledBy = userId;
          log(`[nipmod-telegram-bot] paused chat=${message.chat.id} user=${userId ?? "unknown"} update=${update.update_id}`);
        }
        if (reply.adminAction === "resume") {
          activeState.disabled = false;
          activeState.resumedAt = new Date().toISOString();
          activeState.resumedBy = userId;
          log(`[nipmod-telegram-bot] resumed chat=${message.chat.id} user=${userId ?? "unknown"} update=${update.update_id}`);
        }
        if (reply.text) {
          if (!isAdminCommand && !reply.statePatch?.allowedChatId) {
            const rate = checkRateLimit(activeState, {
              max: rateLimitMax,
              now: Date.now(),
              userId,
              windowMs: rateLimitWindowMs
            });
            if (!rate.allowed) {
              await client.sendMessage(message.chat.id, "Rate limit. Try again in a minute.", {
                messageThreadId: message.message_thread_id
              });
              log(`[nipmod-telegram-bot] rate_limited chat=${message.chat.id} user=${userId ?? "unknown"} update=${update.update_id}`);
              continue;
            }
          }
          await client.sendMessage(message.chat.id, reply.text, {
            messageThreadId: message.message_thread_id
          });
          log(`[nipmod-telegram-bot] replied chat=${message.chat.id} update=${update.update_id}${reply.safetyEvent ? ` safety=${reply.safetyEvent}` : ""}${reply.adminAction ? ` admin=${reply.adminAction}` : ""}`);
        } else if (reply.ignored) {
          log(`[nipmod-telegram-bot] ignored reason=${reply.reason} chat=${message.chat.id} update=${update.update_id}`);
        }
      }
      if (updates.length > 0) {
        await writeBotState(statePath, activeState);
      }
    } catch (error) {
      log(`[nipmod-telegram-bot] ${redactSecrets(error?.message ?? error, [token, aiApiKey])}`);
      await sleep(2500);
    }
  }

  await writeBotState(statePath, activeState);
  log("[nipmod-telegram-bot] stopped");
}

function startText({ newlyBound }) {
  const prefix = newlyBound
    ? "Nipmod is bound to this group. Private chats and other groups are ignored."
    : "Nipmod is active in this group.";
  return `${prefix}\n\n/help shows commands. /links shows official links.`;
}

function helpText() {
  return [
    "Nipmod commands",
    "/search <term> finds packages",
    "/packages shows archive and count",
    "/links shows official links",
    "/install shows install",
    "/codex shows Codex setup",
    "/claude shows Claude Code setup",
    "/bankr shows Bankr links",
    "/github shows GitHub mirror",
    "/gitlawb shows source network",
    "/mcp shows agent tools",
    "/security shows safety rules",
    "/submit shows package flow",
    "/status shows live checks",
    "/botstatus shows bot control state",
    "/pause pauses replies for admins",
    "/resume resumes replies for admins"
  ].join("\n");
}

function installText() {
  return [
    "Install Nipmod",
    "curl -fsSLO https://nipmod.com/install.sh && bash install.sh",
    "nipmod setup agents",
    "",
    "Then tell the agent",
    "Read https://nipmod.com/llms.txt and use Nipmod for package search, inspection and controlled install."
  ].join("\n");
}

function codexText() {
  return [
    "Codex Setup",
    "curl -fsSLO https://nipmod.com/install.sh && bash install.sh",
    "nipmod setup codex",
    "",
    "Then tell Codex",
    "Read https://nipmod.com/llms.txt and use Nipmod before installing agent packages."
  ].join("\n");
}

function claudeText() {
  return [
    "Claude Code Setup",
    "curl -fsSLO https://nipmod.com/install.sh && bash install.sh",
    "nipmod setup claude",
    "",
    "Then tell Claude Code",
    "Read https://nipmod.com/llms.txt and use Nipmod before installing agent packages."
  ].join("\n");
}

function packagesText(packages) {
  if (!Array.isArray(packages)) {
    return [
      "Archive status",
      "The bot cannot reach the registry right now.",
      "Registry https://nipmod.com/registry/packages.json",
      "Status https://nipmod.com/status"
    ].join("\n");
  }
  return [
    `Live archive ${packages.length} verified packages`,
    FACTS.archive,
    "Packages https://nipmod.com/packages",
    "Registry https://nipmod.com/registry/packages.json",
    "",
    "Search with /search <term>"
  ].join("\n");
}

function searchText(query, packages) {
  if (!Array.isArray(packages)) {
    return [
      "Search unavailable",
      "The bot cannot reach the registry right now.",
      "Registry https://nipmod.com/registry/packages.json",
      "Status https://nipmod.com/status"
    ].join("\n");
  }
  const results = searchRegistryPackages(query, packages, 5);
  if (!String(query ?? "").trim()) {
    return "Format\n/search <term>\n\nExample\n/search gitlawb";
  }
  if (results.length === 0) {
    return `No match for "${query}".\n/packages shows the archive.\nhttps://nipmod.com/packages`;
  }
  const lines = [`Matches for "${query}"`];
  for (const pkg of results) {
    lines.push("");
    lines.push(`${pkg.name}@${pkg.version}`);
    if (pkg.description) {
      lines.push(String(pkg.description));
    }
    lines.push(`Inspect\nnipmod inspect ${pkg.canonical}@${pkg.version}`);
  }
  return lines.join("\n");
}

function submitText() {
  return [
    "Package Flow",
    "1. Put the repo on Gitlawb",
    "2. Check locally",
    "nipmod package doctor gitlawb://did:key:.../repo --json",
    "3. Build the package patch",
    "nipmod package pr gitlawb://did:key:.../repo --dir repo-pr --json",
    "4. Review locally, then publish through the owner flow",
    "",
    "Never post private keys, seed phrases or API keys in Telegram."
  ].join("\n");
}

function statusText() {
  return [
    "Live Status",
    "Status https://nipmod.com/status",
    "System readiness https://nipmod.com/compatibility/system-readiness.json",
    "Platform readiness https://nipmod.com/compatibility/platform-readiness.json",
    "Registry https://nipmod.com/registry/packages.json"
  ].join("\n");
}

function linksText() {
  return ["Official Nipmod links", ...OFFICIAL_LINKS.map(([label, url]) => `${label} ${url}`)].join("\n");
}

function xText() {
  return [
    "X",
    "https://x.com/Nipmod"
  ].join("\n");
}

function coinText() {
  return [
    "Coin",
    "Bankr coin https://bankr.bot/launches/0x5155Eaa3B5784B829DeAD78189Eb4Bf69359dbA3"
  ].join("\n");
}

function githubText() {
  return [
    "GitHub",
    FACTS.github,
    "Repo https://github.com/nipmod/nipmod"
  ].join("\n");
}

function gitlawbText() {
  return [
    "Gitlawb",
    FACTS.gitlawb,
    "Source https://gitlawb.com/node/repos/z6Mkwbud/nipmod"
  ].join("\n");
}

function bankrText() {
  return [
    "Bankr",
    FACTS.bankr,
    "Integration https://nipmod.com/bankr",
    "Skill https://nipmod.com/integrations/bankr/nipmod/SKILL.md",
    "Coin https://bankr.bot/launches/0x5155Eaa3B5784B829DeAD78189Eb4Bf69359dbA3"
  ].join("\n");
}

function mcpText() {
  return [
    "MCP",
    FACTS.mcp,
    "Docs https://nipmod.com/mcp",
    "Agent discovery https://nipmod.com/.well-known/nipmod.json",
    "Agent instructions https://nipmod.com/llms.txt"
  ].join("\n");
}

function securityText() {
  return [
    "Security",
    FACTS.safety,
    "Security policy https://github.com/nipmod/nipmod/blob/main/SECURITY.md",
    "Status https://nipmod.com/status"
  ].join("\n");
}

function botText() {
  return [
    "Bot",
    "I answer normal group questions when Telegram privacy is disabled.",
    "I know Nipmod links, install, Gitlawb, GitHub, Bankr, Codex, Claude Code, MCP, packages, registry and security.",
    "Use /links for official links."
  ].join("\n");
}

function aboutText() {
  return [
    "Nipmod",
    FACTS.archive,
    FACTS.gitlawb,
    "Start https://nipmod.com"
  ].join("\n");
}

function conciseFallbackText() {
  return [
    "I cannot answer that cleanly.",
    "/help shows commands.",
    "/links shows official links."
  ].join("\n");
}

function packageSearchScore(pkg, terms) {
  const name = String(pkg.name ?? "").toLowerCase();
  const canonical = String(pkg.canonical ?? "").toLowerCase();
  const description = String(pkg.description ?? "").toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (name === term) {
      score += 100;
    }
    if (name.includes(term)) {
      score += 50;
    }
    if (canonical.includes(term)) {
      score += 20;
    }
    if (description.includes(term)) {
      score += 10;
    }
  }
  return score;
}

function mentionsAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function isSpecificXRequest(text) {
  const normalized = normalizeTextForMatching(text);
  if (!normalized) {
    return false;
  }
  return containsSafetyTerm(normalized, X_TERMS) && !containsSafetyTerm(normalized, ["x402"]);
}

function isSpecificCoinRequest(text) {
  const normalized = normalizeTextForMatching(text);
  if (!normalized) {
    return false;
  }
  return containsSafetyTerm(normalized, ["coin", "token"]) && !containsSafetyTerm(normalized, ["bankr"]);
}

function isSpecificOfficialLinksRequest(text) {
  const normalized = normalizeTextForMatching(text);
  if (!normalized) {
    return false;
  }
  return containsSafetyTerm(normalized, LINK_TERMS) && !containsSafetyTerm(normalized, [
    ...X_TERMS,
    ...GITHUB_TERMS,
    ...GITLAWB_TERMS,
    ...BANKR_TERMS,
    ...CODEX_TERMS,
    ...CLAUDE_TERMS,
    ...MCP_TERMS
  ]);
}

function isSpecificGithubRequest(text) {
  const normalized = normalizeTextForMatching(text);
  if (!normalized) {
    return false;
  }
  return containsSafetyTerm(normalized, GITHUB_TERMS) && containsSafetyTerm(normalized, LINK_TERMS);
}

function isSpecificGitlawbRequest(text) {
  const normalized = normalizeTextForMatching(text);
  if (!normalized) {
    return false;
  }
  return containsSafetyTerm(normalized, GITLAWB_TERMS) && containsSafetyTerm(normalized, LINK_TERMS);
}

function isSpecificInstallRequest(text) {
  const normalized = normalizeTextForMatching(text);
  if (!normalized) {
    return false;
  }
  return containsSafetyTerm(normalized, INSTALL_TERMS) && !containsSafetyTerm(normalized, [
    ...CODEX_TERMS,
    ...CLAUDE_TERMS,
    ...MCP_TERMS
  ]);
}

function containsSafetyTerm(normalizedText, terms) {
  const padded = ` ${normalizeTextForMatching(normalizedText)} `;
  return terms.some((term) => {
    const normalizedTerm = normalizeTextForMatching(term);
    if (!normalizedTerm) {
      return false;
    }
    return normalizedTerm.includes(" ")
      ? padded.includes(` ${normalizedTerm} `)
      : new RegExp(`(^|\\s)${escapeRegExp(normalizedTerm)}($|\\s)`).test(padded);
  });
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseIdList(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeIdSet(values) {
  if (values instanceof Set) {
    return new Set([...values].map((value) => String(value)));
  }
  if (Array.isArray(values)) {
    return new Set(values.map((value) => String(value)).filter(Boolean));
  }
  return new Set(parseIdList(values));
}

export function matchesAny(text, terms) {
  const normalizedText = normalizeTextForMatching(text);
  if (!normalizedText) {
    return false;
  }
  const tokens = normalizedText.split(/\s+/).filter(Boolean);
  return terms.some((term) => {
    const normalizedTerm = normalizeTextForMatching(term);
    if (!normalizedTerm) {
      return false;
    }
    if (normalizedText.includes(normalizedTerm)) {
      return true;
    }
    const termTokens = normalizedTerm.split(/\s+/).filter(Boolean);
    if (termTokens.length > 1) {
      return false;
    }
    return tokens.some((token) => tokenMatches(token, normalizedTerm));
  });
}

export function normalizeTextForMatching(value) {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenMatches(token, term) {
  if (token === term) {
    return true;
  }
  if (term === "codex" && token === "code") {
    return false;
  }
  if (term.length <= 3) {
    return false;
  }
  if (term.length >= 5 && token.length >= 5 && (token.includes(term) || term.includes(token))) {
    return true;
  }
  const allowedDistance = term.length <= 5 ? 1 : term.length <= 7 ? 2 : 3;
  return levenshteinDistanceAtMost(token, term, allowedDistance) <= allowedDistance;
}

function levenshteinDistanceAtMost(left, right, maxDistance) {
  if (Math.abs(left.length - right.length) > maxDistance) {
    return maxDistance + 1;
  }
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    let rowMin = current[0];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      const value = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + cost
      );
      current[rightIndex] = value;
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > maxDistance) {
      return maxDistance + 1;
    }
    previous = current;
  }
  return previous[right.length];
}

function unquoteEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function trimTrailingSlash(value) {
  return String(value ?? "").replace(/\/+$/, "");
}

function redactSecrets(value, secrets) {
  let text = String(value);
  for (const secret of secrets.filter(Boolean)) {
    text = text.split(secret).join("[redacted-secret]");
  }
  return text;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function main() {
  if (process.argv.includes("--help")) {
    process.stdout.write(
      [
        "Usage: node tools/telegram-bot.mjs",
        "",
        "Required env:",
        "  TELEGRAM_BOT_TOKEN",
        "",
        "Optional env:",
        "  NIPMOD_TELEGRAM_BOT_USERNAME=nipmodbot",
        "  NIPMOD_TELEGRAM_ALLOWED_CHAT_ID=<group chat id>",
        "  NIPMOD_TELEGRAM_ADMIN_USER_IDS=<comma-separated-telegram-user-ids>",
        "  NIPMOD_TELEGRAM_DISABLED=0",
        "  NIPMOD_TELEGRAM_GROUP_ONLY=1",
        "  NIPMOD_TELEGRAM_BIND_FIRST_GROUP=1",
        "  NIPMOD_TELEGRAM_ANSWER_GROUP_QUESTIONS=1",
        "  NIPMOD_TELEGRAM_LOG_UPDATES=1",
        "  NIPMOD_TELEGRAM_AI_ENABLED=1",
        "  NIPMOD_TELEGRAM_AI_PROVIDER=anthropic",
        "  NIPMOD_TELEGRAM_AI_MODEL=claude-sonnet-4-5",
        "  NIPMOD_TELEGRAM_ANTHROPIC_API_KEY=<anthropic-key>"
      ].join("\n") + "\n"
    );
    return;
  }

  const env = {
    ...(await loadLocalEnv(DEFAULT_ENV_PATH)),
    ...process.env
  };
  const token = env.TELEGRAM_BOT_TOKEN || env.NIPMOD_TELEGRAM_BOT_TOKEN;
  const anthropicApiKey = env.NIPMOD_TELEGRAM_ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY || null;
  const openAiApiKey = env.NIPMOD_TELEGRAM_AI_API_KEY || env.OPENAI_API_KEY || null;
  const aiProvider = normalizeAiProvider(env.NIPMOD_TELEGRAM_AI_PROVIDER || (anthropicApiKey ? "anthropic" : "openai"));
  const aiApiKey = aiProvider === "anthropic" ? anthropicApiKey : openAiApiKey;
  await runTelegramBot({
    allowedChatId: env.NIPMOD_TELEGRAM_ALLOWED_CHAT_ID || null,
    adminUserIds: parseIdList(env.NIPMOD_TELEGRAM_ADMIN_USER_IDS),
    answerGroupQuestions: env.NIPMOD_TELEGRAM_ANSWER_GROUP_QUESTIONS !== "0",
    aiApiKey,
    aiBaseUrl: env.NIPMOD_TELEGRAM_AI_BASE_URL || (aiProvider === "anthropic" ? DEFAULT_ANTHROPIC_BASE_URL : DEFAULT_AI_BASE_URL),
    aiEnabled: env.NIPMOD_TELEGRAM_AI_ENABLED !== "0" && Boolean(aiApiKey),
    aiModel: env.NIPMOD_TELEGRAM_AI_MODEL || (aiProvider === "anthropic" ? DEFAULT_ANTHROPIC_MODEL : DEFAULT_AI_MODEL),
    aiProvider,
    bindFirstGroup: env.NIPMOD_TELEGRAM_BIND_FIRST_GROUP !== "0",
    disabled: env.NIPMOD_TELEGRAM_DISABLED === "1",
    groupOnly: env.NIPMOD_TELEGRAM_GROUP_ONLY !== "0",
    logUpdates: env.NIPMOD_TELEGRAM_LOG_UPDATES !== "0",
    registryUrl: env.NIPMOD_REGISTRY_URL || DEFAULT_REGISTRY_URL,
    statePath: env.NIPMOD_TELEGRAM_STATE_PATH || DEFAULT_STATE_PATH,
    token,
    username: env.NIPMOD_TELEGRAM_BOT_USERNAME || DEFAULT_BOT_USERNAME
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error?.message ?? error}\n`);
    process.exitCode = 1;
  });
}
