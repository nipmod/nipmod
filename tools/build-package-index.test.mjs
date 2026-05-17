import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  assertImmutableDigests,
  buildRegistryIndex,
  buildBlobUrl,
  buildPublicPackageDocuments,
  deriveTrust,
  encodeCanonicalForRegistryPath,
  hasVerifiedReleaseEvent,
  assertNoMissingPackages,
  normalizeBaseUrl,
  readPreviousIndex,
  safeBlobPath,
  writePackageDocuments
} from "./build-package-index.mjs";

const emptyPermissions = {
  env: 0,
  exec: false,
  filesystem: 0,
  mcpTools: 0,
  network: 0,
  postinstall: false,
  secrets: 0
};

describe("package indexer rules", () => {
  test("does not call unsigned release metadata verified", () => {
    const trust = deriveTrust(
      {
        artifactDigestVerified: true,
        bundleSignatureVerified: true,
        immutableSnapshotMatched: true,
        publisherMatchesCanonical: true,
        releaseEventSigned: false,
        sourceProvenanceVerified: false,
        transparencyLogIncluded: false,
        transparencyLogVerified: false
      },
      emptyPermissions
    );

    expect(trust.level).toBe("review");
    expect(trust.warnings).toContain("Release event missing or invalid");
  });

  test("does not call signed releases verified until transparency log inclusion is verified", () => {
    const trust = deriveTrust(
      {
        artifactDigestVerified: true,
        bundleSignatureVerified: true,
        immutableSnapshotMatched: true,
        publisherMatchesCanonical: true,
        releaseEventSigned: true,
        sourceProvenanceVerified: true,
        transparencyLogIncluded: false,
        transparencyLogVerified: false
      },
      emptyPermissions
    );
    const verified = deriveTrust(
      {
        ...trust.evidence,
        transparencyLogIncluded: true,
        transparencyLogVerified: true
      },
      emptyPermissions
    );

    expect(trust.level).toBe("signed");
    expect(trust.score).toBe(90);
    expect(trust.warnings).toContain("Witnessed checkpoint pending");
    expect(verified.level).toBe("verified");
    expect(verified.score).toBe(100);
  });

  test("does not call witnessed releases verified without source provenance", () => {
    const trust = deriveTrust(
      {
        artifactDigestVerified: true,
        bundleSignatureVerified: true,
        immutableSnapshotMatched: true,
        publisherMatchesCanonical: true,
        releaseEventSigned: true,
        sourceProvenanceVerified: false,
        transparencyLogIncluded: true,
        transparencyLogVerified: true
      },
      emptyPermissions
    );

    expect(trust.level).not.toBe("verified");
    expect(trust.score).toBeLessThan(100);
    expect(trust.warnings).toContain("Source tag could not be verified");
  });

  test("fails if a known package version points to a new digest", () => {
    const previous = indexFixture("a".repeat(64));
    const next = indexFixture("b".repeat(64));

    expect(() => assertImmutableDigests(previous, next)).toThrow("immutable digest changed");
  });

  test("fails if a known package version disappears from the next registry", () => {
    const previous = indexFixture("a".repeat(64));
    const next = { ...previous, packages: [] };

    expect(() => assertNoMissingPackages(previous, next)).toThrow(
      "registry packages disappeared: pkg:did:key:zabc/alpha@0.1.0"
    );
  });

  test("allows explicitly excluded internal artifacts to disappear from the public registry", () => {
    const previous = indexFixture("a".repeat(64));
    const next = { ...previous, packages: [] };

    expect(() => assertNoMissingPackages(previous, next, new Set(["pkg:did:key:zabc/alpha@0.1.0"]))).not.toThrow();
  });

  test("rejects unsafe blob paths before constructing Gitlawb URLs", () => {
    expect(() => safeBlobPath("../bundle.nipmod")).toThrow("unsafe blob path");
    expect(() => buildBlobUrl(new URL("https://node.nipmod.com"), "zabc", "pkg", "../x")).toThrow(
      "unsafe blob path"
    );
  });

  test("requires https for remote node URLs", () => {
    expect(() => normalizeBaseUrl("http://node.nipmod.com")).toThrow("must use https");
    expect(normalizeBaseUrl("http://127.0.0.1:3000").href).toBe("http://127.0.0.1:3000/");
  });

  test("does not trust release event signature shape without cryptographic verification", () => {
    expect(
      hasVerifiedReleaseEvent(
        {
          publisher: "did:key:zabc",
          signature: {
            algorithm: "Ed25519",
            signatureBase64: "fake"
          },
          type: "dev.nipmod.release.v1"
        },
        {
          artifactSha256: "a".repeat(64),
          mediaType: "application/vnd.nipmod.bundle.v1+json",
          package: "pkg:did:key:zabc/alpha",
          publisher: "did:key:zabc",
          version: "0.1.0"
        },
        () => {
          throw new Error("invalid signature");
        }
      )
    ).toBe(false);
  });

  test("trusts release metadata only when the verifier accepts the exact expected release", () => {
    const event = {
      artifact: {
        mediaType: "application/vnd.nipmod.bundle.v1+json",
        sha256: "a".repeat(64)
      },
      formatVersion: 1,
      package: "pkg:did:key:zabc/alpha",
      publisher: "did:key:zabc",
      signature: {
        algorithm: "Ed25519",
        keyId: "did:key:zabc",
        signatureBase64: "signed"
      },
      type: "dev.nipmod.release.v1",
      version: "0.1.0"
    };
    const expected = {
      artifactSha256: "a".repeat(64),
      manifestDigest: "b".repeat(64),
      mediaType: "application/vnd.nipmod.bundle.v1+json",
      package: "pkg:did:key:zabc/alpha",
      publisher: "did:key:zabc",
      sourceRepo: "gitlawb://did:key:zabc/alpha",
      sourceTag: "v0.1.0",
      version: "0.1.0"
    };

    expect(
      hasVerifiedReleaseEvent(event, expected, (_event, actualExpected) => {
        expect(actualExpected).toEqual(expected);
        return event;
      })
    ).toBe(true);
  });

  test("fails closed when the previous registry index is malformed", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-index-test-"));
    const indexPath = join(dir, "registry-data.json");
    await writeFile(indexPath, "{");

    await expect(readPreviousIndex(indexPath)).rejects.toThrow("previous registry index is invalid JSON");
  });

  test("skips repos whose Gitlawb owner does not match the package publisher", async () => {
    const owner = "did:key:z6Mkowner";
    const publisher = "did:key:z6Mkpublisher";
    const result = await buildRegistryFixture({
      manifestOwner: publisher,
      repoOwner: owner
    });

    expect(result.packages).toHaveLength(0);
    expect(result.skipped[0]?.reason).toMatch(/repo owner/i);
  });

  test("skips packages whose index manifest digest does not match the signed bundle", async () => {
    const owner = "did:key:z6Mkowner";
    const result = await buildRegistryFixture({
      bundleManifestDigest: "a".repeat(64),
      indexManifestDigest: "b".repeat(64),
      manifestOwner: owner,
      repoOwner: owner
    });

    expect(result.packages).toHaveLength(0);
    expect(result.skipped[0]?.reason).toMatch(/manifest digest/i);
  });

  test("preserves signed manifest dependency maps in registry records", async () => {
    const owner = "did:key:z6Mkowner";
    const result = await buildRegistryFixture({
      manifestDependencies: {
        dependencies: { "agent-logger": "^1.0.0" },
        devDependencies: { "fixture-pack": "0.1.0" },
        optionalDependencies: { "browser-adapter": "~1.2.0" },
        peerDependencies: { "codex-host": "latest" },
        peerDependenciesMeta: {
          "codex-host": {
            optional: true
          }
        }
      },
      manifestOwner: owner,
      repoOwner: owner
    });

    expect(result.packages[0]).toMatchObject({
      dependencies: { "agent-logger": "^1.0.0" },
      devDependencies: { "fixture-pack": "0.1.0" },
      optionalDependencies: { "browser-adapter": "~1.2.0" },
      peerDependencies: { "codex-host": "latest" },
      peerDependenciesMeta: {
        "codex-host": {
          optional: true
        }
      }
    });
  });

  test("builds npm-style public package documents with URL-safe canonical paths", () => {
    const canonical = "pkg:did:key:z6Mkowner/alpha";
    const encoded = encodeCanonicalForRegistryPath(canonical);
    const documents = buildPublicPackageDocuments({
      formatVersion: 1,
      generatedAt: "2026-05-17T00:00:00.000Z",
      packages: [
        registryPackageFixture({
          canonical,
          dependencies: { "agent-logger": "^1.0.0" },
          digest: "a".repeat(64),
          version: "0.1.0"
        }),
        registryPackageFixture({
          canonical,
          digest: "b".repeat(64),
          proof: {
            checkpointUrl: "/transparency/checkpoint.json",
            eventHash: "c".repeat(64),
            leafHash: "d".repeat(64),
            leafIndex: 1,
            leafUrl: "/transparency/leaves/d.json",
            proofUrl: "/transparency/proofs/d.json",
            rootHash: "e".repeat(64),
            subject: `${canonical}@0.2.0`,
            treeSize: 2,
            type: "dev.nipmod.registry.proof.v1"
          },
          sourceCommit: "1".repeat(40),
          sourceTag: "v0.2.0",
          version: "0.2.0"
        })
      ],
      skipped: [],
      source: "https://node.nipmod.com"
    });

    expect(encoded).not.toMatch(/[/:+]/);
    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({
      dependenciesPath: `registry/packages/${encoded}/dependencies.json`,
      documentPath: `registry/packages/${encoded}.json`,
      provenancePath: `registry/packages/${encoded}/provenance.json`,
      packageDocument: {
        canonical,
        distTags: {
          latest: "0.2.0"
        },
        formatVersion: 1,
        name: "alpha",
        type: "dev.nipmod.package-document.v1"
      }
    });
    expect(Object.keys(documents[0].packageDocument.versions)).toEqual(["0.1.0", "0.2.0"]);
    expect(documents[0].packageDocument.versions["0.1.0"].dependencies).toEqual({ "agent-logger": "^1.0.0" });
    expect(documents[0].versionDocuments.map((doc) => doc.version)).toEqual(["0.1.0", "0.2.0"]);
    expect(documents[0].dependenciesDocument).toMatchObject({
      canonical,
      direct: {},
      version: "0.2.0"
    });
    expect(documents[0].provenanceDocument).toMatchObject({
      canonical,
      digest: "b".repeat(64),
      proof: {
        subject: `${canonical}@0.2.0`
      },
      sourceCommit: "1".repeat(40),
      version: "0.2.0"
    });
  });

  test("rejects canonical package ids that cannot fit in one static path segment", () => {
    const canonical = `pkg:did:key:z${"a".repeat(120)}/${"b".repeat(53)}`;
    const encoded = encodeCanonicalForRegistryPath(canonical);
    expect(Buffer.byteLength(`${encoded}.json`)).toBeLessThanOrEqual(255);
    expect(() => encodeCanonicalForRegistryPath(`${canonical}c`)).toThrow(/too long/i);
  });

  test("validates package documents before removing existing static registry files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-static-registry-test-"));
    const packagesDir = join(dir, "registry", "packages");
    await mkdir(packagesDir, { recursive: true });
    await writeFile(join(packagesDir, "existing.json"), "{}\n");

    await expect(
      writePackageDocuments(
        {
          formatVersion: 1,
          generatedAt: "2026-05-17T00:00:00.000Z",
          packages: [
            registryPackageFixture({
              canonical: `pkg:did:key:z${"a".repeat(120)}/${"b".repeat(54)}`
            })
          ],
          skipped: [],
          source: "https://node.nipmod.com"
        },
        { publicSiteDir: dir }
      )
    ).rejects.toThrow(/too long/i);
    expect(await readdir(packagesDir)).toEqual(["existing.json"]);
  });

  test("validates version path segments before removing existing static registry files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-static-registry-version-test-"));
    const packagesDir = join(dir, "registry", "packages");
    await mkdir(packagesDir, { recursive: true });
    await writeFile(join(packagesDir, "existing.json"), "{}\n");

    await expect(
      writePackageDocuments(
        {
          formatVersion: 1,
          generatedAt: "2026-05-17T00:00:00.000Z",
          packages: [
            registryPackageFixture({
              version: `${"1".repeat(41)}.0.0`
            })
          ],
          skipped: [],
          source: "https://node.nipmod.com"
        },
        { publicSiteDir: dir }
      )
    ).rejects.toThrow(/invalid semver/i);
    expect(await readdir(packagesDir)).toEqual(["existing.json"]);
  });

  test("indexes every package release instead of only the latest release", async () => {
    const owner = "did:key:z6Mkowner";
    const result = await buildRegistryFixture({
      latestVersion: "0.2.0",
      manifestOwner: owner,
      releaseVersions: ["0.1.0", "0.2.0"],
      repoOwner: owner
    });
    const documents = buildPublicPackageDocuments(result);

    expect(result.packages.map((pkg) => pkg.version).sort()).toEqual(["0.1.0", "0.2.0"]);
    expect(documents[0].packageDocument.distTags.latest).toBe("0.2.0");
    expect(Object.keys(documents[0].packageDocument.versions)).toEqual(["0.1.0", "0.2.0"]);
    expect(documents[0].versionDocuments.map((doc) => doc.version)).toEqual(["0.1.0", "0.2.0"]);
  });

  test("uses the verified package index latest value instead of highest semver", async () => {
    const owner = "did:key:z6Mkowner";
    const result = await buildRegistryFixture({
      latestVersion: "0.1.0",
      manifestOwner: owner,
      releaseVersions: ["0.1.0", "0.2.0"],
      repoOwner: owner
    });
    const documents = buildPublicPackageDocuments(result);

    expect(result.packages.every((pkg) => pkg.distTags.latest === "0.1.0")).toBe(true);
    expect(documents[0].packageDocument.distTags.latest).toBe("0.1.0");
    expect(documents[0].dependenciesDocument.version).toBe("0.1.0");
    expect(documents[0].provenanceDocument.version).toBe("0.1.0");
  });

  test("skips malformed package release keys before reading bad payloads", async () => {
    const owner = "did:key:z6Mkowner";
    const result = await buildRegistryFixture({
      extraMalformedReleases: ["canary"],
      latestVersion: "0.2.0",
      manifestOwner: owner,
      releaseVersions: ["0.1.0", "0.2.0"],
      repoOwner: owner
    });

    expect(result.packages.map((pkg) => pkg.version).sort()).toEqual(["0.1.0", "0.2.0"]);
    expect(result.skipped).toContainEqual({
      reason: expect.stringContaining("release canary: invalid semver"),
      repo: "alpha"
    });
  });

  test("excludes internal probe packages from the public package list", async () => {
    const owner = "did:key:z6Mkowner";
    const result = await buildRegistryFixture({
      manifestName: "source-bound-probe-123",
      manifestOwner: owner,
      releaseEventVerifies: true,
      repoName: "source-bound-probe-123",
      repoOwner: owner,
      transparency: fakeTransparency()
    });

    expect(result.packages).toHaveLength(0);
    expect(result.skipped[0]?.reason).toMatch(/excluded/i);
  });

  test("publishes proof metadata without calling self-generated static logs verified", async () => {
    const owner = "did:key:z6Mkowner";
    const result = await buildRegistryFixture({
      manifestOwner: owner,
      releaseEventVerifies: true,
      repoOwner: owner,
      transparency: fakeTransparency()
    });

    expect(result.packages).toHaveLength(1);
    expect(result.packages[0]?.trust.level).toBe("signed");
    expect(result.packages[0]?.trust.score).toBe(90);
    expect(result.packages[0]?.trust.evidence.transparencyLogIncluded).toBe(true);
    expect(result.packages[0]?.trust.evidence.transparencyLogVerified).toBe(false);
    expect(result.packages[0]?.proof?.leafIndex).toBe(0);
    expect(result.transparencyLog?.entries).toHaveLength(1);
  });

  test("keeps prior transparency leaves in the next log", async () => {
    const owner = "did:key:z6Mkowner";
    const previousLeaf = {
      artifactSha256: "1".repeat(64),
      eventHash: "2".repeat(64),
      package: "pkg:did:key:z6Mkold/old",
      publisher: "did:key:z6Mkold",
      version: "0.1.0"
    };
    const result = await buildRegistryFixture({
      manifestOwner: owner,
      previousIndex: indexWithTransparencyLeaf(previousLeaf),
      releaseEventVerifies: true,
      repoOwner: owner,
      transparency: fakeTransparency()
    });

    expect(result.transparencyLog?.entries.map((entry) => entry.leaf.package)).toEqual([
      "pkg:did:key:z6Mkold/old",
      "pkg:did:key:z6Mkowner/alpha"
    ]);
    expect(result.transparencyLog?.treeHead.treeSize).toBe(2);
  });

  test("does not treat a local witness identity as verified trust evidence", async () => {
    const owner = "did:key:z6Mkowner";
    const result = await buildRegistryFixture({
      manifestOwner: owner,
      releaseEventVerifies: true,
      repoOwner: owner,
      transparency: fakeTransparency({ witnessVerifies: true }),
      witnessIdentity: {
        did: "did:key:z6Mkwitness",
        privateKeyPem: "",
        publicKeyPem: ""
      }
    });

    expect(result.packages).toHaveLength(1);
    expect(result.packages[0]?.trust.level).toBe("signed");
    expect(result.packages[0]?.trust.score).toBe(90);
    expect(result.packages[0]?.trust.evidence.transparencyLogIncluded).toBe(true);
    expect(result.packages[0]?.trust.evidence.transparencyLogVerified).toBe(false);
    expect(result.packages[0]?.proof?.witnesses).toEqual(["did:key:z6Mkwitness"]);
    expect(result.packages[0]?.proof?.witnessUrls).toEqual(["/transparency/witnesses/z6Mkwitness.json"]);
    expect(result.transparencyLog?.witnesses).toHaveLength(1);
  });

  test("marks signed releases verified only with pinned external witness statements", async () => {
    const owner = "did:key:z6Mkowner";
    const result = await buildRegistryFixture({
      allowedLogIds: ["did:key:z6Mklog"],
      allowedWitnesses: ["did:key:z6Mkwitness"],
      manifestOwner: owner,
      releaseEventVerifies: true,
      repoOwner: owner,
      transparency: fakeTransparency({ witnessVerifies: true }),
      witnessStatements: [fakeWitnessStatement()]
    });

    expect(result.packages).toHaveLength(1);
    expect(result.packages[0]?.trust.level).toBe("verified");
    expect(result.packages[0]?.trust.score).toBe(100);
    expect(result.packages[0]?.sourceCommit).toBe("1".repeat(40));
    expect(result.packages[0]?.trust.evidence.sourceProvenanceVerified).toBe(true);
    expect(result.packages[0]?.trust.evidence.transparencyLogVerified).toBe(true);
    expect(result.packages[0]?.proof?.witnesses).toEqual(["did:key:z6Mkwitness"]);
  });

  test("attaches compatibility receipts only when they match package evidence", async () => {
    const owner = "did:key:z6Mkowner";
    const result = await buildRegistryFixture({
      allowedLogIds: ["did:key:z6Mklog"],
      allowedWitnesses: ["did:key:z6Mkwitness"],
      compatibilityReceipts: [compatibilityReceiptFixture()],
      manifestOwner: owner,
      releaseEventVerifies: true,
      repoOwner: owner,
      transparency: fakeTransparency({ witnessVerifies: true }),
      witnessStatements: [fakeWitnessStatement()]
    });

    expect(result.packages[0]?.compatibilityReceipts).toEqual([
      expect.objectContaining({
        externalFormat: "mcp-server-json",
        id: "receipt.mcp",
        package: "pkg:did:key:z6Mkowner/alpha",
        packageDigest: sha256Hex(Buffer.from("bundle")),
        sourceCommit: "1".repeat(40)
      })
    ]);
  });

  test("rejects compatibility receipts with hidden provenance loss", async () => {
    const owner = "did:key:z6Mkowner";

    await expect(
      buildRegistryFixture({
        allowedLogIds: ["did:key:z6Mklog"],
        allowedWitnesses: ["did:key:z6Mkwitness"],
        compatibilityReceipts: [
          compatibilityReceiptFixture({
            provenanceLoss: ["source tag was dropped"]
          })
        ],
        manifestOwner: owner,
        releaseEventVerifies: true,
        repoOwner: owner,
        transparency: fakeTransparency({ witnessVerifies: true }),
        witnessStatements: [fakeWitnessStatement()]
      })
    ).rejects.toThrow("compatibility receipt provenance loss must be explicit and empty");
  });

  test("rejects compatibility receipts when example hashes drift", async () => {
    const owner = "did:key:z6Mkowner";

    await expect(
      buildRegistryFixture({
        allowedLogIds: ["did:key:z6Mklog"],
        allowedWitnesses: ["did:key:z6Mkwitness"],
        compatibilityReceipts: [
          compatibilityReceiptFixture({
            externalInputSha256: "b".repeat(64)
          })
        ],
        manifestOwner: owner,
        releaseEventVerifies: true,
        repoOwner: owner,
        transparency: fakeTransparency({ witnessVerifies: true }),
        witnessStatements: [fakeWitnessStatement()]
      })
    ).rejects.toThrow("compatibility receipt example hash mismatch");
  });

  test("rejects overlong compatibility field lists instead of truncating them", async () => {
    const owner = "did:key:z6Mkowner";

    await expect(
      buildRegistryFixture({
        allowedLogIds: ["did:key:z6Mklog"],
        allowedWitnesses: ["did:key:z6Mkwitness"],
        compatibilityReceipts: [
          compatibilityReceiptFixture({
            unsupportedFields: Array.from({ length: 33 }, (_, index) => `field-${index}`)
          })
        ],
        manifestOwner: owner,
        releaseEventVerifies: true,
        repoOwner: owner,
        transparency: fakeTransparency({ witnessVerifies: true }),
        witnessStatements: [fakeWitnessStatement()]
      })
    ).rejects.toThrow("compatibility receipt unsupportedFields has too many entries");
  });

  test("keeps witnessed packages below verified when the source tag points elsewhere", async () => {
    const owner = "did:key:z6Mkowner";
    const result = await buildRegistryFixture({
      allowedLogIds: ["did:key:z6Mklog"],
      allowedWitnesses: ["did:key:z6Mkwitness"],
      manifestOwner: owner,
      releaseEventVerifies: true,
      repoOwner: owner,
      sourceTagCommit: "2".repeat(40),
      transparency: fakeTransparency({ witnessVerifies: true }),
      witnessStatements: [fakeWitnessStatement()]
    });

    expect(result.packages).toHaveLength(1);
    expect(result.packages[0]?.trust.level).not.toBe("verified");
    expect(result.packages[0]?.sourceCommit).toBe(null);
    expect(result.packages[0]?.trust.evidence.sourceProvenanceVerified).toBe(false);
  });

  test("treats witness statement source as external trust evidence", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-witness-source-test-"));
    const source = join(dir, "witness-statements.json");
    await writeFile(
      source,
      JSON.stringify({
        formatVersion: 1,
        statements: [fakeWitnessStatement()],
        type: "dev.nipmod.transparency.witness-statements.v1"
      })
    );

    const previousSource = process.env.NIPMOD_WITNESS_STATEMENTS_SOURCE;
    process.env.NIPMOD_WITNESS_STATEMENTS_SOURCE = source;
    try {
      const owner = "did:key:z6Mkowner";
      const result = await buildRegistryFixture({
        allowedLogIds: ["did:key:z6Mklog"],
        allowedWitnesses: ["did:key:z6Mkwitness"],
        manifestOwner: owner,
        releaseEventVerifies: true,
        repoOwner: owner,
        transparency: fakeTransparency({ witnessVerifies: true })
      });

      expect(result.packages).toHaveLength(1);
      expect(result.packages[0]?.trust.level).toBe("verified");
      expect(result.packages[0]?.trust.score).toBe(100);
      expect(result.packages[0]?.trust.evidence.transparencyLogVerified).toBe(true);
    } finally {
      if (previousSource === undefined) {
        delete process.env.NIPMOD_WITNESS_STATEMENTS_SOURCE;
      } else {
        process.env.NIPMOD_WITNESS_STATEMENTS_SOURCE = previousSource;
      }
    }
  });

  test("does not verify external witness statements without a pinned witness allowlist", async () => {
    const owner = "did:key:z6Mkowner";
    const result = await buildRegistryFixture({
      allowedLogIds: ["did:key:z6Mklog"],
      manifestOwner: owner,
      releaseEventVerifies: true,
      repoOwner: owner,
      transparency: fakeTransparency({ witnessVerifies: true }),
      witnessStatements: [fakeWitnessStatement()]
    });

    expect(result.packages).toHaveLength(1);
    expect(result.packages[0]?.trust.level).toBe("signed");
    expect(result.packages[0]?.trust.evidence.transparencyLogVerified).toBe(false);
  });

  test("does not verify external witness statements without a pinned log id", async () => {
    const owner = "did:key:z6Mkowner";
    const result = await buildRegistryFixture({
      allowedLogIds: ["did:key:z6Mkother"],
      allowedWitnesses: ["did:key:z6Mkwitness"],
      manifestOwner: owner,
      releaseEventVerifies: true,
      repoOwner: owner,
      transparency: fakeTransparency({ witnessVerifies: true }),
      witnessStatements: [fakeWitnessStatement()]
    });

    expect(result.packages).toHaveLength(1);
    expect(result.packages[0]?.trust.level).toBe("signed");
    expect(result.packages[0]?.trust.evidence.transparencyLogVerified).toBe(false);
  });

  test("does not verify stale or same-key external witness statements", async () => {
    const owner = "did:key:z6Mkowner";
    const stale = fakeWitnessStatement("did:key:z6Mkwitness");
    stale.treeHead.rootHash = "0".repeat(64);
    const sameKey = fakeWitnessStatement("did:key:z6Mklog");
    const result = await buildRegistryFixture({
      allowedLogIds: ["did:key:z6Mklog"],
      allowedWitnesses: ["did:key:z6Mkwitness", "did:key:z6Mklog"],
      manifestOwner: owner,
      releaseEventVerifies: true,
      repoOwner: owner,
      transparency: fakeTransparency({ witnessVerifies: true }),
      witnessStatements: [stale, sameKey]
    });

    expect(result.packages).toHaveLength(1);
    expect(result.packages[0]?.trust.level).toBe("signed");
    expect(result.packages[0]?.trust.evidence.transparencyLogVerified).toBe(false);
  });

  test("filters malformed external witness statements from public proof metadata", async () => {
    const owner = "did:key:z6Mkowner";
    const result = await buildRegistryFixture({
      allowedLogIds: ["did:key:z6Mklog"],
      allowedWitnesses: ["did:key:z6Mkwitness"],
      manifestOwner: owner,
      releaseEventVerifies: true,
      repoOwner: owner,
      transparency: fakeTransparency({ witnessVerifies: true }),
      witnessStatements: [
        null,
        { witness: "../bad" },
        {
          formatVersion: 1,
          signature: { algorithm: "Ed25519", keyId: "../bad", signatureBase64: "x" },
          witness: "../bad"
        }
      ]
    });

    expect(result.packages).toHaveLength(1);
    expect(result.packages[0]?.trust.level).toBe("signed");
    expect(result.packages[0]?.proof?.witnesses).toEqual([]);
    expect(result.packages[0]?.proof?.witnessUrls).toEqual([]);
    expect(result.transparencyLog?.witnesses).toEqual([]);
  });
});

