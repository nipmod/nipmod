#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SITE_REGISTRY_PATH = join(ROOT, "site", "app", "registry-data.json");
const PUBLIC_REGISTRY_PATH = join(ROOT, "site", "public", "registry", "packages.json");
const PUBLIC_REGISTRY_PACKAGES_DIR = join(ROOT, "site", "public", "registry", "packages");
const PUBLIC_TRANSPARENCY_DIR = join(ROOT, "site", "public", "transparency");
const PUBLIC_TRANSPARENCY_LOG_PATH = join(PUBLIC_TRANSPARENCY_DIR, "log.json");
const PUBLIC_TRANSPARENCY_CHECKPOINT_PATH = join(PUBLIC_TRANSPARENCY_DIR, "checkpoint.json");
const PUBLIC_TRANSPARENCY_WITNESS_REQUEST_PATH = join(PUBLIC_TRANSPARENCY_DIR, "witness-request.json");
const PUBLIC_TRANSPARENCY_LEAVES_DIR = join(PUBLIC_TRANSPARENCY_DIR, "leaves");
const PUBLIC_TRANSPARENCY_PROOFS_DIR = join(PUBLIC_TRANSPARENCY_DIR, "proofs");
const PUBLIC_TRANSPARENCY_WITNESSES_DIR = join(PUBLIC_TRANSPARENCY_DIR, "witnesses");
const PUBLIC_COMPATIBILITY_RECEIPTS_PATH = join(ROOT, "site", "public", "compatibility", "receipts.json");
const PUBLIC_SITE_DIR = join(ROOT, "site", "public");
const DEFAULT_LOG_IDENTITY_PATH = join(ROOT, ".nipmod", "transparency-log-identity.json");
const DEFAULT_WITNESS_IDENTITY_PATH = join(ROOT, ".nipmod", "transparency-witness-identity.json");
const DEFAULT_NODE_URL = "https://node.nipmod.com";
const BUNDLE_MEDIA_TYPE = "application/vnd.nipmod.bundle.v1+json";
const COMPATIBILITY_RECEIPT_TYPE = "dev.nipmod.compatibility-receipt.v1";
const COMPATIBILITY_RECEIPT_INDEX_TYPE = "dev.nipmod.compatibility-receipts.v1";
const COMPATIBILITY_FORMATS = new Set(["apm-package", "git-source-provenance", "mcp-server-json"]);
const MAX_STATIC_CANONICAL_BYTES = 187;
const JSON_LIMIT = 512 * 1024;
const BUNDLE_LIMIT = 5 * 1024 * 1024;
const STRING_LIMITS = {
  description: 180,
  name: 90,
  type: 40
};

export async function buildRegistryIndex(options = {}) {
  const baseUrl = normalizeBaseUrl(options.nodeUrl ?? process.env.NIPMOD_NODE_URL ?? DEFAULT_NODE_URL);
  const fetchFn = options.fetchFn ?? fetch;
  const verifyBundle = options.verifyBundle ?? (await loadVerifyBundle());
  const verifySignedReleaseEvent = options.verifySignedReleaseEvent ?? (await loadVerifySignedReleaseEvent());
  const verifySignedLifecycleEvent = options.verifySignedLifecycleEvent ?? (await loadVerifySignedLifecycleEvent());
  const previousIndex = options.previousIndex ?? emptyRegistry(baseUrl.href.replace(/\/$/, ""));
  const previousDigests = packageDigestMap(previousIndex);
  const packages = [];
  const transparencyCandidates = [];
  const skipped = [];
  const repos = await fetchJson(new URL("/api/v1/repos", baseUrl), { fetchFn, maxBytes: JSON_LIMIT });
  const compatibilityReceipts =
    process.env.NIPMOD_SKIP_COMPATIBILITY_RECEIPTS === "1"
      ? []
      : options.compatibilityReceipts === undefined
      ? await loadCompatibilityReceipts(options.compatibilityReceiptsPath ?? process.env.NIPMOD_COMPATIBILITY_RECEIPTS_PATH)
      : parseCompatibilityReceiptIndex(options.compatibilityReceipts);
  await assertCompatibilityReceiptExampleHashes(compatibilityReceipts);

  if (!Array.isArray(repos)) {
    throw new Error("Gitlawb repo list must be a JSON array");
  }

  for (const repoValue of repos) {
    const repoName = typeof repoValue?.name === "string" ? repoValue.name : "unknown";
    try {
      const repo = parseRepo(repoValue);
      if (!repo.is_public) {
        skipped.push({ reason: "repo is not public", repo: repo.name });
        continue;
      }

      const ownerSegment = didTail(repo.owner_did);
      const packageIndex = parsePackageIndex(
        await fetchJson(buildBlobUrl(baseUrl, ownerSegment, repo.name, "index.json"), {
          fetchFn,
          maxBytes: JSON_LIMIT
        })
      );
      const gitlawbSourceRepo = `gitlawb://${repo.owner_did}/${repo.name}`;
      const lifecycleState = await buildLifecycleState({
        baseUrl,
        fetchFn,
        ownerSegment,
        packageIndex,
        repo,
        sourceRepo: gitlawbSourceRepo,
        verifySignedLifecycleEvent
      });
      for (const skippedRelease of packageIndex.skippedReleases) {
        skipped.push({
          reason: `release ${skippedRelease.version}: ${skippedRelease.reason}`,
          repo: repo.name
        });
      }
      if (!packageIndex.releases[packageIndex.latest]) {
        throw new Error(`latest release ${packageIndex.latest} is missing`);
      }

      for (const [releaseVersion, release] of sortedReleaseEntries(packageIndex.releases, skipped, repo.name)) {
        try {
          const artifactPath = safeBlobPath(release.artifact.path);
          if (release.artifact.mediaType !== BUNDLE_MEDIA_TYPE) {
            throw new Error(`unsupported artifact media type ${release.artifact.mediaType}`);
          }

          const releasePath = safeBlobPath(`releases/${releaseVersion}/release.json`);
          const releaseEvent = await fetchOptionalJson(buildBlobUrl(baseUrl, ownerSegment, repo.name, releasePath), {
            fetchFn,
            maxBytes: JSON_LIMIT
          });
          const artifactUrl = buildBlobUrl(baseUrl, ownerSegment, repo.name, artifactPath);
          const artifactBytes = await fetchBytes(artifactUrl, { fetchFn, maxBytes: BUNDLE_LIMIT });
          const artifactDigest = sha256Hex(artifactBytes);
          const artifactDigestVerified = artifactDigest === release.artifact.sha256;
          if (!artifactDigestVerified) {
            throw new Error(`artifact digest mismatch: ${artifactDigest} !== ${release.artifact.sha256}`);
          }

          const bundle = verifyBundle(artifactBytes, release.artifact.sha256, { requireSignature: true });
          const manifest = bundle.manifest;
          if (packageIndex.package !== manifest.canonical) {
            throw new Error("package index canonical does not match bundle canonical");
          }
          if (releaseVersion !== manifest.version) {
            throw new Error("package index release version does not match bundle version");
          }
          if (manifest.publish.signingKey !== repo.owner_did) {
            throw new Error("repo owner does not match package publisher");
          }
          if (release.publisher !== manifest.publish.signingKey) {
            throw new Error("release publisher does not match package publisher");
          }
          if (!manifest.canonical.startsWith(`pkg:${manifest.publish.signingKey}/`)) {
            throw new Error("package canonical owner does not match publisher");
          }
          if (release.artifact.manifestDigest !== bundle.manifestDigest) {
            throw new Error("package index manifest digest does not match bundle manifest");
          }
          const permissions = summarizePermissions(manifest.permissions);
          const releaseEventSigned = hasVerifiedReleaseEvent(
            releaseEvent,
            {
              artifactPath,
              artifactSha256: release.artifact.sha256,
              manifestDigest: release.artifact.manifestDigest,
              mediaType: BUNDLE_MEDIA_TYPE,
              package: manifest.canonical,
              publisher: manifest.publish.signingKey,
              sourceRepo: gitlawbSourceRepo,
              sourceTag: `v${manifest.version}`,
              version: manifest.version
            },
            verifySignedReleaseEvent
          );
          const sourceProvenance = releaseEventSigned
            ? await verifySourceTag(baseUrl, ownerSegment, repo.name, repo.default_branch, `v${manifest.version}`, fetchFn)
            : null;
          const evidence = {
            artifactDigestVerified,
            bundleSignatureVerified: Boolean(bundle.signature),
            immutableSnapshotMatched:
              previousDigests.get(`${manifest.canonical}@${manifest.version}`) === undefined ||
              previousDigests.get(`${manifest.canonical}@${manifest.version}`) === artifactDigest,
            publisherMatchesCanonical:
              manifest.publish.signingKey === repo.owner_did &&
              release.publisher === manifest.publish.signingKey &&
              manifest.canonical.startsWith(`pkg:${manifest.publish.signingKey}/`),
            releaseEventSigned,
            sourceProvenanceVerified: sourceProvenance?.verified === true,
            transparencyLogIncluded: false,
            transparencyLogVerified: false
          };
          const trust = deriveTrust(evidence, permissions.summary);

          const packageRecord = {
            artifactPath,
            artifactSha256: release.artifact.sha256,
            canonical: manifest.canonical,
            cloneUrl: buildCloneUrl(baseUrl, ownerSegment, repo.name),
            description: sanitizeText(manifest.description ?? repo.description ?? "", STRING_LIMITS.description),
            ...dependencyMetadata(manifest),
            digest: artifactDigest,
            distTags: lifecycleState.distTags,
            ...(lifecycleState.deprecations[manifest.version] ? { deprecated: lifecycleState.deprecations[manifest.version] } : {}),
            ...(lifecycleState.yanks[manifest.version] ? { yanked: lifecycleState.yanks[manifest.version] } : {}),
            ...(lifecycleState.events.length > 0 ? { lifecycleEvents: lifecycleState.events } : {}),
            name: sanitizeText(manifest.name, STRING_LIMITS.name),
            owner: repo.owner_did,
            permissionDetails: permissions.details,
            permissions: permissions.summary,
            publisher: manifest.publish.signingKey,
            releasePath,
            repo: repo.name,
            resolved: artifactUrl.href,
            sourceCommit: sourceProvenance?.commit ?? null,
            sourceTag: sourceProvenance?.tag ?? null,
            sourceRepo: buildCloneUrl(baseUrl, ownerSegment, repo.name),
            stars: repo.star_count,
            trust,
            type: sanitizeText(manifest.type, STRING_LIMITS.type),
            updatedAt: repo.updated_at,
            version: manifest.version
          };
          const excludedPackageKeys = registryExcludedPackageKeys(options.excludedPackageKeys);
          if (isRegistryExcludedPackage(packageRecord, excludedPackageKeys)) {
            skipped.push({
              reason: "package excluded by registry policy",
              repo: repo.name
            });
            continue;
          }

          const packageIndexInResult = packages.length;
          packages.push(packageRecord);
          if (releaseEventSigned && releaseEvent) {
            transparencyCandidates.push({
              packageIndex: packageIndexInResult,
              leaf: {
                artifactSha256: release.artifact.sha256,
                package: manifest.canonical,
                publisher: manifest.publish.signingKey,
                releaseEvent,
                version: manifest.version
              }
            });
          }
        } catch (error) {
          skipped.push({
            reason: `release ${releaseVersion}: ${error instanceof Error ? error.message : "unknown crawler error"}`,
            repo: repo.name
          });
        }
      }
    } catch (error) {
      skipped.push({
        reason: error instanceof Error ? error.message : "unknown crawler error",
        repo: repoName
      });
    }
  }

  const transparencyLog = await buildTransparencyLog(transparencyCandidates, packages, { ...options, previousIndex });
  attachCompatibilityReceipts(packages, compatibilityReceipts);
  const index = {
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    packages: packages.sort(comparePackages),
    skipped,
    source: baseUrl.href.replace(/\/$/, "")
  };
  if (transparencyLog) {
    index.transparencyLog = transparencyLog;
  }
  assertNoMissingPackages(previousIndex, index);
  assertImmutableDigests(previousIndex, index);
  return index;
}

