#!/usr/bin/env node
import { spawn } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const args = new Set(process.argv.slice(2));
const includeLive = args.has("--live");
const includeHostSmoke = args.has("--host-smoke");
const includeBankrAgentSmoke = args.has("--bankr-agent-smoke") || process.env.NIPMOD_INCLUDE_BANKR_AGENT_SMOKE === "1";
const nodeBinPath = process.execPath;
const cliPath = join(root, "nipmod", "dist", "cli.js");
const bankrAgentSmokePath = join(root, "tools", "bankr-agent-smoke.mjs");
const expectedTools = [
  "nipmod.search",
  "nipmod.view",
  "nipmod.inspect",
  "nipmod.install_plan",
  "nipmod.install",
  "nipmod.update_plan",
  "nipmod.demo",
  "nipmod.publish_plan",
  "nipmod.claim_verify",
  "nipmod.claim_index",
  "nipmod.verify",
  "nipmod.audit",
  "nipmod.sbom",
  "nipmod.explain"
];
const proofPackage = "pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0";

const checks = [];

await checkStaticConfigs();
await checkMcpStdio();

if (includeLive) {
  await checkSourceMirrors();
  await checkLiveEndpoints();
  await checkBankrProofPath();
  if (includeBankrAgentSmoke) {
    await checkBankrAgentSmoke();
  }
}

if (includeHostSmoke) {
  await checkCodex();
  await checkClaudeCode();
  await checkOpenCode();
}

const summary = {
  fail: checks.filter((check) => check.status === "fail").length,
  pass: checks.filter((check) => check.status === "pass").length,
  skip: checks.filter((check) => check.status === "skip").length,
  total: checks.length
};

const result = {
  checkedAt: new Date().toISOString(),
  checks,
  flags: {
    bankrAgentSmoke: includeBankrAgentSmoke,
    hostSmoke: includeHostSmoke,
    live: includeLive
  },
  ok: summary.fail === 0,
  summary,
  type: "dev.nipmod.platform-readiness-check.v1"
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.ok) {
  process.exitCode = 1;
}

async function checkStaticConfigs() {
  const claude = JSON.parse(await readFile(join(root, ".mcp.json"), "utf8"));
  assertDeepEqual("claude_project_mcp_config", claude, {
    mcpServers: {
      nipmod: {
        args: ["mcp", "serve"],
        command: "nipmod",
        env: {},
        type: "stdio"
      }
    }
  });

  const opencode = JSON.parse(await readFile(join(root, "opencode.json"), "utf8"));
  assertDeepEqual("opencode_project_mcp_config", opencode, {
    $schema: "https://opencode.ai/config.json",
    mcp: {
      nipmod: {
        command: ["nipmod", "mcp", "serve"],
        enabled: true,
        type: "local"
      }
    }
  });

  const receipt = JSON.parse(await readFile(join(root, "site", "public", "compatibility", "platform-readiness.json"), "utf8"));
  pass("platform_readiness_receipt", {
    platforms: receipt.platforms.map((platform) => platform.id),
    type: receipt.type
  });
}

async function checkMcpStdio() {
  await chmod(cliPath, 0o755).catch(() => {});
  const input = [
    {
      id: 1,
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        capabilities: {},
        clientInfo: { name: "platform-readiness", version: "1.0.0" },
        protocolVersion: "2025-11-25"
      }
    },
    { id: 2, jsonrpc: "2.0", method: "tools/list" }
  ]
    .map((message) => JSON.stringify(message))
    .join("\n");

  const output = await run(nodeBinPath, [cliPath, "mcp", "serve"], { input: `${input}\n` });
  const responses = output.stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const tools = responses.at(-1)?.result?.tools?.map((tool) => tool.name) ?? [];
  assertDeepEqual("mcp_tool_list", tools, expectedTools);
}

async function checkSourceMirrors() {
  const head = (await run("git", ["rev-parse", "HEAD"], { cwd: root })).stdout.trim();
  const gitEnv = { ...process.env, PATH: `/Users/hazar/.local/bin:${process.env.PATH ?? ""}` };
  const github = (await run("git", ["ls-remote", "origin", "refs/heads/main"], { cwd: root, env: gitEnv })).stdout.trim();
  const gitlawb = (await run("git", ["ls-remote", "gitlawb", "refs/heads/main"], { cwd: root, env: gitEnv })).stdout.trim();

  assertText("github_main_matches_head", github, head);
  assertText("gitlawb_main_matches_head", gitlawb, head);
}

