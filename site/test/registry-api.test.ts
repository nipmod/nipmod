import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..", "..");
const registryRoot = join(root, "site", "public", "registry");
const registry = JSON.parse(readFileSync(join(registryRoot, "packages.json"), "utf8")) as {
  packages: RegistryPackageLike[];
};

interface RegistryPackageLike {
  canonical: string;
  digest: string;
  proof?: {
    witnesses?: string[];
  };
  sourceRepo: string;
  trust?: {
    level?: string;
  };
  version: string;
}

describe("static registry API", () => {
  test("publishes package documents only for public registry packages", () => {
    const grouped = new Map<string, RegistryPackageLike[]>();
    for (const pkg of registry.packages) {
      grouped.set(pkg.canonical, [...(grouped.get(pkg.canonical) ?? []), pkg]);
    }

    const packagesRoot = join(registryRoot, "packages");
    const packageEntries = existsSync(packagesRoot) ? readdirSync(packagesRoot) : [];
    expect(grouped.size).toBe(registry.packages.length);
    expect(packageEntries).toHaveLength(registry.packages.length === 0 ? 0 : grouped.size);
    for (const [canonical, packages] of grouped) {
      const encoded = encodeCanonicalForRegistryPath(canonical);
      const documentPath = join(registryRoot, "packages", `${encoded}.json`);
      expect(existsSync(documentPath), `${canonical} package document is missing`).toBe(true);

      const document = JSON.parse(readFileSync(documentPath, "utf8"));
      expect(document).toMatchObject({
        canonical,
        formatVersion: 1,
        type: "dev.nipmod.package-document.v1"
      });
      expect(document.distTags.latest).toMatch(/^\d+\.\d+\.\d+$/);
      expect(Object.keys(document.versions).sort()).toEqual(
        packages.map((pkg) => pkg.version).sort((left, right) => left.localeCompare(right))
      );

      for (const pkg of packages) {
        const versionPath = join(registryRoot, "packages", encoded, `${pkg.version}.json`);
        expect(existsSync(versionPath), `${canonical}@${pkg.version} version document is missing`).toBe(true);
        expect(JSON.parse(readFileSync(versionPath, "utf8"))).toMatchObject({
          canonical,
          digest: pkg.digest,
          documentType: "dev.nipmod.package-version.v1",
          formatVersion: 1,
          version: pkg.version
        });
      }
    }
  });

  test("publishes latest dependency and provenance sidecars for each package document", () => {
    for (const pkg of registry.packages) {
      const encoded = encodeCanonicalForRegistryPath(pkg.canonical);
      const document = JSON.parse(readFileSync(join(registryRoot, "packages", `${encoded}.json`), "utf8"));
      if (document.distTags.latest !== pkg.version) {
        continue;
      }

      const dependencies = JSON.parse(readFileSync(join(registryRoot, "packages", encoded, "dependencies.json"), "utf8"));
      const provenance = JSON.parse(readFileSync(join(registryRoot, "packages", encoded, "provenance.json"), "utf8"));

      expect(dependencies).toMatchObject({
        canonical: pkg.canonical,
        formatVersion: 1,
        type: "dev.nipmod.package-dependencies.v1",
        version: pkg.version
      });
      expect(provenance).toMatchObject({
        canonical: pkg.canonical,
        digest: pkg.digest,
        formatVersion: 1,
        sourceRepo: pkg.sourceRepo,
        type: "dev.nipmod.package-provenance.v1",
        version: pkg.version
      });
    }
  });

  test("requires witness evidence for every verified registry package", () => {
    const witnesses = new Set(
      (registry as { transparencyLog?: { witnesses?: Array<{ witness?: string }> } }).transparencyLog?.witnesses
        ?.map((statement) => statement.witness)
        .filter((witness): witness is string => Boolean(witness)) ?? []
    );

    if (registry.packages.length === 0) {
      expect(witnesses.size).toBe(0);
      return;
    }
    expect(witnesses.size).toBeGreaterThan(0);
    for (const pkg of registry.packages.filter((candidate) => candidate.trust?.level === "verified")) {
      expect(pkg.proof?.witnesses?.some((witness) => witnesses.has(witness)), `${pkg.canonical}@${pkg.version}`).toBe(
        true
      );
    }
  });
});

function encodeCanonicalForRegistryPath(canonical: string): string {
  return Buffer.from(canonical, "utf8").toString("base64url");
}
