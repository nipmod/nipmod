import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { generateIdentity } from "../src/identity.js";
import {
  analyzeLocalPackageCandidate,
  createPackageClaimProof,
  fetchGitlawbPackageCandidates,
  formatPackageCandidateReport,
  verifyPackageClaimProof
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

  test("fetches Gitlawb repo candidates from a node list endpoint", async () => {
    const owner = generateIdentity().did;
    const requests: string[] = [];
    const fetchImpl = async (url: string | URL | Request) => {
      requests.push(String(url));
      return new Response(
        JSON.stringify([
          {
            clone_url: "https://node.example/z6Owner/repo-reader.git",
            default_branch: "main",
            description: "Read Gitlawb repos for agents",
            is_public: true,
            name: "repo-reader",
            owner_did: owner,
            updated_at: "2026-05-17T00:00:00.000Z"
          }
        ]),
        { headers: { "content-type": "application/json" }, status: 200 }
      );
    };

    const result = await fetchGitlawbPackageCandidates({
      fetchImpl,
      nodeUrl: "https://node.example",
      limit: 10
    });

    expect(requests).toEqual(["https://node.example/api/v1/repos"]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      package: `pkg:${owner}/repo-reader`,
      source: `gitlawb://${owner}/repo-reader`,
      status: "almost"
    });
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
    expect(verifyPackageClaimProof({ ...proof, repo: `${proof.repo}-tampered` })).toBe(false);
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
