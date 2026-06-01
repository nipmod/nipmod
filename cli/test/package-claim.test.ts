import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { generateIdentity } from "../src/identity.js";
import {
  analyzeLocalPackageCandidate,
  buildPackageClaimIndex,
  createAssistedPackagePatch,
  createPackageClaimProof,
  fetchGitlawbPackageClaimVerification,
  formatPackageCandidateReport,
  verifyPackageClaimProof,
  verifyPackageClaimProofForRepo
} from "../src/package-claim.js";

describe("package claim", () => {
  test("scores a local repo candidate and explains missing package work", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-candidate-"));
    const owner = generateIdentity().did;
    await writeFile(
      join(dir, "README.md"),
      [
        "# Review agent",
        "",
        "A Gitlawb agent tool with usage examples.",
        "",
        "## Usage",
        "",
        "Run it inside an agent workflow."
      ].join("\n")
    );

    const report = await analyzeLocalPackageCandidate({
      dir,
      repo: {
        cloneUrl: "https://node.example/z6Owner/review-agent.git",
        defaultBranch: "main",
        description: "Review agent for Gitlawb repositories",
        isPublic: true,
        name: "review-agent",
        ownerDid: owner,
        updatedAt: "2026-05-17T00:00:00.000Z"
      }
    });

    expect(report.package).toBe(`pkg:${owner}/review-agent`);
    expect(report.status).toBe("almost");
    expect(report.readinessScore).toBeGreaterThanOrEqual(60);
    expect(report.suggestedType).toBe("agent-profile");
    expect(report.missing.map((item) => item.id)).toContain("manifest");
    expect(report.commands.claim).toBe(`nipmod claim gitlawb://${owner}/review-agent`);
    expect(formatPackageCandidateReport(report)).toContain("missing: Add nipmod.json");
  });

  test("recognizes a package ready repo with explicit permissions", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-ready-candidate-"));
    const owner = generateIdentity().did;
    const manifest = {
      formatVersion: 1,
      name: "repo-reader",
      canonical: `pkg:${owner}/repo-reader`,
      version: "0.1.0",
      type: "skill",
      description: "Read Gitlawb repos for agents",
      license: "MIT",
      exports: {
        ".": {
          skill: "./SKILL.md"
        }
      },
      files: ["README.md", "SKILL.md", "nipmod.json"],
      permissions: {
        env: [],
        exec: { allowed: false },
        filesystem: [],
        mcpTools: [],
        network: [],
        postinstall: { allowed: false },
        secrets: []
      },
      publish: {
        provenance: `gitlawb://${owner}/repo-reader`,
        signingKey: owner
      }
    };
    await writeFile(join(dir, "README.md"), "# Repo reader\n\n## Install\n\nnipmod add repo-reader\n\n## Example\n\nUse it from an agent.\n");
    await writeFile(join(dir, "SKILL.md"), "# Repo reader\n");
    await writeFile(join(dir, "nipmod.json"), `${JSON.stringify(manifest, null, 2)}\n`);

    const report = await analyzeLocalPackageCandidate({
      dir,
      repo: {
        cloneUrl: "https://node.example/z6Owner/repo-reader.git",
        defaultBranch: "main",
        description: "Read Gitlawb repos for agents",
        isPublic: true,
        name: "repo-reader",
        ownerDid: owner,
        updatedAt: "2026-05-17T00:00:00.000Z"
      }
    });

    expect(report.status).toBe("ready");
    expect(report.readinessScore).toBe(100);
    expect(report.missing).toHaveLength(0);
    expect(report.signals.map((item) => item.id)).toContain("permissions");
  });

  test("creates and verifies a DID-bound package claim proof", async () => {
    const identity = generateIdentity();
    const proof = createPackageClaimProof({
      createdAt: "2026-05-17T00:00:00.000Z",
      identity,
      repoName: "repo-reader"
    });

    expect(proof.ownerDid).toBe(identity.did);
    expect(proof.package).toBe(`pkg:${identity.did}/repo-reader`);
    expect(verifyPackageClaimProof(proof)).toBe(true);
    expect(verifyPackageClaimProofForRepo(proof, { ownerDid: identity.did, repoName: "repo-reader" })).toMatchObject({
      claimed: true,
      status: "verified"
    });
    expect(verifyPackageClaimProofForRepo(proof, { ownerDid: identity.did, repoName: "other-repo" })).toMatchObject({
      claimed: false,
      reasons: expect.arrayContaining(["repoName mismatch"]),
      status: "mismatch"
    });
    expect(verifyPackageClaimProof({ ...proof, repo: `${proof.repo}-tampered` })).toBe(false);
  });

  test("fetches and verifies a package claim proof from a Gitlawb repo", async () => {
    const identity = generateIdentity();
    const proof = createPackageClaimProof({
      createdAt: "2026-05-17T00:00:00.000Z",
      identity,
      repoName: "repo-reader"
    });
    const requests: string[] = [];
    const fetchImpl = async (url: string | URL | Request) => {
      requests.push(String(url));
      return new Response(JSON.stringify(proof), {
        headers: { "content-type": "application/json" },
        status: 200
      });
    };

    const result = await fetchGitlawbPackageClaimVerification({
      fetchImpl,
      nodeUrl: "https://node.example",
      ownerDid: identity.did,
      repoName: "repo-reader"
    });

    expect(requests).toEqual([
      `https://node.example/api/v1/repos/${identity.did.slice("did:key:".length)}/repo-reader/blob/.nipmod/package-claim.json`
    ]);
    expect(result).toMatchObject({
      claimed: true,
      package: `pkg:${identity.did}/repo-reader`,
      repo: `gitlawb://${identity.did}/repo-reader`,
      status: "verified"
    });
  });

  test("builds a claim index without treating missing proofs as claims", async () => {
    const claimedIdentity = generateIdentity();
    const missingIdentity = generateIdentity();
    const proof = createPackageClaimProof({
      createdAt: "2026-05-17T00:00:00.000Z",
      identity: claimedIdentity,
      repoName: "repo-reader"
    });
    const fetchImpl = async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.endsWith("/api/v1/repos")) {
        return new Response(
          JSON.stringify([
            {
              clone_url: "https://node.example/claimed/repo-reader.git",
              default_branch: "main",
              description: "Read Gitlawb repos for agents",
              is_public: true,
              name: "repo-reader",
              owner_did: claimedIdentity.did,
              updated_at: "2026-05-17T00:00:00.000Z"
            },
            {
              clone_url: "https://node.example/missing/agent-only.git",
              default_branch: "main",
              description: "Agent only repo",
              is_public: true,
              name: "agent-only",
              owner_did: missingIdentity.did,
              updated_at: "2026-05-17T00:00:00.000Z"
            }
          ]),
          { headers: { "content-type": "application/json" }, status: 200 }
        );
      }
      if (requestUrl.includes("/repo-reader/blob/.nipmod/package-claim.json")) {
        return new Response(JSON.stringify(proof), {
          headers: { "content-type": "application/json" },
          status: 200
        });
      }
      return new Response("not found", { status: 404 });
    };

    const index = await buildPackageClaimIndex({
      fetchImpl,
      generatedAt: "2026-05-17T00:00:00.000Z",
      limit: 10,
      nodeUrl: "https://node.example"
    });

    expect(index.verifiedClaims).toHaveLength(1);
    expect(index.verifiedClaims[0]).toMatchObject({
      package: `pkg:${claimedIdentity.did}/repo-reader`,
      repo: `gitlawb://${claimedIdentity.did}/repo-reader`,
      status: "verified"
    });
    expect(index.invalidClaims).toHaveLength(0);
    expect(index.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          package: `pkg:${missingIdentity.did}/agent-only`,
          status: "missing"
        })
      ])
    );
  });

  test("creates a PR-ready package patch without opening remote issues or pull requests", () => {
    const identity = generateIdentity();
    const patch = createAssistedPackagePatch({
      proof: createPackageClaimProof({
        createdAt: "2026-05-17T00:00:00.000Z",
        identity,
        repoName: "repo-reader"
      }),
      repo: {
        cloneUrl: "https://node.example/z6Owner/repo-reader.git",
        defaultBranch: "main",
        description: "Read Gitlawb repos for agents",
        isPublic: true,
        name: "repo-reader",
        ownerDid: identity.did,
        updatedAt: "2026-05-17T00:00:00.000Z"
      },
      version: "0.1.0"
    });

    expect(patch.remoteWrites).toBe(false);
    expect(patch.files.map((file) => file.path)).toEqual([
      "nipmod.json",
      "README.nipmod.md",
      ".nipmod/package-claim.json"
    ]);
    expect(patch.nextCommands).toEqual([
      "git add nipmod.json README.nipmod.md .nipmod/package-claim.json",
      "git commit -m \"feat: add nipmod package manifest\"",
      "GITLAWB_NODE=https://node.nipmod.com git push"
    ]);
    expect(patch.files.find((file) => file.path === "nipmod.json")?.content).toContain(`"canonical": "pkg:${identity.did}/repo-reader"`);
  });

  test("rejects claim proof creation for a mismatched repo owner", () => {
    const identity = generateIdentity();
    const otherOwner = generateIdentity().did;

    expect(() =>
      createPackageClaimProof({
        createdAt: "2026-05-17T00:00:00.000Z",
        identity,
        ownerDid: otherOwner,
        repoName: "repo-reader"
      })
    ).toThrow("claim identity must match Gitlawb repo owner");
  });
});
