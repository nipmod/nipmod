import { describe, expect, test } from "vitest";
import { signLifecycleEvent, verifySignedLifecycleEvent } from "../src/lifecycle.js";
import { generateIdentity } from "../src/identity.js";

describe("lifecycle events", () => {
  test("signs and verifies dist-tag metadata against package, publisher and tag", () => {
    const identity = generateIdentity();
    const canonical = `pkg:${identity.did}/signed-skill`;
    const event = signLifecycleEvent(
      {
        type: "dev.nipmod.lifecycle.v1",
        formatVersion: 1,
        package: canonical,
        publisher: identity.did,
        source: {
          type: "gitlawb",
          repo: `gitlawb://${identity.did}/signed-skill`
        },
        publishedAt: "2026-05-17T00:00:00.000Z",
        action: {
          kind: "dist-tag.set",
          tag: "latest",
          version: "0.2.0"
        }
      },
      identity
    );

    expect(event.signature.keyId).toBe(identity.did);
    expect(event.signature.algorithm).toBe("Ed25519");
    expect(event.signature.signatureBase64.length).toBeGreaterThan(80);
    expect(
      verifySignedLifecycleEvent(event, {
        actionKind: "dist-tag.set",
        package: canonical,
        publisher: identity.did,
        sourceRepo: `gitlawb://${identity.did}/signed-skill`,
        tag: "latest",
        version: "0.2.0"
      }).payload.action
    ).toMatchObject({ kind: "dist-tag.set", tag: "latest", version: "0.2.0" });
  });

  test("rejects tampered signed lifecycle metadata", () => {
    const identity = generateIdentity();
    const canonical = `pkg:${identity.did}/signed-skill`;
    const event = signLifecycleEvent(
      {
        type: "dev.nipmod.lifecycle.v1",
        formatVersion: 1,
        package: canonical,
        publisher: identity.did,
        source: {
          type: "gitlawb",
          repo: `gitlawb://${identity.did}/signed-skill`
        },
        publishedAt: "2026-05-17T00:00:00.000Z",
        action: {
          kind: "yank",
          version: "0.1.0",
          reason: "Unsafe package release"
        }
      },
      identity
    );

    expect(() =>
      verifySignedLifecycleEvent({
        ...event,
        payload: {
          ...event.payload,
          action: {
            ...event.payload.action,
            reason: "Changed after signing"
          }
        }
      })
    ).toThrow(/signature/i);
  });

  test("rejects lifecycle events signed by a non-owner identity", () => {
    const owner = generateIdentity();
    const attacker = generateIdentity();

    expect(() =>
      signLifecycleEvent(
        {
          type: "dev.nipmod.lifecycle.v1",
          formatVersion: 1,
          package: `pkg:${owner.did}/signed-skill`,
          publisher: owner.did,
          source: {
            type: "gitlawb",
            repo: `gitlawb://${owner.did}/signed-skill`
          },
          publishedAt: "2026-05-17T00:00:00.000Z",
          action: {
            kind: "deprecate",
            version: "0.1.0",
            reason: "Use signed-skill@0.2.0"
          }
        },
        attacker
      )
    ).toThrow(/publisher/i);
  });
});
