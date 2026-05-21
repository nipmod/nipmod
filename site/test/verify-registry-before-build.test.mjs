import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { assertRegistryVerified } from "../scripts/verify-registry-before-build.mjs";

const fixtureDir = (...parts) => join(import.meta.dirname, "..", ...parts);

describe("build-time registry verification", () => {
  test("accepts an empty public archive without transparency files", async () => {
    await expect(assertRegistryVerified({ index: { packages: [] } })).resolves.toBeUndefined();
  });

  test("accepts the static registry only when log, proof and witness signatures verify", async () => {
    await expect(assertLiveFixture()).resolves.toBeUndefined();
  });

  test("rejects packages that lost external witness verification", async () => {
    const fixture = await liveFixture();
    fixture.index.packages[0].trust.evidence.transparencyLogVerified = false;

    await expect(assertRegistryVerified(fixture)).rejects.toThrow("is not externally witnessed");
  });

  test("rejects forged witness signatures", async () => {
    const fixture = await liveFixture();
    fixture.witnessPayload.statements[0].signature.signatureBase64 = "signed";

    await expect(assertRegistryVerified(fixture)).rejects.toThrow("witness signature is invalid");
  });

  test("rejects transparency log leaf tampering", async () => {
    const fixture = await liveFixture();
    const pkg = fixture.index.packages[0];
    const entry = fixture.transparencyLog.entries.find(
      (candidate) => `${candidate.leaf.package}@${candidate.leaf.version}` === `${pkg.canonical}@${pkg.version}`
    );
    entry.leaf.artifactSha256 = "0".repeat(64);

    await expect(assertRegistryVerified(fixture)).rejects.toThrow("transparency proof is invalid");
  });

  test("rejects claimed source provenance without a pinned commit and version tag", async () => {
    const fixture = await liveFixture();
    fixture.index.packages[0].sourceCommit = null;
    fixture.index.packages[0].sourceTag = null;

    await expect(assertRegistryVerified(fixture)).rejects.toThrow("source provenance metadata is invalid");
  });

  test("rejects source tags that no longer resolve to the pinned commit", async () => {
    const fixture = await liveFixture();
    const pkg = fixture.index.packages[0];
    const fetchFn = async (url) => {
      const releasePackage = releasePackageForUrl(fixture, url);
      if (releasePackage) {
        return jsonResponse(liveReleaseEvent(fixture, releasePackage.canonical));
      }
      if (String(url).includes("/info/refs?service=git-upload-pack")) {
        return bufferResponse(gitInfoRefs(`refs/tags/${pkg.sourceTag}`, "0".repeat(40)));
      }
      throw new Error(`unexpected fetch: ${url}`);
    };

    await expect(assertRegistryVerified({ ...fixture, fetchFn })).rejects.toThrow("source tag does not match pinned commit");
  });

  test("rejects release events whose signed source tag no longer matches the package", async () => {
    const fixture = await liveFixture();
    const pkg = fixture.index.packages[0];
    const releaseEvent = liveReleaseEvent(fixture, pkg.canonical);
    releaseEvent.payload.source.tag = "v9.9.9";

    await expect(
      assertRegistryVerified({
        ...fixture,
        fetchFn: sourceRefFetch(fixture, { releaseEvents: new Map([[pkg.canonical, releaseEvent]]) })
      })
    ).rejects.toThrow("release event source tag mismatch");
  });
});

async function assertLiveFixture() {
  const fixture = await liveFixture();
  await assertRegistryVerified({ ...fixture, fetchFn: sourceRefFetch(fixture) });
}

async function liveFixture() {
  const transparencyLog = await readJson("test", "fixtures", "seed-public-registry", "transparency-log.json");
  return {
    checkpoint: await readJson("test", "fixtures", "seed-public-registry", "transparency-checkpoint.json"),
    index: await readJson("test", "fixtures", "seed-public-registry", "registry-data.json"),
    releaseEvents: await readJson("test", "fixtures", "release-events.json"),
    transparencyLog,
    witnessPayload: {
      formatVersion: 1,
      statements: transparencyLog.witnesses,
      type: "dev.nipmod.transparency.witness-statements.v1"
    }
  };
}

async function readJson(...parts) {
  return JSON.parse(await readFile(fixtureDir(...parts), "utf8"));
}

function sourceRefFetch(fixture, { releaseEvents = new Map() } = {}) {
  return async (url) => {
    const releasePackage = releasePackageForUrl(fixture, url);
    if (releasePackage) {
      return jsonResponse(releaseEvents.get(releasePackage.canonical) ?? liveReleaseEvent(fixture, releasePackage.canonical));
    }
    const source = fixture.index.packages.find((pkg) =>
      String(url).startsWith(`${pkg.sourceRepo}/info/refs?service=git-upload-pack`)
    );
    if (!source) {
      throw new Error(`unexpected fetch: ${url}`);
    }
    return bufferResponse(gitInfoRefs(`refs/tags/${source.sourceTag}`, source.sourceCommit));
  };
}

function releasePackageForUrl(fixture, url) {
  if (!String(url).includes("/blob/releases/0.1.0/release.json")) {
    return null;
  }
  return fixture.index.packages.find((pkg) => String(url).startsWith(pkg.resolved.split("/blob/")[0]));
}

function jsonResponse(value) {
  return {
    ok: true,
    json: async () => value
  };
}

function bufferResponse(bytes) {
  return {
    ok: true,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  };
}

function gitInfoRefs(ref, commit) {
  const lines = [
    pktLine("# service=git-upload-pack\n"),
    "0000",
    pktLine(`${commit} ${ref}\n`)
  ];
  return Buffer.from(lines.join(""), "utf8");
}

