#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED_ARCHIVE_ENV = ["NIPMOD_ARCHIVE_SUPABASE_URL", "NIPMOD_ARCHIVE_WRITE_TOKEN"];
const ARCHIVE_KEY_ENV = ["NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY", "NIPMOD_ARCHIVE_SUPABASE_PUBLISHABLE_KEY"];
const VERCEL_ARCHIVE_ENV = [...REQUIRED_ARCHIVE_ENV, ...ARCHIVE_KEY_ENV];
const DEFAULT_BASE_URL = "https://nipmod.com";

async function main() {
  const command = process.argv[2] ?? "help";
  const args = process.argv.slice(3);

  switch (command) {
    case "env-template":
      printEnvTemplate();
      return;
    case "generate-token":
      console.log(randomBytes(32).toString("base64url"));
      return;
    case "verify-secrets":
      await verifySecrets(readOptions(args));
      return;
    case "vercel-env-status":
      await vercelEnvStatus(readOptions(args));
      return;
    case "vercel-apply":
      await vercelApply(readOptions(args));
      return;
    case "live-smoke":
      await liveSmoke(readOptions(args));
      return;
    case "help":
    default:
      printHelp();
  }
}

function printHelp() {
  console.log(`Nipmod package intelligence ops

Commands:
  env-template                         Print the local secret file template.
  generate-token                       Generate a strong archive write token.
  verify-secrets --env-file <path>      Validate Supabase REST access and table exposure.
  vercel-env-status                    Check required Vercel Production env names.
  vercel-apply --env-file <path>        Add required envs to Vercel Production.
  live-smoke [--base-url <url>]         Verify live archive status, prepare, search and dry-run confirm.

Recommended order:
  node --experimental-strip-types tools/package-intelligence-ops.ts env-template > /tmp/nipmod-archive.env
  node --experimental-strip-types tools/package-intelligence-ops.ts generate-token
  Apply supabase/migrations/20260522073000_package_intelligence_archive.sql
  Run select nipmod_private.set_archive_write_token('<generated-token>', 'production') in Supabase SQL editor
  node --experimental-strip-types tools/package-intelligence-ops.ts verify-secrets --env-file /tmp/nipmod-archive.env
  node --experimental-strip-types tools/package-intelligence-ops.ts vercel-apply --env-file /tmp/nipmod-archive.env --replace
  vercel --prod --yes
  node --experimental-strip-types tools/package-intelligence-ops.ts live-smoke

Secrets stay out of git. Do not paste service role keys into public chat.`);
}

function printEnvTemplate() {
  console.log(`# Local only. Do not commit.
NIPMOD_ARCHIVE_SUPABASE_URL=https://<project-ref>.supabase.co
NIPMOD_ARCHIVE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
# Optional service-role fallback:
# NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
NIPMOD_ARCHIVE_WRITE_TOKEN=<run: node --experimental-strip-types tools/package-intelligence-ops.ts generate-token>
`);
}

async function verifySecrets(options) {
  const env = await readEnvFile(requiredOption(options, "env-file"));
  assertRequiredEnv(env);
  const status = await verifySupabaseTable(env);
  printJson({
    ok: true,
    store: status,
    type: "dev.nipmod.package-intelligence-ops.verify-secrets.v1"
  });
}

async function vercelEnvStatus(options) {
  const environment = options.env ?? "production";
  const cwd = resolve(ROOT, options.cwd ?? "site");
  const output = await run("vercel", ["env", "ls", environment], { cwd, allowFailure: true });
  const present = VERCEL_ARCHIVE_ENV.filter((key) => output.stdout.includes(key));
  const missing = REQUIRED_ARCHIVE_ENV.filter((key) => !present.includes(key));
  if (!ARCHIVE_KEY_ENV.some((key) => present.includes(key))) {
    missing.push(ARCHIVE_KEY_ENV.join(" or "));
  }
  printJson({
    environment,
    missing,
    ok: missing.length === 0,
    present,
    type: "dev.nipmod.package-intelligence-ops.vercel-env-status.v1"
  });
}

async function vercelApply(options) {
  const envFile = requiredOption(options, "env-file");
  const environment = options.env ?? "production";
  const cwd = resolve(ROOT, options.cwd ?? "site");
  const replace = options.replace === true;
  const env = await readEnvFile(envFile);
  assertRequiredEnv(env);

  const applied = [];
  const keysToApply = [...REQUIRED_ARCHIVE_ENV, ARCHIVE_KEY_ENV.find((key) => env[key])].filter(Boolean);
  for (const key of keysToApply) {
    if (replace) {
      await run("vercel", ["env", "rm", key, environment, "--yes"], { allowFailure: true, cwd });
    }
    await run("vercel", ["env", "add", key, environment, "--sensitive"], {
      cwd,
      input: `${env[key]}\n`
    });
    applied.push(key);
  }

  printJson({
    applied,
    environment,
    ok: true,
    type: "dev.nipmod.package-intelligence-ops.vercel-apply.v1"
  });
}