async function checkLiveEndpoints() {
  const endpoints = [
    ["setup_page", "https://nipmod.com/setup", ["Connect your agent", "nipmod setup codex"]],
    ["llms_entrypoint", "https://nipmod.com/llms.txt", ["Connect Codex:", "nipmod setup claude", "nipmod setup opencode"]],
    ["demo_page", "https://nipmod.com/demo", ["Search, inspect, plan, receipt.", ".nipmod/receipts"]],
    ["status_page", "https://nipmod.com/status", ["Public proof dashboard", "System readiness"]],
    ["platform_page", "https://nipmod.com/platforms", ["Connection matrix", "Under review", "Candidate"]],
    [
      "discovery_manifest",
      "https://nipmod.com/.well-known/nipmod.json",
      ["https://nipmod.com/setup", "setupCodexMcp", "platformReadiness", "platformConnections"]
    ],
    [
      "platform_connections_live",
      "https://nipmod.com/compatibility/platform-connections.json",
      ["dev.nipmod.platform-connections.v1", "claude-code", "aeon"]
    ],
    [
      "bankr_skill",
      "https://nipmod.com/integrations/bankr/nipmod/SKILL.md",
      ["name: nipmod", "Use Nipmod when a Bankr agent needs package workflows"]
    ],
    [
      "bankr_agent_proof",
      "https://nipmod.com/integrations/bankr/bankr.agent-proof.json",
      ["dev.nipmod.bankr.agent-proof.v1", "plan-install"]
    ],
    [
      "platform_readiness_live",
      "https://nipmod.com/compatibility/platform-readiness.json",
      ["dev.nipmod.platform-readiness.v1", "claude-code", "opencode", "aeon"]
    ]
  ];

  for (const [name, url, expected] of endpoints) {
    const response = await fetch(url);
    if (!response.ok) {
      fail(name, `HTTP ${response.status} for ${url}`);
      continue;
    }
    const text = await response.text();
    for (const needle of expected) {
      assertText(name, text, needle);
    }
  }
}

async function checkBankrProofPath() {
  await assertCommandContains("bankr_search_package", [cliPath, "search", "gitlawb-repo-reader", "--online", "--json"], [
    "gitlawb-repo-reader",
    "verified/100"
  ]);
  await assertCommandContains("bankr_inspect_package", [cliPath, "inspect", proofPackage, "--json"], [
    "readyToInstall",
    "verified/100"
  ]);
  await assertCommandContains("bankr_install_plan", [cliPath, "install", "--plan", proofPackage, "--json"], [
    "install plan ready",
    "packageCount"
  ]);

}

async function checkBankrAgentSmoke() {
  try {
    const output = await run(nodeBinPath, [bankrAgentSmokePath], { timeoutMs: 140_000 });
    const payload = JSON.parse(output.stdout);
    if (payload.status === "skip") {
      skip("bankr_agent_api_smoke", payload.reason);
      return;
    }
    if (payload.ok) {
      pass("bankr_agent_api_smoke", {
        jobId: payload.jobId,
        threadId: payload.threadId
      });
      return;
    }
    fail("bankr_agent_api_smoke", payload);
  } catch (error) {
    fail("bankr_agent_api_smoke", String(error));
  }
}

async function checkCodex() {
  const codex = await findCodex();
  if (!codex) {
    skip("codex_cli_available", "codex not found");
    return;
  }

  const tempHome = await mkdtemp(join(tmpdir(), "nipmod-codex-home-"));
  const tempBin = await createTempNipmodBin();
  try {
    const env = { ...process.env, HOME: tempHome, PATH: `${tempBin}:${process.env.PATH ?? ""}` };
    await run(nodeBinPath, [cliPath, "setup", "codex", "--codex-bin", codex], { env });
    const get = await run(codex, ["mcp", "get", "nipmod"], { env });
    assertText("codex_mcp_get", stripAnsi(get.stdout), "args: mcp serve");
  } finally {
    await rm(tempHome, { recursive: true, force: true });
    await rm(tempBin, { recursive: true, force: true });
  }
}

