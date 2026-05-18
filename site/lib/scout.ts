import {
  candidateClaimState,
  candidateFromRepo,
  fetchGitlawbRepos,
  type GitlawbRepoSummary,
  type PackageClaimIndex,
  type PackageCandidate
} from "./candidates";
import type { RegistryIndex, RegistryPackage } from "./registry";
import { createOwnerNotificationPlan, type OwnerNotificationPlan } from "./scout-notifications";

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
  draft: {
    claimRequired: boolean;
    endpoint: string;
    remoteWrites: false;
    status: PackageDraftStatus;
  };
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

export type PackageDraftStatus = "claimed" | "published" | "unclaimed" | "needs-work";

export interface PackageDraft {
  claim: {
    command: string;
    proofPath: ".nipmod/package-claim.json";
    required: boolean;
    verifyCommand: string;
  };
  files: Array<{ content: string; path: string }>;
  formatVersion: 1;
  generatedAt: string;
  manifest: Record<string, unknown>;
  nextCommands: string[];
  package: string;
  remoteWrites: false;
  repo: {
    gitlawbUrl: string;
    name: string;
    ownerDid: string;
  };
  source: string;
  status: PackageDraftStatus;
  type: "dev.nipmod.package-draft.v1";
  warnings: string[];
}

export interface ScoutCycle {
  candidates: ScoutCandidate[];
  drafts: PackageDraft[];
  formatVersion: 1;
  generatedAt: string;
  node: {
    reposUrl: string;
    url: string;
  };
  ok: true;
  ownerNotifications: OwnerNotificationPlan;
  summary: {
    claimed: number;
    drafts: number;
    patchable: number;
    published: number;
    scanned: number;
    unclaimedDrafts: number;
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
  const drafts = candidates
    .filter((candidate) => draftStatusFromCandidate(candidate) !== "published")
    .map((candidate) =>
      createPackageDraftFromCandidate(candidate, {
        generatedAt,
        status: draftStatusFromCandidate(candidate)
      })
    );

  const cycle: Omit<ScoutCycle, "ownerNotifications"> = {
    candidates,
    drafts,
    formatVersion: 1,
    generatedAt,
    node: {
      reposUrl: `${trimTrailingSlash(nodeUrl)}/api/v1/repos`,
      url: trimTrailingSlash(nodeUrl)
    },
    ok: true,
    summary: {
      claimed: candidates.filter((candidate) => candidate.claimStatus === "claimed").length,
      drafts: drafts.length,
      patchable: candidates.length,
      published: candidates.filter((candidate) => candidate.status === "published").length,
      scanned: candidates.length,
      unclaimedDrafts: drafts.filter((draft) => draft.status === "unclaimed").length
    },
    type: "dev.nipmod.scout-cycle.v1"
  };
  return {
    ...cycle,
    ownerNotifications: createOwnerNotificationPlan({
      candidates,
      claimIndexOk: true,
      drafts,
      generatedAt,
      nodeUrl,
      registryOk: true
    })
  };
}

export function createPackageDraftFromSource(
  source: string,
  {
    generatedAt = new Date().toISOString(),
    scoutBaseUrl = SCOUT_BASE_URL,
    status = "unclaimed"
  }: {
    generatedAt?: string;
    scoutBaseUrl?: string;
    status?: PackageDraftStatus;
  } = {}
): PackageDraft {
  const repo = repoFromSource(source);
  const candidate = scoutCandidateFromPackageCandidate(
    candidateFromRepo(repo, {
      claimedPackages: status === "claimed" ? new Set([`pkg:${repo.owner_did}/${repo.name}`]) : new Set(),
      publishedPackages: status === "published" ? new Set([`pkg:${repo.owner_did}/${repo.name}`]) : new Set()
    }),
    {
      claimedPackages: status === "claimed" ? new Set([`pkg:${repo.owner_did}/${repo.name}`]) : new Set(),
      publishedPackages: status === "published" ? new Set([`pkg:${repo.owner_did}/${repo.name}`]) : new Set()
    },
    scoutBaseUrl
  );
  return createPackageDraftFromCandidate(candidate, { generatedAt, status });
}

export function packageDraftFromScoutCycle(cycle: Pick<ScoutCycle, "drafts">, source: string): PackageDraft | null {
  const normalizedSource = sourceFromRepo(repoFromSource(source));
  return cycle.drafts.find((draft) => draft.source === normalizedSource) ?? null;
}

export function createPackagePatchFromSource(source: string, { generatedAt = new Date().toISOString() } = {}): PackagePatch {
  const draft = createPackageDraftFromSource(source, { generatedAt });

  return {
    files: draft.files,
    formatVersion: 1,
    generatedAt,
    nextCommands: [
      "git add nipmod.json README.nipmod.md",
      "git commit -m \"feat: add nipmod package manifest\"",
      "GITLAWB_NODE=https://node.nipmod.com git push"
    ],
    package: draft.package,
    remoteWrites: false,
    source: draft.source,
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
  const published = state.publishedPackages.has(candidate.packageId);
  const draftStatus = published ? "published" : claimed ? "claimed" : candidate.status === "needs-work" ? "needs-work" : "unclaimed";
  const sourceParam = encodeURIComponent(candidate.source);
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
    draft: {
      claimRequired: draftStatus !== "claimed" && draftStatus !== "published",
      endpoint: `${trimTrailingSlash(scoutBaseUrl)}/draft?repo=${sourceParam}`,
      remoteWrites: false,
      status: draftStatus
    },
    gitlawbUrl: candidate.gitlawbHref,
    package: candidate.packageId,
    patch: {
      endpoint: `${trimTrailingSlash(scoutBaseUrl)}/patch?repo=${sourceParam}`,
      remoteWrites: false
    },
    readinessScore: candidate.readinessScore,
    repoName: candidate.repoName,
    shortOwner: candidate.shortOwner,
    source: candidate.source,
    status: candidate.status === "published" ? "published" : candidate.status === "needs-work" ? "needs-work" : claimed ? "claimed" : "unclaimed-draft",
    suggestedType: suggestedType(candidate),
    updatedAt: candidate.updatedAt
  };
}

function createPackageDraftFromCandidate(
  candidate: ScoutCandidate,
  { generatedAt, status }: { generatedAt: string; status: PackageDraftStatus }
): PackageDraft {
  const ownerDid = ownerDidFromSource(candidate.source);
  const claimRequired = status !== "claimed" && status !== "published";
  const manifest = packageManifestForCandidate(candidate, ownerDid);
  const files = [
    {
      content: `${JSON.stringify(manifest, null, 2)}\n`,
      path: "nipmod.json"
    },
    {
      content: readmeForDraft(candidate),
      path: "README.nipmod.md"
    }
  ];

  return {
    claim: {
      command: `nipmod claim ${candidate.source} --dir . --identity .nipmod/identity.json`,
      proofPath: ".nipmod/package-claim.json",
      required: claimRequired,
      verifyCommand: `nipmod claim verify ${candidate.source} --json`
    },
    files,
    formatVersion: 1,
    generatedAt,
    manifest,
    nextCommands: [
      `nipmod package pr ${candidate.source} --dir . --identity .nipmod/identity.json --json`,
      "git add nipmod.json README.nipmod.md .nipmod/package-claim.json",
      "git commit -m \"feat: add nipmod package manifest\"",
      "GITLAWB_NODE=https://node.nipmod.com git push",
      `nipmod claim verify ${candidate.source} --json`
    ],
    package: candidate.package,
    remoteWrites: false,
    repo: {
      gitlawbUrl: candidate.gitlawbUrl,
      name: candidate.repoName,
      ownerDid
    },
    source: candidate.source,
    status,
    type: "dev.nipmod.package-draft.v1",
    warnings: [
      "This is an unclaimed draft until the Gitlawb repo owner signs and pushes .nipmod/package-claim.json.",
      "Nipmod does not claim ownership of this repo and does not open remote writes automatically."
    ]
  };
}

function packageManifestForCandidate(candidate: ScoutCandidate, ownerDid: string): Record<string, unknown> {
  return {
    canonical: candidate.package,
    description: candidate.description || `${candidate.repoName} package from Gitlawb source`,
    exports: {
      ".": {
        source: "./README.nipmod.md"
      }
    },
    files: ["README.nipmod.md", "nipmod.json"],
    formatVersion: 1,
    license: "NOASSERTION",
    name: candidate.repoName,
    permissions: {
      env: [],
      exec: {
        allowed: false
      },
      filesystem: [],
      mcpTools: [],
      network: [],
      postinstall: {
        allowed: false
      },
      secrets: []
    },
    publish: {
      provenance: candidate.source,
      signingKey: ownerDid
    },
    type: manifestTypeFromSuggested(candidate.suggestedType),
    version: "0.1.0"
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

function sourceFromRepo(repo: GitlawbRepoSummary): string {
  return `gitlawb://${repo.owner_did}/${repo.name}`;
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

function readmeForDraft(candidate: ScoutCandidate): string {
  return `# ${candidate.repoName}

Nipmod package draft for ${candidate.source}.

Package:

\`\`\`text
${candidate.package}
\`\`\`

Prepare this repo:

\`\`\`sh
nipmod claim ${candidate.source} --dir . --identity .nipmod/identity.json
git add nipmod.json README.nipmod.md .nipmod/package-claim.json
git commit -m "feat: add nipmod package manifest"
GITLAWB_NODE=https://node.nipmod.com git push
\`\`\`

Verify ownership:

\`\`\`sh
nipmod claim verify ${candidate.source} --json
\`\`\`
`;
}

function draftStatusFromCandidate(candidate: ScoutCandidate): PackageDraftStatus {
  if (candidate.status === "published") return "published";
  if (candidate.status === "claimed") return "claimed";
  if (candidate.status === "needs-work") return "needs-work";
  return "unclaimed";
}

function manifestTypeFromSuggested(value: string): string {
  if (value === "mcp-server") return "mcp-server";
  if (value === "agent-skill") return "skill";
  if (value === "workflow-pack") return "workflow-pack";
  if (value === "agent-tool") return "tool-bundle";
  return "adapter";
}

function ownerDidFromSource(source: string): string {
  const match = /^gitlawb:\/\/(did:key:z[A-Za-z0-9]+)\//.exec(source);
  if (!match?.[1]) {
    throw new Error("repo must be gitlawb://did:key:.../repo");
  }
  return match[1];
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
