import type { PackageDraft, ScoutCandidate } from "./scout";

const DEFAULT_MAX_PER_CYCLE = 5;
const DEFAULT_MAX_PER_OWNER_PER_CYCLE = 2;
const DEFAULT_DEDUPE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_NODE_URL = "https://node.nipmod.com";

export interface OwnerNotificationPlan {
  blockedReason: string | null;
  dryRun: true;
  formatVersion: 1;
  generatedAt: string;
  notifications: OwnerNotification[];
  policy: {
    allowAll: boolean;
    allowListCount: number;
    claimIndexRequired: true;
    dedupeWindowMs: number;
    maxPerCycle: number;
    maxPerOwnerPerCycle: number;
    optOutCount: number;
    registryRequired: true;
    remoteWritesRequireExplicitRun: true;
  };
  ready: boolean;
  remoteWrites: false;
  summary: {
    blocked: number;
    deduped: number;
    eligible: number;
    optedOut: number;
    planned: number;
    rateLimited: number;
    skipped: number;
  };
  transport: {
    channel: "gitlawb-issue";
    writeEndpointTemplate: string;
    writeRequires: string[];
  };
  type: "dev.nipmod.scout-owner-notifications.v1";
}

export interface OwnerNotification {
  body: string;
  channel: "gitlawb-issue";
  createdAt: string;
  dedupeKey: string;
  draft: {
    endpoint: string | null;
    remoteWrites: false;
  };
  issue: {
    path: string;
  };
  package: string;
  remoteWrites: false;
  repo: {
    gitlawbUrl: string;
    name: string;
    ownerDid: string;
    shortOwner: string;
  };
  source: string;
  status: "planned";
  title: string;
  type: "dev.nipmod.scout-owner-notification.v1";
}

export function createOwnerNotificationPlan({
  candidates,
  claimIndexOk,
  drafts,
  generatedAt,
  nodeUrl = DEFAULT_NODE_URL,
  registryOk
}: {
  candidates: ScoutCandidate[];
  claimIndexOk: boolean;
  drafts: PackageDraft[];
  generatedAt: string;
  nodeUrl?: string;
  registryOk: boolean;
}): OwnerNotificationPlan {
  const draftPackages = new Set(drafts.map((draft) => draft.package));
  const ready = claimIndexOk && registryOk;
  const notifications: OwnerNotification[] = [];
  const seenKeys = new Set<string>();
  const perOwner = new Map<string, number>();
  const summary = {
    blocked: 0,
    deduped: 0,
    eligible: 0,
    optedOut: 0,
    planned: 0,
    rateLimited: 0,
    skipped: 0
  };

  for (const candidate of candidates) {
    if (!isNotificationEligible(candidate, draftPackages)) {
      summary.skipped += 1;
      continue;
    }
    summary.eligible += 1;

    const dedupeKey = notificationDedupeKey(candidate.package);
    if (seenKeys.has(dedupeKey)) {
      summary.deduped += 1;
      continue;
    }
    seenKeys.add(dedupeKey);

    if (!ready) {
      summary.blocked += 1;
      continue;
    }

    const ownerDid = ownerDidFromSource(candidate.source);
    const ownerCount = perOwner.get(ownerDid) ?? 0;
    if (ownerCount >= DEFAULT_MAX_PER_OWNER_PER_CYCLE || notifications.length >= DEFAULT_MAX_PER_CYCLE) {
      summary.rateLimited += 1;
      continue;
    }
    perOwner.set(ownerDid, ownerCount + 1);
    notifications.push(ownerNotification(candidate, dedupeKey, generatedAt));
  }
  summary.planned = notifications.length;

  return {
    blockedReason: ready ? null : "claim index and registry must both be fresh before owner notifications are planned",
    dryRun: true,
    formatVersion: 1,
    generatedAt,
    notifications,
    policy: {
      allowAll: true,
      allowListCount: 0,
      claimIndexRequired: true,
      dedupeWindowMs: DEFAULT_DEDUPE_WINDOW_MS,
      maxPerCycle: DEFAULT_MAX_PER_CYCLE,
      maxPerOwnerPerCycle: DEFAULT_MAX_PER_OWNER_PER_CYCLE,
      optOutCount: 0,
      registryRequired: true,
      remoteWritesRequireExplicitRun: true
    },
    ready,
    remoteWrites: false,
    summary,
    transport: {
      channel: "gitlawb-issue",
      writeEndpointTemplate: `${trimTrailingSlash(nodeUrl)}/api/v1/repos/{owner}/{repo}/issues`,
      writeRequires: [
        "operator authorization",
        "explicit remote write mode",
        "Scout signing identity"
      ]
    },
    type: "dev.nipmod.scout-owner-notifications.v1"
  };
}

function isNotificationEligible(candidate: ScoutCandidate, draftPackages: Set<string>): boolean {
  return (
    candidate.status === "unclaimed-draft" &&
    candidate.claimStatus === "unclaimed" &&
    candidate.draft.status === "unclaimed" &&
    candidate.draft.remoteWrites === false &&
    draftPackages.has(candidate.package)
  );
}

function ownerNotification(candidate: ScoutCandidate, dedupeKey: string, generatedAt: string): OwnerNotification {
  const ownerDid = ownerDidFromSource(candidate.source);
  const shortOwner = ownerDid.replace(/^did:key:/, "");
  const title = "Package this repo with Nipmod";
  const body = [
    "Nipmod Scout prepared a package draft for this Gitlawb repo.",
    "",
    `Package: ${candidate.package}`,
    `Draft: ${candidate.draft.endpoint}`,
    "",
    "Owner command:",
    "```sh",
    candidate.commands.packagePr,
    "git add nipmod.json README.nipmod.md .nipmod/package-claim.json",
    "git commit -m \"feat: add nipmod package manifest\"",
    "GITLAWB_NODE=https://node.nipmod.com git push",
    "```",
    "",
    "Nothing is claimed until the Gitlawb owner DID signs and pushes `.nipmod/package-claim.json`.",
    "",
    `Dedupe: ${dedupeKey}`
  ].join("\n");

  return {
    body,
    channel: "gitlawb-issue",
    createdAt: generatedAt,
    dedupeKey,
    draft: {
      endpoint: candidate.draft.endpoint,
      remoteWrites: false
    },
    issue: {
      path: `/api/v1/repos/${shortOwner}/${candidate.repoName}/issues`
    },
    package: candidate.package,
    remoteWrites: false,
    repo: {
      gitlawbUrl: candidate.gitlawbUrl,
      name: candidate.repoName,
      ownerDid,
      shortOwner
    },
    source: candidate.source,
    status: "planned",
    title,
    type: "dev.nipmod.scout-owner-notification.v1"
  };
}

function notificationDedupeKey(packageId: string): string {
  return `nipmod-scout:${Buffer.from(packageId).toString("base64url")}:package-claim`;
}

function ownerDidFromSource(source: string): string {
  const match = /^gitlawb:\/\/(did:key:z[A-Za-z0-9]+)\/[a-z0-9][a-z0-9._-]*$/.exec(source);
  return match?.[1] ?? "";
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
