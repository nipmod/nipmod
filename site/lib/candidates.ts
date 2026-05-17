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
  description: string;
  doctorCommand: string;
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
    description: repo.description || "Public Gitlawb repo",
    doctorCommand: `nipmod package doctor ${source}`,
    gitlawbHref: `https://gitlawb.com/node/repos/${ownerSegment(repo.owner_did)}/${repo.name}`,
    packageCommand: `nipmod package ${source} --dir ${repo.name}`,
    packageId,
    readinessScore,
    repoName: repo.name,
    shortOwner: ownerSegment(repo.owner_did).slice(0, 8),
    source,
    status,
    updatedAt: repo.updated_at
  };
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
    { label: "Candidates", value: String(candidates.length) },
    { label: "Claimed", value: String(claimed) },
    { label: "Published", value: String(published) },
    { label: "Unclaimed", value: String(unclaimed) }
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

function isDidKey(value: string): boolean {
  return /^did:key:z[A-Za-z0-9]+$/.test(value);
}

function isRepoName(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*$/.test(value);
}

function isProbeRepo(repo: GitlawbRepoSummary): boolean {
  return [repo.name, repo.description].some((value) => value.toLowerCase().includes("probe"));
}
