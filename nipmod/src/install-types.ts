import { type DependencyRequest } from "./resolver.js";

export interface InstallResult {
  lockfileChanged: boolean;
}

export interface InstalledPackageSummary {
  canonical: string;
  integrity: string;
  name: string;
  packageKey: string;
  publisher: string;
  version: string;
}

export interface UninstallResult {
  lockfileChanged: boolean;
  removed: boolean;
  removedPackages: InstalledPackageSummary[];
}

export interface InstallOptions {
  integrity?: string;
  expected?: {
    canonical: string;
    version: string;
  };
  rootDependency?: DependencyRequest;
}

export interface InstallGraphPackage {
  bundleBytes: Uint8Array;
  expected?: {
    canonical: string;
    version: string;
  };
  integrity: string;
  resolved: string;
  rootDependency?: DependencyRequest;
}
