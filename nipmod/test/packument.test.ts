import { describe, expect, test } from "vitest";
import { buildPackageDocuments } from "../src/packument.js";

describe("package document builder", () => {
  test("groups registry records into package documents with latest dist tag", () => {
    const documents = buildPackageDocuments([
      {
        ...registryPackage("pkg:did:key:z6Mka/example", "example", "1.0.0"),
        dependencies: {
          "agent-logger": "^1.0.0"
        }
      },
      registryPackage("pkg:did:key:z6Mka/example", "example", "1.10.0"),
      registryPackage("pkg:did:key:z6Mka/example", "example", "2.0.0")
    ]);

    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({
      canonical: "pkg:did:key:z6Mka/example",
      distTags: {
        latest: "2.0.0"
      },
      name: "example"
    });
    expect(documents[0]?.versions["1.0.0"]?.dependencies).toEqual({
      "agent-logger": "^1.0.0"
    });
    expect(Object.keys(documents[0]?.versions ?? {})).toEqual(["1.0.0", "1.10.0", "2.0.0"]);
  });

  test("keeps same display names separate when canonical DID owners differ", () => {
    const documents = buildPackageDocuments([
      registryPackage("pkg:did:key:z6Mka/shared", "shared", "0.1.0"),
      registryPackage("pkg:did:key:z6Mkb/shared", "shared", "0.1.0")
    ]);

    expect(documents.map((doc) => doc.canonical).sort()).toEqual([
      "pkg:did:key:z6Mka/shared",
      "pkg:did:key:z6Mkb/shared"
    ]);
  });

  test("uses source dist tags instead of highest semver", () => {
    const documents = buildPackageDocuments([
      {
        ...registryPackage("pkg:did:key:z6Mka/example", "example", "2.0.0")
      },
      {
        ...registryPackage("pkg:did:key:z6Mka/example", "example", "1.0.0"),
        distTags: {
          latest: "1.0.0"
        }
      }
    ]);

    expect(documents[0]?.distTags.latest).toBe("1.0.0");
  });

  test("fails closed on conflicting source dist tags", () => {
    expect(() =>
      buildPackageDocuments([
        {
          ...registryPackage("pkg:did:key:z6Mka/example", "example", "1.0.0"),
          distTags: {
            latest: "1.0.0"
          }
        },
        {
          ...registryPackage("pkg:did:key:z6Mka/example", "example", "2.0.0"),
          distTags: {
            latest: "2.0.0"
          }
        }
      ])
    ).toThrow(/conflicting latest/i);
  });

  test("fails closed when the same canonical version has conflicting digests", () => {
    expect(() =>
      buildPackageDocuments([
        registryPackage("pkg:did:key:z6Mka/example", "example", "0.1.0", "a".repeat(64)),
        registryPackage("pkg:did:key:z6Mka/example", "example", "0.1.0", "b".repeat(64))
      ])
    ).toThrow(/conflicting/i);
  });
});

function registryPackage(canonical: string, name: string, version: string, digest = "a".repeat(64)) {
  return {
    canonical,
    description: `${name} package`,
    digest,
    name,
    publisher: canonical.slice("pkg:".length).split("/")[0] ?? "",
    trust: {
      level: "verified",
      score: 100
    },
    type: "skill",
    version
  };
}
