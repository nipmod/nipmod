export type TrustLevel = "verified" | "signed" | "review" | "unknown";

export interface RegistryPermissionSummary {
  filesystem: number;
  network: number;
  mcpTools: number;
  env: number;
  secrets: number;
  exec: boolean;
  postinstall: boolean;
}

export interface RegistryPermissionDetails {
  filesystem: string[];
  network: string[];
  mcpTools: string[];
  env: string[];
  secrets: string[];
}

export interface TrustEvidence {
  artifactDigestVerified: boolean;
  bundleSignatureVerified: boolean;
  immutableSnapshotMatched: boolean;
  publisherMatchesCanonical: boolean;
  releaseEventSigned: boolean;
  sourceProvenanceVerified: boolean;
  transparencyLogIncluded: boolean;
  transparencyLogVerified: boolean;
}

export interface RegistryPackageProof {
  checkpointUrl: string;
  eventHash: string;
  leafHash: string;
  leafIndex: number;
  leafUrl: string;
  proofUrl: string;
  rootHash: string;
  subject: string;
  treeSize: number;
  type: "dev.nipmod.registry.proof.v1";
  witnesses?: string[];
  witnessUrls?: string[];
}

export type CompatibilityReceiptFormat = "apm-package" | "git-source-provenance" | "mcp-server-json";

export interface CompatibilityReceipt {
  exampleUrl: string;
  externalFormat: CompatibilityReceiptFormat;
  externalInputSha256: string;
  id: string;
  label: string;
  package: string;
  packageDigest: string;
  preservedFields: string[];
  provenanceLoss: string[];
  receiptUrl: string;
  sourceCommit: string;
  sourceRepo: string;
  sourceTag: string;
  type: "dev.nipmod.compatibility-receipt.v1";
  unsupportedFields: string[];
  version: string;
}

export interface RegistryPackage {
  canonical: string;
  name: string;
  description: string;
  type: string;
  version: string;
  publisher: string;
  owner: string;
  repo: string;
  cloneUrl: string;
  resolved: string;
  digest: string;
  artifactSha256: string;
  artifactPath: string;
  releasePath: string;
  sourceRepo: string;
  sourceCommit: string | null;
  sourceTag: string | null;
  updatedAt: string;
  stars: number;
  trust: {
    level: TrustLevel;
    score: number;
    evidence: TrustEvidence;
    signals: string[];
    warnings: string[];
  };
  permissions: RegistryPermissionSummary;
  permissionDetails: RegistryPermissionDetails;
  proof?: RegistryPackageProof;
  compatibilityReceipts?: CompatibilityReceipt[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean | undefined }>;
  quarantine?: {
    active?: boolean;
    advisoryId: string;
    artifactSha256?: string;
    package: string;
    publishedAt: string;
    reason: string;
    severity: "low" | "moderate" | "high" | "critical";
    status: "active" | "withdrawn";
    type: "dev.nipmod.quarantine.v1";
    version: string;
  };
}

export interface RegistryIndex {
  formatVersion: 1;
  generatedAt: string;
  source: string;
  packages: RegistryPackage[];
  transparencyLog?: {
    entries: Array<{
      leafHash: string;
      leafIndex: number;
    }>;
    formatVersion: 1;
    treeHead: {
      generatedAt: string;
      logId: string;
      rootHash: string;
      treeSize: number;
    };
    witnesses?: Array<{
      formatVersion: 1;
      signature: {
        algorithm: "Ed25519";
        keyId: string;
        signatureBase64: string;
      };
      treeHead: {
        formatVersion: 1;
        generatedAt: string;
        logId: string;
        rootHash: string;
        treeSize: number;
      };
      type: "dev.nipmod.transparency.witness.v1";
      witness: string;
    }>;
  };
  skipped: Array<{
    repo: string;
    reason: string;
  }>;
}

export function searchPackages(
  packages: readonly RegistryPackage[],
  query: string,
  options: { includeQuarantined?: boolean } = {}
): RegistryPackage[] {
  const normalized = query.trim().toLowerCase();
  const publicPackages = packages.filter((item) => options.includeQuarantined === true || !isActivelyQuarantined(item));
  if (!normalized) {
    return [...publicPackages].sort(comparePackages);
  }

  return publicPackages
    .filter((item) => packageSearchFields(item).some((value) => value.toLowerCase().includes(normalized)))
    .sort((left, right) => compareSearchMatches(left, right, normalized));
}

