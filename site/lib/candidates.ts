export type CandidateStatus = "claimed" | "published" | "unclaimed" | "needs-work";

export interface GitlawbRepoSummary {
  clone_url: string;
  default_branch: string;
  description: string;
  is_public: boolean;
  name: string;
  owner_did: string;
  updated_at: string;
}

export interface PackageCandidate {
  claimCommand: string;
  claimVerifyCommand: string;
  description: string;
  doctorCommand: string;
  draftCommand: string;
  draftEndpoint?: string;
  draftStatus?: string;
  gitlawbHref: string;
  packageCommand: string;
  packageId: string;
  readinessScore: number;
  repoName: string;
  shortOwner: string;
  source: string;
  status: CandidateStatus;
  updatedAt: string;
}

export interface ScoutCandidateSummary {
  claimStatus: "claimed" | "unclaimed";
  commands?: {
    claim?: string;
    claimVerify?: string;
    packagePr?: string;
  };
  description?: string;
  gitlawbUrl?: string;
  package: string;
  draft?: {
    endpoint?: string;
    status?: string;
  };
  readinessScore?: number;
  repoName: string;
  shortOwner?: string;
  source: string;
  status?: string;
  updatedAt?: string;
}

export interface CandidateClaimState {
  claimedPackages: ReadonlySet<string>;
  publishedPackages: ReadonlySet<string>;
}

export interface PackageClaimIndex {
  verifiedClaims?: Array<{ package: string; status: string }>;
}

export interface CandidateNoticeState {
  blocked: number;
  deduped: number;
  failed: number;
  packageIds: ReadonlySet<string>;
  planned: number;
  skipped: number;
  touched: number;
  written: number;
}

export interface CandidateOutreachKit {
  claimUrl: string;
  communityReply: string;
  gitlawbIssueBody: string;
  gitlawbIssueTitle: string;
  xDm: string;
}

export function candidateClaimState(options: {
  claimIndex: PackageClaimIndex;
  publishedPackages: ReadonlySet<string>;
}): CandidateClaimState {
  return {
    claimedPackages: new Set(
      (options.claimIndex.verifiedClaims ?? [])
        .filter((claim) => claim.status === "verified")
        .map((claim) => claim.package)
    ),
    publishedPackages: options.publishedPackages
  };
}

export function candidateFromRepo(repo: GitlawbRepoSummary, state: CandidateClaimState): PackageCandidate {
  const packageId = `pkg:${repo.owner_did}/${repo.name}`;
  const source = `gitlawb://${repo.owner_did}/${repo.name}`;
  const claimed = state.claimedPackages.has(packageId);
  const published = state.publishedPackages.has(packageId);
  const readinessScore = claimed || published ? 100 : scoreRepoCandidate(repo);
  const status: CandidateStatus = claimed
    ? "claimed"
    : published
      ? "published"
      : readinessScore >= 50
        ? "unclaimed"
        : "needs-work";

  return {
    claimCommand: `nipmod claim ${source}`,
    claimVerifyCommand: `nipmod claim verify ${source} --json`,
    description: repo.description || "Public Gitlawb repo",
    doctorCommand: `nipmod package doctor ${source}`,
    draftCommand: `nipmod package pr ${source} --dir ${repo.name}-pr --json`,
    draftEndpoint: draftEndpointForSource(source),
    draftStatus: status,
    gitlawbHref: `https://gitlawb.com/node/repos/${ownerSegment(repo.owner_did)}/${repo.name}`,
    packageCommand: `nipmod package pr ${source} --dir ${repo.name}-pr --json`,
    packageId,
    readinessScore,
    repoName: repo.name,
    shortOwner: ownerSegment(repo.owner_did).slice(0, 8),
    source,
    status,
    updatedAt: repo.updated_at
  };
}

export function candidateFromScout(candidate: ScoutCandidateSummary): PackageCandidate {
  const repoName = candidate.repoName;
  const status: CandidateStatus =
    candidate.status === "published"
      ? "published"
      : candidate.claimStatus === "claimed"
        ? "claimed"
        : candidate.status === "needs-work"
          ? "needs-work"
          : "unclaimed";
  const packageCandidate: PackageCandidate = {
    claimCommand: candidate.commands?.claim ?? `nipmod claim ${candidate.source}`,
    claimVerifyCommand: candidate.commands?.claimVerify ?? `nipmod claim verify ${candidate.source} --json`,
    description: candidate.description || "Public Gitlawb repo",
    doctorCommand: `nipmod package doctor ${candidate.source}`,
    draftCommand: candidate.commands?.packagePr ?? `nipmod package pr ${candidate.source} --dir ${repoName}-pr --json`,
    draftStatus: candidate.draft?.status ?? status,
    gitlawbHref: candidate.gitlawbUrl ?? "https://gitlawb.com",
    packageCommand: candidate.commands?.packagePr ?? `nipmod package pr ${candidate.source} --dir ${repoName}-pr`,
    packageId: candidate.package,
    readinessScore: candidate.readinessScore ?? (status === "claimed" ? 100 : 50),
    repoName,
    shortOwner: candidate.shortOwner ?? candidate.package.replace(/^pkg:did:key:/, "").slice(0, 8),
    source: candidate.source,
    status,
    updatedAt: candidate.updatedAt ?? new Date(0).toISOString()
  };
  if (candidate.draft?.endpoint) {
    packageCandidate.draftEndpoint = candidate.draft.endpoint;
  } else if (candidate.status !== "published") {
    packageCandidate.draftEndpoint = draftEndpointForSource(candidate.source);
  }
  return packageCandidate;
}

