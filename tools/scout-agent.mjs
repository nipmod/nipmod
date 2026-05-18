#!/usr/bin/env node
import { createOwnerNotificationPlan, notificationOptionsFromEnv } from "./scout-notify.mjs";

const DEFAULT_NODE_URL = "https://node.nipmod.com";
const DEFAULT_CLAIM_INDEX_URL = "https://nipmod.com/claims/index.json";
const DEFAULT_REGISTRY_URL = "https://nipmod.com/registry/packages.json";
const DEFAULT_SCOUT_URL = "https://nipmod.com/scout";

export async function runScoutCycle({
  claimIndexUrl = process.env.NIPMOD_SCOUT_CLAIM_INDEX_URL ?? DEFAULT_CLAIM_INDEX_URL,
  fetchFn = fetch,
  generatedAt = new Date().toISOString(),
  limit = numberFromEnv(process.env.NIPMOD_SCOUT_LIMIT, 500),
  nodeUrl = process.env.NIPMOD_SCOUT_NODE_URL ?? process.env.GITLAWB_NODE ?? DEFAULT_NODE_URL,
  notificationOptions = notificationOptionsFromEnv(process.env),
  registryUrl = process.env.NIPMOD_SCOUT_REGISTRY_URL ?? DEFAULT_REGISTRY_URL,
  scoutUrl = process.env.NIPMOD_SCOUT_PUBLIC_URL ?? DEFAULT_SCOUT_URL
} = {}) {
  const repos = await fetchPublicRepos({ fetchFn, limit, nodeUrl });
  const claimIndex = await fetchClaimIndex({ claimIndexUrl, fetchFn });
  const registry = await fetchRegistry({ fetchFn, registryUrl });
  const candidates = repos
    .map((repo) => candidateFromRepo(repo, claimIndex.verifiedPackageSet, registry.publishedPackageSet, { scoutUrl }))
    .sort(compareCandidates);
  const drafts = candidates
    .filter((candidate) => candidate.status !== "published")
    .map((candidate) =>
      createPackageDraft(candidate, {
        generatedAt,
        scoutUrl,
        status: candidate.claimStatus === "claimed" ? "claimed" : candidate.status === "needs-work" ? "needs-work" : "unclaimed"
      })
    );

  const cycle = {
    candidates,
    drafts,
    claimIndex: {
      error: claimIndex.error,
      generatedAt: claimIndex.generatedAt,
      ok: claimIndex.ok,
      url: claimIndexUrl,
      verifiedClaims: claimIndex.verifiedClaims
    },
    formatVersion: 1,
    generatedAt,
    node: {
      reposUrl: `${trimTrailingSlash(nodeUrl)}/api/v1/repos`,
      url: trimTrailingSlash(nodeUrl)
    },
    ok: true,
    registry: {
      error: registry.error,
      ok: registry.ok,
      publishedPackages: registry.publishedPackages,
      url: registryUrl
    },
    summary: {
      claimed: candidates.filter((candidate) => candidate.claimStatus === "claimed").length,
      drafts: drafts.length,
      patchable: candidates.filter((candidate) => candidate.patch?.remoteWrites === false).length,
      published: candidates.filter((candidate) => candidate.status === "published").length,
      scanned: candidates.length,
      unclaimedDrafts: drafts.filter((draft) => draft.status === "unclaimed").length
    },
    type: "dev.nipmod.scout-cycle.v1"
  };
  return {
    ...cycle,
    ownerNotifications: createOwnerNotificationPlan(cycle, {
      ...notificationOptions,
      generatedAt
    })
  };
}

