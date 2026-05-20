#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const args = new Set(process.argv.slice(2));
const includeLive = args.has("--live");
const includeParallel = args.has("--parallel");
const cliPath = join(root, "nipmod", "dist", "cli.js");
const nodeBin = process.execPath;
const registryPath = join(root, "site", "public", "registry", "packages.json");
const localRegistryUrl = pathToFileURL(registryPath).href;
const manifestPath = join(root, "site", "public", ".well-known", "nipmod.json");
const llmsPath = join(root, "site", "public", "llms.txt");
const quorumPolicyPath = join(root, "site", "public", "quorum", "policy.json");
const quorumReceiptsPath = join(root, "site", "public", "quorum", "receipts.json");
const quorumSignersPath = join(root, "site", "public", "quorum", "signers.json");
const receiptPath = join(root, "site", "public", "compatibility", "system-readiness.json");
const encodedProofPackage = "cGtnOmRpZDprZXk6ejZNa3FEQWtLTnRXSDY5WllvRml0RXJrMUNDS29mRlA1QWFGalZYeTViVlE0ZmJEL2dpdGxhd2ItcmVwby1yZWFkZXI";
const proofPackage = "pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0";
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
const expectedRemoteMcpTools = [
  "nipmod.search",
  "nipmod.view",
  "nipmod.inspect",
  "nipmod.install_plan",
  "nipmod.demo"
];
const expectedCommands = [
  "init",
  "pack",
  "package",
  "claim",
  "publish",
  "dist-tag",
  "deprecate",
  "yank",
  "manifest",
  "verify",
  "install",
  "add",
  "ls",
  "uninstall",
  "outdated",
  "update",
  "explain",
  "sbom",
  "doctor",
  "audit",
  "ci",
  "inspect",
  "search",
  "view",
  "policy",
  "mcp",
  "version",
  "setup",
  "setup-cloudflare"
];

const checks = [];
const state = {};

await checkStaticSystemReceipt();
await checkArchiveInvariants();
await checkDiscoveryBinding();
await checkCliSurface();
await checkMcpSurface();
await checkWriteBoundaries();

if (includeLive) {
  await checkLiveSystemEndpoints();
  await checkRemoteMcpSurface();
  await checkSourceSync();
}

if (includeParallel) {
  await checkParallelArchiveAccess();
}

const summary = {
  fail: checks.filter((check) => check.status === "fail").length,
  pass: checks.filter((check) => check.status === "pass").length,
  total: checks.length
};
const result = {
  checkedAt: new Date().toISOString(),
  checks,
  flags: {
    live: includeLive,
    parallel: includeParallel
  },
  ok: summary.fail === 0,
  summary,
  type: "dev.nipmod.system-readiness-check.v1"
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.ok) {
  process.exitCode = 1;
}

async function checkStaticSystemReceipt() {
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  state.receipt = receipt;
  assertEqual("system_receipt_type", receipt.type, "dev.nipmod.system-readiness.v1");
  assertEqual("system_receipt_package_count", receipt.sharedArchive.packageCount, 28);
  assertDeepEqual("system_receipt_mcp_tools", receipt.mcpTools, expectedTools);
  assertDeepEqual("system_receipt_remote_mcp_tools", receipt.remoteMcpTools, expectedRemoteMcpTools);
  assertDeepEqual("system_receipt_cli_commands", receipt.cliCommands, expectedCommands);
  assertText("system_receipt_scope", receipt.meaning, "one shared verified archive");
  assertText("system_receipt_remote_mcp", receipt.meaning, "hosted read-only MCP access");
  assertText("system_receipt_quorum", receipt.meaning, "quorum approved package digests");
  assertText("system_receipt_install_receipts", receipt.meaning, "install receipts");
  assertText("system_receipt_boundaries", JSON.stringify(receipt.notClaimed), "Nipmod owns or controls Gitlawb repos");
}