export function deriveTrust(evidence, permissions) {
  const signals = [];
  const warnings = [];
  let score = 0;

  if (evidence.artifactDigestVerified) {
    score += 20;
    signals.push("Artifact digest verified");
  } else {
    warnings.push("Artifact digest could not be verified");
  }

  if (evidence.bundleSignatureVerified) {
    score += 20;
    signals.push("Bundle signature verified");
  } else {
    warnings.push("Bundle signature missing or invalid");
  }

  if (evidence.publisherMatchesCanonical) {
    score += 15;
    signals.push("Publisher matches canonical owner");
  } else {
    warnings.push("Publisher does not match canonical owner");
  }

  if (evidence.immutableSnapshotMatched) {
    score += 15;
    signals.push("Version digest unchanged");
  } else {
    warnings.push("Version digest changed since the last index");
  }

  if (evidence.releaseEventSigned) {
    score += 10;
    signals.push("Release event signed");
  } else {
    warnings.push("Release event missing or invalid");
  }

  if (evidence.sourceProvenanceVerified) {
    score += 5;
    signals.push("Source tag verified");
  } else {
    warnings.push("Source tag could not be verified");
  }

  if (evidence.transparencyLogIncluded) {
    signals.push("Transparency proof published");
  } else {
    warnings.push("Transparency proof not published");
  }

  if (evidence.transparencyLogVerified) {
    score += 10;
    signals.push("Witnessed checkpoint verified");
  } else {
    warnings.push("Witnessed checkpoint pending");
  }

  if (hasNoRequestedPermissions(permissions)) {
    score += 5;
    signals.push("No manifest permissions");
  } else {
    warnings.push("Package requests permissions");
  }

  const hardSigned =
    evidence.artifactDigestVerified &&
    evidence.bundleSignatureVerified &&
    evidence.publisherMatchesCanonical &&
    evidence.immutableSnapshotMatched &&
    evidence.releaseEventSigned &&
    evidence.sourceProvenanceVerified;
  const hardVerified = hardSigned && evidence.transparencyLogIncluded && evidence.transparencyLogVerified;

  return {
    evidence,
    level: hardVerified ? "verified" : hardSigned ? "signed" : score > 0 ? "review" : "unknown",
    score,
    signals,
    warnings
  };
}

export function assertImmutableDigests(previousIndex, nextIndex) {
  const previousDigests = packageDigestMap(previousIndex);
  for (const pkg of nextIndex.packages ?? []) {
    const key = `${pkg.canonical}@${pkg.version}`;
    const previousDigest = previousDigests.get(key);
    if (previousDigest !== undefined && previousDigest !== pkg.digest) {
      throw new Error(`immutable digest changed for ${key}: ${previousDigest} -> ${pkg.digest}`);
    }
  }
}