export function homepagePackages(packages: readonly RegistryPackage[]): RegistryPackage[] {
  return packages.filter((pkg) => !isProbePackage(pkg) && !isActivelyQuarantined(pkg));
}

export function registryStats(index: RegistryIndex): Array<{ label: string; value: string }> {
  const verified = index.packages.filter((item) => item.trust.level === "verified").length;
  const publishers = new Set(index.packages.map((item) => item.publisher)).size;
  return [
    { label: "Packages", value: String(index.packages.length) },
    { label: "Verified", value: String(verified) },
    { label: "Publishers", value: String(publishers) }
  ];
}

function isProbePackage(pkg: RegistryPackage): boolean {
  return [pkg.name, pkg.canonical, pkg.description, pkg.repo].some((value) => value.toLowerCase().includes("probe"));
}

function isActivelyQuarantined(pkg: RegistryPackage): boolean {
  return activeQuarantine(pkg) !== null;
}

function activeQuarantine(pkg: RegistryPackage): NonNullable<RegistryPackage["quarantine"]> | null {
  const quarantine = pkg.quarantine;
  if (!quarantine || quarantine.status !== "active" || quarantine.active === false) {
    return null;
  }
  if (quarantine.package !== pkg.canonical || quarantine.version !== pkg.version) {
    return null;
  }
  if (quarantine.artifactSha256 && quarantine.artifactSha256 !== pkg.digest) {
    return null;
  }
  if (quarantine.severity !== "high" && quarantine.severity !== "critical") {
    return null;
  }
  return quarantine;
}

export function registryTrustSummary(index: RegistryIndex): {
  cards: Array<{ label: string; value: string }>;
  checks: Array<{ label: string; ok: boolean; text: string }>;
  ready: boolean;
} {
  const verified = index.packages.filter((item) => item.trust.level === "verified");
  const witnesses = index.transparencyLog?.witnesses ?? [];
  const rootHash = index.transparencyLog?.treeHead.rootHash ?? "";
  const activeQuarantines = index.packages.filter(isActivelyQuarantined).length;
  const checks = [
    {
      label: "Signed bundles",
      ok: index.packages.length > 0 && index.packages.every((item) => item.trust.evidence.bundleSignatureVerified),
      text: "Every listed package has a bundle signature."
    },
    {
      label: "Source tags",
      ok: index.packages.length > 0 && index.packages.every((item) => item.trust.evidence.sourceProvenanceVerified),
      text: "Verified packages bind a version tag to a Gitlawb commit."
    },
    {
      label: "Transparency",
      ok: index.packages.length > 0 && index.packages.every((item) => item.trust.evidence.transparencyLogVerified),
      text: "The checkpoint is witnessed outside the registry."
    },
    {
      label: "Quiet permissions",
      ok: index.packages.every((item) => hasNoRequestedPermissions(item.permissions)),
      text: "No listed package declares network, secrets, exec or install scripts."
    },
    {
      label: "No active quarantine",
      ok: activeQuarantines === 0,
      text: "High and critical advisories block public readiness."
    }
  ];
  return {
    cards: [
      { label: "Packages", value: String(index.packages.length) },
      { label: "Witnesses", value: String(witnesses.length) },
      { label: "Root hash", value: rootHash ? `${rootHash.slice(0, 10)}...${rootHash.slice(-8)}` : "missing" },
      { label: "Quarantine", value: String(activeQuarantines) }
    ],
    checks,
    ready: verified.length === index.packages.length && index.packages.length > 0 && checks.every((check) => check.ok)
  };
}

export function installCommand(pkg: RegistryPackage): string {
  const quarantine = activeQuarantine(pkg);
  if (quarantine) {
    return `Install blocked: ${quarantine.advisoryId}: ${quarantine.reason}`;
  }
  return `nipmod install ${pkg.name}`;
}

const allowedSourceRepoHosts = new Set([
  "gitlawb.com",
  "node.gitlawb.com",
  "node2.gitlawb.com",
  "node3.gitlawb.com",
  "node.nipmod.com"
]);

export function safeSourceRepoHref(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !allowedSourceRepoHosts.has(url.hostname)) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

