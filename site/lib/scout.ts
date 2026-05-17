import {
  candidateClaimState,
  candidateFromRepo,
  fetchGitlawbRepos,
  type GitlawbRepoSummary,
  type PackageClaimIndex,
  type PackageCandidate
} from "./candidates";
import type { RegistryIndex, RegistryPackage } from "./registry";

export const SCOUT_BASE_URL = "https://nipmod.com/scout";
export const SCOUT_INTERVAL_MS = 300_000;
export const DEFAULT_NODE_URL = "https://node.nipmod.com";

export interface ScoutCandidate {
  claimStatus: "claimed" | "unclaimed";
  cloneUrl: string;
  commands: {
    claim: string;
    claimVerify: string;
    packagePr: string;
  };
  defaultBranch: string;
  description: string;
  gitlawbUrl: string;
  package: string;
  patch: {
    endpoint: string;
    remoteWrites: false;
  };
  readinessScore: number;
  repoName: string;
  shortOwner: string;
  source: string;
  status: string;
  suggestedType: string;
  updatedAt: string;
}

export interface ScoutCycle {
  candidates: ScoutCandidate[];
  formatVersion: 1;
  generatedAt: string;
  node: {
    reposUrl: string;
    url: string;
  };
  ok: true;
  summary: {
    claimed: number;
    patchable: number;
    scanned: number;
  };
  type: "dev.nipmod.scout-cycle.v1";
}

export interface PackagePatch {
  files: Array<{ content: string; path: string }>;
  formatVersion: 1;
  generatedAt: string;
  nextCommands: string[];
  package: string;
  remoteWrites: false;
  source: string;
  type: "dev.nipmod.package-patch.v1";
}

export async function buildScoutCycle({
  claimIndex,
  fetchReposFn = fetchGitlawbRepos,
  generatedAt = new Date().toISOString(),
  nodeUrl = DEFAULT_NODE_URL,
  registry,
  scoutBaseUrl = SCOUT_BASE_URL
}: {
  claimIndex: PackageClaimIndex;
  fetchReposFn?: (options: { nodeUrl: string }) => Promise<GitlawbRepoSummary[]>;
  generatedAt?: string;
  nodeUrl?: string;
  registry: RegistryIndex;
  scoutBaseUrl?: string;
}): Promise<ScoutCycle> {
  const state = candidateClaimState({
    claimIndex,
    publishedPackages: new Set(registry.packages.map((pkg) => pkg.canonical))
  });
  const repos = await readRepos({ fetchReposFn, nodeUrl, registry });
  const candidates = repos.map((repo) => scoutCandidateFromPackageCandidate(candidateFromRepo(repo, state), state, scoutBaseUrl));

  return {
    candidates,
    formatVersion: 1,
    generatedAt,
    node: {
      reposUrl: `${trimTrailingSlash(nodeUrl)}/api/v1/repos`,
      url: trimTrailingSlash(nodeUrl)
    },
    ok: true,
    summary: {
      claimed: candidates.filter((candidate) => candidate.claimStatus === "claimed").length,
      patchable: candidates.length,
      scanned: candidates.length
    },
    type: "dev.nipmod.scout-cycle.v1"
  };
}

export function createPackagePatchFromSource(source: string, { generatedAt = new Date().toISOString() } = {}): PackagePatch {
  const repo = repoFromSource(source);
  const packageId = `pkg:${repo.owner_did}/${repo.name}`;
  const normalizedSource = `gitlawb://${repo.owner_did}/${repo.name}`;
  const manifest = {
    agent: {
      permissions: [],
      runtime: "source"
    },
    canonical: packageId,
    defaultBranch: repo.default_branch,
    description: repo.description,
    formatVersion: 1,
    name: repo.name,
    source: normalizedSource,
    type: "dev.nipmod.package-manifest.v1",
    version: "0.1.0"
  };

  return {
    files: [
      {
        content: `${JSON.stringify(manifest, null, 2)}\n`,
        path: "nipmod.json"
      },
      {
        content: readmeForPatch(repo, packageId, normalizedSource),
        path: "README.nipmod.md"
      }
    ],
    formatVersion: 1,
    generatedAt,
    nextCommands: [
      "git add nipmod.json README.nipmod.md",
      "git commit -m \"feat: add nipmod package manifest\"",
      "GITLAWB_NODE=https://node.nipmod.com git push"
    ],
    package: packageId,
    remoteWrites: false,
    source: normalizedSource,
    type: "dev.nipmod.package-patch.v1"
  };
}