export function createPackagePatch(input, { generatedAt = new Date().toISOString(), nodeUrl = DEFAULT_NODE_URL } = {}) {
  const draft = createPackageDraft(input, { generatedAt, nodeUrl });

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

export function createPackageDraft(
  input,
  { generatedAt = new Date().toISOString(), nodeUrl = DEFAULT_NODE_URL, scoutUrl = DEFAULT_SCOUT_URL, status = "unclaimed" } = {}
) {
  const repo = normalizeRepo(input, { assumePublicFromSource: true });
  if (!repo) {
    throw new Error("invalid Gitlawb repo");
  }

  const source = sourceForRepo(repo);
  const packageId = packageForRepo(repo);
  const gitlawbUrl = `https://gitlawb.com/node/repos/${ownerSegment(repo.owner_did)}/${repo.name}`;
  const manifest = {
    canonical: packageId,
    description: repo.description || "Public Gitlawb repo",
    exports: {
      ".": {
        source: "./README.nipmod.md"
      }
    },
    files: ["README.nipmod.md", "nipmod.json"],
    formatVersion: 1,
    license: "NOASSERTION",
    name: repo.name,
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
      provenance: source,
      signingKey: repo.owner_did
    },
    type: manifestTypeFromSuggested(suggestedType(repo)),
    version: "0.1.0"
  };
  const files = [
    {
      content: `${JSON.stringify(manifest, null, 2)}\n`,
      path: "nipmod.json"
    },
    {
      content: packageReadme(repo, packageId, source, nodeUrl),
      path: "README.nipmod.md"
    }
  ];
  const claimRequired = status !== "claimed" && status !== "published";

  return {
    claim: {
      command: `nipmod claim ${source} --dir . --identity .nipmod/identity.json`,
      proofPath: ".nipmod/package-claim.json",
      required: claimRequired,
      verifyCommand: `nipmod claim verify ${source} --json`
    },
    files,
    formatVersion: 1,
    generatedAt,
    manifest,
    nextCommands: [
      `nipmod package pr ${source} --dir . --identity .nipmod/identity.json --json`,
      "git add nipmod.json README.nipmod.md .nipmod/package-claim.json",
      "git commit -m \"feat: add nipmod package manifest\"",
      "GITLAWB_NODE=https://node.nipmod.com git push",
      `nipmod claim verify ${source} --json`
    ],
    package: packageId,
    remoteWrites: false,
    repo: {
      gitlawbUrl,
      name: repo.name,
      ownerDid: repo.owner_did
    },
    source,
    status,
    type: "dev.nipmod.package-draft.v1",
    warnings: [
      "This is an unclaimed draft until the Gitlawb repo owner signs and pushes .nipmod/package-claim.json.",
      "Nipmod does not claim ownership of this repo and does not open remote writes automatically."
    ]
  };
}

export function repoFromGitlawbSource(source) {
  const match = /^gitlawb:\/\/(did:key:z[A-Za-z0-9]+)\/([a-z0-9][a-z0-9._-]*)$/.exec(String(source ?? ""));
  if (!match) {
    throw new Error("repo must be gitlawb://did:key:.../repo");
  }
  return {
    clone_url: `${DEFAULT_NODE_URL}/${ownerSegment(match[1])}/${match[2]}.git`,
    default_branch: "main",
    description: "Public Gitlawb repo",
    is_public: true,
    name: match[2],
    owner_did: match[1],
    updated_at: new Date(0).toISOString()
  };
}

