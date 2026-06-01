import { describe, expect, test } from "vitest";
import { packProject } from "../src/bundle.js";
import { generateIdentity } from "../src/identity.js";
import { signReleaseEvent } from "../src/release.js";
import {
  createTransparencyLog,
  createTransparencyLogFromLeaves,
  extendTransparencyLog,
  releaseEventHash,
  signWitnessStatement,
  verifyTransparencyEntry,
  verifyTransparencyLog,
  verifyWitnessStatement,
  type TransparencyLogLeafInput
} from "../src/transparency.js";
import { BUNDLE_MEDIA_TYPE } from "../src/bundle.js";
import { createSignedSkillProject } from "./helpers/package.js";

describe("transparency log", () => {
  test("creates a signed tree head and verifies inclusion proofs", async () => {
    const logIdentity = generateIdentity();
    const leaf = await signedLeafInput();
    const log = createTransparencyLog([leaf], logIdentity, "2026-05-15T00:00:00.000Z");

    expect(log.formatVersion).toBe(1);
    expect(log.treeHead.logId).toBe(logIdentity.did);
    expect(log.treeHead.treeSize).toBe(1);
    expect(log.entries[0]?.leaf.eventHash).toBe(releaseEventHash(leaf.releaseEvent));
    expect(verifyTransparencyEntry(log.entries[0], log.treeHead)).toBe(true);
    expect(verifyTransparencyEntry(log.entries[0], log.treeHead, [logIdentity.did])).toBe(true);
    expect(verifyTransparencyEntry(log.entries[0], log.treeHead, [])).toBe(false);
  });

  test("rejects tampered inclusion leaves", async () => {
    const logIdentity = generateIdentity();
    const leaf = await signedLeafInput();
    const log = createTransparencyLog([leaf], logIdentity, "2026-05-15T00:00:00.000Z");
    const entry = log.entries[0];
    if (!entry) {
      throw new Error("expected log entry");
    }

    expect(
      verifyTransparencyEntry(
        {
          ...entry,
          leafHash: "0".repeat(64)
        },
        log.treeHead
      )
    ).toBe(false);
  });

  test("rejects conflicting events for the same package version", async () => {
    const logIdentity = generateIdentity();
    const { conflict, leaf } = await conflictingLeafInputs();

    expect(() =>
      createTransparencyLog([leaf, conflict], logIdentity, "2026-05-15T00:00:00.000Z")
    ).toThrow(/conflicting transparency log event/i);
  });

  test("rebuilds a signed log from prior normalized leaves", async () => {
    const logIdentity = generateIdentity();
    const leaf = await signedLeafInput();
    const first = createTransparencyLog([leaf], logIdentity, "2026-05-15T00:00:00.000Z");
    const rebuilt = createTransparencyLogFromLeaves(
      first.entries.map((entry) => entry.leaf),
      logIdentity,
      "2026-05-15T00:00:00.000Z"
    );

    expect(rebuilt.treeHead.rootHash).toBe(first.treeHead.rootHash);
    expect(rebuilt.entries[0]?.leafHash).toBe(first.entries[0]?.leafHash);
    expect(verifyTransparencyEntry(rebuilt.entries[0], rebuilt.treeHead, [logIdentity.did])).toBe(true);
  });

  test("extends prior logs without reordering existing leaves", async () => {
    const logIdentity = generateIdentity();
    const previousLeaf = {
      artifactSha256: "a".repeat(64),
      eventHash: "b".repeat(64),
      package: "pkg:did:key:zzzzzzzzzzzzzzzzzzzz/zzz",
      publisher: "did:key:zzzzzzzzzzzzzzzzzzzz",
      version: "0.1.0"
    };
    const first = createTransparencyLogFromLeaves([previousLeaf], logIdentity, "2026-05-15T00:00:00.000Z");
    const nextLeaf = await signedLeafInput();
    const extended = extendTransparencyLog(first, [nextLeaf], logIdentity, "2026-05-16T00:00:00.000Z");

    expect(extended.entries.map((entry) => entry.leaf.package)).toEqual([
      previousLeaf.package,
      nextLeaf.package
    ]);
    expect(verifyTransparencyLog(extended, [logIdentity.did])).toBe(true);
  });

  test("verifies every entry in odd sized transparency trees", () => {
    const logIdentity = generateIdentity();
    const leaves = Array.from({ length: 7 }, (_, index) => ({
      artifactSha256: String(index).repeat(64).slice(0, 64).padEnd(64, "0"),
      eventHash: String(index + 1).repeat(64).slice(0, 64).padEnd(64, "1"),
      package: `pkg:did:key:z6Mkowner/package-${index}`,
      publisher: "did:key:z6Mkowner",
      version: "0.1.0"
    }));
    const log = createTransparencyLogFromLeaves(leaves, logIdentity, "2026-05-16T00:00:00.000Z");

    expect(verifyTransparencyLog(log, [logIdentity.did])).toBe(true);
    expect(log.entries.every((entry) => verifyTransparencyEntry(entry, log.treeHead, [logIdentity.did]))).toBe(true);
  });

  test("signs and verifies witnessed tree-head checkpoints", async () => {
    const logIdentity = generateIdentity();
    const witnessIdentity = generateIdentity();
    const leaf = await signedLeafInput();
    const log = createTransparencyLog([leaf], logIdentity, "2026-05-15T00:00:00.000Z");
    const witness = signWitnessStatement(log.treeHead, witnessIdentity);

    expect(witness.witness).toBe(witnessIdentity.did);
    expect(verifyWitnessStatement(witness, log.treeHead)).toBe(true);
    expect(verifyWitnessStatement(witness, log.treeHead, [witnessIdentity.did])).toBe(true);
    expect(verifyWitnessStatement(witness, log.treeHead, [])).toBe(false);
  });

  test("rejects same-key log and witness identities", async () => {
    const logIdentity = generateIdentity();
    const leaf = await signedLeafInput();
    const log = createTransparencyLog([leaf], logIdentity, "2026-05-15T00:00:00.000Z");

    expect(() => signWitnessStatement(log.treeHead, logIdentity)).toThrow(/witness identity/i);
  });

  test("rejects witnessed checkpoints for a different tree head", async () => {
    const logIdentity = generateIdentity();
    const witnessIdentity = generateIdentity();
    const leaf = await signedLeafInput();
    const log = createTransparencyLog([leaf], logIdentity, "2026-05-15T00:00:00.000Z");
    const witness = signWitnessStatement(log.treeHead, witnessIdentity);

    expect(
      verifyWitnessStatement(witness, {
        ...log.treeHead,
        rootHash: "0".repeat(64)
      })
    ).toBe(false);
  });

  test("requires an allowed checkpoint witness when supplied", async () => {
    const logIdentity = generateIdentity();
    const witnessIdentity = generateIdentity();
    const otherIdentity = generateIdentity();
    const leaf = await signedLeafInput();
    const log = createTransparencyLog([leaf], logIdentity, "2026-05-15T00:00:00.000Z");
    const witness = signWitnessStatement(log.treeHead, witnessIdentity);

    expect(verifyWitnessStatement(witness, log.treeHead, [otherIdentity.did])).toBe(false);
  });
});

