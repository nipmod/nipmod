import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, test } from "vitest";
import { auditProject } from "../src/audit.js";
import { generateIdentity } from "../src/identity.js";
import { createTransparencyLogFromLeaves, signWitnessStatement } from "../src/transparency.js";

const owner = generateIdentity().did;
const canonical = `pkg:${owner}/safe-skill`;
const version = "0.1.0";
const digest = "a".repeat(64);
const transparency = testTransparency();

describe("installed package audit", () => {
  test("passes a lockfile package that is still verified and advisory-free", async () => {
    const projectDir = await projectWithLockfile();

    const result = await auditProject(projectDir, {
      allowedLogIds: [transparency.log.treeHead.logId],
      allowedWitnesses: [transparency.witness.witness],
      ...signedAdvisoryOptions([]),
      registry: registryIndex({ digest, level: "verified", sourceProvenanceVerified: true })
    });

    expect(result.ready).toBe(true);
    expect(result.summary).toEqual({ fail: 0, ok: 1, total: 1, warn: 0 });
    expect(result.packages[0]).toMatchObject({
      canonical,
      status: "ok",
      trustLevel: "verified",
      version
    });
  });

  test("fails when the registry digest no longer matches the lockfile integrity", async () => {
    const projectDir = await projectWithLockfile();

    const result = await auditProject(projectDir, {
      allowedLogIds: [transparency.log.treeHead.logId],
      allowedWitnesses: [transparency.witness.witness],
      ...signedAdvisoryOptions([]),
      registry: registryIndex({ digest: "b".repeat(64), level: "verified", sourceProvenanceVerified: true })
    });

    expect(result.ready).toBe(false);
    expect(result.packages[0]?.status).toBe("fail");
    expect(result.packages[0]?.findings).toContain("registry digest does not match lockfile integrity");
  });

  test("fails when a matching active high advisory exists", async () => {
    const projectDir = await projectWithLockfile();

    const result = await auditProject(projectDir, {
      allowedLogIds: [transparency.log.treeHead.logId],
      allowedWitnesses: [transparency.witness.witness],
      ...signedAdvisoryOptions([
        {
          id: "NIPMOD-2026-0001",
          package: canonical,
          severity: "high",
          status: "active",
          title: "Compromised release",
          versions: [version]
        }
      ]),
      registry: registryIndex({ digest, level: "verified", sourceProvenanceVerified: true })
    });

    expect(result.ready).toBe(false);
    expect(result.packages[0]?.status).toBe("fail");
    expect(result.packages[0]?.advisories).toEqual(["NIPMOD-2026-0001"]);
  });

  test("fails when the registry marks a package version as actively quarantined", async () => {
    const projectDir = await projectWithLockfile();

    const result = await auditProject(projectDir, {
      allowedLogIds: [transparency.log.treeHead.logId],
      allowedWitnesses: [transparency.witness.witness],
      ...signedAdvisoryOptions([]),
      registry: registryIndex({
        digest,
        level: "verified",
        quarantine: {
          active: true,
          advisoryId: "NIPMOD-2026-0007",
          artifactSha256: digest,
          package: canonical,
          publishedAt: "2026-05-16T15:00:00.000Z",
          reason: "Quarantined by registry metadata",
          severity: "critical",
          status: "active",
          type: "dev.nipmod.quarantine.v1",
          version
        },
        sourceProvenanceVerified: true
      })
    });

    expect(result.ready).toBe(false);
    expect(result.packages[0]?.status).toBe("fail");
    expect(result.packages[0]?.advisories).toEqual(["NIPMOD-2026-0007"]);
    expect(result.packages[0]?.findings).toContain("NIPMOD-2026-0007: Quarantined by registry metadata");
  });

  test("verifies a signed advisory feed loaded from a URL source", async () => {
    const projectDir = await projectWithLockfile();
    const { feedPath, publicKey, signaturePath } = await signedAdvisoryFeed([]);

    const result = await auditProject(projectDir, {
      advisoryPublicKeySpkiBase64: publicKey.publicKeySpkiBase64,
      advisoryPublicKeySpkiSha256: publicKey.publicKeySpkiSha256,
      advisoriesSignatureUrl: pathToFileURL(signaturePath).href,
      advisoriesUrl: pathToFileURL(feedPath).href,
      allowedLogIds: [transparency.log.treeHead.logId],
      allowedWitnesses: [transparency.witness.witness],
      registry: registryIndex({ digest, level: "verified", sourceProvenanceVerified: true })
    });

    expect(result.ready).toBe(true);
    expect(result.summary).toEqual({ fail: 0, ok: 1, total: 1, warn: 0 });
  });

  test("auto-fetches and verifies the signature for HTTPS advisory feeds", async () => {
    const projectDir = await projectWithLockfile();
    const signed = signedAdvisoryPayload([]);
    const requests: string[] = [];

    const result = await auditProject(projectDir, {
      advisoryPublicKeySpkiBase64: signed.publicKey.publicKeySpkiBase64,
      advisoryPublicKeySpkiSha256: signed.publicKey.publicKeySpkiSha256,
      advisoriesUrl: "https://mirror.test/advisories.json",
      allowedLogIds: [transparency.log.treeHead.logId],
      allowedWitnesses: [transparency.witness.witness],
      fetchImpl: jsonFetch({
        "https://mirror.test/advisories.json": signed.feed,
        "https://mirror.test/advisories.json.sig": signed.signature
      }, requests),
      registry: registryIndex({ digest, level: "verified", sourceProvenanceVerified: true })
    });

    expect(result.ready).toBe(true);
    expect(requests).toEqual(["https://mirror.test/advisories.json", "https://mirror.test/advisories.json.sig"]);
  });

  test("rejects a tampered signed advisory feed loaded from a URL source", async () => {
    const projectDir = await projectWithLockfile();
    const { feedPath, publicKey, signaturePath } = await signedAdvisoryFeed([]);
    await writeFile(feedPath, `${JSON.stringify(advisoryFeed([{ id: "NIPMOD-2026-0001", package: canonical, severity: "critical", status: "active", title: "Tampered", versions: [version] }]))}\n`);

    await expect(
      auditProject(projectDir, {
        advisoryPublicKeySpkiBase64: publicKey.publicKeySpkiBase64,
        advisoryPublicKeySpkiSha256: publicKey.publicKeySpkiSha256,
        advisoriesSignatureUrl: pathToFileURL(signaturePath).href,
        advisoriesUrl: pathToFileURL(feedPath).href,
        allowedLogIds: [transparency.log.treeHead.logId],
        allowedWitnesses: [transparency.witness.witness],
        registry: registryIndex({ digest, level: "verified", sourceProvenanceVerified: true })
      })
    ).rejects.toThrow(/advisory feed signature/i);
  });

  test("rejects direct advisory objects because the original signed bytes are unavailable", async () => {
    const projectDir = await projectWithLockfile();

    await expect(
      auditProject(projectDir, {
        allowedLogIds: [transparency.log.treeHead.logId],
        allowedWitnesses: [transparency.witness.witness],
        advisories: advisoryFeed([]),
        registry: registryIndex({ digest, level: "verified", sourceProvenanceVerified: true })
      })
    ).rejects.toThrow(/raw signed advisory bytes/i);
  });

  test("rejects expired signed advisory feeds", async () => {
    const projectDir = await projectWithLockfile();
    const signed = signedAdvisoryOptions([], {
      expiresAt: "2026-05-15T00:00:00.000Z",
      generatedAt: "2026-05-14T00:00:00.000Z"
    });

    await expect(
      auditProject(projectDir, {
        allowedLogIds: [transparency.log.treeHead.logId],
        allowedWitnesses: [transparency.witness.witness],
        ...signed,
        registry: registryIndex({ digest, level: "verified", sourceProvenanceVerified: true })
      })
    ).rejects.toThrow(/advisory feed expired/i);
  });

  test("does not trust mutable discovery log and witness pins by default", async () => {
    const projectDir = await projectWithLockfile();
    const attacker = testTransparency();
    const signed = signedAdvisoryPayload([]);

    const result = await auditProject(projectDir, {
      advisoryPublicKeySpkiBase64: signed.publicKey.publicKeySpkiBase64,
      advisoryPublicKeySpkiSha256: signed.publicKey.publicKeySpkiSha256,
      discoveryUrl: "https://mirror.test/.well-known/nipmod.json",
      fetchImpl: jsonFetch({
        "https://mirror.test/.well-known/nipmod.json": {
          advisories: "https://mirror.test/advisories.json",
          formatVersion: 1,
          registry: { url: "https://mirror.test/registry.json" },
          transparency: { logId: attacker.log.treeHead.logId },
          type: "dev.nipmod.discovery.v1",
          witness: { did: attacker.witness.witness }
        },
        "https://mirror.test/advisories.json": signed.feed,
        "https://mirror.test/advisories.json.sig": signed.signature,
        "https://mirror.test/registry.json": registryIndex({
          digest,
          level: "verified",
          sourceProvenanceVerified: true,
          transparency: attacker
        })
      })
    });

    expect(result.ready).toBe(false);
    expect(result.packages[0]?.findings).toContain("transparency proof is invalid");
  });

  test("rejects missing HTTPS advisory signatures", async () => {
    const projectDir = await projectWithLockfile();
    const signed = signedAdvisoryPayload([]);

    await expect(
      auditProject(projectDir, {
        advisoryPublicKeySpkiBase64: signed.publicKey.publicKeySpkiBase64,
        advisoryPublicKeySpkiSha256: signed.publicKey.publicKeySpkiSha256,
        advisoriesUrl: "https://mirror.test/advisories.json",
        allowedLogIds: [transparency.log.treeHead.logId],
        allowedWitnesses: [transparency.witness.witness],
        fetchImpl: jsonFetch({
          "https://mirror.test/advisories.json": signed.feed
        }),
        registry: registryIndex({ digest, level: "verified", sourceProvenanceVerified: true })
      })
    ).rejects.toThrow(/failed to fetch advisories signature/i);
  });


  test("warns for active moderate advisories and ignores withdrawn or unrelated advisories", async () => {
    const projectDir = await projectWithLockfile();

    const result = await auditProject(projectDir, {
      allowedLogIds: [transparency.log.treeHead.logId],
      allowedWitnesses: [transparency.witness.witness],
      ...signedAdvisoryOptions([
        {
          id: "NIPMOD-2026-0002",
          package: canonical,
          severity: "moderate",
          status: "active",
          title: "Needs review",
          versions: [version]
        },
        {
          id: "NIPMOD-2026-0003",
          package: canonical,
          severity: "critical",
          status: "withdrawn",
          title: "Withdrawn",
          versions: [version]
        },
        {
          id: "NIPMOD-2026-0004",
          package: canonical,
          severity: "critical",
          status: "active",
          title: "Different version",
          versions: ["0.2.0"]
        }
      ]),
      registry: registryIndex({ digest, level: "verified", sourceProvenanceVerified: true })
    });

    expect(result.ready).toBe(true);
    expect(result.summary).toEqual({ fail: 0, ok: 0, total: 1, warn: 1 });
    expect(result.packages[0]?.advisories).toEqual(["NIPMOD-2026-0002"]);
  });

  test("fails when a package is no longer fully verified", async () => {
    const projectDir = await projectWithLockfile();

    const result = await auditProject(projectDir, {
      allowedLogIds: [transparency.log.treeHead.logId],
      allowedWitnesses: [transparency.witness.witness],
      ...signedAdvisoryOptions([]),
      registry: registryIndex({ digest, level: "signed", sourceProvenanceVerified: false })
    });

    expect(result.ready).toBe(false);
    expect(result.packages[0]?.status).toBe("fail");
    expect(result.packages[0]?.findings).toContain("package is not verified by the public registry");
  });

  test("fails when required trust evidence is missing or false", async () => {
    const projectDir = await projectWithLockfile();
    const registry = registryIndex({ digest, level: "verified", sourceProvenanceVerified: true });
    registry.packages[0]!.trust.evidence.releaseEventSigned = false;

    const result = await auditProject(projectDir, {
      allowedLogIds: [transparency.log.treeHead.logId],
      allowedWitnesses: [transparency.witness.witness],
      ...signedAdvisoryOptions([]),
      registry
    });

    expect(result.ready).toBe(false);
    expect(result.packages[0]?.findings).toContain("package is not verified by the public registry");
  });

  test("fails when the lockfile package key does not match the package identity", async () => {
    const otherOwner = generateIdentity().did;
    const projectDir = await projectWithLockfile({
      canonical: `pkg:${otherOwner}/safe-skill`,
      key: `${canonical}@${version}`,
      publisher: otherOwner
    });

    const result = await auditProject(projectDir, {
      allowedLogIds: [transparency.log.treeHead.logId],
      allowedWitnesses: [transparency.witness.witness],
      ...signedAdvisoryOptions([]),
      registry: registryIndex({ digest, level: "verified", sourceProvenanceVerified: true })
    });

    expect(result.ready).toBe(false);
    expect(result.packages[0]?.status).toBe("fail");
    expect(result.packages[0]?.findings).toContain("lockfile package key does not match package identity");
  });

  test("fails when the registry publisher does not match the lockfile publisher", async () => {
    const otherOwner = generateIdentity().did;
    const projectDir = await projectWithLockfile({ publisher: otherOwner });

    const result = await auditProject(projectDir, {
      allowedLogIds: [transparency.log.treeHead.logId],
      allowedWitnesses: [transparency.witness.witness],
      ...signedAdvisoryOptions([]),
      registry: registryIndex({ digest, level: "verified", sourceProvenanceVerified: true })
    });

    expect(result.ready).toBe(false);
    expect(result.packages[0]?.status).toBe("fail");
    expect(result.packages[0]?.findings).toContain("registry publisher does not match lockfile publisher");
  });

  test("fails when the publisher does not match the canonical package owner", async () => {
    const attacker = generateIdentity().did;
    const forgedTransparency = testTransparency({ publisher: attacker });
    const projectDir = await projectWithLockfile({ publisher: attacker });

    const result = await auditProject(projectDir, {
      allowedLogIds: [forgedTransparency.log.treeHead.logId],
      allowedWitnesses: [forgedTransparency.witness.witness],
      ...signedAdvisoryOptions([]),
      registry: registryIndex({
        digest,
        level: "verified",
        publisher: attacker,
        sourceProvenanceVerified: true,
        transparency: forgedTransparency
      })
    });

    expect(result.ready).toBe(false);
    expect(result.packages[0]?.status).toBe("fail");
    expect(result.packages[0]?.findings).toContain("package publisher does not match canonical owner");
    expect(result.packages[0]?.findings).toContain("transparency proof is invalid");
  });

  test("rejects malformed lockfiles before reporting a healthy audit", async () => {
    const projectDir = await mkdtemp(join(tmpdir(), "nipmod-audit-bad-lock-"));
    await writeFile(join(projectDir, "nipmod.lock.json"), JSON.stringify({ formatVersion: 1, packages: {} }));

    await expect(
      auditProject(projectDir, {
        allowedLogIds: [transparency.log.treeHead.logId],
        allowedWitnesses: [transparency.witness.witness],
        ...signedAdvisoryOptions([]),
        registry: registryIndex({ digest, level: "verified", sourceProvenanceVerified: true })
      })
    ).rejects.toThrow();
  });

  test("fails when a package transparency proof is missing", async () => {
    const projectDir = await projectWithLockfile();
    const registry = registryIndex({ digest, level: "verified", sourceProvenanceVerified: true });
    delete registry.packages[0]!.proof;

    const result = await auditProject(projectDir, {
      allowedLogIds: [transparency.log.treeHead.logId],
      allowedWitnesses: [transparency.witness.witness],
      ...signedAdvisoryOptions([]),
      registry
    });

    expect(result.ready).toBe(false);
    expect(result.packages[0]?.findings).toContain("transparency proof is invalid");
  });

  test("fails when proof event metadata is not bound to the transparency leaf", async () => {
    const projectDir = await projectWithLockfile();
    const registry = registryIndex({ digest, level: "verified", sourceProvenanceVerified: true });
    registry.packages[0]!.proof!.eventHash = "c".repeat(64);

    const result = await auditProject(projectDir, {
      allowedLogIds: [transparency.log.treeHead.logId],
      allowedWitnesses: [transparency.witness.witness],
      ...signedAdvisoryOptions([]),
      registry
    });

    expect(result.ready).toBe(false);
    expect(result.packages[0]?.findings).toContain("transparency proof is invalid");
  });

  test("fails when proof leaf index is not bound to the transparency entry", async () => {
    const projectDir = await projectWithLockfile();
    const registry = registryIndex({ digest, level: "verified", sourceProvenanceVerified: true });
    registry.packages[0]!.proof!.leafIndex = 99;

    const result = await auditProject(projectDir, {
      allowedLogIds: [transparency.log.treeHead.logId],
      allowedWitnesses: [transparency.witness.witness],
      ...signedAdvisoryOptions([]),
      registry
    });

    expect(result.ready).toBe(false);
    expect(result.packages[0]?.findings).toContain("transparency proof is invalid");
  });

  test("fails when the witnessed transparency root is not pinned", async () => {
    const projectDir = await projectWithLockfile();

    const result = await auditProject(projectDir, {
      allowedLogIds: ["did:key:z6Mkother111111111111111111111111111111111"],
      allowedWitnesses: [transparency.witness.witness],
      ...signedAdvisoryOptions([]),
      registry: registryIndex({ digest, level: "verified", sourceProvenanceVerified: true })
    });

    expect(result.ready).toBe(false);
    expect(result.packages[0]?.findings).toContain("transparency proof is invalid");
  });

  test("fails when the transparency witness is not pinned", async () => {
    const projectDir = await projectWithLockfile();

    const result = await auditProject(projectDir, {
      allowedLogIds: [transparency.log.treeHead.logId],
      allowedWitnesses: ["did:key:z6Mkother111111111111111111111111111111111"],
      ...signedAdvisoryOptions([]),
      registry: registryIndex({ digest, level: "verified", sourceProvenanceVerified: true })
    });

    expect(result.ready).toBe(false);
    expect(result.packages[0]?.findings).toContain("transparency proof is invalid");
  });
});