export function candidateGitlawbPackageHref(candidate: Pick<PackageCandidate, "packageId" | "repoName" | "source">): string {
  const path = candidateGitlawbPath(candidate);
  if (!path) {
    return "/candidates";
  }
  return `/gitlawb/${path.owner}/${path.repo}`;
}

export function candidateGitlawbOwnerHref(candidate: Pick<PackageCandidate, "packageId" | "repoName" | "source">): string {
  const path = candidateGitlawbPath(candidate);
  if (!path) {
    return "/candidates";
  }
  return `/gitlawb/${path.owner}`;
}

export function candidatesByGitlawbOwner(candidates: readonly PackageCandidate[], owner: string): PackageCandidate[] {
  if (!/^z[A-Za-z0-9]+$/.test(owner)) {
    return [];
  }
  return candidates
    .filter((candidate) => candidateGitlawbPath(candidate)?.owner === owner)
    .sort(compareCandidates);
}

export function findCandidateByGitlawbPath(
  candidates: readonly PackageCandidate[],
  owner: string,
  repo: string
): PackageCandidate | null {
  if (!/^z[A-Za-z0-9]+$/.test(owner) || !isRepoName(repo)) {
    return null;
  }
  return (
    candidates.find((candidate) => {
      const path = candidateGitlawbPath(candidate);
      return path?.owner === owner && path.repo.toLowerCase() === repo.toLowerCase();
    }) ?? null
  );
}

export function searchCandidates(candidates: readonly PackageCandidate[], query: string): PackageCandidate[] {
  const normalized = query.trim().toLowerCase();
  const sorted = [...candidates].sort(compareCandidates);
  if (!normalized) {
    return sorted;
  }
  return sorted.filter((candidate) =>
    [candidate.repoName, candidate.description, candidate.packageId, candidate.source]
      .join("\n")
      .toLowerCase()
      .includes(normalized)
  );
}

export function candidateStats(candidates: readonly PackageCandidate[]): Array<{ label: string; value: string }> {
  const claimed = candidates.filter((candidate) => candidate.status === "claimed").length;
  const published = candidates.filter((candidate) => candidate.status === "published").length;
  const unclaimed = candidates.filter((candidate) => candidate.status === "unclaimed").length;
  return [
    { label: "Repos", value: String(candidates.length) },
    { label: "Drafts", value: String(candidates.length - published) },
    { label: "Claimed", value: String(claimed) },
    { label: "Published", value: String(published) },
    { label: "Unclaimed drafts", value: String(unclaimed) }
  ];
}

export function candidateConversionStats(
  candidates: readonly PackageCandidate[],
  notices: CandidateNoticeState = emptyCandidateNoticeState()
): Array<{ label: string; value: string }> {
  const claimed = candidates.filter((candidate) => candidate.status === "claimed").length;
  const published = candidates.filter((candidate) => candidate.status === "published").length;
  const draftReady = candidates.filter((candidate) => candidate.status !== "published").length;
  const ownerNoticed = Math.min(candidates.length, Math.max(notices.touched, notices.packageIds.size));
  return [
    { label: "Found", value: String(candidates.length) },
    { label: "Draft ready", value: String(draftReady) },
    { label: "Owner noticed", value: String(ownerNoticed) },
    { label: "Claimed", value: String(claimed) },
    { label: "Published", value: String(published) }
  ];
}

export function candidateNoticeLabel(candidate: PackageCandidate, notices: CandidateNoticeState = emptyCandidateNoticeState()): string {
  if (candidate.status === "published") return "Published";
  if (candidate.status === "claimed") return "Owner claimed";
  if (candidate.status === "needs-work") return "Needs cleanup";
  if (notices.packageIds.has(candidate.packageId)) return "Owner notice active";
  if (notices.touched > 0 || notices.planned > 0) return "Scout outreach running";
  return "Ready for owner";
}