export function assertNoMissingPackages(previousIndex, nextIndex, excludedPackageKeys = registryExcludedPackageKeys()) {
  const nextKeys = new Set((nextIndex.packages ?? []).map((pkg) => packageKey(pkg)));
  const missing = (previousIndex.packages ?? [])
    .filter((pkg) => !isRegistryExcludedPackage(pkg, excludedPackageKeys))
    .map((pkg) => packageKey(pkg))
    .filter((key) => !nextKeys.has(key));
  if (missing.length > 0) {
    throw new Error(`registry packages disappeared: ${missing.join(", ")}`);
  }
}

export function isRegistryExcludedPackage(pkg, excludedPackageKeys = registryExcludedPackageKeys()) {
  const values = [pkg?.name, pkg?.canonical, pkg?.description, pkg?.repo]
    .filter((value) => typeof value === "string")
    .map((value) => value.toLowerCase());
  if (values.some((value) => value.includes("probe"))) {
    return true;
  }
  const key = packageKey(pkg);
  return excludedPackageKeys.has(key) || excludedPackageKeys.has(pkg?.canonical);
}

function registryExcludedPackageKeys(value = process.env.NIPMOD_REGISTRY_EXCLUDE_PACKAGES) {
  if (value instanceof Set) {
    return value;
  }
  if (Array.isArray(value)) {
    return new Set(value.map((item) => String(item).trim()).filter(Boolean));
  }
  if (typeof value !== "string" || value.trim() === "") {
    return new Set();
  }
  return new Set(value.split(",").map((item) => item.trim()).filter(Boolean));
}

async function loadCompatibilityReceipts(path = PUBLIC_COMPATIBILITY_RECEIPTS_PATH) {
  if (path === null || path === false) {
    return [];
  }
  try {
    const index = JSON.parse(await readFile(path, "utf8"));
    return parseCompatibilityReceiptIndex(index);
  } catch (error) {
    if (isNotFound(error)) {
      return [];
    }
    throw error;
  }
}

function parseCompatibilityReceiptIndex(value) {
  if (Array.isArray(value)) {
    return value.map(parseCompatibilityReceipt);
  }
  if (
    !value ||
    typeof value !== "object" ||
    value.formatVersion !== 1 ||
    value.type !== COMPATIBILITY_RECEIPT_INDEX_TYPE ||
    !Array.isArray(value.receipts)
  ) {
    throw new Error("compatibility receipt index is invalid");
  }
  return value.receipts.map(parseCompatibilityReceipt);
}

function parseCompatibilityReceipt(value) {
  if (!value || typeof value !== "object") {
    throw new Error("compatibility receipt is invalid");
  }
  const receipt = {
    exampleUrl: requiredCompatibilityUrl(value.exampleUrl, "exampleUrl"),
    externalFormat: requiredCompatibilityFormat(value.externalFormat),
    externalInputSha256: assertSha256(requiredString(value.externalInputSha256, "externalInputSha256", 80)),
    id: assertCompatibilityReceiptId(requiredString(value.id, "id", 90)),
    label: requiredString(value.label, "label", 48),
    package: requiredString(value.package, "package", 180),
    packageDigest: assertSha256(requiredString(value.packageDigest, "packageDigest", 80)),
    preservedFields: compatibilityStringList(value.preservedFields, "preservedFields"),
    provenanceLoss: compatibilityStringList(value.provenanceLoss, "provenanceLoss"),
    receiptUrl: requiredCompatibilityUrl(value.receiptUrl, "receiptUrl"),
    sourceCommit: assertGitCommit(requiredString(value.sourceCommit, "sourceCommit", 48)),
    sourceRepo: requiredString(value.sourceRepo, "sourceRepo", 240),
    sourceTag: requiredString(value.sourceTag, "sourceTag", 60),
    type: requiredString(value.type, "type", 80),
    unsupportedFields: compatibilityStringList(value.unsupportedFields, "unsupportedFields"),
    version: requiredString(value.version, "version", 40)
  };
  if (receipt.type !== COMPATIBILITY_RECEIPT_TYPE) {
    throw new Error("compatibility receipt type is invalid");
  }
  if (receipt.provenanceLoss.length > 0) {
    throw new Error("compatibility receipt provenance loss must be explicit and empty");
  }
  return receipt;
}

function attachCompatibilityReceipts(packages, receipts) {
  if (receipts.length === 0) {
    return;
  }
  const packagesByKey = new Map(packages.map((pkg) => [packageKey(pkg), pkg]));
  const ids = new Set();
  for (const receipt of receipts) {
    if (ids.has(receipt.id)) {
      throw new Error(`duplicate compatibility receipt: ${receipt.id}`);
    }
    ids.add(receipt.id);
    const key = packageKey({ canonical: receipt.package, version: receipt.version });
    const pkg = packagesByKey.get(key);
    if (!pkg) {
      throw new Error(`compatibility receipt references missing package: ${key}`);
    }
    assertCompatibilityReceiptMatchesPackage(receipt, pkg);
    pkg.compatibilityReceipts = [...(pkg.compatibilityReceipts ?? []), receipt].sort((left, right) =>
      left.label.localeCompare(right.label)
    );
  }
}

async function assertCompatibilityReceiptExampleHashes(receipts) {
  for (const receipt of receipts) {
    const examplePath = localCompatibilityExamplePath(receipt.exampleUrl);
    const digest = sha256Hex(await readFile(examplePath));
    if (digest !== receipt.externalInputSha256) {
      throw new Error(`compatibility receipt example hash mismatch: ${receipt.id}`);
    }
  }
}

function localCompatibilityExamplePath(href) {
  const url = new URL(href);
  const segments = url.pathname.split("/").filter(Boolean);
  if (
    segments.length < 3 ||
    segments[0] !== "compatibility" ||
    segments[1] !== "examples" ||
    segments.some((segment) => segment === "." || segment === ".." || segment.includes("\\"))
  ) {
    throw new Error("compatibility receipt example path is invalid");
  }
  return join(PUBLIC_SITE_DIR, ...segments.map((segment) => decodeURIComponent(segment)));
}

function assertCompatibilityReceiptMatchesPackage(receipt, pkg) {
  const subject = packageKey(pkg);
  if (pkg.trust.level !== "verified" || pkg.trust.score !== 100) {
    throw new Error(`${subject} compatibility receipt requires verified trust`);
  }
  const expected = {
    packageDigest: pkg.digest,
    sourceCommit: pkg.sourceCommit,
    sourceRepo: pkg.sourceRepo,
    sourceTag: pkg.sourceTag
  };
  for (const [field, value] of Object.entries(expected)) {
    if (receipt[field] !== value) {
      throw new Error(`${subject} compatibility receipt ${field} mismatch`);
    }
  }
}

function requiredCompatibilityFormat(value) {
  const format = requiredString(value, "externalFormat", 48);
  if (!COMPATIBILITY_FORMATS.has(format)) {
    throw new Error(`compatibility receipt format is unsupported: ${format}`);
  }
  return format;
}

function requiredCompatibilityUrl(value, field) {
  const href = requiredString(value, field, 260);
  const url = new URL(href);
  if (url.protocol !== "https:" || url.origin !== "https://nipmod.com" || !url.pathname.startsWith("/compatibility/")) {
    throw new Error(`compatibility receipt ${field} must be a nipmod compatibility URL`);
  }
  return href;
}

function assertCompatibilityReceiptId(value) {
  if (!/^[a-z0-9][a-z0-9._-]{1,80}$/.test(value)) {
    throw new Error("compatibility receipt id is invalid");
  }
  return value;
}

function assertGitCommit(value) {
  if (!isGitCommitHash(value)) {
    throw new Error("compatibility receipt source commit is invalid");
  }
  return value;
}