async function fetchPublicRepos({ fetchFn, limit, nodeUrl }) {
  const response = await fetchFn(`${trimTrailingSlash(nodeUrl)}/api/v1/repos`, {
    headers: { accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(`Gitlawb repo scan failed with HTTP ${response.status}`);
  }
  const payload = await response.json();
  const rawRepos = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.repos)
      ? payload.repos
      : Array.isArray(payload?.repositories)
        ? payload.repositories
        : [];
  return rawRepos.map((repo) => normalizeRepo(repo)).filter(isScoutableRepo).slice(0, limit);
}

async function fetchClaimIndex({ claimIndexUrl, fetchFn }) {
  try {
    const response = await fetchFn(claimIndexUrl, {
      headers: { accept: "application/json" }
    });
    if (!response.ok) {
      throw new Error(`claim index returned HTTP ${response.status}`);
    }
    const payload = await response.json();
    const verifiedClaims = verifiedClaimPackages(payload);
    return {
      generatedAt: payload.generatedAt ?? null,
      ok: true,
      verifiedClaims: verifiedClaims.size,
      verifiedPackageSet: verifiedClaims
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      generatedAt: null,
      ok: false,
      verifiedClaims: 0,
      verifiedPackageSet: new Set()
    };
  }
}

function verifiedClaimPackages(payload) {
  const claims = Array.isArray(payload?.verifiedClaims)
    ? payload.verifiedClaims
    : Array.isArray(payload?.claims)
      ? payload.claims
      : [];
  return new Set(
    claims
      .filter((claim) => claim?.status === "verified" && typeof claim.package === "string")
      .map((claim) => claim.package.replace(/@(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/, ""))
  );
}

async function fetchRegistry({ fetchFn, registryUrl }) {
  try {
    const response = await fetchFn(registryUrl, {
      headers: { accept: "application/json" }
    });
    if (!response.ok) {
      throw new Error(`registry returned HTTP ${response.status}`);
    }
    const publishedPackageSet = publishedPackages(await response.json());
    return {
      ok: true,
      publishedPackages: publishedPackageSet.size,
      publishedPackageSet
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      ok: false,
      publishedPackages: 0,
      publishedPackageSet: new Set()
    };
  }
}

function publishedPackages(payload) {
  const packages = Array.isArray(payload?.packages) ? payload.packages : [];
  return new Set(
    packages
      .map((pkg) => (typeof pkg?.canonical === "string" ? pkg.canonical : null))
      .filter(Boolean)
      .map((canonical) => canonical.replace(/@(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/, ""))
  );
}

function candidateFromRepo(repo, verifiedPackageSet, publishedPackageSet, { scoutUrl }) {
  const packageId = packageForRepo(repo);
  const source = sourceForRepo(repo);
  const claimed = verifiedPackageSet.has(packageId);
  const published = publishedPackageSet.has(packageId);
  const readinessScore = claimed ? 100 : scoreRepo(repo);
  const sourceParam = encodeURIComponent(source);
  const draftStatus = published ? "published" : claimed ? "claimed" : readinessScore >= 50 ? "unclaimed" : "needs-work";
  const patchEndpoint = `${trimTrailingSlash(scoutUrl)}/patch?repo=${sourceParam}`;

  return {
    claimStatus: claimed ? "claimed" : "unclaimed",
    cloneUrl: repo.clone_url,
    commands: {
      claim: `nipmod claim ${source} --dir . --identity .nipmod/identity.json`,
      claimVerify: `nipmod claim verify ${source} --json`,
      packagePr: `nipmod package pr ${source} --dir ${repo.name}-pr --json`
    },
    defaultBranch: repo.default_branch,
    description: repo.description || "Public Gitlawb repo",
    draft: {
      claimRequired: draftStatus !== "claimed" && draftStatus !== "published",
      endpoint: `${trimTrailingSlash(scoutUrl)}/draft?repo=${sourceParam}`,
      remoteWrites: false,
      status: draftStatus
    },
    gitlawbUrl: `https://gitlawb.com/node/repos/${ownerSegment(repo.owner_did)}/${repo.name}`,
    package: packageId,
    patch: {
      endpoint: patchEndpoint,
      remoteWrites: false
    },
    readinessScore,
    repoName: repo.name,
    shortOwner: ownerSegment(repo.owner_did).slice(0, 8),
    source,
    status: published ? "published" : claimed ? "claimed" : readinessScore >= 50 ? "unclaimed-draft" : "needs-work",
    suggestedType: suggestedType(repo),
    updatedAt: repo.updated_at
  };
}

function normalizeRepo(input, { assumePublicFromSource = false } = {}) {
  if (!input || typeof input !== "object") {
    return null;
  }
  const ownerDid =
    typeof input.owner_did === "string"
      ? input.owner_did
      : typeof input.ownerDid === "string"
        ? input.ownerDid
        : typeof input.owner?.did === "string"
          ? input.owner.did
          : ownerDidFromSource(input.source);
  const name =
    typeof input.name === "string"
      ? input.name
      : typeof input.repoName === "string"
        ? input.repoName
        : typeof input.repo === "string"
          ? input.repo
          : repoNameFromSource(input.source);
  const isPublic =
    typeof input.is_public === "boolean"
      ? input.is_public
      : typeof input.public === "boolean"
        ? input.public
        : input.visibility === "public" || (assumePublicFromSource && isGitlawbSource(input.source));

  return {
    clone_url: stringOr(input.clone_url, input.cloneUrl, ""),
    default_branch: stringOr(input.default_branch, input.defaultBranch, "main"),
    description: stringOr(input.description, ""),
    is_public: isPublic,
    name,
    owner_did: ownerDid,
    updated_at: stringOr(input.updated_at, input.updatedAt, new Date(0).toISOString())
  };
}

function isScoutableRepo(repo) {
  return repo?.is_public === true && isDidKey(repo.owner_did) && isRepoName(repo.name) && !isProbeRepo(repo);
}

function scoreRepo(repo) {
  let score = 0;
  const corpus = `${repo.name}\n${repo.description}`.toLowerCase();
  if (repo.is_public) score += 20;
  if (repo.description.trim()) score += 20;
  if (repo.default_branch) score += 10;
  if (repo.clone_url) score += 10;
  if (/\bagent\b|\bskill\b|\bmcp\b|\btool\b|\bworkflow\b|\bpolicy\b|\beval\b|\bpackage\b|gitlawb|nipmod/.test(corpus)) {
    score += 25;
  }
  if (/(reader|review|audit|policy|skill|agent|mcp|workflow|package|bot|index|registry)/.test(repo.name)) {
    score += 15;
  }
  return Math.min(100, score);
}

function suggestedType(repo) {
  const corpus = `${repo.name}\n${repo.description}`.toLowerCase();
  if (/\bmcp\b/.test(corpus)) return "mcp-server";
  if (/\bskill\b/.test(corpus)) return "agent-skill";
  if (/\bworkflow\b|\bpolicy\b|\beval\b/.test(corpus)) return "workflow-pack";
  if (/\btool\b|\breview\b|\baudit\b|\breader\b|\bagent\b/.test(corpus)) return "agent-tool";
  return "source-package";
}

function manifestTypeFromSuggested(value) {
  if (value === "mcp-server") return "mcp-server";
  if (value === "agent-skill") return "skill";
  if (value === "workflow-pack") return "workflow-pack";
  if (value === "agent-tool") return "tool-bundle";
  return "adapter";
}

function compareCandidates(left, right) {
  return (
    statusWeight(right.status) - statusWeight(left.status) ||
    right.readinessScore - left.readinessScore ||
    left.repoName.localeCompare(right.repoName)
  );
}

function statusWeight(status) {
  if (status === "unclaimed-draft") return 3;
  if (status === "claimed") return 2;
  return 1;
}

function packageReadme(repo, packageId, source, nodeUrl) {
  return `# ${repo.name}

Nipmod package draft for ${source}.

Package:

\`\`\`text
${packageId}
\`\`\`

Prepare this repo:

\`\`\`sh
nipmod claim ${source} --dir . --identity .nipmod/identity.json
git add nipmod.json README.nipmod.md .nipmod/package-claim.json
git commit -m "feat: add nipmod package manifest"
GITLAWB_NODE=${trimTrailingSlash(nodeUrl)} git push
\`\`\`

Verify ownership:

\`\`\`sh
nipmod claim verify ${source} --json
\`\`\`
`;
}

function packageForRepo(repo) {
  return `pkg:${repo.owner_did}/${repo.name}`;
}

function sourceForRepo(repo) {
  return `gitlawb://${repo.owner_did}/${repo.name}`;
}

function ownerSegment(ownerDid) {
  return ownerDid.replace(/^did:key:/, "");
}

function isDidKey(value) {
  return /^did:key:z[A-Za-z0-9]+$/.test(value);
}

function isRepoName(value) {
  return /^[a-z0-9][a-z0-9._-]*$/.test(value);
}

function isGitlawbSource(value) {
  return /^gitlawb:\/\/did:key:z[A-Za-z0-9]+\/[a-z0-9][a-z0-9._-]*$/.test(String(value ?? ""));
}

function ownerDidFromSource(value) {
  const match = /^gitlawb:\/\/(did:key:z[A-Za-z0-9]+)\//.exec(String(value ?? ""));
  return match?.[1] ?? "";
}

function repoNameFromSource(value) {
  const match = /^gitlawb:\/\/did:key:z[A-Za-z0-9]+\/([a-z0-9][a-z0-9._-]*)$/.exec(String(value ?? ""));
  return match?.[1] ?? "";
}

function isProbeRepo(repo) {
  return [repo.name, repo.description].some((value) => String(value).toLowerCase().includes("probe"));
}

function stringOr(...values) {
  for (const value of values) {
    if (typeof value === "string") {
      return value;
    }
  }
  return "";
}

function trimTrailingSlash(value) {
  return String(value).replace(/\/+$/, "");
}

function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const result = await runScoutCycle();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}
