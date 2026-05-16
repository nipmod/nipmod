import { readFile } from "node:fs/promises";
import * as z from "zod";
import { PermissionSchema } from "./protocol.js";
import { type DependencyKind } from "./resolver.js";

const PackageKeySchema = z.string().regex(/^pkg:did:key:z[A-Za-z0-9]+\/[a-z0-9][a-z0-9._-]*@(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
const DependencyMapSchema = z.record(z.string().min(1), z.string().min(1));

export function isAllowedResolvedUrl(value: string): boolean {
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

const ResolvedUrlSchema = z.string().refine(isAllowedResolvedUrl, {
  message: "expected file:, https:, or loopback http: URL"
});

export const LockfilePackageSchema = z.strictObject({
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

const LockfileV1Schema = z.strictObject({
  formatVersion: z.literal(1),
  generatedBy: z.string().min(1),
  packages: z.record(z.string(), LockfilePackageSchema)
});

const LockfileRootSchema = z.strictObject({
  dependencies: DependencyMapSchema,
  devDependencies: DependencyMapSchema,
  optionalDependencies: DependencyMapSchema,
  peerDependencies: DependencyMapSchema
});

const LockfileSnapshotSchema = z.strictObject({
  dependencies: z.record(z.string().min(1), PackageKeySchema),
  devDependencies: z.record(z.string().min(1), PackageKeySchema),
  optionalDependencies: z.record(z.string().min(1), PackageKeySchema),
  peerDependencies: z.record(z.string().min(1), PackageKeySchema)
});

const LockfileV2Schema = z.strictObject({
  formatVersion: z.literal(2),
  generatedBy: z.string().min(1),
  root: LockfileRootSchema,
  packages: z.record(PackageKeySchema, LockfilePackageSchema),
  snapshots: z.record(PackageKeySchema, LockfileSnapshotSchema)
});

type LockfileV1 = z.infer<typeof LockfileV1Schema>;
export type Lockfile = z.infer<typeof LockfileV2Schema>;
export type LockfilePackage = z.infer<typeof LockfilePackageSchema>;
export type LockfileSnapshot = z.infer<typeof LockfileSnapshotSchema>;

export function isValidLockfilePackage(value: unknown): boolean {
  return LockfilePackageSchema.safeParse(value).success;
}

export async function readLockfile(path: string): Promise<Lockfile> {
  const text = await readOptionalFile(path);
  if (!text) {
    return emptyLockfile();
  }

  const parsed = JSON.parse(text) as unknown;
  const v2 = LockfileV2Schema.safeParse(parsed);
  if (v2.success) {
    return v2.data;
  }
  const v1 = LockfileV1Schema.safeParse(parsed);
  if (v1.success) {
    return migrateV1Lockfile(v1.data);
  }
  const details = v2.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`lockfile invalid: ${details}`);
}

export function emptySnapshot(): LockfileSnapshot {
  return {
    dependencies: {},
    devDependencies: {},
    optionalDependencies: {},
    peerDependencies: {}
  };
}

function emptyLockfile(): Lockfile {
  return {
    formatVersion: 2,
    generatedBy: "nipmod/0.0.0",
    root: emptyRoot(),
    packages: {},
    snapshots: {}
  };
}

function migrateV1Lockfile(lockfile: LockfileV1): Lockfile {
  return {
    formatVersion: 2,
    generatedBy: lockfile.generatedBy,
    root: emptyRoot(),
    packages: lockfile.packages,
    snapshots: Object.fromEntries(Object.keys(lockfile.packages).map((packageKey) => [packageKey, emptySnapshot()]))
  };
}

function emptyRoot(): Record<DependencyKind, Record<string, string>> {
  return {
    dependencies: {},
    devDependencies: {},
    optionalDependencies: {},
    peerDependencies: {}
  };
}

export async function readOptionalFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}
