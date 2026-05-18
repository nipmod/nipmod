import { describe, expect, test } from "vitest";
import {
  candidateActivationPost,
  candidateConversionStats,
  candidateFromRepo,
  candidateNoticeLabel,
  candidateNoticeStateFromScoutPayloads,
  candidateNoticeStats,
  candidateOutreachKit,
  candidateStats,
  searchCandidates,
  type GitlawbRepoSummary
} from "../lib/candidates";

describe("candidate content", () => {
  const repo: GitlawbRepoSummary = {
    clone_url: "https://node.example/z6Owner/repo-reader.git",
    default_branch: "main",
    description: "Read Gitlawb repos for agents",
    is_public: true,
    name: "repo-reader",
    owner_did: "did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD",
    updated_at: "2026-05-17T00:00:00.000Z"
  };

  test("turns a Gitlawb repo into a claimable package candidate", () => {
    const candidate = candidateFromRepo(repo, {
      claimedPackages: new Set(),
      publishedPackages: new Set()
    });

    expect(candidate).toMatchObject({
      claimCommand:
        "nipmod claim gitlawb://did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/repo-reader",
      draftCommand:
        "nipmod package pr gitlawb://did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/repo-reader --dir repo-reader-pr --json",
      packageId: "pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/repo-reader",
      repoName: "repo-reader",
      source: "gitlawb://did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/repo-reader",
      status: "unclaimed"
    });
    expect(candidate.readinessScore).toBeGreaterThanOrEqual(60);
  });

  test("does not mark registry packages as claimed without a verified proof", () => {
    const candidate = candidateFromRepo(repo, {
      claimedPackages: new Set(),
      publishedPackages: new Set([`pkg:${repo.owner_did}/${repo.name}`])
    });

    expect(candidate.status).toBe("published");
    expect(candidate.readinessScore).toBe(100);
  });

  test("marks verified claim proof packages as claimed", () => {
    const candidate = candidateFromRepo(repo, {
      claimedPackages: new Set([`pkg:${repo.owner_did}/${repo.name}`]),
      publishedPackages: new Set([`pkg:${repo.owner_did}/${repo.name}`])
    });

    expect(candidate.status).toBe("claimed");
    expect(candidate.readinessScore).toBe(100);
  });

  test("searches candidates by repo, package and description", () => {
    const candidate = candidateFromRepo(repo, {
      claimedPackages: new Set(),
      publishedPackages: new Set()
    });

    expect(searchCandidates([candidate], "reader")).toHaveLength(1);
    expect(searchCandidates([candidate], "agent")).toHaveLength(1);
    expect(searchCandidates([candidate], "missing")).toHaveLength(0);
  });

  test("summarizes candidate states", () => {
    const unclaimed = candidateFromRepo(repo, {
      claimedPackages: new Set(),
      publishedPackages: new Set()
    });
    const published = candidateFromRepo(repo, {
      claimedPackages: new Set(),
      publishedPackages: new Set([`pkg:${repo.owner_did}/${repo.name}`])
    });
    const claimed = candidateFromRepo(repo, {
      claimedPackages: new Set([`pkg:${repo.owner_did}/${repo.name}`]),
      publishedPackages: new Set([`pkg:${repo.owner_did}/${repo.name}`])
    });

    expect(candidateStats([unclaimed, published, claimed])).toEqual([
      { label: "Repos", value: "3" },
      { label: "Drafts", value: "2" },
      { label: "Claimed", value: "1" },
      { label: "Published", value: "1" },
      { label: "Unclaimed drafts", value: "1" }
    ]);
  });

  test("summarizes the claim conversion funnel with verified notice delivery", () => {
    const unclaimed = candidateFromRepo(repo, {
      claimedPackages: new Set(),
      publishedPackages: new Set()
    });
    const published = candidateFromRepo(repo, {
      claimedPackages: new Set(),
      publishedPackages: new Set([`pkg:${repo.owner_did}/${repo.name}`])
    });
    const claimed = candidateFromRepo(
      { ...repo, name: "claimed-repo" },
      {
        claimedPackages: new Set([`pkg:${repo.owner_did}/claimed-repo`]),
        publishedPackages: new Set()
      }
    );
    const notices = candidateNoticeStateFromScoutPayloads({
      healthPayload: {
        ownerNotificationDelivery: {
          summary: {
            deduped: 1,
            failed: 0,
            planned: 2,
            written: 1
          }
        }
      },
      notificationsPayload: {
        notifications: [{ package: unclaimed.packageId }]
      }
    });

    expect(candidateConversionStats([unclaimed, published, claimed], notices)).toEqual([
      { label: "Found", value: "3" },
      { label: "Draft ready", value: "2" },
      { label: "Owner noticed", value: "2" },
      { label: "Claimed", value: "1" },
      { label: "Published", value: "1" }
    ]);
    expect(candidateNoticeLabel(unclaimed, notices)).toBe("Owner notice active");
    expect(candidateNoticeLabel(claimed, notices)).toBe("Owner claimed");
    expect(candidateNoticeLabel(published, notices)).toBe("Published");
  });

  test("builds notice dashboard metrics and owner safe outreach copy", () => {
    const unclaimed = candidateFromRepo(repo, {
      claimedPackages: new Set(),
      publishedPackages: new Set()
    });
    const claimed = candidateFromRepo(
      { ...repo, name: "claimed-repo" },
      {
        claimedPackages: new Set([`pkg:${repo.owner_did}/claimed-repo`]),
        publishedPackages: new Set()
      }
    );
    const notices = candidateNoticeStateFromScoutPayloads({
      healthPayload: {
        ownerNotificationDelivery: {
          summary: {
            blocked: 0,
            deduped: 2,
            failed: 1,
            planned: 4,
            skipped: 1,
            written: 1
          }
        }
      },
      notificationsPayload: {
        notifications: [{ package: unclaimed.packageId }, { package: claimed.packageId }]
      }
    });

    expect(candidateNoticeStats([unclaimed, claimed], notices)).toEqual([
      { label: "Notice planned", value: "4" },
      { label: "Sent", value: "1" },
      { label: "Deduped", value: "2" },
      { label: "Failed", value: "1" },
      { label: "Claimed after notice", value: "1" }
    ]);
    expect(candidateOutreachKit(unclaimed)).toMatchObject({
      claimUrl: "https://nipmod.com/package?repo=gitlawb%3A%2F%2Fdid%3Akey%3Az6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD%2Frepo-reader",
      gitlawbIssueTitle: "Nipmod package draft ready for repo-reader"
    });
    expect(candidateOutreachKit(unclaimed).xDm).toContain("Nipmod Scout prepared a package draft for repo-reader");
    expect(candidateOutreachKit(unclaimed).gitlawbIssueBody).toContain(unclaimed.draftCommand);
    expect(candidateOutreachKit(unclaimed).communityReply).toContain("claim it with the owner DID");
  });

  test("builds a public update post from real candidate counts", () => {
    const candidates = [
      candidateFromRepo(repo, {
        claimedPackages: new Set(),
        publishedPackages: new Set()
      }),
      candidateFromRepo(
        { ...repo, name: "published-repo" },
        {
          claimedPackages: new Set(),
          publishedPackages: new Set([`pkg:${repo.owner_did}/published-repo`])
        }
      ),
      candidateFromRepo(
        { ...repo, name: "claimed-repo" },
        {
          claimedPackages: new Set([`pkg:${repo.owner_did}/claimed-repo`]),
          publishedPackages: new Set()
        }
      )
    ];
    const notices = candidateNoticeStateFromScoutPayloads({
      healthPayload: {
        ownerNotificationDelivery: {
          summary: {
            deduped: 1,
            failed: 0,
            planned: 1,
            written: 0
          }
        }
      }
    });

    expect(candidateActivationPost(candidates, notices)).toBe(
      "Nipmod Scout update:\n\n- 3 Gitlawb repos found\n- 1 package drafts ready to claim\n- 1 verified packages indexed\n- 1 owner notices active\n\nPackaging should come to the repo.\n\nClaim yours: https://nipmod.com/candidates"
    );
  });
});
