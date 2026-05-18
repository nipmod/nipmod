import registryData from "../registry-data.json";
import { newPackages, packageQualityStats, trendingPackages } from "../../lib/package-quality";
import {
  homepagePackages,
  searchPackages,
  type RegistryIndex,
  type RegistryPackage
} from "../../lib/registry";

export type PackageInstallVariant = {
  label: string;
  command: string;
};

export type PackageDependencyEntry = {
  kind: string;
  name: string;
  spec: string;
};

const registry = registryData as RegistryIndex;

export function packagePageParams(): Array<{ packageName: string }> {
  return registry.packages.map((pkg) => ({ packageName: packagePageSlug(pkg) }));
}

export function packagePageHref(pkg: Pick<RegistryPackage, "canonical">): string {
  return `/packages/${packagePageSlug(pkg)}`;
}

export function packageEvidenceHref(pkg: Pick<RegistryPackage, "canonical">, anchor = "package-proof"): string {
  return `/evidence/package/${packagePageSlug(pkg)}#${anchor}`;
}

export function packagePageHrefByName(name: string): string {
  const pkg = findPackage(name);
  return pkg ? packagePageHref(pkg) : `/packages?q=${encodeURIComponent(name)}`;
}

export function findPackage(value: string): RegistryPackage | null {
  const normalized = decodeURIComponent(value).trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const matches = registry.packages.filter(
    (pkg) =>
      pkg.name.toLowerCase() === normalized ||
      pkg.canonical.toLowerCase() === normalized ||
      packagePageSlug(pkg).toLowerCase() === normalized
  );
  return matches.find((pkg) => pkg.distTags?.latest === pkg.version) ?? matches[0] ?? null;
}

export function packageBrowseData(options: { query: string; type: string }) {
  const packages = homepagePackages(registry.packages);
  const searched = searchPackages(packages, options.query);
  const filtered = options.type ? searched.filter((pkg) => pkg.type === options.type) : searched;
  const highlights = packageBrowseHighlights(packages);
  return {
    ...highlights,
    packages: filtered,
    registry: { ...registry, packages },
    types: [...new Set(packages.map((pkg) => pkg.type))].sort()
  };
}

export function packageBrowseHighlights(packages: readonly RegistryPackage[]) {
  return {
    newest: newPackages(packages, 4),
    qualityStats: packageQualityStats(packages),
    trending: trendingPackages(packages, 4)
  };
}

export function packageVersions(pkg: RegistryPackage): RegistryPackage[] {
  return registry.packages
    .filter((candidate) => candidate.canonical === pkg.canonical)
    .sort((left, right) => right.version.localeCompare(left.version));
}

export function packageInstallVariants(pkg: RegistryPackage): PackageInstallVariant[] {
  const spec = `${pkg.canonical}@${pkg.version}`;
  return [
    {
      label: "Install",
      command: `nipmod install ${spec}`
    },
    {
      label: "Inspect first",
      command: `nipmod inspect ${spec}`
    },
    {
      label: "Plan only",
      command: `nipmod install --plan ${spec}`
    }
  ];
}

export function packageDependencyText(pkg: RegistryPackage): string {
  const dependencyCount = packageDependencyEntries(pkg).length;
  if (dependencyCount === 0) {
    return "No dependency metadata is published for this package version.";
  }
  return `${dependencyCount} dependency entries are published for this package version.`;
}

export function packageDependencyEntries(pkg: RegistryPackage): PackageDependencyEntry[] {
  return [
    ...dependencyEntries("dependencies", pkg.dependencies),
    ...dependencyEntries("peer", pkg.peerDependencies),
    ...dependencyEntries("optional", pkg.optionalDependencies),
    ...dependencyEntries("dev", pkg.devDependencies)
  ];
}

function dependencyEntries(kind: string, dependencies: Record<string, string> | undefined): PackageDependencyEntry[] {
  return Object.entries(dependencies ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, spec]) => ({ kind, name, spec }));
}

export function packagePageSlug(pkg: Pick<RegistryPackage, "canonical">): string {
  const match = /^pkg:did:key:([^/]+)\/([a-z0-9][a-z0-9._-]*)$/.exec(pkg.canonical);
  if (!match) {
    throw new Error(`invalid package canonical: ${pkg.canonical}`);
  }
  return `${match[1]}-${match[2]}`;
}