function indexFixture(digest) {
  return {
    formatVersion: 1,
    generatedAt: "2026-05-15T00:00:00.000Z",
    packages: [
      {
        canonical: "pkg:did:key:zabc/alpha",
        digest,
        version: "0.1.0"
      }
    ],
    skipped: [],
    source: "https://node.nipmod.com"
  };
}

function registryPackageFixture(overrides = {}) {
  const canonical = overrides.canonical ?? "pkg:did:key:z6Mkowner/alpha";
  const version = overrides.version ?? "0.1.0";
  return {
    artifactPath: `releases/${version}/bundle.nipmod`,
    artifactSha256: overrides.digest ?? "a".repeat(64),
    canonical,
    cloneUrl: "https://node.nipmod.com/z6Mkowner/alpha.git",
    description: "alpha package",
    digest: overrides.digest ?? "a".repeat(64),
    name: "alpha",
    owner: "did:key:z6Mkowner",
    permissionDetails: { env: [], filesystem: [], mcpTools: [], network: [], secrets: [] },
    permissions: emptyPermissions,
    publisher: "did:key:z6Mkowner",
    releasePath: `releases/${version}/release.json`,
    repo: "alpha",
    resolved: `https://node.nipmod.com/api/v1/repos/z6Mkowner/alpha/blob/releases/${version}/bundle.nipmod`,
    sourceCommit: null,
    sourceRepo: "https://node.nipmod.com/z6Mkowner/alpha.git",
    sourceTag: null,
    stars: 0,
    trust: {
      evidence: {
        artifactDigestVerified: true,
        bundleSignatureVerified: true,
        immutableSnapshotMatched: true,
        publisherMatchesCanonical: true,
        releaseEventSigned: true,
        sourceProvenanceVerified: false,
        transparencyLogIncluded: false,
        transparencyLogVerified: false
      },
      level: "signed",
      score: 90,
      signals: [],
      warnings: []
    },
    type: "skill",
    updatedAt: "2026-05-17T00:00:00.000Z",
    version,
    ...overrides
  };
}

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function buildRegistryFixture({
  allowedLogIds,
  allowedWitnesses,
  bundleManifestDigest = "a".repeat(64),
  compatibilityReceipts = [],
  extraMalformedReleases = [],
  indexManifestDigest = bundleManifestDigest,
  latestVersion = "0.1.0",
  manifestName = "alpha",
  manifestDependencies = {},
  manifestOwner,
  previousIndex,
  releaseEventVerifies = false,
  releaseVersions = ["0.1.0"],
  repoName = "alpha",
  repoOwner,
  sourceHeadCommit = "1".repeat(40),
  sourceTagCommit = sourceHeadCommit,
  transparency,
  witnessIdentity,
  witnessStatements
}) {
  const canonical = `pkg:${manifestOwner}/${manifestName}`;
  const releaseFixtures = new Map(
    releaseVersions.map((version) => {
      const artifactBytes = version === "0.1.0" ? Buffer.from("bundle") : Buffer.from(`bundle-${version}`);
      const manifestDigest =
        version === "0.1.0" ? bundleManifestDigest : sha256Hex(Buffer.from(`manifest-${version}`));
      const indexedManifestDigest = version === "0.1.0" ? indexManifestDigest : manifestDigest;
      return [
        version,
        {
          artifactBytes,
          artifactSha256: sha256Hex(artifactBytes),
          indexedManifestDigest,
          manifestDigest,
          version
        }
      ];
    })
  );
  const fetchFn = async (input) => {
    const path = new URL(String(input)).pathname;
    if (path === "/api/v1/repos") {
      return jsonResponse([
        {
          clone_url: `https://node.nipmod.com/${repoOwner.split(":").at(-1)}/alpha.git`,
          created_at: "2026-05-15T00:00:00.000Z",
          default_branch: "main",
          description: "alpha package",
          id: "repo-1",
          is_public: true,
          name: repoName,
          owner_did: repoOwner,
          star_count: 0,
          updated_at: "2026-05-15T00:00:00.000Z"
        }
      ]);
    }
    if (path.endsWith(".git/info/refs")) {
      return gitInfoRefsResponse({
        head: sourceHeadCommit,
        main: sourceHeadCommit,
        tags: Object.fromEntries(releaseVersions.map((version) => [`v${version}`, sourceTagCommit]))
      });
    }
    if (path.endsWith("/blob/index.json")) {
      return jsonResponse({
        formatVersion: 1,
        latest: latestVersion,
        package: canonical,
        releases: {
	          ...Object.fromEntries(
	            [...releaseFixtures.values()].map((release) => [
	              release.version,
	              {
	                artifact: {
	                  manifestDigest: release.indexedManifestDigest,
	                  mediaType: "application/vnd.nipmod.bundle.v1+json",
	                  path: `releases/${release.version}/bundle.nipmod`,
	                  sha256: release.artifactSha256
	                },
	                publisher: manifestOwner
	              }
	            ])
	          ),
	          ...Object.fromEntries(
	            extraMalformedReleases.map((version) => [
	              version,
	              {
	                artifact: {
	                  manifestDigest: "not-a-sha",
	                  mediaType: "application/vnd.nipmod.bundle.v1+json",
	                  path: `releases/${version}/bundle.nipmod`,
	                  sha256: "not-a-sha"
	                },
	                publisher: manifestOwner
	              }
            ])
          )
        }
      });
    }
    const releaseMatch = /\/blob\/releases\/([^/]+)\/(release\.json|bundle\.nipmod)$/.exec(path);
    if (releaseMatch) {
      const release = releaseFixtures.get(releaseMatch[1]);
      if (!release) {
        return new Response("not found", { status: 404 });
      }
      if (releaseMatch[2] === "release.json") {
        return jsonResponse({ ok: true });
      }
      return new Response(release.artifactBytes);
    }
    return new Response("not found", { status: 404 });
  };

  return buildRegistryIndex({
    fetchFn,
    verifyBundle: (bytes) => {
      const artifactDigest = sha256Hex(bytes);
      const release = [...releaseFixtures.values()].find((candidate) => candidate.artifactSha256 === artifactDigest);
      if (!release) {
        throw new Error("unknown bundle");
      }
      return {
        manifest: {
          canonical,
          description: "alpha package",
          ...manifestDependencies,
          name: manifestName,
          permissions: manifestPermissions(),
          publish: {
            provenance: "test",
            signingKey: manifestOwner
          },
          type: "skill",
          version: release.version
        },
        manifestDigest: release.manifestDigest,
        signature: {
          algorithm: "Ed25519",
          keyId: manifestOwner,
          signatureBase64: "signed"
        }
      };
    },
    verifySignedReleaseEvent: releaseEventVerifies ? () => ({ ok: true }) : () => {
      throw new Error("not signed");
    },
    logIdentity: {
      did: "did:key:z6Mklog",
      privateKeyPem: "",
      publicKeyPem: ""
    },
    allowedLogIds,
    allowedWitnesses,
    compatibilityReceipts,
    previousIndex,
    transparency,
    witnessIdentity,
    witnessStatements
  });
}

