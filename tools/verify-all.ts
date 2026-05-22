#!/usr/bin/env node
import { createHash, generateKeyPairSync } from "node:crypto";
import { createServer as createNetServer } from "node:net";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createAdvisoryPublicKeyInfo, readAdvisoryPublicKeyInfo, verifyAdvisorySignature } from "./advisory-signing.ts";
import { writeAuditSmokeLockfile } from "./live-audit-smoke.ts";
import { assertUnauthenticatedReceivePackBlocked } from "./receive-pack-abuse-smoke.ts";
import { readReleasePublicKeyInfo, verifyReleaseSignature } from "./release-signing.ts";

const root = resolve(import.meta.dirname, "..");
const version = JSON.parse(await readFile(join(root, "nipmod", "package.json"), "utf8")).version;
const releaseName = `nipmod-${version}.tgz`;
const releasePath = join(root, "site", "public", "releases", releaseName);
const advisoriesPath = join(root, "site", "public", "advisories.json");
const runProdChecks = process.argv.includes("--prod");
const HEX_SHA256 = /^[a-f0-9]{64}$/;
const SOURCE_COMMIT = /^[a-f0-9]{40}$/;
const SOURCE_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

await run("pnpm", ["--dir", "site", "test"]);
await run(
  "pnpm",
  [
    "--dir",
    "site",
    "exec",
    "vitest",
    "run",
    "../tools/release-signing.test.ts",
    "../tools/quorum-signing.test.ts",
    "../tools/advisory-signing.test.ts",
    "../tools/advisory-drill.test.ts",
    "../tools/witness-server.test.ts",
    "../tools/witness-worker.test.ts",
    "../tools/build-package-index.test.ts",
    "../tools/rebuild-verified-registry.test.ts",
    "../tools/live-audit-smoke.test.ts",
    "../tools/receive-pack-abuse-smoke.test.ts",
    "../tools/prod-synthetic-monitor.test.ts",
    "../tools/restore-drill.test.ts",
    "../tools/prod-alert-runner.test.ts",
    "../tools/monitor-server.test.ts",
    "../tools/prod-load-smoke.test.ts",
    "../tools/node-edge-resilience-smoke.test.ts",
    "../tools/first-party-packages.test.ts",
    "../tools/generate-review-packet.test.ts",
    "../tools/public-proof-loop.test.ts"
  ],
  {
    env: {
      NIPMOD_INCLUDE_OPERATOR_TESTS: "1"
    }
  }
);
await run("pnpm", ["--dir", "nipmod", "test"]);
await cleanBuildArtifacts();
await run("pnpm", ["--dir", "site", "build"]);
await run("pnpm", ["--dir", "site", "typecheck"]);
await run("pnpm", ["--dir", "nipmod", "typecheck"]);
await run("pnpm", ["--dir", "nipmod", "build"]);
await run(process.execPath, ["--experimental-strip-types", "tools/platform-readiness-check.ts"], { timeoutMs: 30_000 });
await run(process.execPath, ["--experimental-strip-types", "tools/system-readiness-check.ts"], { timeoutMs: 60_000 });
if (process.env.NIPMOD_INCLUDE_HOST_SMOKE === "1") {
  await run(process.execPath, ["--experimental-strip-types", "tools/platform-readiness-check.ts", "--host-smoke"], { timeoutMs: 120_000 });
}
await run("pnpm", ["--dir", "site", "test:e2e"], {
  env: {
    NIPMOD_E2E_PORT: String(await freePort())
  },
  timeoutMs: 180_000
});
await run(process.execPath, ["--experimental-strip-types", "tools/secret-scan.ts"]);
await run(process.execPath, ["--experimental-strip-types", "tools/supply-chain-check.ts"], { timeoutMs: 120_000 });

await verifyLocalArtifacts();
await smokeLocalInstaller();

if (runProdChecks) {
  await verifyProduction();
}

console.log(runProdChecks ? "verify-all passed with production checks" : "verify-all passed");