async function signedLeafInput(): Promise<TransparencyLogLeafInput> {
  const project = await createSignedSkillProject();
  const packed = await packProject(project.dir, {
    signingPrivateKeyPem: project.identity.privateKeyPem
  });
  return signedLeafFor(project, packed, packed.digest);
}

async function conflictingLeafInputs(): Promise<{
  conflict: TransparencyLogLeafInput;
  leaf: TransparencyLogLeafInput;
}> {
  const project = await createSignedSkillProject();
  const packed = await packProject(project.dir, {
    signingPrivateKeyPem: project.identity.privateKeyPem
  });

  return {
    conflict: signedLeafFor(project, packed, "0".repeat(64)),
    leaf: signedLeafFor(project, packed, packed.digest)
  };
}

function signedLeafFor(
  project: Awaited<ReturnType<typeof createSignedSkillProject>>,
  packed: Awaited<ReturnType<typeof packProject>>,
  artifactSha256: string
): TransparencyLogLeafInput {
  const releaseEvent = signReleaseEvent(
    {
      type: "dev.nipmod.release.v1",
      formatVersion: 1,
      package: packed.manifest.canonical,
      version: packed.manifest.version,
      publisher: packed.manifest.publish.signingKey,
      source: {
        type: "gitlawb",
        repo: `gitlawb://${project.identity.did}/signed-skill`,
        tag: "v0.1.0"
      },
      artifact: {
        mediaType: BUNDLE_MEDIA_TYPE,
        path: "releases/0.1.0/bundle.nipmod",
        manifestDigest: packed.manifestDigest,
        sha256: artifactSha256
      }
    },
    project.identity
  );

  return {
    artifactSha256,
    package: packed.manifest.canonical,
    publisher: project.identity.did,
    releaseEvent,
    version: packed.manifest.version
  };
}