async function checkClaudeCode() {
  const tempHome = await mkdtemp(join(tmpdir(), "nipmod-claude-home-"));
  const tempBin = await createTempNipmodBin();
  try {
    const env = {
      ...process.env,
      HOME: tempHome,
      PATH: `${tempBin}:${process.env.PATH ?? ""}`
    };
    const list = await run("pnpm", ["dlx", "@anthropic-ai/claude-code@2.1.144", "mcp", "list"], {
      cwd: root,
      env,
      timeoutMs: 60_000
    });
    assertText("claude_code_mcp_connected", stripAnsi(list.stdout), "nipmod: nipmod mcp serve -");
    assertText("claude_code_mcp_connected", stripAnsi(list.stdout), "Connected");
  } finally {
    await rm(tempHome, { recursive: true, force: true });
    await rm(tempBin, { recursive: true, force: true });
  }
}

async function checkOpenCode() {
  const tempHome = await mkdtemp(join(tmpdir(), "nipmod-opencode-home-"));
  const tempProject = await mkdtemp(join(tmpdir(), "nipmod-opencode-project-"));
  const tempBin = await createTempNipmodBin();
  try {
    await writeFile(join(tempProject, "opencode.json"), await readFile(join(root, "opencode.json"), "utf8"));
    const env = {
      ...process.env,
      HOME: tempHome,
      PATH: `${tempBin}:${process.env.PATH ?? ""}`
    };
    const list = await run("pnpm", ["dlx", "opencode-ai@1.15.5", "mcp", "list"], {
      cwd: tempProject,
      env,
      timeoutMs: 60_000
    });
    assertText("opencode_mcp_connected", stripAnsi(list.stdout), "nipmod");
    assertText("opencode_mcp_connected", stripAnsi(list.stdout), "connected");
  } finally {
    await rm(tempHome, { recursive: true, force: true });
    await rm(tempProject, { recursive: true, force: true });
    await rm(tempBin, { recursive: true, force: true });
  }
}

async function assertCommandContains(name, commandAndArgs, expected) {
  const [command, ...commandArgs] = commandAndArgs;
  const output = await run(nodeBinPath, command === cliPath ? [cliPath, ...commandArgs] : commandAndArgs);
  const text = `${output.stdout}\n${output.stderr}`;
  for (const needle of expected) {
    assertText(name, text, needle);
  }
}

async function createTempNipmodBin() {
  await chmod(cliPath, 0o755).catch(() => {});
  const tempBin = await mkdtemp(join(tmpdir(), "nipmod-platform-bin-"));
  await symlink(cliPath, join(tempBin, "nipmod"));
  return tempBin;
}

async function findCodex() {
  const candidates = [
    process.env.NIPMOD_CODEX_BIN,
    "/Applications/Codex.app/Contents/Resources/codex",
    "codex"
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await run(candidate, ["--version"], { timeoutMs: 10_000 });
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

function assertDeepEqual(name, actual, expected) {
  if (stableJson(actual) !== stableJson(expected)) {
    fail(name, { actual, expected });
    return;
  }
  pass(name);
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function assertText(name, haystack, needle) {
  if (!haystack.includes(needle)) {
    fail(name, `missing ${needle}`);
    return;
  }
  pass(name);
}

function pass(name, data = undefined) {
  checks.push({ data, name, status: "pass" });
}

function skip(name, data) {
  checks.push({ data, name, status: "skip" });
}

function fail(name, data) {
  checks.push({ data, name, status: "fail" });
}

function run(command, commandArgs, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: options.cwd ?? root,
      env: options.env ?? process.env,
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${basename(command)} timed out`));
    }, options.timeoutMs ?? 30_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolvePromise({ stderr, stdout });
        return;
      }
      reject(new Error(`${command} ${commandArgs.join(" ")} exited ${code}\n${stdout}\n${stderr}`));
    });
    if (options.input) {
      child.stdin.end(options.input);
    } else {
      child.stdin.end();
    }
  });
}

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}
