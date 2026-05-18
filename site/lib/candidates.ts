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

function isProbeRepo(repo: GitlawbRepoSummary): boolean {
  return [repo.name, repo.description].some((value) => value.toLowerCase().includes("probe"));
}