function compatibilityStringList(value, field) {
  if (!Array.isArray(value)) {
    if (field === "provenanceLoss") {
      throw new Error("compatibility receipt provenance loss must be explicit and empty");
    }
    throw new Error(`compatibility receipt ${field} is invalid`);
  }
  if (value.length > 32) {
    throw new Error(`compatibility receipt ${field} has too many entries`);
  }
  return value.map((item) => requiredString(item, field, 120));
}

export function normalizeBaseUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("NIPMOD_NODE_URL must use https unless it targets localhost");
  }
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

export function safeBlobPath(path) {
  if (typeof path !== "string" || path.length === 0 || path.length > 240) {
    throw new Error("blob path is invalid");
  }
  if (path.includes("\\") || path.startsWith("/") || path.startsWith("~")) {
    throw new Error(`unsafe blob path: ${path}`);
  }
  const parts = path.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new Error(`unsafe blob path: ${path}`);
  }
  return parts.join("/");
}

export function buildBlobUrl(baseUrl, owner, repo, path) {
  const safeOwner = encodeURIComponent(didTail(owner));
  const safeRepo = encodeURIComponent(assertSlug(repo, "repo"));
  const safePath = safeBlobPath(path)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return new URL(`/api/v1/repos/${safeOwner}/${safeRepo}/blob/${safePath}`, baseUrl);
}

function parseRepo(value) {
  if (!value || typeof value !== "object") {
    throw new Error("repo entry is invalid");
  }

  return {
    clone_url: optionalString(value.clone_url, "clone_url", 240),
    created_at: requiredString(value.created_at, "created_at", 80),
    default_branch: requiredString(value.default_branch, "default_branch", 80),
    description: optionalString(value.description, "description", STRING_LIMITS.description),
    id: requiredString(value.id, "id", 120),
    is_public: value.is_public === true,
    name: assertSlug(requiredString(value.name, "name", STRING_LIMITS.name), "name"),
    owner_did: assertDid(requiredString(value.owner_did, "owner_did", 140)),
    star_count: Number.isSafeInteger(value.star_count) ? value.star_count : 0,
    updated_at: requiredString(value.updated_at, "updated_at", 80)
  };
}

function parsePackageIndex(value) {
  if (!value || typeof value !== "object" || value.formatVersion !== 1) {
    throw new Error("package index is invalid");
  }
  const latest = requiredString(value.latest, "latest", 40);
  const packageId = requiredString(value.package, "package", 180);
  if (!value.releases || typeof value.releases !== "object" || Array.isArray(value.releases)) {
    throw new Error("package index releases are invalid");
  }
  const lifecycleEvents = parseLifecycleEventRefs(value.lifecycle);
  const releases = {};
  const skippedReleases = [];
  for (const [version, releaseValue] of Object.entries(value.releases)) {
    try {
      parseSemver(version);
    } catch (error) {
      skippedReleases.push({
        reason: error instanceof Error ? error.message : "invalid semver",
        version
      });
      continue;
    }
    if (!releaseValue || typeof releaseValue !== "object") {
      continue;
    }
    const artifact = releaseValue.artifact;
    if (!artifact || typeof artifact !== "object") {
      continue;
    }
    releases[version] = {
      artifact: {
        mediaType: requiredString(artifact.mediaType, "artifact.mediaType", 120),
        manifestDigest: assertSha256(requiredString(artifact.manifestDigest, "artifact.manifestDigest", 80)),
        path: safeBlobPath(requiredString(artifact.path, "artifact.path", 240)),
        sha256: assertSha256(requiredString(artifact.sha256, "artifact.sha256", 80))
      },
      publisher: assertDid(requiredString(releaseValue.publisher, "publisher", 140))
    };
  }

  return {
    formatVersion: 1,
    latest,
    lifecycleEvents,
    package: packageId,
    releases,
    skippedReleases
  };
}

function parseLifecycleEventRefs(value) {
  if (value === undefined) {
    return [];
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("package index lifecycle is invalid");
  }
  const events = value.events;
  if (events === undefined) {
    return [];
  }
  if (!Array.isArray(events)) {
    throw new Error("package index lifecycle events are invalid");
  }
  return events.map((event, index) => {
    if (!event || typeof event !== "object" || Array.isArray(event)) {
      throw new Error(`package index lifecycle event ${index} is invalid`);
    }
    return {
      path: safeBlobPath(requiredString(event.path, "lifecycle.events.path", 240))
    };
  });
}

function summarizePermissions(permissions) {
  const details = {
    env: capList(permissions.env),
    filesystem: capList(permissions.filesystem),
    mcpTools: capList(permissions.mcpTools),
    network: capList(permissions.network),
    secrets: capList(permissions.secrets)
  };
  return {
    details,
    summary: {
      env: details.env.length,
      exec: permissions.exec.allowed !== false,
      filesystem: details.filesystem.length,
      mcpTools: details.mcpTools.length,
      network: details.network.length,
      postinstall: permissions.postinstall.allowed !== false,
      secrets: details.secrets.length
    }
  };
}

function dependencyMetadata(manifest) {
  return {
    ...nonEmptyMap("dependencies", manifest.dependencies),
    ...nonEmptyMap("devDependencies", manifest.devDependencies),
    ...nonEmptyMap("optionalDependencies", manifest.optionalDependencies),
    ...nonEmptyMap("peerDependencies", manifest.peerDependencies),
    ...nonEmptyMap("peerDependenciesMeta", manifest.peerDependenciesMeta)
  };
}

function nonEmptyMap(field, value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length === 0) {
    return {};
  }
  return {
    [field]: value
  };
}

export function hasVerifiedReleaseEvent(releaseEvent, expected, verifySignedReleaseEvent) {
  if (!releaseEvent || typeof verifySignedReleaseEvent !== "function") {
    return false;
  }

  try {
    verifySignedReleaseEvent(releaseEvent, expected);
    return true;
  } catch {
    return false;
  }
}

async function buildLifecycleState({
  baseUrl,
  fetchFn,
  ownerSegment,
  packageIndex,
  repo,
  sourceRepo,
  verifySignedLifecycleEvent
}) {
  const distTags = { latest: packageIndex.latest };
  const deprecations = {};
  const yanks = {};
  const events = [];

  for (const ref of packageIndex.lifecycleEvents ?? []) {
    const rawEvent = await fetchJson(buildBlobUrl(baseUrl, ownerSegment, repo.name, ref.path), {
      fetchFn,
      maxBytes: JSON_LIMIT
    });
    const signed = verifySignedLifecycleEvent(rawEvent, {
      package: packageIndex.package,
      publisher: repo.owner_did,
      sourceRepo
    });
    const event = signed.payload;
    assertLifecycleEventTarget(event, packageIndex);
    const summary = lifecycleEventSummary(event, ref.path, signed.signature.keyId);
    events.push(summary);

    switch (event.action.kind) {
      case "dist-tag.set":
        distTags[event.action.tag] = event.action.version;
        break;
      case "dist-tag.remove":
        delete distTags[event.action.tag];
        break;
      case "deprecate":
        deprecations[event.action.version] = {
          active: true,
          eventPath: ref.path,
          package: event.package,
          publishedAt: event.publishedAt,
          reason: event.action.reason,
          signer: signed.signature.keyId,
          type: "dev.nipmod.deprecation.v1",
          version: event.action.version
        };
        break;
      case "yank":
        yanks[event.action.version] = {
          active: true,
          eventPath: ref.path,
          package: event.package,
          publishedAt: event.publishedAt,
          reason: event.action.reason,
          signer: signed.signature.keyId,
          type: "dev.nipmod.yank.v1",
          version: event.action.version
        };
        break;
    }
  }

  if (!distTags.latest) {
    distTags.latest = packageIndex.latest;
  }
  assertLifecycleDistTags(distTags, packageIndex);
  return { deprecations, distTags, events, yanks };
}

