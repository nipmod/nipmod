import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as z from "zod";
import { type NipmodBundle, verifyBundle } from "./bundle.js";
import { digestFromIntegrity } from "./integrity.js";
import { PermissionSchema } from "./protocol.js";
import { canonicalJson } from "./verifier.js";

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
}

const ResolvedUrlSchema = z.string().refine(isAllowedResolvedUrl, {
  message: "expected file:, https:, or loopback http: URL"
});

const LockfilePackageSchema = z.strictObject({
  name: z.string().min(1),
  canonical: z.string().regex(/^pkg:did:key:z[A-Za-z0-9]+\/[a-z0-9][a-z0-9._-]*$/),
  version: z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/),
  resolved: ResolvedUrlSchema,
  integrity: z.string().regex(/^sha256-[a-f0-9]{64}$/),
  manifestDigest: z.string().regex(/^[a-f0-9]{64}$/),
  publisher: z.string().regex(/^did:key:z[A-Za-z0-9]+$/),
  permissions: PermissionSchema,
  files: z.array(z.string().min(1)),
  storePath: z.string().regex(/^\.nipmod\/store\/sha256\/[a-f0-9]{64}\/bundle\.nipmod$/).optional()
});

const LockfileSchema = z.strictObject({
  formatVersion: z.literal(1),
  generatedBy: z.string().min(1),
  packages: z.record(z.string(), LockfilePackageSchema)
});

type Lockfile = z.infer<typeof LockfileSchema>;

export function isValidLockfilePackage(value: unknown): boolean {
  return LockfilePackageSchema.safeParse(value).success;
}

export async function installFilePackage(
  bundlePath: string,
  projectDir: string,
  options: InstallOptions = {}
): Promise<InstallResult> {
  const absoluteBundlePath = resolve(bundlePath);
  const bytes = await readFile(absoluteBundlePath);

  return installBundlePackage(bytes, pathToFileURL(absoluteBundlePath).href, projectDir, options);
}

export async function installBundlePackage(
  bundleBytes: Uint8Array,
  resolved: string,
  projectDir: string,
  options: InstallOptions = {}
): Promise<InstallResult> {
  if (!options.integrity) {
    throw new Error("external integrity is required for install");
  }

  if (!isAllowedResolvedUrl(resolved)) {
    throw new Error("resolved package URL must be file:, https:, or loopback http:");
  }

  const expectedDigest = digestFromIntegrity(options.integrity);
  const bundle = verifyBundle(bundleBytes, expectedDigest, { requireSignature: true });
  if (options.expected) {
    if (bundle.manifest.canonical !== options.expected.canonical || bundle.manifest.version !== options.expected.version) {
      throw new Error(
        `bundle identity mismatch: expected ${options.expected.canonical}@${options.expected.version}, got ${bundle.manifest.canonical}@${bundle.manifest.version}`
      );
    }
  }
  const lockfilePath = join(projectDir, "nipmod.lock.json");
  const lockfile = await readLockfile(lockfilePath);
  const packageKey = `${bundle.manifest.canonical}@${bundle.manifest.version}`;
  const storePath = await writeStoreBundle(projectDir, expectedDigest, bundleBytes);

  lockfile.packages[packageKey] = {
    name: bundle.manifest.name,
    canonical: bundle.manifest.canonical,
    version: bundle.manifest.version,
    resolved,
    integrity: options.integrity,
    manifestDigest: bundle.manifestDigest,
    publisher: bundle.manifest.publish.signingKey,
    permissions: bundle.manifest.permissions,
    files: bundle.files.map((file) => file.path),
    storePath
  };

  const nextLockfile = `${canonicalJson(lockfile)}\n`;
  const previousLockfile = await readOptionalFile(lockfilePath);
  if (previousLockfile === nextLockfile) {
    return { lockfileChanged: false };
  }

  await mkdir(projectDir, { recursive: true });
  await writeFile(lockfilePath, nextLockfile);
  return { lockfileChanged: true };
}

export async function listInstalledPackages(projectDir: string): Promise<InstalledPackageSummary[]> {
  const lockfile = await readLockfile(join(projectDir, "nipmod.lock.json"));
  return Object.entries(lockfile.packages)
    .map(([packageKey, pkg]) => ({
      canonical: pkg.canonical,
      integrity: pkg.integrity,
      name: pkg.name,
      packageKey,
      publisher: pkg.publisher,
      version: pkg.version
    }))
    .sort((left, right) => left.name.localeCompare(right.name) || left.version.localeCompare(right.version));
}

export async function uninstallPackage(query: string, projectDir: string): Promise<UninstallResult> {
  const lockfilePath = join(projectDir, "nipmod.lock.json");
  const lockfile = await readLockfile(lockfilePath);
  const matches = Object.entries(lockfile.packages).filter(([packageKey, pkg]) =>
    [packageKey, pkg.name, pkg.canonical, `${pkg.canonical}@${pkg.version}`].includes(query)
  );

  if (matches.length > 1) {
    throw new Error(`uninstall query is ambiguous: ${query}`);
  }

  if (matches.length === 0) {
    return {
      lockfileChanged: false,
      removed: false,
      removedPackages: []
    };
  }

  const [packageKey, pkg] = matches[0] ?? [];
  if (!packageKey || !pkg) {
    throw new Error("uninstall failed to resolve package");
  }

  delete lockfile.packages[packageKey];
  await writeFile(lockfilePath, `${canonicalJson(lockfile)}\n`);
  return {
    lockfileChanged: true,
    removed: true,
    removedPackages: [
      {
        canonical: pkg.canonical,
        integrity: pkg.integrity,
        name: pkg.name,
        packageKey,
        publisher: pkg.publisher,
        version: pkg.version
      }
    ]
  };
}

async function writeStoreBundle(projectDir: string, digest: string, bundleBytes: Uint8Array): Promise<string> {
  const relativePath = `.nipmod/store/sha256/${digest}/bundle.nipmod`;
  const absolutePath = join(projectDir, relativePath);
  await mkdir(join(projectDir, ".nipmod", "store", "sha256", digest), { recursive: true });
  await writeFile(absolutePath, bundleBytes);
  return relativePath;
}

async function readLockfile(path: string): Promise<Lockfile> {
  const text = await readOptionalFile(path);
  if (!text) {
    return {
      formatVersion: 1,
      generatedBy: "nipmod/0.0.0",
      packages: {}
    };
  }

  const parsed = JSON.parse(text) as Partial<Lockfile>;
  const result = LockfileSchema.safeParse(parsed);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`lockfile invalid: ${details}`);
  }

  return result.data;
}

async function readOptionalFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function isAllowedResolvedUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol === "file:" || url.protocol === "https:") {
    return true;
  }

  if (url.protocol !== "http:") {
    return false;
  }

  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);
}