async function readRepos({
  fetchReposFn,
  nodeUrl,
  registry
}: {
  fetchReposFn: (options: { nodeUrl: string }) => Promise<GitlawbRepoSummary[]>;
  nodeUrl: string;
  registry: RegistryIndex;
}): Promise<GitlawbRepoSummary[]> {
  try {
    const repos = await fetchReposFn({ nodeUrl });
    if (repos.length > 0) {
      return repos;
    }
  } catch {
    return registry.packages.map(repoFromRegistryPackage);
  }
  return registry.packages.map(repoFromRegistryPackage);
}

function scoutCandidateFromPackageCandidate(candidate: PackageCandidate, state: ReturnType<typeof candidateClaimState>, scoutBaseUrl: string): ScoutCandidate {
  const claimed = state.claimedPackages.has(candidate.packageId);
  return {
    claimStatus: claimed ? "claimed" : "unclaimed",
    cloneUrl: "",
    commands: {
      claim: `nipmod claim ${candidate.source} --dir . --identity .nipmod/identity.json`,
      claimVerify: `nipmod claim verify ${candidate.source} --json`,
      packagePr: `nipmod package pr ${candidate.source} --dir ${candidate.repoName}-pr --json`
    },
    defaultBranch: "main",
    description: candidate.description,
    gitlawbUrl: candidate.gitlawbHref,
    package: candidate.packageId,
    patch: {
      endpoint: `${trimTrailingSlash(scoutBaseUrl)}/patch?repo=${encodeURIComponent(candidate.source)}`,
      remoteWrites: false
    },
    readinessScore: candidate.readinessScore,
    repoName: candidate.repoName,
    shortOwner: candidate.shortOwner,
    source: candidate.source,
    status: candidate.status === "needs-work" ? "needs-work" : claimed ? "claimed" : "package-ready",
    suggestedType: suggestedType(candidate),
    updatedAt: candidate.updatedAt
  };
}

function repoFromSource(source: string): GitlawbRepoSummary {
  const match = /^gitlawb:\/\/(did:key:z[A-Za-z0-9]+)\/([a-z0-9][a-z0-9._-]*)$/.exec(source);
  if (!match) {
    throw new Error("repo must be gitlawb://did:key:.../repo");
  }
  const ownerDid = match[1];
  const name = match[2];
  if (!ownerDid || !name) {
    throw new Error("repo must be gitlawb://did:key:.../repo");
  }
  return {
    clone_url: `https://node.nipmod.com/${ownerDid.replace(/^did:key:/, "")}/${name}.git`,
    default_branch: "main",
    description: "Public Gitlawb repo",
    is_public: true,
    name,
    owner_did: ownerDid,
    updated_at: new Date(0).toISOString()
  };
}

function repoFromRegistryPackage(pkg: RegistryPackage): GitlawbRepoSummary {
  return {
    clone_url: pkg.cloneUrl,
    default_branch: "main",
    description: pkg.description,
    is_public: true,
    name: pkg.repo,
    owner_did: pkg.publisher,
    updated_at: pkg.updatedAt
  };
}

function suggestedType(candidate: PackageCandidate): string {
  const corpus = `${candidate.repoName}\n${candidate.description}`.toLowerCase();
  if (/\bmcp\b/.test(corpus)) return "mcp-server";
  if (/\bskill\b/.test(corpus)) return "agent-skill";
  if (/\bworkflow\b|\bpolicy\b|\beval\b/.test(corpus)) return "workflow-pack";
  if (/\btool\b|\breview\b|\baudit\b|\breader\b|\bagent\b/.test(corpus)) return "agent-tool";
  return "source-package";
}

function readmeForPatch(repo: GitlawbRepoSummary, packageId: string, source: string): string {
  return `# ${repo.name}

Nipmod package draft for ${source}.

Package:

\`\`\`text
${packageId}
\`\`\`

Prepare this repo:

\`\`\`sh
git add nipmod.json README.nipmod.md
git commit -m "feat: add nipmod package manifest"
GITLAWB_NODE=https://node.nipmod.com git push
\`\`\`

Verify ownership:

\`\`\`sh
nipmod claim verify ${source} --json
\`\`\`
`;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