function assertLifecycleEventTarget(event, packageIndex) {
  if (event.package !== packageIndex.package) {
    throw new Error("lifecycle event package mismatch");
  }
  const version = event.action?.version;
  if (version && !packageIndex.releases[version]) {
    throw new Error(`lifecycle event target version is not in package index: ${version}`);
  }
}

function assertLifecycleDistTags(distTags, packageIndex) {
  for (const [tag, version] of Object.entries(distTags)) {
    if (!/^[a-z][a-z0-9._-]{0,31}$/.test(tag) || /^(?:v?\d|\d)/.test(tag)) {
      throw new Error(`lifecycle dist-tag is invalid: ${tag}`);
    }
    if (!packageIndex.releases[version]) {
      throw new Error(`lifecycle dist-tag ${tag} points at missing version ${version}`);
    }
  }
}

function lifecycleEventSummary(event, path, signer) {
  const base = {
    action: event.action.kind,
    package: event.package,
    path,
    publishedAt: event.publishedAt,
    signer
  };
  if ("tag" in event.action) {
    base.tag = event.action.tag;
  }
  if ("version" in event.action) {
    base.version = event.action.version;
  }
  if ("reason" in event.action) {
    base.reason = event.action.reason;
  }
  return base;
}

export async function verifySourceTag(baseUrl, owner, repo, defaultBranch, tag, fetchFn = fetch) {
  if (typeof tag !== "string" || !/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag)) {
    return null;
  }
  const refsUrl = new URL(
    `/${encodeURIComponent(didTail(owner))}/${encodeURIComponent(assertSlug(repo, "repo"))}.git/info/refs?service=git-upload-pack`,
    baseUrl
  );
  const refs = parseGitInfoRefs(await fetchBytes(refsUrl, { fetchFn, maxBytes: JSON_LIMIT }));
  const branchRef = `refs/heads/${assertSlug(defaultBranch || "main", "default_branch")}`;
  const tagRef = `refs/tags/${tag}`;
  const branchCommit = refs.get(branchRef) ?? refs.get("HEAD");
  const tagCommit = refs.get(tagRef);
  if (!isGitCommitHash(branchCommit) || !isGitCommitHash(tagCommit) || branchCommit !== tagCommit) {
    return {
      branchCommit: branchCommit ?? null,
      commit: null,
      tag,
      tagCommit: tagCommit ?? null,
      verified: false
    };
  }
  return {
    branchCommit,
    commit: tagCommit,
    tag,
    tagCommit,
    verified: true
  };
}

export function parseGitInfoRefs(bytes) {
  const refs = new Map();
  let offset = 0;
  while (offset + 4 <= bytes.length) {
    const rawLength = bytes.subarray(offset, offset + 4).toString("utf8");
    const length = Number.parseInt(rawLength, 16);
    if (!Number.isFinite(length) || length < 0) {
      break;
    }
    offset += 4;
    if (length === 0) {
      continue;
    }
    if (length < 4 || offset + length - 4 > bytes.length) {
      break;
    }
    const line = bytes.subarray(offset, offset + length - 4).toString("utf8").trimEnd();
    offset += length - 4;
    if (line.startsWith("#")) {
      continue;
    }
    const refLine = line.split("\0")[0];
    const [sha, ref] = refLine.split(" ");
    if (isGitCommitHash(sha) && typeof ref === "string" && ref.length > 0) {
      refs.set(ref, sha);
    }
  }
  return refs;
}

function isGitCommitHash(value) {
  return typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
}

async function buildTransparencyLog(candidates, packages, options) {
  if (candidates.length === 0) {
    return null;
  }

  const transparency = options.transparency ?? (await loadTransparency());
  const logIdentity = options.logIdentity ?? (await loadLogIdentity());
  const previousLeaves = previousTransparencyLeaves(options.previousIndex);
  const currentLeaves = currentTransparencyLeaves(transparency, candidates);
  const generatedAt = transparencyGeneratedAt(options, previousLeaves, currentLeaves);
  const log =
    typeof transparency.extendTransparencyLog === "function"
      ? transparency.extendTransparencyLog(
          options.previousIndex?.transparencyLog ?? null,
          candidates.map((candidate) => candidate.leaf),
          logIdentity,
          generatedAt
        )
      : fallbackTransparencyLog(transparency, candidates, logIdentity, generatedAt, previousLeaves);
  const entriesBySubject = new Map(log.entries.map((entry) => [subjectKey(entry.leaf.package, entry.leaf.version), entry]));
  const externalWitnessInput =
    Array.isArray(options.witnessStatements) ||
    typeof process.env.NIPMOD_WITNESS_STATEMENTS_SOURCE === "string" ||
    typeof process.env.NIPMOD_WITNESS_STATEMENTS_PATH === "string";
  const witnesses = await createWitnessStatements(log.treeHead, transparency, options);
  const allowedLogIds = parseDidList(options.allowedLogIds ?? process.env.NIPMOD_ALLOWED_LOG_IDS);
  const allowedWitnesses = parseDidList(options.allowedWitnesses ?? process.env.NIPMOD_ALLOWED_WITNESSES);
  const witnessVerified =
    externalWitnessInput &&
    allowedLogIds.includes(log.treeHead.logId) &&
    allowedWitnesses.length > 0 &&
    typeof transparency.verifyWitnessStatement === "function" &&
    witnesses.some((witness) => transparency.verifyWitnessStatement(witness, log.treeHead, allowedWitnesses));
  const publicLog = {
    ...log,
    previousCheckpoint: options.previousIndex?.transparencyLog?.treeHead ?? null,
    witnesses
  };

  for (const candidate of candidates) {
    const pkg = packages[candidate.packageIndex];
    const entry = entriesBySubject.get(subjectKey(candidate.leaf.package, candidate.leaf.version));
    const included = transparency.verifyTransparencyEntry(entry, log.treeHead);
    if (!pkg || !entry || !included) {
      continue;
    }

    pkg.proof = proofForEntry(entry, log.treeHead, witnesses);
    pkg.trust = deriveTrust(
      {
        ...pkg.trust.evidence,
        transparencyLogIncluded: true,
        transparencyLogVerified: witnessVerified
      },
      pkg.permissions
    );
  }

  return publicLog;
}

function fallbackTransparencyLog(transparency, candidates, logIdentity, generatedAt, previousLeaves) {
  const draftLog = transparency.createTransparencyLog(
    candidates.map((candidate) => candidate.leaf),
    logIdentity,
    generatedAt
  );
  const leaves = mergeTransparencyLeaves(previousLeaves, draftLog.entries.map((entry) => entry.leaf));
  return typeof transparency.createTransparencyLogFromLeaves === "function"
    ? transparency.createTransparencyLogFromLeaves(leaves, logIdentity, generatedAt)
    : draftLog;
}

async function createWitnessStatements(treeHead, transparency, options) {
  if (Array.isArray(options.witnessStatements)) {
    return sanitizeWitnessStatements(options.witnessStatements);
  }
  const externalWitnesses = await loadWitnessStatementsFromEnv();
  if (externalWitnesses) {
    return externalWitnesses;
  }
  if (!options.witnessIdentity && process.env.NIPMOD_LOCAL_WITNESS !== "1") {
    return [];
  }
  if (typeof transparency.signWitnessStatement !== "function") {
    return [];
  }

  const witnessIdentity = options.witnessIdentity ?? (await loadWitnessIdentity());
  if (witnessIdentity.did === treeHead.logId) {
    throw new Error("transparency witness identity must differ from log identity");
  }

  return [transparency.signWitnessStatement(treeHead, witnessIdentity)];
}