async function checkArchiveInvariants() {
  const registry = JSON.parse(await readFile(registryPath, "utf8"));
  state.registry = registry;
  assertEqual("archive_package_count", registry.packages.length, state.receipt.sharedArchive.packageCount);
  assertEqual("archive_source", registry.source, state.receipt.sharedArchive.source);
  assertEqual("archive_quorum_policy", registry.quorumPolicy?.id, "nipmod-quorum-release-v1");

  const keys = new Set();
  for (const pkg of registry.packages) {
    const key = `${pkg.canonical}@${pkg.version}`;
    if (keys.has(key)) {
      fail("archive_unique_package_keys", `duplicate ${key}`);
    }
    keys.add(key);
    assertEqual(`archive_trust_${pkg.name}`, `${pkg.trust?.level}/${pkg.trust?.score}`, "verified/100");
    assertEqual(`archive_digest_${pkg.name}`, pkg.digest, pkg.artifactSha256);
    assertEqual(`archive_quorum_${pkg.name}`, pkg.quorum?.status, "passed");
    assertEqual(`archive_quorum_threshold_${pkg.name}`, pkg.quorum?.threshold, 2);
    assertText(`archive_quorum_roles_${pkg.name}`, JSON.stringify(pkg.quorum?.approvedRoles ?? []), "release");
    assertText(`archive_quorum_roles_security_${pkg.name}`, JSON.stringify(pkg.quorum?.approvedRoles ?? []), "security");
    assertText(`archive_source_repo_${pkg.name}`, pkg.sourceRepo, "https://node.nipmod.com/");
    assertText(`archive_proof_subject_${pkg.name}`, pkg.proof.subject, key);
  }
  pass("archive_unique_package_keys", { packages: keys.size });

  const quorumPolicy = JSON.parse(await readFile(quorumPolicyPath, "utf8"));
  const quorumSigners = JSON.parse(await readFile(quorumSignersPath, "utf8"));
  const quorumReceipts = JSON.parse(await readFile(quorumReceiptsPath, "utf8"));
  assertEqual("quorum_policy_type", quorumPolicy.type, "dev.nipmod.quorum-policy.v1");
  assertEqual("quorum_signers_type", quorumSigners.type, "dev.nipmod.quorum-signers.v1");
  assertEqual("quorum_receipts_type", quorumReceipts.type, "dev.nipmod.quorum-receipts.v1");
  assertEqual("quorum_receipt_count", quorumReceipts.receipts.length, registry.packages.length);

  const publicRegistryHash = await sha256(registryPath);
  const appRegistryHash = await sha256(join(root, "site", "app", "registry-data.json"));
  assertEqual("archive_app_public_registry_sync", appRegistryHash, publicRegistryHash);

  const packageDoc = JSON.parse(await readFile(join(root, "site", "public", "registry", "packages", `${encodedProofPackage}.json`), "utf8"));
  const versionDoc = JSON.parse(
    await readFile(join(root, "site", "public", "registry", "packages", encodedProofPackage, "0.1.0.json"), "utf8")
  );
  const dependencies = JSON.parse(
    await readFile(join(root, "site", "public", "registry", "packages", encodedProofPackage, "dependencies.json"), "utf8")
  );
  const provenance = JSON.parse(
    await readFile(join(root, "site", "public", "registry", "packages", encodedProofPackage, "provenance.json"), "utf8")
  );
  assertEqual("archive_package_doc_canonical", packageDoc.canonical, proofPackage.replace("@0.1.0", ""));
  assertEqual("archive_version_doc_digest", versionDoc.digest, state.receipt.proofPackage.digest);
  assertEqual("archive_version_doc_quorum", versionDoc.quorum.status, "passed");
  assertEqual("archive_dependencies_package", dependencies.canonical, proofPackage.replace("@0.1.0", ""));
  assertEqual("archive_provenance_package", provenance.canonical, proofPackage.replace("@0.1.0", ""));
  assertEqual("archive_provenance_quorum", provenance.quorum.status, "passed");
}