function compatibilityReceiptFixture(overrides = {}) {
  return {
    exampleUrl: "https://nipmod.com/compatibility/examples/mcp-server.json",
    externalFormat: "mcp-server-json",
    externalInputSha256: "5e57556dc2c229e4449a5d8572f6d27a0026ba3cb937b7457eb562995a161376",
    id: "receipt.mcp",
    label: "MCP import",
    package: "pkg:did:key:z6Mkowner/alpha",
    packageDigest: sha256Hex(Buffer.from("bundle")),
    preservedFields: ["name", "command", "args"],
    provenanceLoss: [],
    receiptUrl: "https://nipmod.com/compatibility/receipts.json#receipt.mcp",
    sourceCommit: "1".repeat(40),
    sourceRepo: "https://node.nipmod.com/z6Mkowner/alpha.git",
    sourceTag: "v0.1.0",
    type: "dev.nipmod.compatibility-receipt.v1",
    unsupportedFields: [],
    version: "0.1.0",
    ...overrides
  };
}

function gitInfoRefsResponse({ head, main, tag, tags }) {
  const tagEntries = tags ?? { "v0.1.0": tag };
  const lines = [
    `${head} HEAD\0multi_ack`,
    `${main} refs/heads/main`,
    ...Object.entries(tagEntries).map(([name, sha]) => `${sha} refs/tags/${name}`)
  ];
  const service = pktLine("# service=git-upload-pack\n");
  const refs = lines.map((line) => pktLine(`${line}\n`)).join("");
  return new Response(Buffer.from(`${service}0000${refs}0000`, "utf8"), {
    headers: {
      "content-type": "application/x-git-upload-pack-advertisement"
    }
  });
}

