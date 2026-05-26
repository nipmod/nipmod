import { createHash, createPublicKey, verify } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..", "..");
const siteRoot = join(root, "site");
const manifest = JSON.parse(readFileSync(join(siteRoot, "public", ".well-known", "nipmod.json"), "utf8"));
const releaseKey = JSON.parse(readFileSync(join(root, "tools", "release-signing-public-key.json"), "utf8"));
const advisoryKey = JSON.parse(readFileSync(join(root, "tools", "advisory-signing-public-key.json"), "utf8"));
const version = JSON.parse(readFileSync(join(root, "nipmod", "package.json"), "utf8")).version;
const shortInstallerCommand = "curl https://nipmod.com/i|bash";

describe("nipmod discovery manifest", () => {
  test("publishes a stable API first discovery document", () => {
    expect(manifest).toMatchObject({
      formatVersion: 1,
      description: "The package layer for AI agents.",
      homepage: "https://nipmod.com",
      name: "Nipmod",
      previewImage: "https://nipmod.com/nipmod-logo.png",
      trustPage: "https://nipmod.com/trust",
      type: "dev.nipmod.discovery.v1"
    });
    expect(Object.keys(manifest).sort()).toEqual([
      "advisories",
      "advisoriesPublicKey",
      "advisoriesSignature",
      "agent",
      "api",
      "archive",
      "baseAgents",
      "description",
      "docs",
      "externalIndex",
      "formatVersion",
      "homepage",
      "install",
      "mcp",
      "name",
      "node",
      "previewImage",
      "quorum",
      "registry",
      "review",
      "sources",
      "transparency",
      "trustPage",
      "type",
      "witness"
    ]);
    expect(JSON.stringify(manifest)).not.toContain("/integrations/");
  });

  test("keeps docs and agent commands focused on API access", () => {
    expect(manifest.docs).toEqual({
      architecture: "https://nipmod.com/architecture",
      api: "https://nipmod.com/api-access",
      apiSpec: "https://nipmod.com/api/openapi",
      baseAgents: "https://nipmod.com/base-agents",
      betaKeyApi: "https://nipmod.com/api/keys/beta",
      examples: "https://nipmod.com/examples",
      externalInspectApi: "https://nipmod.com/api/inspect",
      externalInstallPlanApi: "https://nipmod.com/api/install-plan",
      externalResolveApi: "https://nipmod.com/api/resolve",
      externalSearchApi: "https://nipmod.com/api/search",
      mcp: "https://nipmod.com/mcp",
      packageIntelligenceConfirmApi: "https://nipmod.com/api/archive/confirm",
      packageIntelligencePrepareApi: "https://nipmod.com/api/archive/prepare",
      packageIntelligenceSearchApi: "https://nipmod.com/api/archive/search",
      packageIntelligenceStatusApi: "https://nipmod.com/api/archive/status",
      packages: "https://nipmod.com/packages",
      quickstart: "https://nipmod.com/quickstart",
      security: "https://nipmod.com/security",
      sourceHealthApi: "https://nipmod.com/api/sources/health",
      sources: "https://nipmod.com/sources",
      status: "https://nipmod.com/status",
      home: "https://nipmod.com",
      trust: "https://nipmod.com/trust"
    });
    expect(manifest.agent.runbook).toBe("https://nipmod.com/api-access");
    expect(manifest.agent.workflow).not.toContain("setupCursorOneClick");
    expect(manifest.agent.workflow).not.toContain("setupPublish");
    expect(manifest.agent.workflow).not.toContain("publishDryRun");
    expect(manifest.agent.workflow).not.toContain("claimVerify");
    expect(manifest.agent.workflow).toContain("externalSearch");
    expect(manifest.agent.workflow).toContain("externalResolve");
    expect(manifest.agent.workflow).toContain("externalInstallPlan");
    expect(manifest.agent.workflow).toContain("issueBetaKey");
    expect(manifest.agent.commands).toMatchObject({
      access: "Free beta keys can be issued by POST /api/keys/beta and sent as x-nipmod-api-key or Authorization: Bearer <key>. Package intelligence API calls require a key.",
      externalInspect: "GET https://nipmod.com/api/inspect?source=npm&name=<package-name> with x-nipmod-api-key",
      externalInstallPlan: "GET https://nipmod.com/api/install-plan?source=npm&name=<package-name> with x-nipmod-api-key",
      externalResolve: "GET https://nipmod.com/api/resolve?q=<query>&sources=npm,pypi,github,huggingface-model,huggingface-dataset,mcp with x-nipmod-api-key",
      externalSearch: "GET https://nipmod.com/api/search?q=<query>&sources=npm,pypi,github,huggingface-model,huggingface-dataset,mcp with x-nipmod-api-key",
      issueBetaKey: "POST https://nipmod.com/api/keys/beta",
      packageIntelligencePrepare: "GET https://nipmod.com/api/archive/prepare?source=npm&name=<package-name> with x-nipmod-api-key",
      packageIntelligenceStatus: "GET https://nipmod.com/api/archive/status with x-nipmod-api-key",
      readLlms: "GET https://nipmod.com/llms.txt",
      readOpenApi: "GET https://nipmod.com/api/openapi with x-nipmod-api-key",
      sourceHealth: "GET https://nipmod.com/api/sources/health with x-nipmod-api-key"
    });
    expect(manifest.api.access).toMatchObject({
      keyRequired: true,
      publicBeta: false,
      rateLimited: true
    });
    expect(manifest.baseAgents).toMatchObject({
      agentPrompts: "https://nipmod.com/agent-prompts.json",
      page: "https://nipmod.com/base-agents",
      preflightSpec: "https://nipmod.com/base-agent-preflight.json",
      status: "integration_path_not_official_listing"
    });
    expect(manifest.baseAgents.doesNot).toContain("claim official Base approval");
    expect(manifest.baseAgents.readiness).toContain("machine-readable preflight spec");
    expect(manifest.agent.commands.setupCodexMcp).toBeUndefined();
    expect(manifest.agent.commands.setupHermesBundle).toBeUndefined();
    expect(manifest.agent.commands.setupPublish).toBeUndefined();
    expect(manifest.agent.commands.publishDryRun).toBeUndefined();
    expect(manifest.agent.commands.claimVerify).toBeUndefined();
  });

  test("pins release artifacts to committed files", () => {
    expect(manifest.install.script).toBe("https://nipmod.com/install.sh");
    expect(manifest.install.scriptSha256).toBe(sha256(join(siteRoot, "public", "install.sh")));
    expect(manifest.install.shortCommand).toBe(shortInstallerCommand);
    expect(manifest.install.release).toMatchObject({
      artifact: `https://nipmod.com/releases/nipmod-${version}.tgz`,
      artifactSha256: sha256FromChecksum(join(siteRoot, "public", "releases", `nipmod-${version}.tgz.sha256`)),
      provenance: `https://nipmod.com/releases/nipmod-${version}.tgz.provenance.json`,
      sbom: `https://nipmod.com/releases/nipmod-${version}.tgz.sbom.json`,
      signature: `https://nipmod.com/releases/nipmod-${version}.tgz.sig`,
      version
    });
    expect(manifest.install.release.publicKey).toEqual({
      algorithm: releaseKey.algorithm,
      publicKeySpkiBase64: releaseKey.publicKeySpkiBase64,
      spkiSha256: releaseKey.publicKeySpkiSha256
    });
  });

  test("manifest release signature metadata matches published key material", () => {
    const artifactName = `nipmod-${version}.tgz`;
    const signature = JSON.parse(readFileSync(join(siteRoot, "public", "releases", `${artifactName}.sig`), "utf8"));
    const publicKeyDer = Buffer.from(manifest.install.release.publicKey.publicKeySpkiBase64, "base64");
    const publicKeyHash = createHash("sha256").update(publicKeyDer).digest("hex");

    expect(manifest.install.release.publicKey.algorithm).toBe("Ed25519");
    expect(publicKeyHash).toBe(releaseKey.publicKeySpkiSha256);
    expect(signature.artifact).toBe(artifactName);
    expect(signature.publicKeySpkiSha256).toBe(releaseKey.publicKeySpkiSha256);
    expect(signature.signatureBase64).toMatch(/^[A-Za-z0-9+/=]+$/);
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

  test("publishes external package source coverage and write boundaries", () => {
    expect(manifest.externalIndex.sources).toEqual([
      "npm",
      "pypi",
      "github",
      "huggingface-model",
      "huggingface-dataset",
      "mcp"
    ]);
    expect(manifest.sources).toEqual(manifest.externalIndex.sources);
    expect(manifest.api).toMatchObject({
      baseUrl: "https://nipmod.com",
      description: "Hosted package discovery, trust checks and safe install plans for agents.",
      betaKey: "https://nipmod.com/api/keys/beta",
      installPlan: "https://nipmod.com/api/install-plan",
      openapi: "https://nipmod.com/api/openapi",
      search: "https://nipmod.com/api/search",
      writeBoundary: "Hosted API calls do not write to a caller workspace."
    });
    expect(manifest.archive).toMatchObject({
      confirm: "https://nipmod.com/api/archive/confirm",
      prepare: "https://nipmod.com/api/archive/prepare",
      prepareStores: false,
      search: "https://nipmod.com/api/archive/search",
      status: "https://nipmod.com/api/archive/status"
    });
    expect(manifest.externalIndex.packageIntelligence.writeBoundary).toContain("Durable writes require");
    expect(manifest.mcp.remoteEndpoint).toBe("https://nipmod.com/api/mcp");
    expect(manifest.mcp.remoteTools).toContain("nipmod.resolve");
    expect(manifest.mcp.remoteNotExposed).toContain("nipmod.install");
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
        "gitlawb.com",
        "nipmod.com",
        "node.nipmod.com",
        "nipmod-witness.fly.dev"
      ]).toContain(url.hostname);
    }
  });
});

function sha256(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function sha256FromChecksum(file: string): string {
  return readFileSync(file, "utf8").trim().split(/\s+/)[0] ?? "";
}

function collectUrls(value: unknown): string[] {
  if (typeof value === "string") {
    return value.startsWith("https://") ? [value] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectUrls);
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectUrls);
  }

  return [];
}