async function checkDiscoveryBinding() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const llms = await readFile(llmsPath, "utf8");
  state.manifest = manifest;
  assertEqual("discovery_registry_url", manifest.registry.url, state.receipt.sharedArchive.registry);
  assertEqual("discovery_system_readiness", manifest.review.systemReadiness, state.receipt.entrypoints.systemReadiness);
  assertEqual("discovery_platform_readiness", manifest.review.platformReadiness, state.receipt.entrypoints.platformReadiness);
  assertEqual("discovery_quorum_policy", manifest.quorum.policy, "https://nipmod.com/quorum/policy.json");
  assertEqual("discovery_quorum_receipts", manifest.quorum.receipts, "https://nipmod.com/quorum/receipts.json");
  assertEqual("discovery_quorum_signers", manifest.quorum.signers, "https://nipmod.com/quorum/signers.json");
  assertEqual("discovery_agent_prompts", manifest.agent.prompts, state.receipt.entrypoints.agentPrompts);
  assertEqual("discovery_remote_mcp", manifest.mcp.remoteEndpoint, state.receipt.entrypoints.remoteMcp);
  assertDeepEqual("discovery_remote_mcp_tools", manifest.mcp.remoteTools, expectedRemoteMcpTools);
  assertEqual("discovery_setup_codex", manifest.agent.commands.setupCodexMcp, "nipmod setup codex");
  assertEqual("discovery_setup_claude", manifest.agent.commands.setupClaudeMcp, "nipmod setup claude");
  assertEqual("discovery_setup_cursor", manifest.agent.commands.setupCursorMcp, "nipmod setup cursor");
  assertText("discovery_setup_cursor_oneclick", manifest.agent.commands.setupCursorOneClick, "cursor://anysphere.cursor-deeplink/mcp/install");
  assertEqual("discovery_setup_hermes", manifest.agent.commands.setupHermesMcp, "nipmod setup hermes");
  assertEqual("discovery_setup_hermes_bundle", manifest.agent.commands.setupHermesBundle, "/nipmod");
  assertText("llms_system_readiness", llms, state.receipt.entrypoints.systemReadiness);
  assertText("llms_quorum_receipts", llms, "https://nipmod.com/quorum/receipts.json");
  assertText("llms_shared_archive", llms, state.receipt.sharedArchive.registry);
  assertText("llms_remote_mcp", llms, state.receipt.entrypoints.remoteMcp);
  assertText("llms_setup_agents", llms, "nipmod setup agents");
  assertText("llms_setup_hermes_bundle", llms, "/nipmod");
}

async function checkCliSurface() {
  const help = await run(nodeBin, [cliPath, "help"]);
  for (const command of expectedCommands) {
    assertText(`cli_command_${command}`, help.stdout, command);
  }

  const search = await run(nodeBin, [cliPath, "search", "gitlawb-repo-reader", "--registry", localRegistryUrl, "--json"]);
  assertText("cli_search_archive", search.stdout, "gitlawb-repo-reader");
  assertText("cli_search_trust", search.stdout, "verified/100");

  const inspect = await run(nodeBin, [cliPath, "inspect", proofPackage, "--registry", localRegistryUrl, "--allow-custom-roots", "--json"]);
  assertText("cli_inspect_verified", inspect.stdout, "readyToInstall");
  assertText("cli_inspect_digest", inspect.stdout, state.receipt.proofPackage.digest);
  assertText("cli_inspect_quorum", inspect.stdout, "quorum");

  const planOutput = await run(nodeBin, [
    cliPath,
    "install",
    "--plan",
    proofPackage,
    "--registry",
    localRegistryUrl,
    "--allow-custom-roots",
    "--json"
  ]);
  const plan = JSON.parse(planOutput.stdout);
  assertEqual("cli_install_plan_ok", plan.ok, true);
  assertText("cli_install_plan", plan.data.message, "install plan ready");
  assertEqual("cli_install_plan_action", plan.data.plan.action, "install");
  assertEqual("cli_install_plan_package", plan.data.plan.package.canonical, proofPackage.replace("@0.1.0", ""));

  const setupDir = await mkdtemp(join(tmpdir(), "nipmod-system-setup-"));
  try {
    const setup = JSON.parse((await run(nodeBin, [cliPath, "setup", "agents", "--dir", setupDir, "--dry-run", "--json"])).stdout);
    assertEqual("cli_setup_agents_ok", setup.ok, true);
    assertText("cli_setup_agents_prompt", setup.data.prompt, "Use Nipmod before installing agent packages");
  } finally {
    await rm(setupDir, { recursive: true, force: true });
  }
}

