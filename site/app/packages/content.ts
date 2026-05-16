import registryData from "../registry-data.json";
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

const registry = registryData as RegistryIndex;

export function packagePageParams(): Array<{ packageName: string }> {
  return registry.packages.map((pkg) => ({ packageName: pkg.name }));
}

export function packagePageHref(pkg: Pick<RegistryPackage, "name">): string {
  return `/packages/${encodeURIComponent(pkg.name)}`;
}

export function findPackage(value: string): RegistryPackage | null {
  const normalized = decodeURIComponent(value).trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return (
    registry.packages.find((pkg) => pkg.name.toLowerCase() === normalized || pkg.canonical.toLowerCase() === normalized) ?? null
  );
}

export function packageBrowseData(options: { query: string; type: string }) {
  const packages = homepagePackages(registry.packages);
  const searched = searchPackages(packages, options.query);
  const filtered = options.type ? searched.filter((pkg) => pkg.type === options.type) : searched;
  return {
    packages: filtered,
    registry: { ...registry, packages },
    types: [...new Set(packages.map((pkg) => pkg.type))].sort()
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
      label: "Add",
      command: `nipmod add ${spec} --online`
    },
    {
      label: "Inspect first",
      command: `nipmod inspect ${spec} --online`
    },
    {
      label: "Plan only",
      command: `nipmod install --plan ${spec} --online`
    }
  ];
}

export function packageDependencyText(pkg: RegistryPackage): string {
  const dependencyCount =
    Object.keys(pkg.dependencies ?? {}).length +
    Object.keys(pkg.optionalDependencies ?? {}).length +
    Object.keys(pkg.peerDependencies ?? {}).length;
  if (dependencyCount === 0) {
    return "No dependency metadata is published for this package version yet.";
  }
  return `${dependencyCount} dependency entries are published for this package version.`;
}
