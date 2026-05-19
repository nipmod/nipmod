import { execFileSync } from "node:child_process";
import { createHash, createPublicKey, verify } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..", "..");
const siteRoot = join(root, "site");
const manifestPath = join(siteRoot, "public", ".well-known", "nipmod.json");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const registry = JSON.parse(readFileSync(join(siteRoot, "public", "registry", "packages.json"), "utf8"));
const checkpoint = JSON.parse(readFileSync(join(siteRoot, "public", "transparency", "checkpoint.json"), "utf8"));
const releaseKey = JSON.parse(readFileSync(join(root, "tools", "release-signing-public-key.json"), "utf8"));
const advisoryKey = JSON.parse(readFileSync(join(root, "tools", "advisory-signing-public-key.json"), "utf8"));
const version = JSON.parse(readFileSync(join(root, "nipmod", "package.json"), "utf8")).version;
const agentDemoPackage = "pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0";
const shortInstallerCommand = "curl -fsSLO https://nipmod.com/install.sh && bash install.sh";
const verifyInstallerCommand =
  "curl -fLO https://nipmod.com/install.sh\ncurl -fLO https://nipmod.com/install.sh.sha256\nshasum -a 256 -c install.sh.sha256\nbash install.sh";

describe("nipmod discovery manifest", () => {
  test("publishes a small stable agent discovery document", () => {
    expect(manifest).toMatchObject({
      formatVersion: 1,
      homepage: "https://nipmod.com",
      name: "Nipmod",
      trustPage: "https://nipmod.com/trust",
      type: "dev.nipmod.discovery.v1"
    });
    expect(Object.keys(manifest).sort()).toEqual([
      "advisories",
      "advisoriesPublicKey",
      "advisoriesSignature",
      "agent",
      "bankr",
      "claims",
      "docs",
      "formatVersion",
      "homepage",
      "install",
      "mcp",
      "name",
      "node",
      "registry",
      "review",
      "scout",
      "transparency",
      "trustPage",
      "type",
      "witness"
    ]);
  });

  test("keeps nested objects exact and discovery only", () => {
    expect(Object.keys(manifest.registry).sort()).toEqual([
      "badgeTemplate",
      "canonicalEncoding",
      "dependenciesTemplate",
      "gitlawbOwnerPageTemplate",
      "gitlawbPackagePageTemplate",
      "packageDocumentTemplate",
      "packageVersionTemplate",
      "provenanceTemplate",
      "source",
      "url"
    ]);
    expect(manifest.advisories).toBe("https://nipmod.com/advisories.json");
    expect(manifest.advisoriesSignature).toBe("https://nipmod.com/advisories.json.sig");
    expect(Object.keys(manifest.advisoriesPublicKey).sort()).toEqual([
      "algorithm",
      "publicKeySpkiBase64",
      "spkiSha256"
    ]);
    expect(Object.keys(manifest.docs).sort()).toEqual([
      "agents",
      "audit",
      "bankr",
      "createPackage",
      "docs",
      "install",
      "mcp",
      "packages",
      "security",
      "setup",
      "trust"
    ]);
    expect(Object.keys(manifest.claims).sort()).toEqual([
      "candidatePage",
      "index",
      "indexCommand",
      "verifyCommand"
    ]);
    expect(Object.keys(manifest.scout).sort()).toEqual([
      "candidates",
      "draft",
      "draftParam",
      "drafts",
      "health",
      "intervalMs",
      "last",
      "notifications",
      "patch",
      "patchParam",
      "sourceNodes"
    ]);
    expect(Object.keys(manifest.agent).sort()).toEqual(["commands", "llms", "runbook", "workflow"]);
    expect(Object.keys(manifest.bankr).sort()).toEqual(["app", "coin", "freeServices", "proof", "skill"]);
    expect(Object.keys(manifest.bankr.skill).sort()).toEqual([
      "agentProof",
      "catalogStatus",
      "catalogSubmission",
      "githubFolder",
      "publicSkill",
      "source"
    ]);
    expect(Object.keys(manifest.bankr.freeServices).sort()).toEqual(["map", "services", "status"]);
    expect(Object.keys(manifest.bankr.proof).sort()).toEqual(["agentWorkflow", "expectedSteps", "package"]);
    expect(Object.keys(manifest.agent.commands).sort()).toEqual([
      "addPackage",
      "audit",
      "claimIndex",
      "claimVerify",
      "doctor",
      "inspect",
      "install",
      "installPackage",
      "installPlan",
      "mcpControlledInstall",
      "mcpDemo",
      "packagePr",
      "publishDryRun",
      "sbom",
      "search",
      "setupClaudeMcp",
      "setupCodexMcp",
      "setupOpenCodeMcp",
      "setupPublish",
      "verifyInstaller",
      "view"
    ]);
    expect(Object.keys(manifest.mcp).sort()).toEqual(["demoPackage", "docs", "installConfirmation", "serverCommand", "tools"]);
    expect(Object.keys(manifest.node).sort()).toEqual(["health", "url"]);
    expect(Object.keys(manifest.witness).sort()).toEqual(["did", "health", "statements"]);
    expect(Object.keys(manifest.transparency).sort()).toEqual(["checkpoint", "log", "logId"]);
    expect(Object.keys(manifest.review).sort()).toEqual([
      "evidenceLedger",
      "evidenceManifest",
      "launch",
      "packet",
      "packetMarkdown",
      "proofTranscript"
    ]);
    expect(Object.keys(manifest.install).sort()).toEqual(["release", "script", "scriptSha256", "shortCommand", "verifyCommand"]);
    expect(Object.keys(manifest.install.release).sort()).toEqual([
      "artifact",
      "artifactSha256",
      "publicKey",
      "signature",
      "version"
    ]);
    expect(Object.keys(manifest.install.release.publicKey).sort()).toEqual([
      "algorithm",
      "publicKeySpkiBase64",
      "spkiSha256"
    ]);
    expect(JSON.stringify(manifest)).not.toMatch(/rootHash|treeSize|verifiedPackages/i);
  });

  test("pins install and release artifacts to committed files", () => {
    expect(manifest.install.script).toBe("https://nipmod.com/install.sh");
    expect(manifest.install.scriptSha256).toBe(sha256(join(siteRoot, "public", "install.sh")));
    expect(manifest.install.release).toMatchObject({
      artifact: `https://nipmod.com/releases/nipmod-${version}.tgz`,
      artifactSha256: sha256(join(siteRoot, "public", "releases", `nipmod-${version}.tgz`)),
      signature: `https://nipmod.com/releases/nipmod-${version}.tgz.sig`,
      version
    });
    expect(manifest.install.release.publicKey).toEqual({
      algorithm: releaseKey.algorithm,
      publicKeySpkiBase64: releaseKey.publicKeySpkiBase64,
      spkiSha256: releaseKey.publicKeySpkiSha256
    });
  });

  test("manifest release signature can be verified from published manifest key material", () => {
    const artifactName = `nipmod-${version}.tgz`;
    const artifact = readFileSync(join(siteRoot, "public", "releases", artifactName));
    const signature = JSON.parse(readFileSync(join(siteRoot, "public", "releases", `${artifactName}.sig`), "utf8"));
    const publicKeyDer = Buffer.from(manifest.install.release.publicKey.publicKeySpkiBase64, "base64");
    const publicKeyHash = createHash("sha256").update(publicKeyDer).digest("hex");

    expect(manifest.install.release.publicKey.algorithm).toBe("Ed25519");
    expect(manifest.install.release.publicKey.spkiSha256).toBe(releaseKey.publicKeySpkiSha256);
    expect(publicKeyHash).toBe(releaseKey.publicKeySpkiSha256);
    expect(signature.artifact).toBe(artifactName);
    expect(signature.publicKeySpkiSha256).toBe(releaseKey.publicKeySpkiSha256);
    expect(
      verify(
        null,
        artifact,
        createPublicKey({
          format: "der",
          key: publicKeyDer,
          type: "spki"
        }),
        Buffer.from(signature.signatureBase64, "base64")
      )
    ).toBe(true);
  });

  test("manifest advisory signature can be verified from published manifest key material", () => {
    const advisories = readFileSync(join(siteRoot, "public", "advisories.json"));
    const signature = JSON.parse(readFileSync(join(siteRoot, "public", "advisories.json.sig"), "utf8"));
    const publicKeyDer = Buffer.from(manifest.advisoriesPublicKey.publicKeySpkiBase64, "base64");

    expect(signature).toMatchObject({
      algorithm: "Ed25519",
      artifact: "advisories.json",
      publicKeySpkiSha256: advisoryKey.publicKeySpkiSha256,
      type: "dev.nipmod.advisory.signature.v1"
    });
    expect(manifest.advisoriesPublicKey).toEqual({
      algorithm: advisoryKey.algorithm,
      publicKeySpkiBase64: advisoryKey.publicKeySpkiBase64,
      spkiSha256: advisoryKey.publicKeySpkiSha256
    });
    expect(
      verify(
        null,
        advisories,
        createPublicKey({
          format: "der",
          key: publicKeyDer,
          type: "spki"
        }),
        Buffer.from(signature.signatureBase64, "base64")
      )
    ).toBe(true);
  });

  test("installer dry run matches the manifest release", () => {
    const output = execFileSync("bash", [join(siteRoot, "public", "install.sh")], {
      encoding: "utf8",
      env: {
        ...process.env,
        NIPMOD_DRY_RUN: "1"
      }
    });

    expect(output).toContain(`Installing nipmod ${manifest.install.release.version}`);
    expect(output).toContain(`Package: ${manifest.install.release.artifact}`);
    expect(output).toContain(`Signature: ${manifest.install.release.signature}`);
  });

  test("matches the verified registry and transparency roots", () => {
    expect(manifest.registry).toEqual({
      badgeTemplate: "https://nipmod.com/badge/{owner}/{repo}",
      canonicalEncoding: "base64url(canonical package id), no padding",
      dependenciesTemplate: "https://nipmod.com/registry/packages/{encodedCanonical}/dependencies.json",
      gitlawbOwnerPageTemplate: "https://nipmod.com/gitlawb/{owner}",
      gitlawbPackagePageTemplate: "https://nipmod.com/gitlawb/{owner}/{repo}",
      packageDocumentTemplate: "https://nipmod.com/registry/packages/{encodedCanonical}.json",
      packageVersionTemplate: "https://nipmod.com/registry/packages/{encodedCanonical}/{version}.json",
      provenanceTemplate: "https://nipmod.com/registry/packages/{encodedCanonical}/provenance.json",
      source: registry.source,
      url: "https://nipmod.com/registry/packages.json"
    });
    expect(manifest.transparency).toEqual({
      checkpoint: "https://nipmod.com/transparency/checkpoint.json",
      log: "https://nipmod.com/transparency/log.json",
      logId: checkpoint.logId
    });
    expect(manifest.review).toEqual({
      evidenceLedger: "https://nipmod.com/review/evidence-ledger.json",
      evidenceManifest: "https://nipmod.com/review/evidence-manifest.json",
      launch: "https://nipmod.com/launch",
      packet: "https://nipmod.com/review/packet.json",
      packetMarkdown: "https://nipmod.com/review/packet.md",
      proofTranscript: "https://nipmod.com/proof/transcript.json"
    });
    expect(manifest.scout).toEqual({
      candidates: "https://nipmod.com/scout/candidates",
      draft: "https://nipmod.com/scout/draft",
      draftParam: "repo",
      drafts: "https://nipmod.com/scout/drafts",
      health: "https://nipmod.com/scout/health",
      intervalMs: 300000,
      last: "https://nipmod.com/scout/last",
      notifications: "https://nipmod.com/scout/notifications",
      patch: "https://nipmod.com/scout/patch",
      patchParam: "repo",
      sourceNodes: ["https://node.nipmod.com", "https://node.gitlawb.com", "https://node2.gitlawb.com"]
    });
  });

  test("publishes a complete agent runbook from the machine manifest", () => {
    expect(manifest.docs).toEqual({
      agents: "https://nipmod.com/agents",
      audit: "https://nipmod.com/audit",
      bankr: "https://nipmod.com/bankr",
      createPackage: "https://nipmod.com/package",
      docs: "https://nipmod.com/quickstart#docs",
      install: "https://nipmod.com/quickstart#install",
      mcp: "https://nipmod.com/mcp",
      packages: "https://nipmod.com/packages",
      security: "https://nipmod.com/security",
      setup: "https://nipmod.com/setup",
      trust: "https://nipmod.com/trust"
    });
    expect(manifest.agent.llms).toBe("https://nipmod.com/llms.txt");
    expect(manifest.agent.runbook).toBe("https://nipmod.com/agents");
    expect(manifest.agent.workflow).toEqual([
      "install",
      "setupCodexMcp",
      "setupClaudeMcp",
      "setupOpenCodeMcp",
      "verifyInstaller",
      "setupPublish",
      "doctor",
      "search",
      "inspect",
      "view",
      "installPlan",
      "mcpDemo",
      "mcpControlledInstall",
      "installPackage",
      "addPackage",
      "audit",
      "sbom",
      "publishDryRun",
      "claimVerify",
      "claimIndex",
      "packagePr"
    ]);
    expect(manifest.agent.commands).toEqual({
      addPackage: `nipmod add ${agentDemoPackage} --online`,
      audit: "nipmod audit --online",
      claimIndex: "nipmod claim index --node https://node.nipmod.com --json",
      claimVerify: "nipmod claim verify gitlawb://did:key:.../repo --json",
      doctor: "nipmod doctor --online",
      inspect: `nipmod inspect ${agentDemoPackage} --json`,
      install: shortInstallerCommand,
      installPlan: `nipmod install --plan ${agentDemoPackage} --json`,
      mcpControlledInstall:
        "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"nipmod.install\",\"arguments\":{\"specifier\":\"gitlawb-repo-reader\",\"confirmInstall\":\"write-lockfile\"}}}",
      mcpDemo:
        "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"nipmod.demo\",\"arguments\":{\"host\":\"Codex\",\"package\":\"gitlawb-repo-reader\"}}}",
      installPackage: `nipmod install ${agentDemoPackage}`,
      packagePr: "nipmod package pr gitlawb://did:key:.../repo --dir repo-package-pr --json",
      publishDryRun: "nipmod publish . --dry-run --json",
      sbom: "nipmod sbom --json",
      search: "nipmod search gitlawb --online",
      setupClaudeMcp: "claude mcp add --transport stdio --scope project nipmod -- nipmod mcp serve",
      setupCodexMcp: "codex mcp add nipmod -- nipmod mcp serve",
      setupOpenCodeMcp:
        "cat > opencode.json <<'JSON'\n{\n  \"$schema\": \"https://opencode.ai/config.json\",\n  \"mcp\": {\n    \"nipmod\": {\n      \"type\": \"local\",\n      \"command\": [\"nipmod\", \"mcp\", \"serve\"],\n      \"enabled\": true\n    }\n  }\n}\nJSON",
      setupPublish: "nipmod setup gitlawb",
      view: "nipmod view gitlawb-repo-reader --json",
      verifyInstaller: verifyInstallerCommand
    });
    expect(manifest.mcp).toEqual({
      demoPackage: "gitlawb-repo-reader",
      docs: "https://nipmod.com/mcp",
      installConfirmation: "confirmInstall must be write-lockfile before nipmod.install writes a local lockfile",
      serverCommand: "nipmod mcp serve",
      tools: [
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
        "nipmod.package_patch",
        "nipmod.verify",
        "nipmod.audit",
        "nipmod.sbom",
        "nipmod.explain"
      ]
    });
  });

  test("only exposes allowlisted https endpoints", () => {
    const urls = collectUrls(manifest);
    expect(urls.length).toBeGreaterThan(0);
    for (const value of urls) {
      const url = new URL(value);
      expect(url.protocol).toBe("https:");
      expect(url.username).toBe("");
      expect(url.password).toBe("");
      expect(url.search).toBe("");
      expect([
        "github.com",
        "bankr.bot",
        "gitlawb.com",
        "nipmod.com",
        "node.gitlawb.com",
        "node.nipmod.com",
        "node2.gitlawb.com",
        "nipmod-scout.fly.dev",
        "nipmod-witness.fly.dev"
      ]).toContain(url.hostname);
    }
  });

  test("pins public node and witness endpoints without secrets or local paths", () => {
    expect(manifest.node).toEqual({
      health: "https://node.nipmod.com/health",
      url: "https://node.nipmod.com"
    });
    expect(manifest.witness).toEqual({
      did: "did:key:z6Mkv8WH5QeiZU1sJwGrCs8xe35AiH4gMfAy86zFMiEkewWJ",
      health: "https://nipmod-witness.fly.dev/health",
      statements: "https://nipmod-witness.fly.dev/witness-statements.json"
    });
    expect(JSON.stringify(manifest)).not.toMatch(/token|secret|private|file:|localhost|127\.0\.0\.1/i);
  });
});

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function collectUrls(value: unknown): string[] {
  if (typeof value === "string" && value.startsWith("https://")) {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectUrls);
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectUrls);
  }
  return [];
}