async function projectWithLockfile(
  options: { canonical?: string; key?: string; publisher?: string } = {}
): Promise<string> {
  const projectDir = await mkdtemp(join(tmpdir(), "nipmod-audit-"));
  const packageCanonical = options.canonical ?? canonical;
  const packageKey = options.key ?? `${packageCanonical}@${version}`;
  const packagePublisher = options.publisher ?? owner;
  await writeFile(
    join(projectDir, "nipmod.lock.json"),
    `${JSON.stringify({
      formatVersion: 1,
      generatedBy: "test",
      packages: {
        [packageKey]: {
          canonical: packageCanonical,
          files: ["SKILL.md"],
          integrity: `sha256-${digest}`,
          manifestDigest: "b".repeat(64),
          name: "safe-skill",
          permissions: {
            env: [],
            exec: { allowed: false },
            filesystem: [],
            mcpTools: [],
            network: [],
            postinstall: { allowed: false },
            secrets: []
          },
          publisher: packagePublisher,
          resolved: "https://node.nipmod.com/api/v1/repos/z6Mksafe/safe-skill/blob/releases/0.1.0/bundle.nipmod",
          version
        }
      }
    })}\n`
  );
  return projectDir;
}

function registryIndex({
  digest: packageDigest,
  level,
  publisher = owner,
  quarantine,
  sourceProvenanceVerified,
  transparency: registryTransparency = transparency
}: {
  digest: string;
  level: "verified" | "signed" | "review" | "unknown";
  publisher?: string;
  quarantine?: {
    active: boolean;
    advisoryId: string;
    artifactSha256?: string;
    package: string;
    publishedAt: string;
    reason: string;
    severity: "low" | "moderate" | "high" | "critical";
    status: "active" | "withdrawn";
    type: "dev.nipmod.quarantine.v1";
    version: string;
  };
  sourceProvenanceVerified: boolean;
  transparency?: ReturnType<typeof testTransparency>;
}) {
  return {
    formatVersion: 1,
    generatedAt: "2026-05-16T03:32:00.000Z",
    packages: [
      {
        canonical,
        digest: packageDigest,
        publisher,
        trust: {
          evidence: {
            artifactDigestVerified: true,
            bundleSignatureVerified: true,
            immutableSnapshotMatched: true,
            publisherMatchesCanonical: true,
            releaseEventSigned: true,
            sourceProvenanceVerified,
            transparencyLogIncluded: true,
            transparencyLogVerified: true
          },
          level,
          score: level === "verified" ? 100 : 90
        },
        proof: {
          checkpointUrl: "/transparency/checkpoint.json",
          eventHash: registryTransparency.entry.leaf.eventHash,
          leafHash: registryTransparency.entry.leafHash,
          leafIndex: registryTransparency.entry.leafIndex,
          leafUrl: `/transparency/leaves/${registryTransparency.entry.leafHash}.json`,
          proofUrl: `/transparency/proofs/${registryTransparency.entry.leafHash}.json`,
          rootHash: registryTransparency.log.treeHead.rootHash,
          subject: `${canonical}@${version}`,
          treeSize: registryTransparency.log.treeHead.treeSize,
          type: "dev.nipmod.registry.proof.v1",
          witnesses: [registryTransparency.witness.witness],
          witnessUrls: [`/transparency/witnesses/${registryTransparency.witness.witness}.json`]
        },
        ...(quarantine ? { quarantine } : {}),
        version
      }
    ],
    skipped: [],
    source: "https://node.nipmod.com",
    transparencyLog: {
      ...registryTransparency.log,
      witnesses: [registryTransparency.witness]
    }
  };
}