export function permissionHighlights(pkg: RegistryPackage): string[] {
  const details = pkg.permissionDetails;
  const highlights = [
    formatPermission("Network", details.network),
    formatPermission("Secrets", details.secrets),
    formatPermission("Env", details.env),
    formatPermission("MCP", details.mcpTools),
    formatPermission("Files", details.filesystem)
  ].filter((item): item is string => Boolean(item));

  if (pkg.permissions.exec) {
    highlights.push("Exec requested");
  }

  if (pkg.permissions.postinstall) {
    highlights.push("Postinstall requested");
  }

  return highlights.length > 0 ? highlights : ["No manifest permissions"];
}

export function compatibilityHighlights(pkg: Pick<RegistryPackage, "compatibilityReceipts">): string[] {
  return (pkg.compatibilityReceipts ?? [])
    .filter((receipt) => receipt.provenanceLoss.length === 0)
    .map((receipt) => receipt.label)
    .slice(0, 3);
}

export function shortDid(did: string): string {
  const tail = did.split(":").at(-1) ?? did;
  return `${tail.slice(0, 8)}...${tail.slice(-6)}`;
}

export function deriveTrust(
  evidence: TrustEvidence,
  permissions: RegistryPermissionSummary
): RegistryPackage["trust"] {
  const signals: string[] = [];
  const warnings: string[] = [];
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
    warnings.push("Source tag missing or invalid");
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
  const hardVerified =
    hardSigned &&
    evidence.sourceProvenanceVerified &&
    evidence.transparencyLogIncluded &&
    evidence.transparencyLogVerified;

  return {
    evidence,
    level: hardVerified ? "verified" : hardSigned ? "signed" : score > 0 ? "review" : "unknown",
    score,
    signals,
    warnings
  };
}

export function assertImmutableDigests(previous: RegistryIndex, next: RegistryIndex): void {
  const previousDigests = new Map(previous.packages.map((item) => [packageVersionKey(item), item.digest]));
  const changed = next.packages.find((item) => {
    const previousDigest = previousDigests.get(packageVersionKey(item));
    return previousDigest !== undefined && previousDigest !== item.digest;
  });

  if (!changed) {
    return;
  }

  const previousDigest = previousDigests.get(packageVersionKey(changed));
  throw new Error(
    `immutable digest changed for ${changed.canonical}@${changed.version}: ${previousDigest} -> ${changed.digest}`
  );
}

function comparePackages(left: RegistryPackage, right: RegistryPackage): number {
  if (right.trust.score !== left.trust.score) {
    return right.trust.score - left.trust.score;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}

function compareSearchMatches(left: RegistryPackage, right: RegistryPackage, query: string): number {
  return searchScore(right, query) - searchScore(left, query) || comparePackages(left, right);
}

function searchScore(pkg: RegistryPackage, query: string): number {
  let score = pkg.trust.score;
  if (pkg.name.toLowerCase() === query) {
    score += 60;
  } else if (pkg.name.toLowerCase().startsWith(query)) {
    score += 35;
  }
  if (agentNativeTypes.has(pkg.type)) {
    score += 10;
  }
  if (hasNoRequestedPermissions(pkg.permissions)) {
    score += 5;
  }
  if (compatibilityHighlights(pkg).some((label) => label.toLowerCase().includes(query))) {
    score += 8;
  }
  return score;
}

function packageSearchFields(pkg: RegistryPackage): string[] {
  return [
    pkg.name,
    pkg.canonical,
    pkg.description,
    pkg.type,
    pkg.publisher,
    ...compatibilityHighlights(pkg),
    ...(pkg.compatibilityReceipts ?? []).map((receipt) => receipt.externalFormat)
  ];
}

const agentNativeTypes = new Set(["skill", "agent-profile", "workflow-pack", "policy-pack", "mcp-server"]);

function packageVersionKey(pkg: Pick<RegistryPackage, "canonical" | "version">): string {
  return `${pkg.canonical}@${pkg.version}`;
}

function hasNoRequestedPermissions(permissions: RegistryPermissionSummary): boolean {
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

function formatPermission(label: string, values: readonly string[]): string | null {
  if (values.length === 0) {
    return null;
  }

  return `${label}: ${values.slice(0, 3).join(", ")}${values.length > 3 ? "..." : ""}`;
}
