import { createHash, createPublicKey, verify } from "node:crypto";
import { execFileSync } from "node:child_process";
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

describe("nipmod discovery manifest", () => {
  test("publishes a small stable agent discovery document", () => {
    expect(manifest).toMatchObject({
      formatVersion: 1,
      homepage: "https://nipmod.com",
      name: "nipmod",
      trustPage: "https://nipmod.com/trust",
      type: "dev.nipmod.discovery.v1"
    });
    expect(Object.keys(manifest).sort()).toEqual([
	      "advisories",
	      "advisoriesPublicKey",
	      "advisoriesSignature",
	      "formatVersion",
      "homepage",
      "install",
      "name",
      "node",
      "registry",
      "transparency",
      "trustPage",
      "type",
      "witness"
    ]);
  });

  test("keeps nested objects exact and discovery only", () => {
	    expect(Object.keys(manifest.registry).sort()).toEqual(["source", "url"]);
	    expect(manifest.advisories).toBe("https://nipmod.com/advisories.json");
	    expect(manifest.advisoriesSignature).toBe("https://nipmod.com/advisories.json.sig");
	    expect(Object.keys(manifest.advisoriesPublicKey).sort()).toEqual([
	      "algorithm",
	      "publicKeySpkiBase64",
	      "spkiSha256"
	    ]);
    expect(Object.keys(manifest.node).sort()).toEqual(["health", "url"]);
    expect(Object.keys(manifest.witness).sort()).toEqual(["did", "health", "statements"]);
    expect(Object.keys(manifest.transparency).sort()).toEqual(["checkpoint", "log", "logId"]);
    expect(Object.keys(manifest.install).sort()).toEqual(["release", "script", "scriptSha256"]);
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
      source: registry.source,
      url: "https://nipmod.com/registry/packages.json"
    });
    expect(manifest.transparency).toEqual({
      checkpoint: "https://nipmod.com/transparency/checkpoint.json",
      log: "https://nipmod.com/transparency/log.json",
      logId: checkpoint.logId
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
      expect(["nipmod.com", "node.nipmod.com", "nipmod-witness.fly.dev"]).toContain(url.hostname);
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
