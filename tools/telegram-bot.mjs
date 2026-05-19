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

export function shouldReplyToPlainText(text, username = DEFAULT_BOT_USERNAME) {
  const normalized = String(text ?? "").trim().toLowerCase();
  const botMention = `@${normalizeBotUsername(username)}`;
  return normalized.includes(botMention) || normalized.startsWith("nipmod ");
}

export async function createTelegramBotReply(update, options = {}) {
  const message = update?.message;
  const text = message?.text;
  if (!message || !text) {
    return { ignored: true, reason: "no-text-message" };
  }

  const username = normalizeBotUsername(options.username);
  const command = parseTelegramCommand(text, username);
  const groupOnly = options.groupOnly !== false;
  const bindFirstGroup = options.bindFirstGroup !== false;
  const allowedChatId = options.allowedChatId ?? null;

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

  if (command) {
    return {
      text: await renderCommandReply(command, options)
    };
  }

  if (!shouldReplyToPlainText(text, username)) {
    return { ignored: true, reason: "plain-text-not-addressed" };
  }

  return {
    text: await renderPlainTextReply(text, options)
  };
}

export async function renderCommandReply(command, options = {}) {
  switch (command.name) {
    case "start":
      return startText({ newlyBound: false });
    case "help":
      return helpText();
    case "install":
      return installText();
    case "codex":
      return codexText();
    case "claude":
      return claudeText();
    case "packages":
      return packagesText(await getRegistryPackages(options));
    case "search":
      return searchText(command.args, await getRegistryPackages(options));
    case "submit":
      return submitText();
    case "status":
      return statusText();
    default:
      return `Unknown command: /${command.name}\n\n${helpText()}`;
  }
}

export async function renderPlainTextReply(text, options = {}) {
  const cleaned = String(text ?? "")
    .replace(new RegExp(`@${normalizeBotUsername(options.username)}`, "gi"), "")
    .trim();
  const lower = cleaned.toLowerCase();

  if (lower.includes("codex")) {
    return codexText();
  }
  if (lower.includes("claude")) {
    return claudeText();
  }
  if (lower.includes("install") || lower.includes("setup")) {
    return installText();
  }
  if (lower.includes("package") || lower.includes("archive") || lower.includes("registry")) {
    return packagesText(await getRegistryPackages(options));
  }
  return helpText();
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
      allowed_updates: ["message"],
      offset,
      timeout
    });
  }

  sendMessage(chatId, text) {
    return this.call("sendMessage", {
      chat_id: chatId,
      disable_web_page_preview: true,
      text
    });
  }
}

