export interface RegistryPackageRecord {
  canonical: string;
  dependencies?: Record<string, string>;
  description?: string;
  devDependencies?: Record<string, string>;
  digest: string;
  distTags?: Record<string, string>;
  name: string;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean | undefined }>;
  publisher: string;
  trust: {
    level: string;
    score: number;
  };
  type?: string;
  version: string;
}

export interface PackageVersionDocument {
  canonical: string;
  dependencies?: Record<string, string>;
  description: string;
  devDependencies?: Record<string, string>;
  digest: string;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean | undefined }>;
  publisher: string;
  trust: {
    level: string;
    score: number;
  };
  type: string;
  version: string;
}

export interface PackageDocument {
  canonical: string;
  distTags: Record<string, string>;
  name: string;
  versions: Record<string, PackageVersionDocument>;
}

export function buildPackageDocuments(packages: readonly RegistryPackageRecord[]): PackageDocument[] {
  const byCanonical = new Map<string, PackageDocument>();
  const sourceLatestByCanonical = new Map<string, string>();

  for (const pkg of packages) {
    parseSemver(pkg.version);
    const document =
      byCanonical.get(pkg.canonical) ??
      {
        canonical: pkg.canonical,
        distTags: {},
        name: pkg.name,
        versions: {}
      };
    const existing = document.versions[pkg.version];
    if (existing && existing.digest !== pkg.digest) {
      throw new Error(`conflicting package document version for ${pkg.canonical}@${pkg.version}`);
    }

    document.versions[pkg.version] = {
      canonical: pkg.canonical,
      ...dependencyMetadata(pkg),
      description: pkg.description ?? "",
      digest: pkg.digest,
      publisher: pkg.publisher,
      trust: pkg.trust,
      type: pkg.type ?? "unknown",
      version: pkg.version
    };
    recordSourceLatest(pkg, sourceLatestByCanonical);
    byCanonical.set(pkg.canonical, document);
  }

  return [...byCanonical.values()]
    .map((document) => applyLatestDistTag(document, sourceLatestByCanonical.get(document.canonical)))
    .map(assertPackageDocumentDistTags)
    .sort((left, right) => left.name.localeCompare(right.name) || left.canonical.localeCompare(right.canonical));
}

function dependencyMetadata(pkg: RegistryPackageRecord): Partial<PackageVersionDocument> {
  return {
    ...(nonEmpty(pkg.dependencies) ? { dependencies: pkg.dependencies } : {}),
    ...(nonEmpty(pkg.devDependencies) ? { devDependencies: pkg.devDependencies } : {}),
    ...(nonEmpty(pkg.optionalDependencies) ? { optionalDependencies: pkg.optionalDependencies } : {}),
    ...(nonEmpty(pkg.peerDependencies) ? { peerDependencies: pkg.peerDependencies } : {}),
    ...(nonEmpty(pkg.peerDependenciesMeta) ? { peerDependenciesMeta: pkg.peerDependenciesMeta } : {})
  };
}

function nonEmpty(value: Record<string, unknown> | undefined): boolean {
  return Boolean(value && Object.keys(value).length > 0);
}

function latestVersion(versions: readonly string[]): string {
  const latest = [...versions].sort(compareSemverDesc)[0];
  if (!latest) {
    throw new Error("package document requires at least one version");
  }
  return latest;
}

function recordSourceLatest(pkg: RegistryPackageRecord, sourceLatestByCanonical: Map<string, string>): void {
  const latest = pkg.distTags?.latest;
  if (latest === undefined || latest === "") {
    return;
  }
  const existing = sourceLatestByCanonical.get(pkg.canonical);
  if (existing !== undefined && existing !== latest) {
    throw new Error(`conflicting latest dist tags for ${pkg.canonical}`);
  }
  sourceLatestByCanonical.set(pkg.canonical, latest);
}

function applyLatestDistTag(document: PackageDocument, sourceLatest: string | undefined): PackageDocument {
  document.distTags.latest = sourceLatest ?? latestVersion(Object.keys(document.versions));
  return document;
}

function assertPackageDocumentDistTags(document: PackageDocument): PackageDocument {
  const latest = document.distTags.latest;
  if (!latest || !document.versions[latest]) {
    throw new Error(`latest dist tag is missing from ${document.canonical} versions`);
  }
  return document;
}

function compareSemverDesc(left: string, right: string): number {
  return compareSemver(right, left);
}

function compareSemver(left: string, right: string): number {
  const leftParts = parseSemver(left);
  const rightParts = parseSemver(right);
  const majorDiff = leftParts[0] - rightParts[0];
  if (majorDiff !== 0) {
    return majorDiff;
  }
  const minorDiff = leftParts[1] - rightParts[1];
  if (minorDiff !== 0) {
    return minorDiff;
  }
  const patchDiff = leftParts[2] - rightParts[2];
  if (patchDiff !== 0) {
    return patchDiff;
  }
  return 0;
}

function parseSemver(value: string): [number, number, number] {
  if (value.length > 40) {
    throw new Error(`invalid semver: ${value}`);
  }
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  if (!match) {
    throw new Error(`invalid semver: ${value}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