function previousTransparencyLeaves(index) {
  const entries = index?.transparencyLog?.entries;
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry) => entry?.leaf)
    .filter((leaf) => Boolean(leaf));
}

function currentTransparencyLeaves(transparency, candidates) {
  return candidates.map((candidate) => ({
    artifactSha256: candidate.leaf.artifactSha256,
    eventHash: transparency.releaseEventHash(candidate.leaf.releaseEvent),
    package: candidate.leaf.package,
    publisher: candidate.leaf.publisher,
    version: candidate.leaf.version
  }));
}

function mergeTransparencyLeaves(previousLeaves, currentLeaves) {
  const merged = new Map();
  for (const leaf of [...previousLeaves, ...currentLeaves]) {
    const key = subjectKey(leaf.package, leaf.version);
    const previous = merged.get(key);
    if (!previous) {
      merged.set(key, leaf);
      continue;
    }
    if (previous.eventHash !== leaf.eventHash || previous.artifactSha256 !== leaf.artifactSha256) {
      throw new Error(`transparency log leaf changed for ${key}`);
    }
  }
  return [...merged.values()];
}

function transparencyGeneratedAt(options, previousLeaves, currentLeaves) {
  if (options.generatedAt) {
    return options.generatedAt;
  }
  if (process.env.NIPMOD_INDEX_GENERATED_AT) {
    return process.env.NIPMOD_INDEX_GENERATED_AT;
  }
  const previousTreeHead = options.previousIndex?.transparencyLog?.treeHead;
  if (
    previousTreeHead?.generatedAt &&
    currentLeaves.every((leaf) => hasSameTransparencyLeaf(previousLeaves, leaf))
  ) {
    return previousTreeHead.generatedAt;
  }
  return new Date().toISOString();
}

function hasSameTransparencyLeaf(leaves, candidateLeaf) {
  return leaves.some((leaf) => transparencyLeafIdentity(leaf) === transparencyLeafIdentity(candidateLeaf));
}

function transparencyLeafIdentity(leaf) {
  return `${subjectKey(leaf.package, leaf.version)}:${leaf.eventHash}:${leaf.artifactSha256}`;
}

async function loadWitnessStatementsFromEnv() {
  const source = process.env.NIPMOD_WITNESS_STATEMENTS_SOURCE ?? process.env.NIPMOD_WITNESS_STATEMENTS_PATH;
  if (!source) {
    return null;
  }

  const value = await readJsonSource(source);
  if (value?.type === "dev.nipmod.transparency.witness-statements.v1" && Array.isArray(value.statements)) {
    return sanitizeWitnessStatements(value.statements);
  }
  return sanitizeWitnessStatements(Array.isArray(value) ? value : [value]);
}

async function readJsonSource(source) {
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source, {
      redirect: "error",
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) {
      throw new Error(`fetch failed ${response.status} at ${source}`);
    }
    return response.json();
  }
  return JSON.parse(await readFile(source, "utf8"));
}

function sanitizeWitnessStatements(statements) {
  return statements.filter((statement) => {
    if (!statement || typeof statement !== "object") {
      return false;
    }
    if (typeof statement.witness !== "string") {
      return false;
    }
    if (
      !statement.signature ||
      typeof statement.signature !== "object" ||
      statement.signature.algorithm !== "Ed25519" ||
      typeof statement.signature.keyId !== "string" ||
      typeof statement.signature.signatureBase64 !== "string"
    ) {
      return false;
    }
    try {
      assertDid(statement.witness);
      assertDid(statement.signature.keyId);
      return true;
    } catch {
      return false;
    }
  });
}

function proofForEntry(entry, treeHead, witnesses = []) {
  const leafHash = entry.leafHash;
  const witnessUrls = witnesses.map((witness) => `/transparency/witnesses/${didTail(witness.witness)}.json`);
  return {
    checkpointUrl: "/transparency/checkpoint.json",
    eventHash: entry.leaf.eventHash,
    leafHash,
    leafIndex: entry.leafIndex,
    leafUrl: `/transparency/leaves/${leafHash}.json`,
    proofUrl: `/transparency/proofs/${leafHash}.json`,
    rootHash: treeHead.rootHash,
    subject: subjectKey(entry.leaf.package, entry.leaf.version),
    treeSize: treeHead.treeSize,
    type: "dev.nipmod.registry.proof.v1",
    witnesses: witnesses.map((witness) => witness.witness),
    witnessUrls
  };
}

function parseDidList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => assertDid(String(item)));
  }
  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }
  return value
    .split(",")
    .map((item) => assertDid(item.trim()))
    .filter(Boolean);
}

function subjectKey(packageId, version) {
  return `${packageId}@${version}`;
}

async function fetchOptionalJson(url, options) {
  try {
    return await fetchJson(url, options);
  } catch {
    return null;
  }
}

async function fetchJson(url, options) {
  const bytes = await fetchBytes(url, options);
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error(`invalid JSON at ${url.href}`);
  }
}