export async function runTelegramBot({
  allowedChatId = null,
  bindFirstGroup = true,
  fetchFn = fetch,
  groupOnly = true,
  log = console.log,
  pollTimeout = DEFAULT_POLL_TIMEOUT_SECONDS,
  registryUrl = DEFAULT_REGISTRY_URL,
  signal = undefined,
  statePath = DEFAULT_STATE_PATH,
  token,
  username = DEFAULT_BOT_USERNAME
} = {}) {
  if (!isLikelyTelegramBotToken(token)) {
    throw new Error("TELEGRAM_BOT_TOKEN is missing or invalid");
  }

  const normalizedUsername = normalizeBotUsername(username);
  const client = new TelegramClient({ fetchFn, token });
  const state = await readBotState(statePath);
  const activeState = {
    ...state,
    allowedChatId: allowedChatId ?? state.allowedChatId ?? null,
    offset: Number.isSafeInteger(state.offset) ? state.offset : undefined
  };

  log(
    `[nipmod-telegram-bot] @${normalizedUsername} started; groupOnly=${groupOnly}; chat=${
      activeState.allowedChatId ?? "waiting-for-/start"
    }`
  );

  while (!signal?.aborted) {
    try {
      const updates = await client.getUpdates({
        offset: activeState.offset,
        timeout: pollTimeout
      });
      for (const update of updates) {
        activeState.offset = update.update_id + 1;
        const reply = await createTelegramBotReply(update, {
          allowedChatId: activeState.allowedChatId,
          bindFirstGroup,
          fetchFn,
          groupOnly,
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
        if (reply.text) {
          await client.sendMessage(update.message.chat.id, reply.text);
        }
      }
      if (updates.length > 0) {
        await writeBotState(statePath, activeState);
      }
    } catch (error) {
      log(`[nipmod-telegram-bot] ${redactToken(error?.message ?? error, token)}`);
      await sleep(2500);
    }
  }

  await writeBotState(statePath, activeState);
  log("[nipmod-telegram-bot] stopped");
}

function startText({ newlyBound }) {
  const prefix = newlyBound
    ? "Nipmod Bot is now bound to this group. I will ignore private chats and other groups."
    : "Nipmod Bot is active in this group.";
  return `${prefix}\n\nUse /help, /search <term>, /install, /codex, /claude, /packages, /submit or /status.`;
}

function helpText() {
  return [
    "Nipmod Bot commands:",
    "/search <term> - find packages in the shared archive",
    "/packages - show the live archive link and package count",
    "/install - install Nipmod locally",
    "/codex - Codex setup",
    "/claude - Claude Code setup",
    "/submit - prepare a package from a Gitlawb repo",
    "/status - official links and health pages"
  ].join("\n");
}

function installText() {
  return [
    "Install Nipmod:",
    "curl -fsSLO https://nipmod.com/install.sh && bash install.sh",
    "nipmod setup agents",
    "",
    "Then tell your agent:",
    "Read https://nipmod.com/llms.txt and use Nipmod for package search, inspection and controlled install."
  ].join("\n");
}

function codexText() {
  return [
    "Codex setup:",
    "curl -fsSLO https://nipmod.com/install.sh && bash install.sh",
    "nipmod setup codex",
    "",
    "Then tell Codex:",
    "Read https://nipmod.com/llms.txt and use Nipmod before installing agent packages."
  ].join("\n");
}

function claudeText() {
  return [
    "Claude Code setup:",
    "curl -fsSLO https://nipmod.com/install.sh && bash install.sh",
    "nipmod setup claude",
    "",
    "Then tell Claude Code:",
    "Read https://nipmod.com/llms.txt and use Nipmod before installing agent packages."
  ].join("\n");
}

function packagesText(packages) {
  return [
    `Live archive: ${packages.length} verified packages`,
    "Browse: https://nipmod.com/packages",
    "Registry JSON: https://nipmod.com/registry/packages.json",
    "",
    "Use /search <term> to find one."
  ].join("\n");
}

function searchText(query, packages) {
  const results = searchRegistryPackages(query, packages, 5);
  if (!String(query ?? "").trim()) {
    return "Use: /search <term>\nExample: /search gitlawb";
  }
  if (results.length === 0) {
    return `No package found for "${query}".\nTry /packages or browse https://nipmod.com/packages`;
  }
  const lines = [`Top matches for "${query}":`];
  for (const pkg of results) {
    lines.push("");
    lines.push(`${pkg.name}@${pkg.version}`);
    if (pkg.description) {
      lines.push(String(pkg.description));
    }
    lines.push(`Inspect: nipmod inspect ${pkg.canonical}@${pkg.version}`);
  }
  return lines.join("\n");
}

function submitText() {
  return [
    "To prepare a Nipmod package:",
    "1. Put the repo on Gitlawb.",
    "2. Run: nipmod package doctor gitlawb://did:key:.../repo --json",
    "3. Run: nipmod package pr gitlawb://did:key:.../repo --dir repo-pr --json",
    "4. Review locally, then publish through the owner flow.",
    "",
    "Never paste private keys, seed phrases or API keys into Telegram."
  ].join("\n");
}

function statusText() {
  return [
    "Official Nipmod links:",
    "Website: https://nipmod.com",
    "GitHub: https://github.com/nipmod/nipmod",
    "Gitlawb: https://gitlawb.com/node/repos/z6Mkwbud/nipmod",
    "Telegram: https://t.me/+05Kux7Iyah9jZjAy",
    "Status: https://nipmod.com/status",
    "System readiness: https://nipmod.com/compatibility/system-readiness.json"
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

function unquoteEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function redactToken(value, token) {
  return String(value).split(token).join("[redacted-token]");
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
        "  NIPMOD_TELEGRAM_GROUP_ONLY=1",
        "  NIPMOD_TELEGRAM_BIND_FIRST_GROUP=1"
      ].join("\n") + "\n"
    );
    return;
  }

  const env = {
    ...(await loadLocalEnv(DEFAULT_ENV_PATH)),
    ...process.env
  };
  const token = env.TELEGRAM_BOT_TOKEN || env.NIPMOD_TELEGRAM_BOT_TOKEN;
  await runTelegramBot({
    allowedChatId: env.NIPMOD_TELEGRAM_ALLOWED_CHAT_ID || null,
    bindFirstGroup: env.NIPMOD_TELEGRAM_BIND_FIRST_GROUP !== "0",
    groupOnly: env.NIPMOD_TELEGRAM_GROUP_ONLY !== "0",
    registryUrl: env.NIPMOD_REGISTRY_URL || DEFAULT_REGISTRY_URL,
    statePath: env.NIPMOD_TELEGRAM_STATE_PATH || DEFAULT_STATE_PATH,
    token,
    username: env.NIPMOD_TELEGRAM_BOT_USERNAME || DEFAULT_BOT_USERNAME
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error?.message ?? error}\n`);
    process.exitCode = 1;
  });
}