async function liveSmoke(options) {
  const baseUrl = (options["base-url"] ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const status = await fetchJson(`${baseUrl}/api/archive/status`);
  assertEqual(status.type, "dev.nipmod.archive-status.v1", "archive status type mismatch");

  const prepare = await fetchJson(`${baseUrl}/api/archive/prepare?source=npm&name=node-telegram-bot-api`);
  assertEqual(prepare.type, "dev.nipmod.archive-prepare.v1", "archive prepare type mismatch");
  assertEqual(prepare.validation?.ok, true, "archive prepare validation failed");

  const search = await fetchJson(`${baseUrl}/api/archive/search?q=telegram`);
  assertEqual(search.type, "dev.nipmod.package-intelligence-search.v1", "archive search type mismatch");
  if (!Array.isArray(search.records)) {
    throw new Error("archive search records are not an array");
  }

  const confirm = await fetchJson(`${baseUrl}/api/archive/confirm`, {
    body: JSON.stringify({
      actor: "package-intelligence-ops",
      dryRun: true,
      name: "node-telegram-bot-api",
      source: "npm"
    }),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
  assertEqual(confirm.type, "dev.nipmod.archive-confirm.v1", "archive confirm type mismatch");
  assertEqual(confirm.dryRun, true, "archive confirm dry run mismatch");
  assertEqual(confirm.validation?.ok, true, "archive confirm validation failed");

  printJson({
    baseUrl,
    mode: status.mode,
    ok: true,
    persistedRecords: search.total,
    storeConfigured: status.configured,
    type: "dev.nipmod.package-intelligence-ops.live-smoke.v1"
  });
}

async function verifySupabaseTable(env) {
  const url = `${env.NIPMOD_ARCHIVE_SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/package_intelligence_records?select=id&limit=1`;
  const response = await fetch(url, {
    headers: {
      apikey: archiveKey(env),
      authorization: `Bearer ${archiveKey(env)}`,
      "x-nipmod-archive-token": env.NIPMOD_ARCHIVE_WRITE_TOKEN
    }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Supabase archive table check failed with ${response.status}. Apply supabase/migrations/20260522073000_package_intelligence_archive.sql and ensure the table is exposed to the Data API. ${body.slice(0, 300)}`
    );
  }
  const rows = await response.json();
  if (!Array.isArray(rows)) {
    throw new Error("Supabase archive table did not return an array");
  }
  return {
    configured: true,
    driver: "supabase-rest",
    table: "public.package_intelligence_records"
  };
}

async function readEnvFile(path) {
  const text = await readFile(resolve(path), "utf8");
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (!match) {
      throw new Error(`invalid env line: ${rawLine}`);
    }
    env[match[1]] = stripQuotes(match[2].trim());
  }
  return env;
}

function assertRequiredEnv(env) {
  const missing = REQUIRED_ARCHIVE_ENV.filter((key) => !env[key]);
  if (!ARCHIVE_KEY_ENV.some((key) => env[key])) {
    missing.push(ARCHIVE_KEY_ENV.join(" or "));
  }
  if (missing.length > 0) {
    throw new Error(`missing required env: ${missing.join(", ")}`);
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(env.NIPMOD_ARCHIVE_SUPABASE_URL)) {
    throw new Error("NIPMOD_ARCHIVE_SUPABASE_URL must look like https://<project-ref>.supabase.co");
  }
  if (env.NIPMOD_ARCHIVE_WRITE_TOKEN.length < 32) {
    throw new Error("NIPMOD_ARCHIVE_WRITE_TOKEN must be at least 32 characters");
  }
}

function archiveKey(env) {
  return env.NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY ?? env.NIPMOD_ARCHIVE_SUPABASE_PUBLISHABLE_KEY;
}

function readOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
    } else {
      options[key] = next;
      index += 1;
    }
  }
  return options;
}

function requiredOption(options, key) {
  const value = options[key];
  if (!value || value === true) {
    throw new Error(`--${key} is required`);
  }
  return value;
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

function run(command, args, { allowFailure = false, cwd = ROOT, input } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 || allowFailure) {
        resolvePromise({ code, stderr, stdout });
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed with ${code}: ${stderr || stdout}`));
      }
    });
    if (input) {
      child.stdin.end(input);
    } else {
      child.stdin.end();
    }
  });
}

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