function pktLine(value) {
  const length = Buffer.byteLength(value) + 4;
  return `${length.toString(16).padStart(4, "0")}${value}`;
}

function indexWithTransparencyLeaf(leaf) {
  return {
    formatVersion: 1,
    generatedAt: "2026-05-15T00:00:00.000Z",
    packages: [],
    skipped: [],
    source: "https://node.nipmod.com",
    transparencyLog: {
      entries: [
        {
          inclusionProof: [],
          leaf,
          leafHash: "3".repeat(64),
          leafIndex: 0
        }
      ],
      formatVersion: 1,
      treeHead: {
        formatVersion: 1,
        generatedAt: "2026-05-15T00:00:00.000Z",
        logId: "did:key:z6Mklog",
        rootHash: "3".repeat(64),
        signature: {
          algorithm: "Ed25519",
          keyId: "did:key:z6Mklog",
          signatureBase64: "signed"
        },
        treeSize: 1
      },
      witnesses: []
    }
  };
}

function fakeWitnessStatement(witness = "did:key:z6Mkwitness") {
  return {
    formatVersion: 1,
    signature: {
      algorithm: "Ed25519",
      keyId: witness,
      signatureBase64: "witnessed"
    },
    treeHead: {
      formatVersion: 1,
      generatedAt: "2026-05-15T00:00:00.000Z",
      logId: "did:key:z6Mklog",
      rootHash: "f".repeat(64),
      treeSize: 1
    },
    type: "dev.nipmod.transparency.witness.v1",
    witness
  };
}

