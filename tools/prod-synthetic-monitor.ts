#!/usr/bin/env node
import { createHash, createPublicKey, verify } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateAdvisoryFeed } from "./advisory-signing.ts";
import { assertUnauthenticatedReceivePackBlocked } from "./receive-pack-abuse-smoke.ts";

const DEFAULT_ENDPOINTS = {
  advisories: "https://nipmod.com/advisories.json",
  advisoriesSignature: "https://nipmod.com/advisories.json.sig",
  archiveConfirm: "https://nipmod.com/api/archive/confirm",
  archivePrepare: "https://nipmod.com/api/archive/prepare",
  archiveSearch: "https://nipmod.com/api/archive/search",
  archiveStatus: "https://nipmod.com/api/archive/status",
  checkpoint: "https://nipmod.com/transparency/checkpoint.json",
  discovery: "https://nipmod.com/.well-known/nipmod.json",
  externalInspect: "https://nipmod.com/api/inspect",
  externalInstallPlan: "https://nipmod.com/api/install-plan",
  externalSearch: "https://nipmod.com/api/search",
  home: "https://nipmod.com",
  nodeHealth: "https://node.nipmod.com/health",
  nodeUrl: "https://node.nipmod.com",
  openApi: "https://nipmod.com/api/openapi",
  platforms: "https://nipmod.com/platforms",
  platformConnections: "https://nipmod.com/compatibility/platform-connections.json",
  quorumPolicy: "https://nipmod.com/quorum/policy.json",
  quorumReceipts: "https://nipmod.com/quorum/receipts.json",
  quorumSigners: "https://nipmod.com/quorum/signers.json",
  registry: "https://nipmod.com/registry/packages.json",
  remoteMcp: "https://nipmod.com/api/mcp",
  security: "https://nipmod.com/security",
  securityTxt: "https://nipmod.com/.well-known/security.txt",
  sourceHealth: "https://nipmod.com/api/sources/health",
  trust: "https://nipmod.com/trust",
  witnessHealth: "https://nipmod-witness.fly.dev/health",
  witnessRun: "https://nipmod-witness.fly.dev/run"
};
const DEFAULT_CHECKPOINT_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const DEFAULT_WITNESS_MAX_AGE_MS = 15 * 60 * 1000;
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;
const HEX_SHA256 = /^[a-f0-9]{64}$/;
const SOURCE_COMMIT = /^[a-f0-9]{40}$/;
const SOURCE_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export async function runSyntheticMonitor({
  endpoints = DEFAULT_ENDPOINTS,
  expected,
  fetchFn = fetch,
  now = Date.now(),
  rootDir = resolve(import.meta.dirname, "..")
} = {}) {
  const config = expected ?? (await readExpectedConfig(rootDir));
  const timedFetch = createTimedFetch(fetchFn, config.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS);
  const state = {};
  const checks = [];

  await runCheck(checks, "site_home", async () => {
    const text = await fetchText(endpoints.home, timedFetch);
    assertIncludes(text, "nipmod", "homepage missing product name");
    return { url: endpoints.home };
  });

  await runCheck(checks, "trust_page", async () => {
    const text = await fetchText(endpoints.trust, timedFetch);
    for (const marker of ["Trust signals for package decisions", "Do not trust package text", "Source", "Digest", "Plan boundary"]) {
      assertIncludes(text, marker, `trust page missing ${marker}`);
    }
    return { url: endpoints.trust };
  });

  await runCheck(checks, "platform_connections", async () => {
    const page = await fetchText(endpoints.platforms, timedFetch);
    assertIncludes(page, "Source and access paths", "platform page missing source access title");
    assertIncludes(page, "Native integrations", "platform page missing API scope");
    const matrix = await fetchJson(endpoints.platformConnections, timedFetch);
    assertEqual(matrix.type, "dev.nipmod.platform-connections.v1", "platform connection type mismatch");
    assertIncludes(JSON.stringify(matrix), "api", "platform matrix missing API path");
    assertIncludes(JSON.stringify(matrix), "sources", "platform matrix missing source resolver path");
    assertIncludes(JSON.stringify(matrix), "archive", "platform matrix missing archive path");
    return { matrix: endpoints.platformConnections, page: endpoints.platforms };
  });

  await runCheck(checks, "security_disclosure", async () => {
    const page = await fetchText(endpoints.security, timedFetch);
    assertIncludes(page, "Security policy", "security page missing disclosure marker");
    assertIncludes(page, "What to include", "security page missing report guidance marker");
    const securityTxt = await fetchText(endpoints.securityTxt, timedFetch);
    assertIncludes(securityTxt, `Canonical: ${endpoints.securityTxt}`, "security.txt canonical mismatch");
    assertIncludes(securityTxt, `Policy: ${endpoints.security}`, "security.txt policy mismatch");
    return { policy: endpoints.security, securityTxt: endpoints.securityTxt };
  });

  await runCheck(checks, "discovery_manifest", async () => {
    state.discovery = await fetchJson(endpoints.discovery, timedFetch);
    assertEqual(state.discovery.type, "dev.nipmod.discovery.v1", "discovery type mismatch");
    assertEqual(state.discovery.homepage, endpoints.home, "discovery homepage mismatch");
    assertEqual(state.discovery.trustPage, endpoints.trust, "discovery trust page mismatch");
    assertEqual(state.discovery.registry?.url, endpoints.registry, "discovery registry URL mismatch");
    assertEqual(state.discovery.node?.health, endpoints.nodeHealth, "discovery node health URL mismatch");
    assertEqual(state.discovery.witness?.health, endpoints.witnessHealth, "discovery witness health URL mismatch");
    assertEqual(state.discovery.advisories, endpoints.advisories, "discovery advisory URL mismatch");
    assertEqual(state.discovery.advisoriesSignature, endpoints.advisoriesSignature, "discovery advisory signature URL mismatch");
    assertEqual(state.discovery.quorum?.policy, endpoints.quorumPolicy, "discovery quorum policy URL mismatch");
    assertEqual(state.discovery.quorum?.receipts, endpoints.quorumReceipts, "discovery quorum receipts URL mismatch");
    assertEqual(state.discovery.quorum?.signers, endpoints.quorumSigners, "discovery quorum signers URL mismatch");
    if (state.discovery.transparency?.checkpoint) {
      assertEqual(state.discovery.transparency.checkpoint, endpoints.checkpoint, "discovery checkpoint URL mismatch");
    }
    assertEqual(state.discovery.docs?.platforms, endpoints.platforms, "discovery platforms URL mismatch");
    assertEqual(state.discovery.docs?.apiSpec, endpoints.openApi, "discovery OpenAPI URL mismatch");
    assertEqual(
      state.discovery.review?.platformConnections,
      endpoints.platformConnections,
      "discovery platform connections URL mismatch"
    );
    assertEqual(state.discovery.mcp?.remoteEndpoint, endpoints.remoteMcp, "discovery remote MCP endpoint mismatch");
    assertEqual(state.discovery.review?.packet, `${endpoints.home}/review/packet.json`, "discovery review packet URL mismatch");
    assertEqual(
      state.discovery.review?.evidenceManifest,
      `${endpoints.home}/review/evidence-manifest.json`,
      "discovery review evidence manifest URL mismatch"
    );
    assertEqual(
      state.discovery.review?.evidenceLedger,
      `${endpoints.home}/review/evidence-ledger.json`,
      "discovery review evidence ledger URL mismatch"
    );
    return { url: endpoints.discovery };
  });

  await runCheck(checks, "package_api_contract", async () => {
    const openApi = await fetchJson(endpoints.openApi, timedFetch);
    assertEqual(openApi.openapi, "3.1.0", "OpenAPI version mismatch");
    assertEqual(openApi.info?.title, "Nipmod API", "OpenAPI title mismatch");
    if (!openApi.paths?.["/api/search"] || !openApi.paths?.["/api/inspect"] || !openApi.paths?.["/api/install-plan"]) {
      throw new Error("OpenAPI package paths missing");
    }
    assertEqual(openApi.components?.securitySchemes?.NipmodApiKey?.name, "x-nipmod-api-key", "OpenAPI API key scheme mismatch");

    const search = await fetchJson(`${endpoints.externalSearch}?q=undici&sources=npm&limit=3`, timedFetch);
    assertEqual(search.type, "dev.nipmod.external-search.v1", "external search type mismatch");
    assertEqual(search.selection?.policy, "agent-selection-v1", "external search selection policy mismatch");
    if (!Array.isArray(search.selection?.candidates) || search.selection.candidates.length === 0) {
      throw new Error("external search selection candidates missing");
    }
    if (typeof search.selection?.recommendedId !== "string" || !search.selection.recommendedId.startsWith("npm:")) {
      throw new Error("external search recommended package missing");
    }
    if (!Array.isArray(search.sourceReports) || search.sourceReports[0]?.source !== "npm") {
      throw new Error("external search source reports missing");
    }

    const inspect = await fetchJson(`${endpoints.externalInspect}?source=npm&name=undici`, timedFetch);
    assertEqual(inspect.type, "dev.nipmod.external-inspect.v1", "external inspect type mismatch");
    assertEqual(inspect.record?.type, "dev.nipmod.external-package.v1", "external inspect record type mismatch");
    assertEqual(inspect.record?.source, "npm", "external inspect source mismatch");
    assertEqual(inspect.record?.trust?.policy?.version, "external-v2", "external inspect trust policy mismatch");
    if (!Array.isArray(inspect.record?.trust?.factors) || inspect.record.trust.factors.length === 0) {
      throw new Error("external inspect trust factors missing");
    }

    const plan = await fetchJson(`${endpoints.externalInstallPlan}?source=npm&name=undici`, timedFetch);
    assertEqual(plan.type, "dev.nipmod.external-install-plan.v1", "external install plan type mismatch");
    assertEqual(plan.plan?.requiresApprovalBeforeWrite, true, "external install plan approval boundary mismatch");
    assertEqual(plan.safety?.blocked, false, "external install plan should not be blocked");
    assertEqual(plan.safety?.requiresApprovalBeforeWrite, true, "external install plan safety boundary mismatch");
    const firstCommand = plan.plan?.commandDetails?.[0];
    assertEqual(firstCommand?.hostedApiExecutes, false, "external install plan hosted execution boundary mismatch");
    assertEqual(firstCommand?.requiresApprovalBeforeWrite, true, "external install plan command approval boundary mismatch");
    if (!Array.isArray(plan.plan?.writes) || plan.plan.writes.length !== 0) {
      throw new Error("external install plan should not write remotely");
    }

    const largeNpmPlan = await fetchJson(`${endpoints.externalInstallPlan}?source=npm&name=react`, timedFetch);
    assertEqual(largeNpmPlan.type, "dev.nipmod.external-install-plan.v1", "large npm install plan type mismatch");
    assertEqual(largeNpmPlan.package?.id, "npm:react", "large npm install plan package mismatch");
    assertEqual(largeNpmPlan.plan?.requiresApprovalBeforeWrite, true, "large npm install plan approval boundary mismatch");
    if (!Array.isArray(largeNpmPlan.package?.trust?.signals) || !largeNpmPlan.package.trust.signals.length) {
      throw new Error("large npm install plan missing trust signals");
    }

    return {
      openapi: endpoints.openApi,
      recommendedId: search.selection.recommendedId,
      trustFactors: inspect.record.trust.factors.length,
      searchReports: search.sourceReports.length
    };
  });

  await runCheck(checks, "source_capability_health", async () => {
    const health = await fetchJson(endpoints.sourceHealth, timedFetch);
    assertEqual(health.type, "dev.nipmod.source-health.v1", "source health type mismatch");
    assertEqual(health.summary?.workspaceWritesFromHostedApi, false, "hosted source health write boundary mismatch");
    assertEqual(health.apiAccess?.publicBeta, true, "source health API access mismatch");
    if (!health.rateLimit?.activeStore || typeof health.rateLimit.distributedActive !== "boolean") {
      throw new Error("source health missing rate-limit activation status");
    }
    const sources = Array.isArray(health.sources) ? health.sources : [];
    const names = sources.map((source) => source.source).sort().join(",");
    assertEqual(names, "github,huggingface-dataset,huggingface-model,mcp,npm,pypi", "source health source list mismatch");
    const unsafe = sources.find((source) => source.installPlanWritesWorkspace !== false);
    if (unsafe) {
      throw new Error(`source health exposes workspace writes for ${unsafe.source ?? "unknown"}`);
    }
    return {
      archiveMode: health.archive?.mode,
      rateLimitStore: health.rateLimit.activeStore,
      sources: sources.length
    };
  });

  await runCheck(checks, "external_source_matrix", async () => {
    const plans = await Promise.all([
      fetchJson(`${endpoints.externalInstallPlan}?source=pypi&name=requests`, timedFetch),
      fetchJson(`${endpoints.externalInstallPlan}?source=github&name=vercel/next.js`, timedFetch),
      fetchJson(`${endpoints.externalInstallPlan}?source=huggingface-model&name=bert-base-uncased`, timedFetch),
      fetchJson(`${endpoints.externalInstallPlan}?source=huggingface-dataset&name=squad`, timedFetch)
    ]);
    for (const plan of plans) {
      assertEqual(plan.type, "dev.nipmod.external-install-plan.v1", "source matrix install plan type mismatch");
      assertEqual(plan.plan?.requiresApprovalBeforeWrite, true, "source matrix approval boundary mismatch");
      if (!Array.isArray(plan.plan?.writes) || plan.plan.writes.length !== 0) {
        throw new Error("source matrix install plan should not write remotely");
      }
    }

    const mcpSearch = await fetchJson(`${endpoints.externalSearch}?q=tandem&sources=mcp&limit=3`, timedFetch);
    assertEqual(mcpSearch.type, "dev.nipmod.external-search.v1", "MCP source search type mismatch");
    if (!Array.isArray(mcpSearch.records) || !mcpSearch.records.some((record) => record.source === "mcp")) {
      throw new Error("MCP source search returned no MCP records");
    }

    return {
      installPlans: plans.length,
      mcpRecords: mcpSearch.records.length
    };
  });

  await runCheck(checks, "remote_readonly_mcp", async () => {
    const info = await fetchJson(endpoints.remoteMcp, timedFetch);
    assertEqual(info.type, "dev.nipmod.remote-mcp.v1", "remote MCP type mismatch");
    assertEqual(info.mode, "remote-read-only", "remote MCP mode mismatch");
    if (!Array.isArray(info.tools) || info.tools.includes("nipmod.install")) {
      throw new Error("remote MCP exposed an unsafe tool list");
    }
    const tools = await fetchJson(endpoints.remoteMcp, timedFetch, {
      body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "tools/list" }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    const toolNames = tools.result?.tools?.map((tool) => tool.name) ?? [];
    assertEqual(
      toolNames.join(","),
      "nipmod.search,nipmod.resolve,nipmod.view,nipmod.inspect,nipmod.install_plan,nipmod.external_install_plan,nipmod.demo",
      "remote MCP tool list mismatch"
    );
    return {
      endpoint: endpoints.remoteMcp,
      tools: toolNames.length
    };
  });

  await runCheck(checks, "package_intelligence_archive_api", async () => {
    const status = await fetchJson(endpoints.archiveStatus, timedFetch);
    assertEqual(status.type, "dev.nipmod.archive-status.v1", "archive status type mismatch");
    if (!["durable-archive-enabled", "resolver-only-safe-mode"].includes(status.mode)) {
      throw new Error("archive status mode is invalid");
    }

    const archiveSearchQuery = "react";
    const search = await fetchJson(`${endpoints.archiveSearch}?q=${encodeURIComponent(archiveSearchQuery)}`, timedFetch);
    assertEqual(search.type, "dev.nipmod.package-intelligence-search.v1", "archive search type mismatch");
    if (!Array.isArray(search.records)) {
      throw new Error("archive search records are not an array");
    }
    if (status.mode === "durable-archive-enabled" && search.total < 1) {
      throw new Error("durable archive search returned no seeded package intelligence records");
    }

    const prepare = await fetchJson(`${endpoints.archivePrepare}?source=npm&name=undici`, timedFetch);
    assertEqual(prepare.type, "dev.nipmod.archive-prepare.v1", "archive prepare type mismatch");
    assertEqual(prepare.record?.archive?.status, "external_indexed", "archive prepare status mismatch");
    assertEqual(prepare.validation?.ok, true, "archive prepare validation failed");

    const confirm = await fetchJson(endpoints.archiveConfirm, timedFetch, {
      body: JSON.stringify({
        actor: "prod-synthetic-monitor",
        dryRun: true,
        source: "npm",
        name: "undici"
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    assertEqual(confirm.type, "dev.nipmod.archive-confirm.v1", "archive confirm type mismatch");
    assertEqual(confirm.dryRun, true, "archive confirm dry run mismatch");
    assertEqual(confirm.record?.archive?.status, "agent_confirmed", "archive confirm status mismatch");
    assertEqual(confirm.validation?.ok, true, "archive confirm validation failed");

    return {
      mode: status.mode,
      query: archiveSearchQuery,
      persistedRecords: search.total
    };
  });

  await runCheck(checks, "deploy_drift", async () => {
    const discovery = requireState(state.discovery, "discovery manifest");
    assertEqual(discovery.install?.scriptSha256, config.installerSha256, "live installer hash drifted");
    assertEqual(discovery.install?.release?.version, config.version, "live release version drifted");
    assertEqual(discovery.install?.release?.artifactSha256, config.releaseSha256, "live release hash drifted");
    assertEqual(discovery.install?.release?.artifact, `${endpoints.home}/releases/${config.releaseName}`, "live release artifact URL drifted");
    assertEqual(discovery.install?.release?.sbom, `${endpoints.home}/releases/${config.releaseName}.sbom.json`, "live release SBOM URL drifted");
    assertEqual(
      discovery.install?.release?.provenance,
      `${endpoints.home}/releases/${config.releaseName}.provenance.json`,
      "live release provenance URL drifted"
    );
    assertPublicKeyMatches(discovery.install?.release?.publicKey, config.releasePublicKey, "live release key");
    assertPublicKeyMatches(discovery.advisoriesPublicKey, config.advisoryPublicKey, "live advisory key");
    assertEqual(discovery.transparency?.logId, config.logId, "live transparency log ID drifted");
    assertEqual(discovery.witness?.did, config.witnessDid, "live witness DID drifted");
    return {
      release: config.version,
      witness: config.witnessDid
    };
  });

  await runCheck(checks, "release_artifacts", async () => {
    const discovery = requireState(state.discovery, "discovery manifest");
    const installBytes = await fetchBytes(discovery.install?.script, timedFetch);
    assertEqual(sha256(installBytes), config.installerSha256, "live installer bytes drifted");
    const releaseBytes = await fetchBytes(discovery.install?.release?.artifact, timedFetch);
    assertEqual(sha256(releaseBytes), config.releaseSha256, "live release bytes drifted");
    await verifyReleaseSignatureBytes({
      artifactName: config.releaseName,
      publicKeyInfo: config.releasePublicKey,
      releaseBytes,
      signature: await fetchJson(discovery.install?.release?.signature, timedFetch)
    });
    const sbom = await fetchJson(discovery.install?.release?.sbom, timedFetch);
    assertEqual(sbom.type, "dev.nipmod.release.sbom.v1", "release SBOM type mismatch");
    assertEqual(sbom.artifact?.name, config.releaseName, "release SBOM artifact mismatch");
    assertEqual(sbom.artifact?.sha256, config.releaseSha256, "release SBOM digest mismatch");
    if (!Array.isArray(sbom.components) || !sbom.components.some((component) => component.name === "dist/cli.js")) {
      throw new Error("release SBOM missing CLI component");
    }
    const provenance = await fetchJson(discovery.install?.release?.provenance, timedFetch);
    assertEqual(provenance.type, "dev.nipmod.release.provenance.v1", "release provenance type mismatch");
    assertEqual(provenance.artifact?.name, config.releaseName, "release provenance artifact mismatch");
    assertEqual(provenance.artifact?.sha256, config.releaseSha256, "release provenance digest mismatch");
    assertEqual(provenance.signing?.publicKeySpkiSha256, config.releasePublicKey.publicKeySpkiSha256, "release provenance signing key mismatch");
    if (!Array.isArray(provenance.materials) || !provenance.materials.some((material) => material.path === "package.json")) {
      throw new Error("release provenance missing package manifest material");
    }
    return {
      release: config.releaseName,
      releaseMetadata: ["sbom", "provenance"]
    };
  });

  await runCheck(checks, "registry_verified", async () => {
    state.registry = await fetchJson(endpoints.registry, timedFetch);
    if (!Array.isArray(state.registry.packages)) {
      throw new Error("registry packages are not an array");
    }
    const badPackage = state.registry.packages.find((pkg) => !isPublicVerifiedPackage(pkg, config));
    if (badPackage) {
      throw new Error(`registry package is not public verified/100: ${badPackage.name ?? badPackage.canonical ?? "unknown"}`);
    }
    return {
      mode: state.registry.packages.length === 0 ? "empty-public-archive" : "verified-public-packages",
      packages: state.registry.packages.length
    };
  });

  await runCheck(checks, "quorum_receipts", async () => {
    const policy = await fetchJson(endpoints.quorumPolicy, timedFetch);
    const signers = await fetchJson(endpoints.quorumSigners, timedFetch);
    const receipts = await fetchJson(endpoints.quorumReceipts, timedFetch);
    assertEqual(policy.type, "dev.nipmod.quorum-policy.v1", "quorum policy type mismatch");
    assertEqual(signers.type, "dev.nipmod.quorum-signers.v1", "quorum signer type mismatch");
    assertEqual(receipts.type, "dev.nipmod.quorum-receipts.v1", "quorum receipt type mismatch");
    assertEqual(receipts.receipts.length, state.registry.packages.length, "quorum receipt count mismatch");
    for (const pkg of state.registry.packages) {
      assertEqual(pkg.quorum?.status, "passed", `quorum status mismatch for ${pkg.name ?? pkg.canonical}`);
      assertEqual(pkg.quorum?.threshold, 2, `quorum threshold mismatch for ${pkg.name ?? pkg.canonical}`);
      if (!pkg.quorum?.approvedRoles?.includes("release") || !pkg.quorum?.approvedRoles?.includes("security")) {
        throw new Error(`quorum roles missing for ${pkg.name ?? pkg.canonical}`);
      }
    }
    return {
      receipts: receipts.receipts.length,
      signers: signers.signers.length
    };
  });

  await runCheck(checks, "advisory_feed_signature", async () => {
    const feedBytes = await fetchBytes(endpoints.advisories, timedFetch);
    const feed = JSON.parse(feedBytes.toString("utf8"));
    validateAdvisoryFeed(feed, now);
    await verifyAdvisorySignatureBytes({
      feedBytes,
      publicKeyInfo: config.advisoryPublicKey,
      signature: await fetchJson(endpoints.advisoriesSignature, timedFetch)
    });
    return {
      advisories: feed.advisories.length,
      expiresAt: feed.expiresAt
    };
  });

  await runCheck(checks, "transparency_checkpoint", async () => {
    if ((state.registry?.packages ?? []).length === 0) {
      return {
        mode: "empty-public-archive",
        treeSize: 0
      };
    }
    state.checkpoint = await fetchJson(endpoints.checkpoint, timedFetch);
    assertEqual(state.checkpoint.formatVersion, 1, "checkpoint format mismatch");
    assertEqual(state.checkpoint.logId, config.logId, "checkpoint log ID drifted");
    assertTimestampNotFuture(state.checkpoint.generatedAt, now, "checkpoint");
    if (!HEX_SHA256.test(state.checkpoint.rootHash ?? "")) {
      throw new Error("checkpoint root hash is invalid");
    }
    if (!Number.isInteger(state.checkpoint.treeSize) || state.checkpoint.treeSize < 1) {
      throw new Error("checkpoint tree size is invalid");
    }
    for (const pkg of state.registry?.packages ?? []) {
      assertEqual(pkg.proof?.rootHash, state.checkpoint.rootHash, `registry proof root drifted for ${pkg.name ?? pkg.canonical}`);
      assertEqual(pkg.proof?.treeSize, state.checkpoint.treeSize, `registry proof tree size drifted for ${pkg.name ?? pkg.canonical}`);
    }
    return {
      generatedAt: state.checkpoint.generatedAt,
      rootHash: state.checkpoint.rootHash,
      treeSize: state.checkpoint.treeSize
    };
  });

  await runCheck(checks, "witness_health", async () => {
    state.witnessHealth = await fetchJson(endpoints.witnessHealth, timedFetch);
    if (state.witnessHealth.ok !== true) {
      throw new Error("witness health is not ok");
    }
    if ((state.registry?.packages ?? []).length === 0) {
      return {
        lastError: state.witnessHealth.lastError ?? null,
        mode: "empty-public-archive",
        witness: config.witnessDid
      };
    }
    if (state.witnessHealth.lastError !== null) {
      throw new Error(`witness has lastError: ${state.witnessHealth.lastError}`);
    }
    assertFresh(state.witnessHealth.lastRunAt, now, config.witnessMaxAgeMs, "witness");
    assertEqual(state.witnessHealth.lastWitness?.witness, config.witnessDid, "witness DID drifted");
    if (state.checkpoint) {
      assertEqual(state.witnessHealth.lastWitness?.rootHash, state.checkpoint.rootHash, "witness root drifted");
      assertEqual(state.witnessHealth.lastWitness?.treeSize, state.checkpoint.treeSize, "witness tree size drifted");
    }
    return {
      lastRunAt: state.witnessHealth.lastRunAt,
      witness: state.witnessHealth.lastWitness?.witness
    };
  });

  await runCheck(checks, "witness_run_auth", async () => {
    const response = await timedFetch(endpoints.witnessRun, { method: "POST", redirect: "error" });
    if (![401, 403, 503].includes(response.status)) {
      throw new Error(`witness /run accepted unauthenticated request: ${response.status}`);
    }
    return {
      status: response.status
    };
  });

  await runCheck(checks, "node_health", async () => {
    const payload = await fetchJson(endpoints.nodeHealth, timedFetch);
    assertEqual(payload.status, "ok", "node health status mismatch");
    return { url: endpoints.nodeHealth };
  });

  await runCheck(checks, "receive_pack_auth", async () => {
    const result = await assertUnauthenticatedReceivePackBlocked({
      baseUrl: endpoints.nodeUrl,
      fetchFn: timedFetch
    });
    return {
      probes: result.probes.map((probe) => ({
        bytes: probe.bytes,
        label: probe.label,
        status: probe.status
      }))
    };
  });

  const summary = {
    fail: checks.filter((check) => check.status === "fail").length,
    pass: checks.filter((check) => check.status === "pass").length,
    total: checks.length
  };

  return {
    checkedAt: new Date(now).toISOString(),
    checks,
    formatVersion: 1,
    ok: summary.fail === 0,
    summary,
    type: "dev.nipmod.prod-synthetic-monitor.v1"
  };
}

async function readExpectedConfig(rootDir) {
  const version = JSON.parse(await readFile(join(rootDir, "nipmod", "package.json"), "utf8")).version;
  const releaseName = `nipmod-${version}.tgz`;
  const discovery = JSON.parse(await readFile(join(rootDir, "site", "public", ".well-known", "nipmod.json"), "utf8"));
  return {
    advisoryPublicKey: JSON.parse(await readFile(join(rootDir, "tools", "advisory-signing-public-key.json"), "utf8")),
    checkpointMaxAgeMs: DEFAULT_CHECKPOINT_MAX_AGE_MS,
    fetchTimeoutMs: DEFAULT_FETCH_TIMEOUT_MS,
    installerSha256: await readSha(join(rootDir, "site", "public", "install.sh.sha256")),
    logId: discovery.transparency?.logId,
    releaseName,
    releasePublicKey: JSON.parse(await readFile(join(rootDir, "tools", "release-signing-public-key.json"), "utf8")),
    releaseSha256: await readSha(join(rootDir, "site", "public", "releases", `${releaseName}.sha256`)),
    version,
    witnessDid: discovery.witness.did,
    witnessMaxAgeMs: DEFAULT_WITNESS_MAX_AGE_MS
  };
}

async function runCheck(checks, name, fn) {
  const startedAt = Date.now();
  try {
    checks.push({
      data: await fn(),
      durationMs: Date.now() - startedAt,
      name,
      status: "pass"
    });
  } catch (error) {
    checks.push({
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      name,
      status: "fail"
    });
  }
}

async function fetchJson(url, fetchFn, init) {
  const response = await fetchFn(url, init);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json();
}

async function fetchText(url, fetchFn) {
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.text();
}

async function fetchBytes(url, fetchFn) {
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function readSha(path) {
  const digest = (await readFile(path, "utf8")).trim().split(/\s+/)[0];
  if (!HEX_SHA256.test(digest)) {
    throw new Error(`${path} has invalid sha256`);
  }
  return digest;
}

async function verifyAdvisorySignatureBytes({ feedBytes, publicKeyInfo, signature }) {
  if (signature?.type !== "dev.nipmod.advisory.signature.v1") {
    throw new Error("advisory signature type mismatch");
  }
  if (signature.algorithm !== "Ed25519") {
    throw new Error("advisory signature algorithm mismatch");
  }
  if (signature.artifact !== "advisories.json") {
    throw new Error("advisory signature artifact mismatch");
  }
  if (signature.publicKeySpkiSha256 !== publicKeyInfo.publicKeySpkiSha256) {
    throw new Error("advisory signature key drifted");
  }
  const publicKey = createPublicKey({
    format: "der",
    key: Buffer.from(publicKeyInfo.publicKeySpkiBase64, "base64"),
    type: "spki"
  });
  if (!verify(null, feedBytes, publicKey, Buffer.from(signature.signatureBase64, "base64"))) {
    throw new Error("advisory feed signature verification failed");
  }
}

async function verifyReleaseSignatureBytes({ artifactName, publicKeyInfo, releaseBytes, signature }) {
  if (signature?.type !== "dev.nipmod.release.signature.v1") {
    throw new Error("release signature type mismatch");
  }
  if (signature.algorithm !== "Ed25519") {
    throw new Error("release signature algorithm mismatch");
  }
  if (signature.artifact !== artifactName) {
    throw new Error("release signature artifact mismatch");
  }
  if (signature.publicKeySpkiSha256 !== publicKeyInfo.publicKeySpkiSha256) {
    throw new Error("release signature key drifted");
  }
  const publicKey = createPublicKey({
    format: "der",
    key: Buffer.from(publicKeyInfo.publicKeySpkiBase64, "base64"),
    type: "spki"
  });
  if (!verify(null, releaseBytes, publicKey, Buffer.from(signature.signatureBase64, "base64"))) {
    throw new Error("release artifact signature verification failed");
  }
}

function assertFresh(timestamp, now, maxAgeMs, label) {
  const parsed = assertTimestampNotFuture(timestamp, now, label);
  const ageMs = now - parsed;
  if (ageMs > maxAgeMs) {
    throw new Error(`${label} is stale: ${Math.round(ageMs / 1000)}s old`);
  }
}

function assertTimestampNotFuture(timestamp, now, label) {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} timestamp is invalid`);
  }
  if (parsed > now + 5 * 60 * 1000) {
    throw new Error(`${label} timestamp is in the future`);
  }
  return parsed;
}

function requireState(value, label) {
  if (!value) {
    throw new Error(`${label} was not available`);
  }
  return value;
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertIncludes(text, marker, message) {
  if (!text.includes(marker)) {
    throw new Error(message);
  }
}

function assertNoSecretLeak(value, label) {
  const text = JSON.stringify(value);
  if (/Bearer\s+[A-Za-z0-9._~+/=-]{20,}|BEGIN PRIVATE KEY|NIPMOD_SCOUT_NOTIFY_IDENTITY|TOKEN=|SECRET=/i.test(text)) {
    throw new Error(`${label} leaks notification secret material`);
  }
}

function assertPublicKeyMatches(discoveredKey, expectedKey, label) {
  if (!discoveredKey?.publicKeySpkiBase64) {
    throw new Error(`${label} is missing key material`);
  }
  const fingerprintClaim = discoveredKey.spkiSha256 ?? discoveredKey.publicKeySpkiSha256;
  const actualFingerprint = sha256(Buffer.from(discoveredKey.publicKeySpkiBase64, "base64"));
  assertEqual(fingerprintClaim, actualFingerprint, `${label} fingerprint claim mismatch`);
  assertEqual(actualFingerprint, expectedKey.publicKeySpkiSha256, `${label} fingerprint drifted`);
  assertEqual(discoveredKey.publicKeySpkiBase64, expectedKey.publicKeySpkiBase64, `${label} material drifted`);
}

function isPublicVerifiedPackage(pkg, config) {
  return (
    pkg &&
    typeof pkg === "object" &&
    typeof pkg.canonical === "string" &&
    HEX_SHA256.test(pkg.digest ?? "") &&
    SOURCE_COMMIT.test(pkg.sourceCommit ?? "") &&
    SOURCE_TAG.test(pkg.sourceTag ?? "") &&
    pkg.proof?.rootHash &&
    HEX_SHA256.test(pkg.proof.rootHash) &&
    Number.isInteger(pkg.proof?.treeSize) &&
    pkg.proof.treeSize > 0 &&
    Array.isArray(pkg.proof?.witnesses) &&
    pkg.proof.witnesses.includes(config.witnessDid) &&
    pkg.quorum?.status === "passed" &&
    pkg.quorum?.approvals >= pkg.quorum?.threshold &&
    pkg.quorum?.approvedRoles?.includes("release") &&
    pkg.quorum?.approvedRoles?.includes("security") &&
    pkg.trust?.level === "verified" &&
    pkg.trust?.score === 100 &&
    pkg.trust?.evidence?.releaseEventSigned === true &&
    pkg.trust?.evidence?.sourceProvenanceVerified === true &&
    pkg.trust?.evidence?.transparencyLogIncluded === true &&
    pkg.trust?.evidence?.transparencyLogVerified === true &&
    !isInternalArtifact(pkg)
  );
}

function isInternalArtifact(pkg) {
  return [pkg?.name, pkg?.canonical, pkg?.description, pkg?.repo]
    .filter((value) => typeof value === "string")
    .some((value) => value.toLowerCase().includes("probe"));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function createTimedFetch(fetchFn, timeoutMs) {
  return (url, init = {}) =>
    fetchFn(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(timeoutMs)
    });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await runSyntheticMonitor();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}