async function fetchBytes(url, { fetchFn, maxBytes }) {
  const response = await fetchFn(url, {
    redirect: "error",
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) {
    throw new Error(`fetch failed ${response.status} at ${url.href}`);
  }
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > maxBytes) {
    throw new Error(`response too large at ${url.href}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxBytes) {
    throw new Error(`response too large at ${url.href}`);
  }
  return bytes;
}

async function loadVerifyBundle() {
  const bundlePath = join(ROOT, "nipmod", "dist", "bundle.js");
  ensureNipmodBuilt();
  await access(bundlePath);
  const bundleModule = await import(pathToFileURL(bundlePath).href);
  return bundleModule.verifyBundle;
}

async function loadVerifySignedReleaseEvent() {
  const releasePath = join(ROOT, "nipmod", "dist", "release.js");
  ensureNipmodBuilt();
  await access(releasePath);
  const releaseModule = await import(pathToFileURL(releasePath).href);
  return releaseModule.verifySignedReleaseEvent;
}

async function loadVerifySignedLifecycleEvent() {
  const lifecyclePath = join(ROOT, "nipmod", "dist", "lifecycle.js");
  ensureNipmodBuilt();
  await access(lifecyclePath);
  const lifecycleModule = await import(pathToFileURL(lifecyclePath).href);
  return lifecycleModule.verifySignedLifecycleEvent;
}

async function loadTransparency() {
  const transparencyPath = join(ROOT, "nipmod", "dist", "transparency.js");
  ensureNipmodBuilt();
  await access(transparencyPath);
  const transparencyModule = await import(pathToFileURL(transparencyPath).href);
  return {
    createTransparencyLog: transparencyModule.createTransparencyLog,
    createTransparencyLogFromLeaves: transparencyModule.createTransparencyLogFromLeaves,
    extendTransparencyLog: transparencyModule.extendTransparencyLog,
    releaseEventHash: transparencyModule.releaseEventHash,
    signWitnessStatement: transparencyModule.signWitnessStatement,
    verifyTransparencyEntry: transparencyModule.verifyTransparencyEntry,
    verifyWitnessStatement: transparencyModule.verifyWitnessStatement
  };
}

async function loadLogIdentity() {
  const identityPath = process.env.NIPMOD_LOG_IDENTITY_PATH ?? DEFAULT_LOG_IDENTITY_PATH;
  return loadIdentity(identityPath, "transparency log identity");
}

async function loadWitnessIdentity() {
  const identityPath = process.env.NIPMOD_WITNESS_IDENTITY_PATH ?? DEFAULT_WITNESS_IDENTITY_PATH;
  return loadIdentity(identityPath, "transparency witness identity");
}

async function loadIdentity(identityPath, label) {
  try {
    return validateIdentity(JSON.parse(await readFile(identityPath, "utf8")), label);
  } catch (error) {
    if (!isNotFound(error)) {
      throw error;
    }
  }

  const identityModule = await loadIdentityModule();
  const identity = identityModule.generateIdentity();
  await mkdir(dirname(identityPath), { recursive: true });
  await writeFile(identityPath, `${JSON.stringify(identity, null, 2)}\n`, { mode: 0o600 });
  return identity;
}

async function loadIdentityModule() {
  const identityPath = join(ROOT, "nipmod", "dist", "identity.js");
  ensureNipmodBuilt();
  await access(identityPath);
  return import(pathToFileURL(identityPath).href);
}

function validateIdentity(value, label) {
  if (
    !value ||
    typeof value !== "object" ||
    typeof value.did !== "string" ||
    typeof value.privateKeyPem !== "string" ||
    typeof value.publicKeyPem !== "string"
  ) {
    throw new Error(`${label} is invalid`);
  }

  return value;
}

function isNotFound(error) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

let nipmodBuilt = false;

function ensureNipmodBuilt() {
  if (nipmodBuilt) {
    return;
  }

  buildNipmod();
  nipmodBuilt = true;
}

function buildNipmod() {
  const result = spawnSync("pnpm", ["--dir", join(ROOT, "nipmod"), "build"], {
    stdio: "inherit"
  });
  if (result.status !== 0) {
    throw new Error("failed to build nipmod before indexing packages");
  }
}

function packageDigestMap(index) {
  return new Map((index.packages ?? []).map((pkg) => [packageKey(pkg), pkg.digest]));
}

function packageKey(pkg) {
  return `${pkg.canonical}@${pkg.version}`;
}

function buildCloneUrl(baseUrl, owner, repo) {
  return new URL(`/${encodeURIComponent(didTail(owner))}/${encodeURIComponent(assertSlug(repo, "repo"))}.git`, baseUrl).href;
}

function comparePackages(left, right) {
  if (right.trust.score !== left.trust.score) {
    return right.trust.score - left.trust.score;
  }
  return right.updatedAt.localeCompare(left.updatedAt);
}

function sortedReleaseEntries(releases, skipped, repoName) {
  const valid = [];
  for (const entry of Object.entries(releases)) {
    try {
      parseSemver(entry[0]);
      valid.push(entry);
    } catch (error) {
      skipped.push({
        reason: `release ${entry[0]}: ${error instanceof Error ? error.message : "invalid semver"}`,
        repo: repoName
      });
    }
  }
  return valid.sort(([left], [right]) => compareSemver(left, right));
}

function hasNoRequestedPermissions(permissions) {
  return (
    permissions.filesystem === 0 &&
    permissions.network === 0 &&
    permissions.mcpTools === 0 &&
    permissions.env === 0 &&
    permissions.secrets === 0 &&
    !permissions.exec &&
    !permissions.postinstall
  );
}

function capList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item) => typeof item === "string")
    .slice(0, 24)
    .map((item) => sanitizeText(item, 120));
}

function requiredString(value, field, maxLength) {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
    throw new Error(`${field} is invalid`);
  }
  return value;
}

function optionalString(value, field, maxLength) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  return requiredString(value, field, maxLength);
}

function sanitizeText(value, maxLength) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function assertDid(value) {
  if (!/^did:key:z[A-Za-z0-9]+$/.test(value)) {
    throw new Error(`invalid DID: ${value}`);
  }
  return value;
}

function assertSha256(value) {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error("invalid sha256 digest");
  }
  return value;
}

function assertSlug(value, field) {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(value)) {
    throw new Error(`${field} is invalid`);
  }
  return value;
}

function didTail(did) {
  return did.split(":").at(-1) ?? did;
}

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function emptyRegistry(source) {
  return {
    formatVersion: 1,
    generatedAt: new Date(0).toISOString(),
    packages: [],
    skipped: [],
    source
  };
}

export async function readPreviousIndex(path = SITE_REGISTRY_PATH) {
  try {
    const raw = await readFile(path, "utf8");
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error(
        `previous registry index is invalid JSON: ${error instanceof Error ? error.message : "unknown parse error"}`
      );
    }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return emptyRegistry(DEFAULT_NODE_URL);
    }
    throw error;
  }
}

async function writeRegistry(index) {
  const payload = `${JSON.stringify(index, null, 2)}\n`;
  await writeFile(SITE_REGISTRY_PATH, payload);
  await mkdir(dirname(PUBLIC_REGISTRY_PATH), { recursive: true });
  await writeFile(PUBLIC_REGISTRY_PATH, payload);
  await writePackageDocuments(index);
  await writeTransparencyFiles(index.transparencyLog ?? null);
}

export function encodeCanonicalForRegistryPath(canonical) {
  if (typeof canonical !== "string" || canonical.length === 0 || canonical.length > 240) {
    throw new Error("canonical package id is invalid");
  }
  if (Buffer.byteLength(canonical, "utf8") > MAX_STATIC_CANONICAL_BYTES) {
    throw new Error("canonical package id is too long for a static registry path");
  }
  return Buffer.from(canonical, "utf8").toString("base64url");
}

export function buildPublicPackageDocuments(index) {
  const groups = new Map();
  for (const pkg of index.packages ?? []) {
    const group = groups.get(pkg.canonical) ?? [];
    group.push(pkg);
    groups.set(pkg.canonical, group);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([canonical, packages]) => {
      const encoded = encodeCanonicalForRegistryPath(canonical);
      const sortedPackages = [...packages].sort(comparePackageVersionAsc);
      const distTags = sourceDistTags(sortedPackages);
      const versions = {};
      const versionDocuments = [];
      for (const pkg of sortedPackages) {
        parseSemver(pkg.version);
        const existing = versions[pkg.version];
        if (existing && existing.digest !== pkg.digest) {
          throw new Error(`conflicting package document version for ${pkg.canonical}@${pkg.version}`);
        }
        const versionDocument = buildPackageVersionDocument(pkg, encoded, distTags);
        versions[pkg.version] = versionDocument;
        versionDocuments.push(versionDocument);
      }
      const latest = distTags.latest;
      const latestPackage = sortedPackages.find((pkg) => pkg.version === latest);
      if (!latestPackage) {
        throw new Error(`package document has no latest version: ${canonical}`);
      }
      const packageDocument = {
        canonical,
        distTags,
        formatVersion: 1,
        generatedAt: index.generatedAt,
        lifecycleEvents: latestPackage.lifecycleEvents ?? [],
        name: latestPackage.name,
        source: index.source,
        type: "dev.nipmod.package-document.v1",
        versions
      };

      return {
        dependenciesDocument: buildDependenciesDocument(latestPackage, distTags),
        dependenciesPath: `registry/packages/${encoded}/dependencies.json`,
        documentPath: `registry/packages/${encoded}.json`,
        encoded,
        packageDocument,
        provenanceDocument: buildProvenanceDocument(latestPackage),
        provenancePath: `registry/packages/${encoded}/provenance.json`,
        versionDocuments,
        versionPaths: versionDocuments.map((doc) => `registry/packages/${encoded}/${doc.version}.json`)
      };
    });
}

export async function writePackageDocuments(index, options = {}) {
  const documents = buildPublicPackageDocuments(index);
  const publicSiteDir = options.publicSiteDir ?? PUBLIC_SITE_DIR;
  const packagesDir = join(publicSiteDir, "registry", "packages");
  await rm(packagesDir, { force: true, recursive: true });
  await mkdir(packagesDir, { recursive: true });
  for (const document of documents) {
    await writeJsonFile(join(publicSiteDir, document.documentPath), document.packageDocument);
    const packageDir = join(packagesDir, document.encoded);
    await mkdir(packageDir, { recursive: true });
    for (const versionDocument of document.versionDocuments) {
      await writeJsonFile(join(packageDir, `${versionDocument.version}.json`), versionDocument);
    }
    await writeJsonFile(join(publicSiteDir, document.dependenciesPath), document.dependenciesDocument);
    await writeJsonFile(join(publicSiteDir, document.provenancePath), document.provenanceDocument);
  }
}

function buildPackageVersionDocument(pkg, encoded, distTags = {}) {
  return {
    artifactPath: pkg.artifactPath,
    artifactSha256: pkg.artifactSha256,
    canonical: pkg.canonical,
    cloneUrl: pkg.cloneUrl,
    compatibilityReceipts: pkg.compatibilityReceipts,
    ...dependencyMetadata(pkg),
    description: pkg.description ?? "",
    digest: pkg.digest,
    documentType: "dev.nipmod.package-version.v1",
    formatVersion: 1,
    name: pkg.name,
    owner: pkg.owner,
    permissionDetails: pkg.permissionDetails,
    permissions: pkg.permissions,
    proof: pkg.proof,
    publisher: pkg.publisher,
    quarantine: pkg.quarantine,
    deprecated: pkg.deprecated,
    releasePath: pkg.releasePath,
    repo: pkg.repo,
    resolved: pkg.resolved,
    sourceCommit: pkg.sourceCommit ?? null,
    sourceRepo: pkg.sourceRepo,
    sourceTag: pkg.sourceTag ?? null,
    stars: pkg.stars,
    tags: tagsForVersion(distTags, pkg.version),
    trust: pkg.trust,
    type: pkg.type ?? "unknown",
    updatedAt: pkg.updatedAt,
    urls: {
      dependencies: `/registry/packages/${encoded}/dependencies.json`,
      package: `/registry/packages/${encoded}.json`,
      provenance: `/registry/packages/${encoded}/provenance.json`,
      version: `/registry/packages/${encoded}/${pkg.version}.json`
    },
    version: pkg.version,
    yanked: pkg.yanked
  };
}

function buildDependenciesDocument(pkg, distTags) {
  return {
    canonical: pkg.canonical,
    direct: dependencyMetadata(pkg),
    distTags,
    formatVersion: 1,
    generatedAt: pkg.updatedAt,
    name: pkg.name,
    type: "dev.nipmod.package-dependencies.v1",
    version: pkg.version
  };
}

function buildProvenanceDocument(pkg) {
  return {
    artifactPath: pkg.artifactPath,
    artifactSha256: pkg.artifactSha256,
    canonical: pkg.canonical,
    digest: pkg.digest,
    formatVersion: 1,
    name: pkg.name,
    proof: pkg.proof ?? null,
    publisher: pkg.publisher,
    releasePath: pkg.releasePath,
    resolved: pkg.resolved,
    lifecycleEvents: pkg.lifecycleEvents ?? [],
    sourceCommit: pkg.sourceCommit ?? null,
    sourceRepo: pkg.sourceRepo,
    sourceTag: pkg.sourceTag ?? null,
    trust: pkg.trust,
    type: "dev.nipmod.package-provenance.v1",
    version: pkg.version
  };
}

function latestVersion(versions) {
  const latest = [...versions].sort(compareSemverDesc)[0];
  if (!latest) {
    throw new Error("package document requires at least one version");
  }
  return latest;
}

function sourceDistTags(packages) {
  const tagValues = new Map();
  for (const pkg of packages) {
    for (const [tag, version] of Object.entries(pkg?.distTags ?? {})) {
      if (typeof version !== "string" || version.length === 0) {
        continue;
      }
      const existing = tagValues.get(tag);
      if (existing !== undefined && existing !== version) {
        throw new Error(`conflicting ${tag} dist tags for ${pkg.canonical}`);
      }
      tagValues.set(tag, version);
    }
  }
  const distTags = Object.fromEntries([...tagValues.entries()].sort(([left], [right]) => left.localeCompare(right)));
  if (!distTags.latest) {
    distTags.latest = latestVersion(packages.map((pkg) => pkg.version));
  }
  for (const [tag, version] of Object.entries(distTags)) {
    if (!packages.some((pkg) => pkg.version === version)) {
      throw new Error(`${tag} dist tag ${version} is missing from ${packages[0]?.canonical ?? "package"} versions`);
    }
  }
  return distTags;
}

function tagsForVersion(distTags, version) {
  return Object.entries(distTags)
    .filter(([, taggedVersion]) => taggedVersion === version)
    .map(([tag]) => tag)
    .sort();
}

function comparePackageVersionAsc(left, right) {
  return compareSemver(left.version, right.version);
}

function compareSemverDesc(left, right) {
  return compareSemver(right, left);
}

function compareSemver(left, right) {
  const leftParts = parseSemver(left);
  const rightParts = parseSemver(right);
  for (let index = 0; index < 3; index += 1) {
    const diff = leftParts[index] - rightParts[index];
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

function parseSemver(value) {
  if (typeof value !== "string" || value.length > 40) {
    throw new Error(`invalid semver: ${value}`);
  }
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  if (!match) {
    throw new Error(`invalid semver: ${value}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

async function writeTransparencyFiles(log) {
  await rm(PUBLIC_TRANSPARENCY_DIR, { force: true, recursive: true });
  if (!log) {
    return;
  }
  await mkdir(PUBLIC_TRANSPARENCY_LEAVES_DIR, { recursive: true });
  await mkdir(PUBLIC_TRANSPARENCY_PROOFS_DIR, { recursive: true });
  await mkdir(PUBLIC_TRANSPARENCY_WITNESSES_DIR, { recursive: true });
  await writeJsonFile(PUBLIC_TRANSPARENCY_LOG_PATH, log);
  await writeJsonFile(PUBLIC_TRANSPARENCY_CHECKPOINT_PATH, log.treeHead);
  await writeJsonFile(PUBLIC_TRANSPARENCY_WITNESS_REQUEST_PATH, {
    checkpoint: log.treeHead,
    formatVersion: 1,
    logUrl: "/transparency/log.json",
    previousCheckpoint: log.previousCheckpoint ?? null,
    type: "dev.nipmod.transparency.witness-request.v1"
  });
  for (const witness of log.witnesses ?? []) {
    await writeJsonFile(join(PUBLIC_TRANSPARENCY_WITNESSES_DIR, `${didTail(witness.witness)}.json`), witness);
  }
  for (const entry of log.entries) {
    await writeJsonFile(join(PUBLIC_TRANSPARENCY_LEAVES_DIR, `${entry.leafHash}.json`), entry.leaf);
    await writeJsonFile(join(PUBLIC_TRANSPARENCY_PROOFS_DIR, `${entry.leafHash}.json`), {
      auditPath: entry.inclusionProof,
      leafHash: entry.leafHash,
      leafIndex: entry.leafIndex,
      rootHash: log.treeHead.rootHash,
      treeSize: log.treeHead.treeSize
    });
  }
}

async function writeJsonFile(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  if (process.argv.includes("--package-docs-only")) {
    const index = await readPreviousIndex();
    await writePackageDocuments(index);
    console.log(`wrote package documents for ${new Set(index.packages.map((pkg) => pkg.canonical)).size} packages`);
    return;
  }

  const previousIndex = await readPreviousIndex();
  const index = await buildRegistryIndex({ previousIndex });
  await writeRegistry(index);
  console.log(`indexed ${index.packages.length} packages, skipped ${index.skipped.length}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
