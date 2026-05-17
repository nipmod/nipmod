import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("public review packet", () => {
  test("publishes machine readable review and evidence handoff without endorsement claims", async () => {
    const [packet, manifest] = await Promise.all([
      readJson("site/public/review/packet.json"),
      readJson("site/public/review/evidence-manifest.json")
    ]);

    expect(packet).toMatchObject({
      claims: {
        externalAdoptionProven: false,
        gitlawbEndorsed: false,
        independentlyAudited: false,
        technicalLaunchReady: true
      },
      status: "ready-for-independent-review",
      type: "dev.nipmod.review-packet.v1"
    });
    expect(packet.targets).toMatchObject({
      bankrToken: "https://bankr.bot/launches/0x5155Eaa3B5784B829DeAD78189Eb4Bf69359dbA3",
      evidenceLedger: "https://nipmod.com/review/evidence-ledger.json",
      proofTranscript: "https://nipmod.com/proof/transcript.json",
      registry: "https://nipmod.com/registry/packages.json",
      source: "https://gitlawb.com/node/repos/z6Mkwbud/nipmod"
    });
    expect(packet.reviewScope).toMatchObject({
      commitPolicy: "Reviewer resolves the exact Gitlawb commit before signing external evidence.",
      evidenceStatus: "checklist-and-public-proof-links",
      sourceRef: "main",
      externalReceipts: {
        firstUserReceipts: 0,
        signedIndependentReviews: 0
      }
    });
    expect(packet.commands.map((command: { id: string }) => command.id)).toContain("prod-synthetic-monitor");
    expect(packet.externalProofTracks.map((track: { id: string }) => track.id)).toEqual([
      "gitlawb-review-signal",
      "external-human-audit",
      "real-user-adoption",
      "ecosystem-depth"
    ]);
    expect(manifest.type).toBe("dev.nipmod.review-evidence-manifest.v1");
    expect(manifest.artifacts.map((artifact: { id: string }) => artifact.id)).toEqual(
      expect.arrayContaining(["review-packet", "synthetic-monitor", "witness-health", "registry", "checkpoint"])
    );
    expect(manifest.freshness.liveEndpoints).toEqual(["witness-health"]);
    expect(JSON.stringify({ manifest, packet })).not.toMatch(/sk-[A-Za-z0-9]|BEGIN PRIVATE KEY|TOKEN=/);
  });
});

async function readJson(path: string) {
  return JSON.parse(await readFile(join(root, path), "utf8"));
}