async function checkMcpSurface() {
  const tools = await mcpRequest([
    {
      id: 1,
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        capabilities: {},
        clientInfo: { name: "system-readiness", version: "1.0.0" },
        protocolVersion: "2025-11-25"
      }
    },
    { id: 2, jsonrpc: "2.0", method: "tools/list" }
  ]);
  assertDeepEqual(
    "mcp_tools",
    tools.at(-1).result.tools.map((tool) => tool.name),
    expectedTools
  );
  const annotations = Object.fromEntries(tools.at(-1).result.tools.map((tool) => [tool.name, tool.annotations.readOnlyHint]));
  assertEqual("mcp_install_controlled_write", annotations["nipmod.install"], false);
  assertEqual("mcp_install_plan_read_only", annotations["nipmod.install_plan"], true);

  const calls = await mcpRequest([
    {
      id: 3,
      jsonrpc: "2.0",
      method: "tools/call",
      params: { arguments: { query: "gitlawb-repo-reader" }, name: "nipmod.search" }
    },
    {
      id: 4,
      jsonrpc: "2.0",
      method: "tools/call",
      params: { arguments: { specifier: proofPackage }, name: "nipmod.inspect" }
    },
    {
      id: 5,
      jsonrpc: "2.0",
      method: "tools/call",
      params: { arguments: { specifier: proofPackage }, name: "nipmod.install_plan" }
    },
    {
      id: 6,
      jsonrpc: "2.0",
      method: "tools/call",
      params: { arguments: { host: "Codex", package: "gitlawb-repo-reader" }, name: "nipmod.demo" }
    }
  ]);
  assertText("mcp_search_archive", JSON.stringify(calls[0]), "gitlawb-repo-reader");
  assertText("mcp_inspect_archive", JSON.stringify(calls[1]), state.receipt.proofPackage.digest);
  assertText("mcp_install_plan_archive", JSON.stringify(calls[2]), "install");
  assertText("mcp_demo_archive", JSON.stringify(calls[3]), "gitlawb-repo-reader");
}

async function checkRemoteMcpSurface() {
  const list = await remoteMcpRequest({ id: 30, jsonrpc: "2.0", method: "tools/list" });
  assertDeepEqual(
    "remote_mcp_tools",
    list.result.tools.map((tool) => tool.name),
    expectedRemoteMcpTools
  );
  if (list.result.tools.some((tool) => tool.name === "nipmod.install")) {
    fail("remote_mcp_no_install_tool", "hosted MCP exposed nipmod.install");
  } else {
    pass("remote_mcp_no_install_tool");
  }

  const search = await remoteMcpRequest({
    id: 31,
    jsonrpc: "2.0",
    method: "tools/call",
    params: { arguments: { query: "gitlawb-repo-reader" }, name: "nipmod.search" }
  });
  assertText("remote_mcp_search_archive", JSON.stringify(search), "gitlawb-repo-reader");

  const inspect = await remoteMcpRequest({
    id: 32,
    jsonrpc: "2.0",
    method: "tools/call",
    params: { arguments: { specifier: proofPackage }, name: "nipmod.inspect" }
  });
  assertText("remote_mcp_inspect_archive", JSON.stringify(inspect), state.receipt.proofPackage.digest);

  const install = await remoteMcpRequest({
    id: 33,
    jsonrpc: "2.0",
    method: "tools/call",
    params: { arguments: { specifier: proofPackage, confirmInstall: "write-lockfile" }, name: "nipmod.install" }
  });
  assertText("remote_mcp_install_blocked", install.error?.message, "does not expose nipmod.install");
}

async function checkWriteBoundaries() {
  const workspace = await mkdtemp(join(tmpdir(), "nipmod-system-plan-"));
  try {
    const before = await listFiles(workspace);
    await run(nodeBin, [cliPath, "install", "--plan", proofPackage, "--dir", workspace, "--json"]);
    const after = await listFiles(workspace);
    assertDeepEqual("install_plan_no_workspace_write", after, before);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }

  const installRoot = await mkdtemp(join(tmpdir(), "nipmod-system-receipt-"));
  try {
    const pkgDir = join(installRoot, "pkg");
    const appDir = join(installRoot, "app");
    await run(nodeBin, [cliPath, "init", "--name", "receipt-agent", "--dir", pkgDir]);
    const packed = JSON.parse((await run(nodeBin, [cliPath, "pack", pkgDir, "--out", installRoot, "--json"])).stdout);
    const installed = JSON.parse(
      (
        await run(nodeBin, [
          cliPath,
          "install",
          `file:${packed.data.path}`,
          "--dir",
          appDir,
          "--integrity",
          `sha256-${packed.data.digest}`,
          "--json"
        ])
      ).stdout
    );
    assertText("install_receipt_path", installed.data.receiptPath, ".nipmod/receipts");
    const receipts = await readdir(join(appDir, ".nipmod", "receipts"));
    assertEqual("install_receipt_count", receipts.length, 1);
    assertText("install_receipt_type", await readFile(join(appDir, ".nipmod", "receipts", receipts[0]), "utf8"), "dev.nipmod.install-receipt.v1");
  } finally {
    await rm(installRoot, { recursive: true, force: true });
  }
}

