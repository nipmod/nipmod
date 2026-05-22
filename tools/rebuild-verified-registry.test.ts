import { describe, expect, test } from "vitest";
import {
  assertVerifiedRegistry,
  assertWitnessMatchesCheckpoint,
  parseEnvFile,
  validateVerifiedRegistryEnv
} from "./rebuild-verified-registry.ts";

const logId = "did:key:z6Mklog";
const witness = "did:key:z6Mkwitness";

describe("verified registry rebuild guard", () => {
  test("parses and validates pinned witness env", () => {
    const env = parseEnvFile(`
      # public pins
      NIPMOD_WITNESS_STATEMENTS_SOURCE="https://nipmod-witness.fly.dev/witness-statements.json"
      NIPMOD_ALLOWED_LOG_IDS=${logId}
      NIPMOD_ALLOWED_WITNESSES='${witness}'
    `);

    expect(validateVerifiedRegistryEnv(env)).toEqual({
      allowedLogIds: [logId],
      allowedWitnesses: [witness],
      source: "https://nipmod-witness.fly.dev/witness-statements.json"
    });
  });

  test("rejects non-https witness sources", () => {
    expect(() =>
      validateVerifiedRegistryEnv({
        NIPMOD_ALLOWED_LOG_IDS: logId,
        NIPMOD_ALLOWED_WITNESSES: witness,
        NIPMOD_WITNESS_STATEMENTS_SOURCE: "http://127.0.0.1/witness.json"
      })
    ).toThrow(/https/i);
  });

  test("accepts a pinned witness that matches the checkpoint", () => {
    const statement = assertWitnessMatchesCheckpoint({
      allowedLogIds: [logId],
      allowedWitnesses: [witness],
      checkpoint: checkpointFixture(),
      witnessPayload: witnessPayloadFixture()
    });

    expect(statement.witness).toBe(witness);
  });

  test("rejects stale witness roots", () => {
    const payload = witnessPayloadFixture();
    payload.statements[0].treeHead.rootHash = "b".repeat(64);

    expect(() =>
      assertWitnessMatchesCheckpoint({
        allowedLogIds: [logId],
        allowedWitnesses: [witness],
        checkpoint: checkpointFixture(),
        witnessPayload: payload
      })
    ).toThrow(/root hash/i);
  });

  test("requires every transparent package to have external witness verification", () => {
    expect(() =>
      assertVerifiedRegistry(
        {
          packages: [
            {
              canonical: "pkg:did:key:z6Mkowner/alpha",
              proof: { witnesses: [witness] },
              trust: {
                evidence: {
                  transparencyLogIncluded: true,
                  transparencyLogVerified: false
                }
              }
            }
          ]
        },
        { allowedWitnesses: [witness] }
      )
    ).toThrow(/not verified/i);
  });

  test("accepts a verified package with a pinned witness reference", () => {
    expect(() =>
      assertVerifiedRegistry(
        {
          packages: [
            {
              canonical: "pkg:did:key:z6Mkowner/alpha",
              proof: { witnesses: [witness] },
              trust: {
                evidence: {
                  transparencyLogIncluded: true,
                  transparencyLogVerified: true
                }
              }
            }
          ]
        },
        { allowedWitnesses: [witness] }
      )
    ).not.toThrow();
  });

  test("rejects verified typosquat-confusable package names", () => {
    expect(() =>
      assertVerifiedRegistry(
        {
          packages: [
            verifiedPackage("pkg:did:key:z6Mkowner/gitlawb-release-review", "gitlawb-release-review"),
            verifiedPackage("pkg:did:key:z6Mkother/gitlawb-re1ease-review", "gitlawb-re1ease-review")
          ]
        },
        { allowedWitnesses: [witness] }
      )
    ).toThrow(/typosquat/i);
  });
});

function verifiedPackage(canonical, name) {
  return {
    canonical,
    name,
    proof: { witnesses: [witness] },
    trust: {
      level: "verified",
      score: 100,
      evidence: {
        transparencyLogIncluded: true,
        transparencyLogVerified: true
      }
    }
  };
}

function checkpointFixture() {
  return {
    formatVersion: 1,
    generatedAt: "2026-05-16T00:00:00.000Z",
    logId,
    rootHash: "a".repeat(64),
    treeSize: 1
  };
}

function witnessPayloadFixture() {
  return {
    formatVersion: 1,
    statements: [
      {
        formatVersion: 1,
        signature: {
          algorithm: "Ed25519",
          keyId: witness,
          signatureBase64: "signed"
        },
        treeHead: checkpointFixture(),
        type: "dev.nipmod.transparency.witness.v1",
        witness
      }
    ],
    type: "dev.nipmod.transparency.witness-statements.v1"
  };
}