async function cleanBuildArtifacts() {
  await rm(join(root, "site", ".next"), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

async function verifyLocalArtifacts() {
  await assertShaFile(join(root, "site", "public", "install.sh"), join(root, "site", "public", "install.sh.sha256"));
  await assertShaFile(releasePath, `${releasePath}.sha256`);
  await verifyReleaseSignature({
    artifactName: releaseName,
    artifactPath: releasePath,
    publicKeyInfo: await readReleasePublicKeyInfo(join(root, "tools", "release-signing-public-key.json")),
    signature: JSON.parse(await readFile(`${releasePath}.sig`, "utf8"))
  });
  await verifyAdvisorySignature({
    feedPath: advisoriesPath,
    publicKeyInfo: await readAdvisoryPublicKeyInfo(join(root, "tools", "advisory-signing-public-key.json")),
    signature: JSON.parse(await readFile(`${advisoriesPath}.sig`, "utf8"))
  });
}

async function smokeLocalInstaller() {
  const dir = await mkdtemp(join(tmpdir(), "nipmod-verify-all-"));
  try {
    await run("bash", [join(root, "site", "public", "install.sh")], {
      env: {
        NIPMOD_BIN_DIR: join(dir, "bin"),
        NIPMOD_CHECKSUM_URL: `file://${releasePath}.sha256`,
        NIPMOD_HOME: join(dir, "home"),
        NIPMOD_PACKAGE_URL: `file://${releasePath}`,
        NIPMOD_SIGNATURE_URL: `file://${releasePath}.sig`,
        NIPMOD_SKIP_GITLAWB: "1"
      }
    });
    await run(join(dir, "bin", "nipmod"), ["init", "--name", "verify-all", "--dir", join(dir, "pkg")]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function verifyProduction() {
  await run(process.execPath, ["--experimental-strip-types", "tools/prod-synthetic-monitor.ts"], { timeoutMs: 30_000 });
  await run(process.execPath, ["--experimental-strip-types", "tools/restore-drill.ts"], { timeoutMs: 30_000 });
  await verifyAlertProbe();
  await run(process.execPath, ["--experimental-strip-types", "tools/prod-load-smoke.ts", "--profile", "launch"], { timeoutMs: 120_000 });
  await run(process.execPath, ["--experimental-strip-types", "tools/node-edge-resilience-smoke.ts"], { timeoutMs: 30_000 });
  await assertJson("https://node.nipmod.com/health", (payload) => payload.status === "ok", "node health failed");
  await assertUnauthenticatedReceivePackBlocked();
  await assertJson("https://nipmod-witness.fly.dev/health", (payload) => payload.ok === true, "witness health failed");
  await run(process.execPath, ["--experimental-strip-types", "tools/platform-readiness-check.ts", "--live"], { timeoutMs: 120_000 });
  await run(process.execPath, ["--experimental-strip-types", "tools/system-readiness-check.ts", "--live", "--parallel"], { timeoutMs: 180_000 });
  await assertJson(
    "https://nipmod.com/registry/packages.json",
    (payload) =>
      Array.isArray(payload.packages) &&
      payload.packages.every(isStrictPublicVerifiedPackage),
    "registry trust failed"
  );
  await assertJson(
    "https://nipmod.com/.well-known/nipmod.json",
    (payload) =>
	      payload.type === "dev.nipmod.discovery.v1" &&
	      payload.advisories === "https://nipmod.com/advisories.json" &&
      payload.advisoriesSignature === "https://nipmod.com/advisories.json.sig" &&
      payload.quorum?.policy === "https://nipmod.com/quorum/policy.json" &&
      payload.quorum?.receipts === "https://nipmod.com/quorum/receipts.json" &&
      payload.quorum?.signers === "https://nipmod.com/quorum/signers.json" &&
      payload.registry?.url === "https://nipmod.com/registry/packages.json" &&
	      payload.install?.scriptSha256 === expectedDigestFromShaFileSync(join(root, "site", "public", "install.sh.sha256")) &&
	      payload.install?.release?.version === version &&
	      payload.install?.release?.artifact === `https://nipmod.com/releases/${releaseName}` &&
	      payload.install?.release?.artifactSha256 === expectedDigestFromShaFileSync(`${releasePath}.sha256`) &&
	      payload.install?.release?.signature === `https://nipmod.com/releases/${releaseName}.sig` &&
	      payload.transparency?.logId === localTransparencyLogIdSync() &&
	      (localHasPublicPackagesSync()
	        ? payload.transparency?.checkpoint === "https://nipmod.com/transparency/checkpoint.json"
	        : payload.transparency?.status === "pending_first_public_package" &&
	          payload.transparency?.checkpoint === undefined) &&
	      payload.review?.packet === "https://nipmod.com/review/packet.json" &&
	      payload.review?.evidenceManifest === "https://nipmod.com/review/evidence-manifest.json" &&
	      payload.review?.evidenceLedger === "https://nipmod.com/review/evidence-ledger.json" &&
	      payload.install?.release?.publicKey?.publicKeySpkiBase64 === localReleaseKeySync().publicKeySpkiBase64 &&
	      payload.install?.release?.publicKey?.spkiSha256 === localReleaseKeySync().publicKeySpkiSha256,
	    "discovery manifest failed"
	  );
  await assertJson(
    "https://nipmod.com/advisories.json",
    (payload) =>
      payload.type === "dev.nipmod.advisories.v1" &&
      payload.formatVersion === 1 &&
      Array.isArray(payload.advisories),
    "advisory feed failed"
  );
  await assertText(
    "https://nipmod.com",
    (text) =>
      text.includes("Search, inspect and install verified agent packages") &&
      hasHtmlHref(text, "https://x.com/Nipmod") &&
      hasHtmlHref(text, "https://github.com/nipmod/nipmod"),
    "homepage product surface missing"
  );
  await assertText(
    "https://nipmod.com/quickstart",
    (text) => text.includes("curl https://nipmod.com/i|bash"),
    "quickstart install flow missing"
  );
  await assertText(
    "https://nipmod.com/trust",
    (text) =>
      text.includes("Verified registry") &&
      text.includes("Current public roots") &&
      text.includes("Release key"),
    "trust page proof surface missing"
  );
  const liveInstall = await fetchBytes("https://nipmod.com/install.sh");
  const expectedInstallDigest = await expectedDigestFromShaFile(join(root, "site", "public", "install.sh.sha256"));
  const actualInstallDigest = createHash("sha256").update(liveInstall).digest("hex");
  if (actualInstallDigest !== expectedInstallDigest) {
    throw new Error(`live installer digest mismatch: ${actualInstallDigest}`);
  }
  const liveRelease = await fetchBytes(`https://nipmod.com/releases/${releaseName}`);
  const expectedReleaseDigest = await expectedDigestFromShaFile(`${releasePath}.sha256`);
  const actualReleaseDigest = createHash("sha256").update(liveRelease).digest("hex");
  if (actualReleaseDigest !== expectedReleaseDigest) {
    throw new Error(`live release digest mismatch: ${actualReleaseDigest}`);
  }
  await verifyLiveAdvisorySignature();
  await smokeLiveInstalledAudit();
  await run(process.execPath, ["--experimental-strip-types", "tools/public-proof-loop.ts", "--registry", "https://nipmod.com/registry/packages.json", "--quiet"]);
  await runAdvisoryDrillWithEphemeralKey();
}

async function runAdvisoryDrillWithEphemeralKey() {
  const dir = await mkdtemp(join(tmpdir(), "nipmod-prod-advisory-key-"));
  try {
    const privateKeyPath = join(dir, "advisory-private.pem");
    const publicKeyPath = join(dir, "advisory-public.json");
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    await writeFile(privateKeyPath, privateKey.export({ format: "pem", type: "pkcs8" }), { mode: 0o600 });
    await writeFile(publicKeyPath, `${JSON.stringify(createAdvisoryPublicKeyInfo(publicKey), null, 2)}\n`);
    await run(process.execPath, [
      "tools/advisory-drill.ts",
      "--registry",
      "https://nipmod.com/registry/packages.json",
      "--private-key",
      privateKeyPath,
      "--public-key",
      publicKeyPath,
      "--quiet"
    ]);
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
}

async function verifyAlertProbe() {
  if (process.env.NIPMOD_MONITOR_PROBE_URL) {
    const headers = {};
    if (process.env.NIPMOD_MONITOR_PROBE_BEARER_TOKEN) {
      headers.authorization = `Bearer ${process.env.NIPMOD_MONITOR_PROBE_BEARER_TOKEN}`;
    }
    const response = await fetch(process.env.NIPMOD_MONITOR_PROBE_URL, {
      headers,
      redirect: "error"
    });
    if (!response.ok) {
      throw new Error(`monitor probe failed: ${response.status}`);
    }
    const payload = await response.json();
    if (payload?.ok !== true || payload?.mode !== "probe" || payload?.alertSent !== true) {
      throw new Error("monitor probe did not prove alert delivery");
    }
    return;
  }

  if (hasLocalAlertDestination()) {
    await run(process.execPath, ["--experimental-strip-types", "tools/prod-alert-runner.ts", "--probe"], { timeoutMs: 60_000 });
    return;
  }

  await run("flyctl", ["ssh", "console", "--config", "tools/fly.monitor.toml", "--command", "node --experimental-strip-types tools/prod-alert-runner.ts --probe"], {
    timeoutMs: 120_000
  });
}

function hasLocalAlertDestination() {
  return Boolean(
    process.env.NIPMOD_ALERT_PRIMARY_WEBHOOK_URL ||
      process.env.NIPMOD_ALERT_SECONDARY_WEBHOOK_URL ||
      process.env.NIPMOD_ALERT_WEBHOOK_URLS
  );
}

function isInternalArtifact(pkg) {
  return [pkg?.name, pkg?.canonical, pkg?.description, pkg?.repo]
    .filter((value) => typeof value === "string")
    .some((value) => value.toLowerCase().includes("probe"));
}

function isStrictPublicVerifiedPackage(pkg) {
  return (
    pkg?.trust?.level === "verified" &&
    pkg?.trust?.score === 100 &&
    pkg?.trust?.evidence?.releaseEventSigned === true &&
    pkg?.trust?.evidence?.sourceProvenanceVerified === true &&
    pkg?.trust?.evidence?.transparencyLogIncluded === true &&
    pkg?.trust?.evidence?.transparencyLogVerified === true &&
    HEX_SHA256.test(pkg?.digest ?? "") &&
    SOURCE_COMMIT.test(pkg?.sourceCommit ?? "") &&
    SOURCE_TAG.test(pkg?.sourceTag ?? "") &&
    HEX_SHA256.test(pkg?.proof?.rootHash ?? "") &&
    Number.isInteger(pkg?.proof?.treeSize) &&
    pkg.proof.treeSize > 0 &&
    Array.isArray(pkg?.proof?.witnesses) &&
    pkg.proof.witnesses.length > 0 &&
    pkg?.quorum?.status === "passed" &&
    pkg.quorum.approvals >= pkg.quorum.threshold &&
    pkg.quorum.approvedRoles?.includes("release") &&
    pkg.quorum.approvedRoles?.includes("security") &&
    !isInternalArtifact(pkg)
  );
}

async function verifyLiveAdvisorySignature() {
  const dir = await mkdtemp(join(tmpdir(), "nipmod-prod-advisories-"));
  try {
    const liveAdvisoriesPath = join(dir, "advisories.json");
    await writeFile(liveAdvisoriesPath, await fetchBytes("https://nipmod.com/advisories.json"));
    await verifyAdvisorySignature({
      feedPath: liveAdvisoriesPath,
      publicKeyInfo: await readAdvisoryPublicKeyInfo(join(root, "tools", "advisory-signing-public-key.json")),
      signature: await assertJson("https://nipmod.com/advisories.json.sig", (payload) => payload?.artifact === "advisories.json", "advisory signature failed")
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function smokeLiveInstalledAudit() {
  const dir = await mkdtemp(join(tmpdir(), "nipmod-prod-audit-smoke-"));
  try {
    const installScriptPath = join(dir, "install.sh");
    const appDir = join(dir, "app");
    await writeFile(installScriptPath, await fetchBytes("https://nipmod.com/install.sh"));
    await run("bash", [installScriptPath], {
      env: {
        NIPMOD_BIN_DIR: join(dir, "bin"),
        NIPMOD_HOME: join(dir, "home"),
        NIPMOD_SKIP_GITLAWB: "1"
      }
    });
    const subject = await writeAuditSmokeLockfile({ appDir });
    await run(join(dir, "bin", "nipmod"), ["audit", "--dir", appDir, "--online", "--json"]);
    await run(join(dir, "bin", "nipmod"), ["ci", "--dir", appDir, "--online", "--json"]);
    await run(join(dir, "bin", "nipmod"), ["inspect", subject, "--json"]);
    await run(join(dir, "bin", "nipmod"), ["install", "--plan", subject, "--dir", join(dir, "plan-app"), "--json"]);
    await run(join(dir, "bin", "nipmod"), ["add", subject, "--dir", join(dir, "add-app"), "--json"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function assertJson(url, predicate, message) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${message}: ${response.status}`);
  }
  const payload = await response.json();
  if (!predicate(payload)) {
    throw new Error(message);
  }
  return payload;
}

async function assertText(url, predicate, message) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${message}: ${response.status}`);
  }
  const text = await response.text();
  if (!predicate(text)) {
    throw new Error(message);
  }
}

function hasHtmlHref(html, expectedHref) {
  for (const segment of html.split("href=").slice(1)) {
    const quote = segment[0];
    if (quote !== `"` && quote !== "'") {
      continue;
    }
    const endIndex = segment.indexOf(quote, 1);
    if (endIndex === -1) {
      continue;
    }
    if (segment.slice(1, endIndex) === expectedHref) {
      return true;
    }
  }
  return false;
}

async function fetchBytes(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to fetch ${url}: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function assertShaFile(path, shaPath) {
  const expected = await expectedDigestFromShaFile(shaPath);
  const actual = createHash("sha256").update(await readFile(path)).digest("hex");
  if (actual !== expected) {
    throw new Error(`${path} digest mismatch: ${actual}`);
  }
}

async function expectedDigestFromShaFile(path) {
  const digest = (await readFile(path, "utf8")).trim().split(/\s+/)[0];
  if (!/^[a-f0-9]{64}$/.test(digest)) {
    throw new Error(`${path} has invalid sha256`);
  }
  return digest;
}

function expectedDigestFromShaFileSync(path) {
  const digest = readFileSync(path, "utf8").trim().split(/\s+/)[0];
  if (!/^[a-f0-9]{64}$/.test(digest)) {
    throw new Error(`${path} has invalid sha256`);
  }
  return digest;
}

function localCheckpointSync() {
  return JSON.parse(readFileSync(join(root, "site", "public", "transparency", "checkpoint.json"), "utf8"));
}

function localDiscoverySync() {
  return JSON.parse(readFileSync(join(root, "site", "public", ".well-known", "nipmod.json"), "utf8"));
}

function localHasPublicPackagesSync() {
  const registry = JSON.parse(readFileSync(join(root, "site", "public", "registry", "packages.json"), "utf8"));
  return Array.isArray(registry.packages) && registry.packages.length > 0;
}

function localTransparencyLogIdSync() {
  try {
    return localCheckpointSync().logId;
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
    return localDiscoverySync().transparency?.logId;
  }
}

function localReleaseKeySync() {
  return JSON.parse(readFileSync(join(root, "tools", "release-signing-public-key.json"), "utf8"));
}

async function run(command, args, options = {}) {
  const env = { ...process.env, ...(options.env ?? {}) };
  const child = spawn(command, args, {
    cwd: options.cwd ?? root,
    env,
    stdio: "inherit"
  });
  const code = await new Promise((resolve, reject) => {
    const timeout =
      options.timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            child.kill("SIGTERM");
            reject(new Error(`${command} ${args.join(" ")} timed out after ${options.timeoutMs}ms`));
          }, options.timeoutMs);
    child.on("error", reject);
    child.on("close", (exitCode) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      resolve(exitCode);
    });
  });
  if (code !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with ${code}`);
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("could not allocate e2e port")));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}