export function candidateNoticeStats(
  candidates: readonly PackageCandidate[],
  notices: CandidateNoticeState = emptyCandidateNoticeState()
): Array<{ label: string; value: string }> {
  const claimedAfterNotice = candidates.filter(
    (candidate) => notices.packageIds.has(candidate.packageId) && (candidate.status === "claimed" || candidate.status === "published")
  ).length;
  return [
    { label: "Notice planned", value: String(notices.planned) },
    { label: "Sent", value: String(notices.written) },
    { label: "Deduped", value: String(notices.deduped) },
    { label: "Failed", value: String(notices.failed) },
    { label: "Claimed after notice", value: String(claimedAfterNotice) }
  ];
}

export function candidateOutreachKit(candidate: PackageCandidate): CandidateOutreachKit {
  const claimUrl = canonicalClaimUrl(candidate.source);
  const xDm = `Nipmod Scout prepared a package draft for ${candidate.repoName}. You can review it and claim it with your Gitlawb DID here: ${claimUrl}`;
  const gitlawbIssueTitle = `Nipmod package draft ready for ${candidate.repoName}`;
  const gitlawbIssueBody = [
    `Nipmod Scout found this public Gitlawb repo and prepared a package draft for ${candidate.repoName}.`,
    "",
    `Claim page: ${claimUrl}`,
    "",
    "Local draft command:",
    candidate.draftCommand,
    "",
    "Nothing is published or owned by Nipmod until the repo owner signs the claim proof with the matching DID."
  ].join("\n");
  const communityReply = `We prepared a Nipmod package draft for ${candidate.repoName}. The owner can review it and claim it with the owner DID: ${claimUrl}`;
  return {
    claimUrl,
    communityReply,
    gitlawbIssueBody,
    gitlawbIssueTitle,
    xDm
  };
}

export function candidateActivationPost(
  candidates: readonly PackageCandidate[],
  notices: CandidateNoticeState = emptyCandidateNoticeState()
): string {
  const published = candidates.filter((candidate) => candidate.status === "published").length;
  const readyToClaim = candidates.filter((candidate) => candidate.status === "unclaimed").length;
  const ownerNotices = Math.min(candidates.length, Math.max(notices.touched, notices.packageIds.size));
  return [
    "Nipmod Scout update:",
    "",
    `- ${candidates.length} Gitlawb repos found`,
    `- ${readyToClaim} package drafts ready to claim`,
    `- ${published} verified packages indexed`,
    `- ${ownerNotices} owner notices active`,
    "",
    "Packaging should come to the repo.",
    "",
    "Claim yours: https://nipmod.com/candidates"
  ].join("\n");
}

export function candidateNoticeStateFromScoutPayloads({
  healthPayload,
  notificationsPayload
}: {
  healthPayload?: unknown;
  notificationsPayload?: unknown;
}): CandidateNoticeState {
  const packageIds = new Set<string>();
  const notifications = readArray(readRecord(notificationsPayload)?.notifications);
  for (const notification of notifications) {
    const packageId = readRecord(notification)?.package;
    if (typeof packageId === "string" && isPackageId(packageId)) {
      packageIds.add(packageId);
    }
  }

  const notificationSummary = readRecord(readRecord(notificationsPayload)?.summary);
  const deliverySummary = readRecord(readRecord(readRecord(healthPayload)?.ownerNotificationDelivery)?.summary);
  const planned = Math.max(
    packageIds.size,
    readFiniteNumber(notificationSummary?.planned) ?? 0,
    readFiniteNumber(deliverySummary?.planned) ?? 0
  );
  const touched =
    (readFiniteNumber(deliverySummary?.written) ?? 0) +
    (readFiniteNumber(deliverySummary?.deduped) ?? 0);
  const failed = readFiniteNumber(deliverySummary?.failed) ?? 0;
  const written = readFiniteNumber(deliverySummary?.written) ?? 0;
  const deduped = readFiniteNumber(deliverySummary?.deduped) ?? 0;

  return {
    blocked: readFiniteNumber(deliverySummary?.blocked) ?? 0,
    deduped,
    failed,
    packageIds,
    planned,
    skipped: readFiniteNumber(deliverySummary?.skipped) ?? 0,
    touched,
    written
  };
}

export function emptyCandidateNoticeState(): CandidateNoticeState {
  return {
    blocked: 0,
    deduped: 0,
    failed: 0,
    packageIds: new Set(),
    planned: 0,
    skipped: 0,
    touched: 0,
    written: 0
  };
}

export async function fetchGitlawbRepos(options: { nodeUrl: string }): Promise<GitlawbRepoSummary[]> {
  const response = await fetch(`${options.nodeUrl.replace(/\/$/, "")}/api/v1/repos`, {
    next: { revalidate: 300 }
  });
  if (!response.ok) {
    throw new Error(`Gitlawb repo scan failed with HTTP ${response.status}`);
  }
  const data = (await response.json()) as GitlawbRepoSummary[];
  return data.filter((repo) => repo.is_public && isDidKey(repo.owner_did) && isRepoName(repo.name) && !isProbeRepo(repo));
}

