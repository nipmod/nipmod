import { describe, expect, test } from "vitest";
import { packProject } from "../src/bundle.js";
import { signReleaseEvent, verifySignedReleaseEvent } from "../src/release.js";
import { BUNDLE_MEDIA_TYPE } from "../src/bundle.js";
import { createSignedSkillProject } from "./helpers/package.js";

describe("release events", () => {
  test("signs and verifies release metadata against package, version and artifact digest", async () => {
    const project = await createSignedSkillProject();
    const packed = await packProject(project.dir, {
      signingPrivateKeyPem: project.identity.privateKeyPem
    });
    const event = signReleaseEvent(
      {
        type: "dev.nipmod.release.v1",
        formatVersion: 1,
        package: packed.manifest.canonical,
        version: packed.manifest.version,
        publisher: packed.manifest.publish.signingKey,
        artifact: {
          mediaType: BUNDLE_MEDIA_TYPE,
          path: "releases/0.1.0/bundle.nipmod",
          manifestDigest: packed.manifestDigest,
          sha256: packed.digest
        },
        source: {
          type: "gitlawb",
          repo: `gitlawb://${project.identity.did}/signed-skill`,
          tag: "v0.1.0"
        }
      },
      project.identity
    );

    expect(event.payload.package).toBe(packed.manifest.canonical);
    expect(event.payload.artifact.manifestDigest).toBe(packed.manifestDigest);
    expect(event.payload.artifact.path).toBe("releases/0.1.0/bundle.nipmod");
    expect(event.signature.keyId).toBe(project.identity.did);
    expect(event.signature.algorithm).toBe("Ed25519");
    expect(event.signature.signatureBase64.length).toBeGreaterThan(80);
    expect(
      verifySignedReleaseEvent(event, {
        artifactSha256: packed.digest,
        sourceRepo: `gitlawb://${project.identity.did}/signed-skill`,
        sourceTag: "v0.1.0",
        mediaType: BUNDLE_MEDIA_TYPE,
        package: packed.manifest.canonical,
        publisher: project.identity.did,
        version: packed.manifest.version
      }).payload.package
    ).toBe(packed.manifest.canonical);
  });

  test("rejects tampered signed release metadata", async () => {
    const project = await createSignedSkillProject();
    const packed = await packProject(project.dir, {
      signingPrivateKeyPem: project.identity.privateKeyPem
    });
    const event = signReleaseEvent(
      {
        type: "dev.nipmod.release.v1",
        formatVersion: 1,
        package: packed.manifest.canonical,
        version: packed.manifest.version,
        publisher: packed.manifest.publish.signingKey,
        artifact: {
          mediaType: BUNDLE_MEDIA_TYPE,
          path: "releases/0.1.0/bundle.nipmod",
          manifestDigest: packed.manifestDigest,
          sha256: packed.digest
        },
        source: {
          type: "gitlawb",
          repo: `gitlawb://${project.identity.did}/signed-skill`,
          tag: "v0.1.0"
        }
      },
      project.identity
    );

    expect(() =>
      verifySignedReleaseEvent(
        {
          ...event,
          payload: {
            ...event.payload,
            artifact: {
              ...event.payload.artifact,
              sha256: "0".repeat(64)
            }
          }
        },
        { artifactSha256: "0".repeat(64) }
      )
    ).toThrow(/signature/i);
  });

  test("rejects expected package mismatches even when the signature is valid", async () => {
    const project = await createSignedSkillProject();
    const packed = await packProject(project.dir, {
      signingPrivateKeyPem: project.identity.privateKeyPem
    });
    const event = signReleaseEvent(
      {
        type: "dev.nipmod.release.v1",
        formatVersion: 1,
        package: packed.manifest.canonical,
        version: packed.manifest.version,
        publisher: packed.manifest.publish.signingKey,
        artifact: {
          mediaType: BUNDLE_MEDIA_TYPE,
          path: "releases/0.1.0/bundle.nipmod",
          manifestDigest: packed.manifestDigest,
          sha256: packed.digest
        },
        source: {
          type: "gitlawb",
          repo: `gitlawb://${project.identity.did}/signed-skill`,
          tag: "v0.1.0"
        }
      },
      project.identity
    );

    expect(() =>
      verifySignedReleaseEvent(event, {
        package: `${packed.manifest.canonical}-other`
      })
    ).toThrow(/package/i);
  });

  test("rejects source repo substitutions even when the signature is valid", async () => {
    const project = await createSignedSkillProject();
    const packed = await packProject(project.dir, {
      signingPrivateKeyPem: project.identity.privateKeyPem
    });
    const event = signReleaseEvent(
      {
        type: "dev.nipmod.release.v1",
        formatVersion: 1,
        package: packed.manifest.canonical,
        version: packed.manifest.version,
        publisher: packed.manifest.publish.signingKey,
        artifact: {
          mediaType: BUNDLE_MEDIA_TYPE,
          path: "releases/0.1.0/bundle.nipmod",
          manifestDigest: packed.manifestDigest,
          sha256: packed.digest
        },
        source: {
          type: "gitlawb",
          repo: `gitlawb://${project.identity.did}/signed-skill`,
          tag: "v0.1.0"
        }
      },
      project.identity
    );

    expect(() =>
      verifySignedReleaseEvent(event, {
        sourceRepo: `gitlawb://${project.identity.did}/other-repo`
      })
    ).toThrow(/source repo/i);
  });
});