function pktLine(value) {
  return `${(value.length + 4).toString(16).padStart(4, "0")}${value}`;
}

function liveReleaseEvent(fixtureOrCanonical, maybeCanonical) {
  if (maybeCanonical !== undefined) {
    const event = fixtureOrCanonical.releaseEvents?.[maybeCanonical];
    if (!event) {
      throw new Error(`missing release event fixture for ${maybeCanonical}`);
    }
    return structuredClone(event);
  }
  const canonical = fixtureOrCanonical;
  const event = liveReleaseEvents()[canonical];
  if (!event) {
    throw new Error(`missing release event fixture for ${canonical}`);
  }
  return structuredClone(event);
}

function liveReleaseEvents() {
  return {
      "pkg:did:key:z6MkgXXLN2Qt3GKL9KJPo7SH7WGcQqRYcpT5MrwbTJ9qHpZu/repo-readme-audit": {
          "payload": {
              "artifact": {
                  "manifestDigest": "6736f94d226dda2d612b1b073ccc260ae34a1baa56b70da7f5622a78d6f311f4",
                  "mediaType": "application/vnd.nipmod.bundle.v1+json",
                  "path": "releases/0.1.0/bundle.nipmod",
                  "sha256": "aa102c984a663b1fb4811740667ac1b14a80c9000870dfc6d3e854b9b3c0ba58"
              },
              "formatVersion": 1,
              "package": "pkg:did:key:z6MkgXXLN2Qt3GKL9KJPo7SH7WGcQqRYcpT5MrwbTJ9qHpZu/repo-readme-audit",
              "publisher": "did:key:z6MkgXXLN2Qt3GKL9KJPo7SH7WGcQqRYcpT5MrwbTJ9qHpZu",
              "source": {
                  "repo": "gitlawb://did:key:z6MkgXXLN2Qt3GKL9KJPo7SH7WGcQqRYcpT5MrwbTJ9qHpZu/repo-readme-audit",
                  "tag": "v0.1.0",
                  "type": "gitlawb"
              },
              "type": "dev.nipmod.release.v1",
              "version": "0.1.0"
          },
          "signature": {
              "algorithm": "Ed25519",
              "keyId": "did:key:z6MkgXXLN2Qt3GKL9KJPo7SH7WGcQqRYcpT5MrwbTJ9qHpZu",
              "signatureBase64": "Kck99ABwDMZf7fs4lKL3gYOutNLuTyOdJ1Az8YxCFvVPHEckmPdVozFgYcFXC0jVfjoEN89ki7RVCy4n715mBA=="
          }
      },
      "pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader": {
          "payload": {
              "artifact": {
                  "manifestDigest": "8a8bfe60f9ae8daed86269029906054470ec990c676cfe453b2ddfef39cd9d0f",
                  "mediaType": "application/vnd.nipmod.bundle.v1+json",
                  "path": "releases/0.1.0/bundle.nipmod",
                  "sha256": "d57b227f009f974d26537db6677083c12071d52a40121fbadd655ba54f302818"
              },
              "formatVersion": 1,
              "package": "pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader",
              "publisher": "did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD",
              "source": {
                  "repo": "gitlawb://did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader",
                  "tag": "v0.1.0",
                  "type": "gitlawb"
              },
              "type": "dev.nipmod.release.v1",
              "version": "0.1.0"
          },
          "signature": {
              "algorithm": "Ed25519",
              "keyId": "did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD",
              "signatureBase64": "iKbBHvDPqBc7o4XdBIo3IUV0sSSxhSG3d4kDOAC2IORJQhEhQPxiE9ZCs1P46OfJny2m22Y8IoKbDLjfuXdtBg=="
          }
      },
      "pkg:did:key:z6Mkqm8Ub1wbA79siRozF1Q7j1DjixxFNAsHnSSfPaT2iA1C/dependency-risk-review": {
          "payload": {
              "artifact": {
                  "manifestDigest": "c66eb6e4740a8c7361e79b642ae4e785be64fc5bdd0cecd6c2f0bf163f1ca93a",
                  "mediaType": "application/vnd.nipmod.bundle.v1+json",
                  "path": "releases/0.1.0/bundle.nipmod",
                  "sha256": "30e7f7594ad3c17276cac9f736db5c7915a614ae24afdd11a93ed61e48cb0f3d"
              },
              "formatVersion": 1,
              "package": "pkg:did:key:z6Mkqm8Ub1wbA79siRozF1Q7j1DjixxFNAsHnSSfPaT2iA1C/dependency-risk-review",
              "publisher": "did:key:z6Mkqm8Ub1wbA79siRozF1Q7j1DjixxFNAsHnSSfPaT2iA1C",
              "source": {
                  "repo": "gitlawb://did:key:z6Mkqm8Ub1wbA79siRozF1Q7j1DjixxFNAsHnSSfPaT2iA1C/dependency-risk-review",
                  "tag": "v0.1.0",
                  "type": "gitlawb"
              },
              "type": "dev.nipmod.release.v1",
              "version": "0.1.0"
          },
          "signature": {
              "algorithm": "Ed25519",
              "keyId": "did:key:z6Mkqm8Ub1wbA79siRozF1Q7j1DjixxFNAsHnSSfPaT2iA1C",
              "signatureBase64": "am+F2YpOm69+DxlMti80Z9rRDdrR55jjsxRQ1xBf0pRe6zSrsVSVDyJwUc7EikFx/XvAFbgn5KXH/tZ1yYTqAA=="
          }
      }
  };
}