function advisoryFeed(advisories: unknown[]) {
  const now = Date.now();
  const generatedAt = new Date(now - 60_000).toISOString();
  const expiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
  return {
    advisories,
    expiresAt,
    formatVersion: 1,
    generatedAt,
    type: "dev.nipmod.advisories.v1"
  };
}

async function signedAdvisoryFeed(advisories: unknown[]) {
  const dir = await mkdtemp(join(tmpdir(), "nipmod-signed-advisories-"));
  const feedPath = join(dir, "advisories.json");
  const signaturePath = `${feedPath}.sig`;
  const signed = signedAdvisoryPayload(advisories);
  const bytes = Buffer.from(`${JSON.stringify(signed.feed)}\n`);
  await writeFile(feedPath, bytes);
  await writeFile(signaturePath, `${JSON.stringify(signed.signature)}\n`);
  return { feedPath, publicKey: signed.publicKey, signaturePath };
}

function signedAdvisoryPayload(
  advisories: unknown[],
  dates: { expiresAt?: string; generatedAt?: string } = {}
) {
  const feed = advisoryFeed(advisories);
  feed.generatedAt = dates.generatedAt ?? feed.generatedAt;
  feed.expiresAt = dates.expiresAt ?? feed.expiresAt;
  const bytes = Buffer.from(`${JSON.stringify(feed)}\n`);
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyDer = publicKey.export({ format: "der", type: "spki" });
  const publicKeyInfo = {
    publicKeySpkiBase64: publicKeyDer.toString("base64"),
    publicKeySpkiSha256: createHash("sha256").update(publicKeyDer).digest("hex")
  };
  return {
    feed,
    publicKey: publicKeyInfo,
    signature: {
      algorithm: "Ed25519",
      artifact: "advisories.json",
      publicKeySpkiSha256: publicKeyInfo.publicKeySpkiSha256,
      signatureBase64: sign(null, bytes, privateKey).toString("base64"),
      type: "dev.nipmod.advisory.signature.v1"
    }
  };
}

