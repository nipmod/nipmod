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
const verifyInstallerCommand =
  "curl -fLO https://nipmod.com/install.sh\ncurl -fLO https://nipmod.com/install.sh.sha256\nshasum -a 256 -c install.sh.sha256\nbash install.sh";

describe("nipmod discovery manifest", () => {
  test("publishes a stable API first discovery document", () => {
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
      "claims",
      "docs",
      "externalIndex",
      "formatVersion",
      "homepage",
      "install",
      "mcp",
      "name",
      "node",
      "quorum",
      "registry",
      "review",
      "transparency",
      "trustPage",
      "type",
      "witness"
    ]);
    expect(JSON.stringify(manifest)).not.toContain("/integrations/");
  });

  test("keeps docs and agent commands focused on API access", () => {
    expect(manifest.docs).toEqual({
      api: "https://nipmod.com/api-access",
      apiSpec: "https://nipmod.com/api/openapi",
      audit: "https://nipmod.com/audit",
      createPackage: "https://nipmod.com/package",
      demo: "https://nipmod.com/demo",
      docs: "https://nipmod.com/quickstart#docs",
      examples: "https://nipmod.com/examples",
      externalInspectApi: "https://nipmod.com/api/inspect",
      externalInstallPlanApi: "https://nipmod.com/api/install-plan",
      externalResolveApi: "https://nipmod.com/api/resolve",
      externalSearchApi: "https://nipmod.com/api/search",
      install: "https://nipmod.com/quickstart#install",
      mcp: "https://nipmod.com/mcp",
      packageIntelligenceConfirmApi: "https://nipmod.com/api/archive/confirm",
      packageIntelligencePrepareApi: "https://nipmod.com/api/archive/prepare",
      packageIntelligenceSearchApi: "https://nipmod.com/api/archive/search",
      packageIntelligenceStatusApi: "https://nipmod.com/api/archive/status",
      packages: "https://nipmod.com/packages",
      platforms: "https://nipmod.com/platforms",
      security: "https://nipmod.com/security",
      setup: "https://nipmod.com/setup",
      sources: "https://nipmod.com/sources",
      status: "https://nipmod.com/status",
      trust: "https://nipmod.com/trust"
    });
    expect(manifest.agent.runbook).toBe("https://nipmod.com/api-access");
    expect(manifest.agent.workflow).not.toContain("setupCursorOneClick");
    expect(manifest.agent.workflow).toContain("externalResolve");
    expect(manifest.agent.workflow).toContain("externalInstallPlan");
    expect(manifest.agent.commands).toMatchObject({
      externalInspect: "GET https://nipmod.com/api/inspect?source=npm&name=<package-name>",
      externalInstallPlan: "GET https://nipmod.com/api/install-plan?source=npm&name=<package-name>",
      externalResolve: "GET https://nipmod.com/api/resolve?q=<query>&sources=npm,pypi,github,huggingface-model,huggingface-dataset,mcp",
      externalSearch: "GET https://nipmod.com/api/search?q=<query>&sources=npm,pypi,github,huggingface-model,huggingface-dataset,mcp",
      install: shortInstallerCommand,
      packageIntelligencePrepare: "GET https://nipmod.com/api/archive/prepare?source=npm&name=<package-name>",
      packageIntelligenceStatus: "GET https://nipmod.com/api/archive/status",
      verifyInstaller: verifyInstallerCommand
    });
    expect(manifest.agent.commands.setupCodexMcp).toBeUndefined();
    expect(manifest.agent.commands.setupHermesBundle).toBeUndefined();
  });

  test("pins release artifacts to committed files", () => {
    expect(manifest.install.script).toBe("https://nipmod.com/install.sh");
    expect(manifest.install.scriptSha256).toBe(sha256(join(siteRoot, "public", "install.sh")));
    expect(manifest.install.shortCommand).toBe(shortInstallerCommand);
    expect(manifest.install.release).toMatchObject({
      artifact: `https://nipmod.com/releases/nipmod-${version}.tgz`,
      artifactSha256: sha256FromChecksum(join(siteRoot, "public", "releases", `nipmod-${version}.tgz.sha256`)),
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