function jsonResponse(value) {
  return new Response(JSON.stringify(value), {
    headers: {
      "content-type": "application/json"
    }
  });
}

function manifestPermissions() {
  return {
    env: [],
    exec: { allowed: false },
    filesystem: [],
    mcpTools: [],
    network: [],
    postinstall: { allowed: false },
    secrets: []
  };
}

function fakeTransparency({ witnessVerifies = false } = {}) {
  const createLog = (entries, _identity, generatedAt = "2026-05-15T00:00:00.000Z") => ({
    entries: entries.map((entry, leafIndex) => ({
      inclusionProof: [],
      leaf: {
        artifactSha256: entry.artifactSha256,
        eventHash: entry.eventHash ?? "e".repeat(64),
        package: entry.package,
        publisher: entry.publisher,
        version: entry.version
      },
      leafHash: String(leafIndex).repeat(64).slice(0, 64).padEnd(64, "f"),
      leafIndex
    })),
    formatVersion: 1,
    treeHead: {
      formatVersion: 1,
      generatedAt,
      logId: "did:key:z6Mklog",
      rootHash: "f".repeat(64),
      signature: {
        algorithm: "Ed25519",
        keyId: "did:key:z6Mklog",
        signatureBase64: "signed"
      },
      treeSize: entries.length
    }
  });

  return {
    createTransparencyLog: createLog,
    createTransparencyLogFromLeaves: createLog,
    releaseEventHash: () => "e".repeat(64),
    signWitnessStatement: (treeHead, identity) => ({
      formatVersion: 1,
      signature: {
        algorithm: "Ed25519",
        keyId: identity.did,
        signatureBase64: "witnessed"
      },
      treeHead: {
        formatVersion: treeHead.formatVersion,
        generatedAt: treeHead.generatedAt,
        logId: treeHead.logId,
        rootHash: treeHead.rootHash,
        treeSize: treeHead.treeSize
      },
      type: "dev.nipmod.transparency.witness.v1",
      witness: identity.did
    }),
    verifyTransparencyEntry: () => true,
    verifyWitnessStatement: (statement, treeHead, allowedWitnesses = []) =>
      witnessVerifies &&
      statement.witness !== treeHead.logId &&
      statement.treeHead.rootHash === treeHead.rootHash &&
      allowedWitnesses.includes(statement.witness)
  };
}