async function checkLiveSystemEndpoints() {
  const liveRegistryText = await fetchText(state.receipt.sharedArchive.registry);
  const liveRegistryHash = sha256Bytes(liveRegistryText);
  const localRegistryHash = await sha256(registryPath);
  assertEqual("live_registry_matches_local_archive", liveRegistryHash, localRegistryHash);

  const endpoints = [
    ["live_setup", state.receipt.entrypoints.humanSetup, ["Connect your agent"]],
    ["live_cursor", state.receipt.entrypoints.cursor, ["Use Nipmod in Cursor", "Add to Cursor", "nipmod setup cursor"]],
    ["live_llms", state.receipt.entrypoints.agentText, [state.receipt.entrypoints.systemReadiness]],
    ["live_agent_prompts", state.receipt.entrypoints.agentPrompts, ["dev.nipmod.agent-prompts.v1", "nipmod setup codex"]],
    ["live_cursor_public_config", "https://nipmod.com/integrations/cursor/mcp.json", ["mcpServers", "nipmod", "\"command\": \"nipmod\""]],
    ["live_remote_mcp", state.receipt.entrypoints.remoteMcp, ["dev.nipmod.remote-mcp.v1", "remote-read-only"]],
    ["live_demo", state.receipt.entrypoints.demo, ["Search, inspect, plan, receipt."]],
    ["live_status", state.receipt.entrypoints.status, ["Public proof dashboard"]],
    ["live_manifest", state.receipt.entrypoints.machineManifest, [state.receipt.entrypoints.systemReadiness]],
    ["live_quorum_policy", "https://nipmod.com/quorum/policy.json", ["dev.nipmod.quorum-policy.v1"]],
    ["live_quorum_receipts", "https://nipmod.com/quorum/receipts.json", ["dev.nipmod.quorum-receipts.v1"]],
    ["live_quorum_signers", "https://nipmod.com/quorum/signers.json", ["dev.nipmod.quorum-signers.v1"]],
    ["live_system_readiness", state.receipt.entrypoints.systemReadiness, ["dev.nipmod.system-readiness.v1", "parallelAccessProof"]],
    ["live_platform_readiness", state.receipt.entrypoints.platformReadiness, ["dev.nipmod.platform-readiness.v1"]],
    ["live_package_doc", `https://nipmod.com/registry/packages/${encodedProofPackage}.json`, [state.receipt.proofPackage.digest]],
    [
      "live_package_version_doc",
      `https://nipmod.com/registry/packages/${encodedProofPackage}/0.1.0.json`,
      [state.receipt.proofPackage.digest]
    ],
    ["live_dependencies_doc", `https://nipmod.com/registry/packages/${encodedProofPackage}/dependencies.json`, ["dependencies"]],
    ["live_provenance_doc", `https://nipmod.com/registry/packages/${encodedProofPackage}/provenance.json`, ["sourceCommit"]],
    ["live_bankr_skill", state.receipt.agentHosts.bankr.skill, ["name: nipmod"]],
    ["live_bankr_proof", state.receipt.agentHosts.bankr.proof, ["dev.nipmod.bankr.agent-proof.v1"]]
  ];

  for (const [name, url, expected] of endpoints) {
    const text = await fetchText(url);
    for (const needle of expected) {
      assertText(name, text, needle);
    }
  }
}

async function checkSourceSync() {
  const head = (await run("git", ["rev-parse", "HEAD"])).stdout.trim();
  const gitEnv = { ...process.env, PATH: `/Users/hazar/.local/bin:${process.env.PATH ?? ""}` };
  const github = (await run("git", ["ls-remote", "origin", "refs/heads/main"], { env: gitEnv })).stdout.trim();
  const gitlawb = (await run("git", ["ls-remote", "gitlawb", "refs/heads/main"], { env: gitEnv })).stdout.trim();
  assertText("source_sync_github", github, head);
  assertText("source_sync_gitlawb", gitlawb, head);
}