export async function fetchScoutCandidates(options: { scoutUrl: string }): Promise<ScoutCandidateSummary[]> {
  const response = await fetch(`${options.scoutUrl.replace(/\/$/, "")}/candidates`, {
    next: { revalidate: 300 }
  });
  if (!response.ok) {
    throw new Error(`Nipmod scout candidate fetch failed with HTTP ${response.status}`);
  }
  const data = (await response.json()) as { candidates?: ScoutCandidateSummary[] };
  return Array.isArray(data.candidates)
    ? data.candidates.filter((candidate) => isPackageId(candidate.package) && isGitlawbSource(candidate.source) && isRepoName(candidate.repoName))
    : [];
}

export async function fetchScoutNoticeState(options: { scoutUrl: string }): Promise<CandidateNoticeState> {
  const base = options.scoutUrl.replace(/\/$/, "");
  const [notifications, health] = await Promise.allSettled([
    fetchScoutJson(`${base}/notifications`),
    fetchScoutJson(`${base}/health`)
  ]);

  return candidateNoticeStateFromScoutPayloads({
    healthPayload: health.status === "fulfilled" ? health.value : undefined,
    notificationsPayload: notifications.status === "fulfilled" ? notifications.value : undefined
  });
}

function scoreRepoCandidate(repo: GitlawbRepoSummary): number {
  let score = 0;
  const corpus = [repo.name, repo.description].join("\n").toLowerCase();
  if (repo.is_public) score += 20;
  if (repo.description.trim()) score += 20;
  if (/\bagent\b|\bskill\b|\bmcp\b|\btool\b|\bworkflow\b|\bpolicy\b|\beval\b|\bpackage\b|gitlawb|nipmod/.test(corpus)) {
    score += 25;
  }
  if (repo.default_branch) score += 10;
  if (repo.clone_url) score += 10;
  if (/(reader|review|audit|policy|skill|agent|mcp|workflow|package)/.test(repo.name)) score += 15;
  return Math.min(100, score);
}

function compareCandidates(left: PackageCandidate, right: PackageCandidate): number {
  const statusRank = statusWeight(right.status) - statusWeight(left.status);
  if (statusRank !== 0) {
    return statusRank;
  }
  return right.readinessScore - left.readinessScore || left.repoName.localeCompare(right.repoName);
}

function statusWeight(status: CandidateStatus): number {
  if (status === "unclaimed") return 3;
  if (status === "claimed") return 2;
  if (status === "published") return 2;
  return 1;
}

function ownerSegment(ownerDid: string): string {
  return ownerDid.replace(/^did:key:/, "");
}

function candidateGitlawbPath(candidate: Pick<PackageCandidate, "packageId" | "repoName" | "source">): {
  owner: string;
  repo: string;
} | null {
  const sourceMatch = /^gitlawb:\/\/did:key:(z[A-Za-z0-9]+)\/([a-z0-9][a-z0-9._-]*)$/i.exec(candidate.source);
  const packageMatch = /^pkg:did:key:(z[A-Za-z0-9]+)\/([a-z0-9][a-z0-9._-]*)$/i.exec(candidate.packageId);
  const owner = sourceMatch?.[1] ?? packageMatch?.[1];
  const repo = sourceMatch?.[2] ?? packageMatch?.[2] ?? candidate.repoName;
  if (!owner || !isRepoName(repo)) {
    return null;
  }
  return { owner, repo };
}

function draftEndpointForSource(source: string): string {
  return `/scout/draft?repo=${encodeURIComponent(source)}`;
}

function canonicalClaimUrl(source: string): string {
  return `https://nipmod.com/package?repo=${encodeURIComponent(source)}`;
}

function isDidKey(value: string): boolean {
  return /^did:key:z[A-Za-z0-9]+$/.test(value);
}

function isRepoName(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*$/.test(value);
}

function isPackageId(value: string): boolean {
  return /^pkg:did:key:z[A-Za-z0-9]+\/[a-z0-9][a-z0-9._-]*$/.test(value);
}

function isGitlawbSource(value: string): boolean {
  return /^gitlawb:\/\/did:key:z[A-Za-z0-9]+\/[a-z0-9][a-z0-9._-]*$/.test(value);
}

async function fetchScoutJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json"
    },
    next: { revalidate: 300 }
  });
  if (!response.ok) {
    throw new Error(`Nipmod scout fetch failed with HTTP ${response.status}`);
  }
  return response.json();
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isProbeRepo(repo: GitlawbRepoSummary): boolean {
  return [repo.name, repo.description].some((value) => value.toLowerCase().includes("probe"));
}