function signedAdvisoryOptions(advisories: unknown[], dates: { expiresAt?: string; generatedAt?: string } = {}) {
  const signed = signedAdvisoryPayload(advisories, dates);
  return {
    advisoriesBytes: Buffer.from(`${JSON.stringify(signed.feed)}\n`),
    advisoriesSignature: signed.signature,
    advisoryPublicKeySpkiBase64: signed.publicKey.publicKeySpkiBase64,
    advisoryPublicKeySpkiSha256: signed.publicKey.publicKeySpkiSha256
  };
}

function jsonFetch(payloads: Record<string, unknown>, requests: string[] = []): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    requests.push(url);
    if (!(url in payloads)) {
      return new Response("not found", { status: 404 });
    }
    return new Response(`${JSON.stringify(payloads[url])}\n`, {
      headers: { "content-type": "application/json" },
      status: 200
    });
  }) as typeof fetch;
}

function testTransparency(options: { publisher?: string } = {}) {
  const logIdentity = generateIdentity();
  const witnessIdentity = generateIdentity();
  const leaf = {
    artifactSha256: digest,
    eventHash: "b".repeat(64),
    package: canonical,
    publisher: options.publisher ?? owner,
    version
  };
  const log = createTransparencyLogFromLeaves([leaf], logIdentity, "2026-05-16T03:53:00.000Z");
  const witness = signWitnessStatement(log.treeHead, witnessIdentity);
  const entry = log.entries[0];
  if (!entry) {
    throw new Error("missing test transparency entry");
  }
  return { entry, log, witness };
}
