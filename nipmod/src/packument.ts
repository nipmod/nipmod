export interface RegistryPackageRecord {
  canonical: string;
  description?: string;
  digest: string;
  name: string;
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
  description: string;
  digest: string;
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

  for (const pkg of packages) {
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
      description: pkg.description ?? "",
      digest: pkg.digest,
      publisher: pkg.publisher,
      trust: pkg.trust,
      type: pkg.type ?? "unknown",
      version: pkg.version
    };
    document.distTags.latest = latestVersion(Object.keys(document.versions));
    byCanonical.set(pkg.canonical, document);
  }

  return [...byCanonical.values()].sort((left, right) => left.name.localeCompare(right.name) || left.canonical.localeCompare(right.canonical));
}

function latestVersion(versions: readonly string[]): string {
  const latest = [...versions].sort(compareSemverDesc)[0];
  if (!latest) {
    throw new Error("package document requires at least one version");
  }
  return latest;
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
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  if (!match) {
    throw new Error(`invalid semver: ${value}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