async function checkParallelArchiveAccess() {
  const tasks = [
    async () => assertText("parallel_registry", await fetchText(state.receipt.sharedArchive.registry), proofPackage.replace("@0.1.0", "")),
    async () => assertText("parallel_package_doc", await fetchText(`https://nipmod.com/registry/packages/${encodedProofPackage}.json`), state.receipt.proofPackage.digest),
    async () =>
      assertText(
        "parallel_package_version",
        await fetchText(`https://nipmod.com/registry/packages/${encodedProofPackage}/0.1.0.json`),
        state.receipt.proofPackage.digest
      ),
    async () =>
      assertText(
        "parallel_dependencies",
        await fetchText(`https://nipmod.com/registry/packages/${encodedProofPackage}/dependencies.json`),
        proofPackage.replace("@0.1.0", "")
      ),
    async () =>
      assertText(
        "parallel_provenance",
        await fetchText(`https://nipmod.com/registry/packages/${encodedProofPackage}/provenance.json`),
        "quorum"
      ),
    async () => assertText("parallel_cli_search", (await run(nodeBin, [cliPath, "search", "gitlawb-repo-reader", "--online", "--json"])).stdout, "verified/100"),
    async () => assertText("parallel_cli_inspect", (await run(nodeBin, [cliPath, "inspect", proofPackage, "--json"])).stdout, state.receipt.proofPackage.digest),
    async () => assertText("parallel_cli_plan", (await run(nodeBin, [cliPath, "install", "--plan", proofPackage, "--json"])).stdout, "install plan ready"),
    async () =>
      assertText(
        "parallel_mcp_search",
        JSON.stringify(
          await mcpRequest([
            {
              id: 20,
              jsonrpc: "2.0",
              method: "tools/call",
              params: { arguments: { query: "gitlawb-repo-reader" }, name: "nipmod.search" }
            }
          ])
        ),
        "gitlawb-repo-reader"
      ),
    async () =>
      assertText(
        "parallel_remote_mcp_search",
        JSON.stringify(
          await remoteMcpRequest({
            id: 40,
            jsonrpc: "2.0",
            method: "tools/call",
            params: { arguments: { query: "gitlawb-repo-reader" }, name: "nipmod.search" }
          })
        ),
        "gitlawb-repo-reader"
      ),
    async () =>
      assertText(
        "parallel_remote_mcp_plan",
        JSON.stringify(
          await remoteMcpRequest({
            id: 41,
            jsonrpc: "2.0",
            method: "tools/call",
            params: { arguments: { specifier: proofPackage }, name: "nipmod.install_plan" }
          })
        ),
        "remote-read-only"
      ),
    async () => assertText("parallel_bankr_skill", await fetchText(state.receipt.agentHosts.bankr.skill), "name: nipmod"),
    async () => assertText("parallel_bankr_proof", await fetchText(state.receipt.agentHosts.bankr.proof), proofPackage),
    async () => assertText("parallel_cursor_page", await fetchText(state.receipt.entrypoints.cursor), "Use Nipmod in Cursor"),
    async () => assertText("parallel_cursor_config", await fetchText("https://nipmod.com/integrations/cursor/mcp.json"), "mcpServers"),
    async () => assertText("parallel_llms", await fetchText(state.receipt.entrypoints.agentText), state.receipt.sharedArchive.registry),
    async () => assertText("parallel_manifest", await fetchText(state.receipt.entrypoints.machineManifest), state.receipt.sharedArchive.registry)
  ];
  await Promise.all(tasks.map((task) => task()));
}

async function mcpRequest(messages) {
  const input = `${messages.map((message) => JSON.stringify(message)).join("\n")}\n`;
  const output = await run(nodeBin, [cliPath, "mcp", "serve"], { input });
  return output.stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function remoteMcpRequest(message) {
  const response = await fetch(state.receipt.entrypoints.remoteMcp, {
    body: JSON.stringify(message),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
  if (!response.ok) {
    throw new Error(`${state.receipt.entrypoints.remoteMcp} returned HTTP ${response.status}`);
  }
  return await response.json();
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return await response.text();
}

async function listFiles(dir) {
  try {
    const entries = await readdir(dir);
    const files = [];
    for (const entry of entries) {
      const path = join(dir, entry);
      if ((await stat(path)).isFile()) {
        files.push(entry);
      }
    }
    return files.sort();
  } catch {
    await mkdir(dir, { recursive: true });
    return [];
  }
}

async function sha256(path) {
  return sha256Bytes(await readFile(path));
}

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertEqual(name, actual, expected) {
  if (actual !== expected) {
    fail(name, { actual, expected });
    return;
  }
  pass(name);
}

function assertDeepEqual(name, actual, expected) {
  if (stableJson(actual) !== stableJson(expected)) {
    fail(name, { actual, expected });
    return;
  }
  pass(name);
}

function assertText(name, haystack, needle) {
  if (!String(haystack).includes(needle)) {
    fail(name, `missing ${needle}`);
    return;
  }
  pass(name);
}

function pass(name, data = undefined) {
  checks.push({ data, name, status: "pass" });
}

function fail(name, data) {
  checks.push({ data, name, status: "fail" });
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
