import { lstat, readFile } from "node:fs/promises";
import { join } from "node:path";
import * as z from "zod";
import { publicKeyPemFromDidKey, signBytes, verifyBytes } from "./identity.js";
import { type Manifest, validateManifest } from "./protocol.js";
import { canonicalJson, sha256Hex } from "./verifier.js";

export const BUNDLE_MEDIA_TYPE = "application/vnd.nipmod.bundle.v1+json";

export interface BundleFile {
  path: string;
  mode: "100644" | "100755";
  sha256: string;
  contentBase64: string;
}

export interface NipmodBundle {
  formatVersion: 1;
  mediaType: typeof BUNDLE_MEDIA_TYPE;
  manifest: Manifest;
  manifestDigest: string;
  files: BundleFile[];
  signature?: BundleSignature;
}

export interface BundleSignature {
  keyId: string;
  algorithm: "Ed25519";
  signatureBase64: string;
}

export interface PackedBundle {
  bytes: Buffer;
  digest: string;
  manifestDigest: string;
  manifest: Manifest;
}

export interface PackProjectOptions {
  signingPrivateKeyPem?: string;
}

export interface VerifyBundleOptions {
  requireSignature?: boolean;
}

const BundleFileSchema = z.strictObject({
  path: z.string().min(1),
  mode: z.enum(["100644", "100755"]),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  contentBase64: z.string()
});

const BundleSchema = z.strictObject({
  formatVersion: z.literal(1),
  mediaType: z.literal(BUNDLE_MEDIA_TYPE),
  manifest: z.unknown(),
  manifestDigest: z.string().regex(/^[a-f0-9]{64}$/),
  files: z.array(BundleFileSchema).min(1),
  signature: z
    .strictObject({
      keyId: z.string().regex(/^did:key:z[A-Za-z0-9]+$/),
      algorithm: z.literal("Ed25519"),
      signatureBase64: z.string()
    })
    .optional()
});
const BUNDLE_SIGNATURE_CONTEXT = "nipmod-bundle-v1";

export async function packProject(projectDir: string, options: PackProjectOptions = {}): Promise<PackedBundle> {
  const manifest = validateManifest(JSON.parse(await readFile(join(projectDir, "nipmod.json"), "utf8")));
  const paths = normalizeFileList(manifest.files);
  const files = await Promise.all(paths.map((path) => readBundleFile(projectDir, path)));
  const manifestDigest = sha256Hex(canonicalJson(manifest));
  let bundle: NipmodBundle = {
    formatVersion: 1,
    mediaType: BUNDLE_MEDIA_TYPE,
    manifest,
    manifestDigest,
    files
  };

  if (options.signingPrivateKeyPem) {
    bundle = signBundle(bundle, options.signingPrivateKeyPem);
  }

  const bytes = Buffer.from(canonicalJson(bundle), "utf8");
  if (options.signingPrivateKeyPem) {
    verifyBundle(bytes, undefined, { requireSignature: true });
  }

  return {
    bytes,
    digest: sha256Hex(bytes),
    manifestDigest,
    manifest
  };
}

export function readBundle(bytes: Uint8Array): NipmodBundle {
  const parsedJson = JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
  const result = BundleSchema.safeParse(parsedJson);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "bundle"}: ${issue.message}`)
      .join("; ");
    throw new Error(`bundle invalid: ${details}`);
  }

  const manifest = validateManifest(result.data.manifest);
  const manifestDigest = sha256Hex(canonicalJson(manifest));
  if (manifestDigest !== result.data.manifestDigest) {
    throw new Error("bundle manifest digest mismatch");
  }

  const files = result.data.files.map((file) => {
    const normalizedPath = normalizeBundlePath(file.path);
    return { ...file, path: normalizedPath };
  });

  const bundle: NipmodBundle = {
    formatVersion: result.data.formatVersion,
    mediaType: result.data.mediaType,
    manifest,
    manifestDigest: result.data.manifestDigest,
    files
  };
  if (result.data.signature) {
    bundle.signature = result.data.signature;
  }

  return bundle;
}

export function verifyBundle(
  bytes: Uint8Array,
  expectedDigest?: string,
  options: VerifyBundleOptions = {}
): NipmodBundle {
  const digest = sha256Hex(bytes);
  if (expectedDigest && digest !== expectedDigest) {
    throw new Error(`bundle digest mismatch: expected ${expectedDigest}, got ${digest}`);
  }

  const bundle = readBundle(bytes);
  const manifestFiles = normalizeFileList(bundle.manifest.files);
  const bundlePaths = bundle.files.map((file) => file.path);
  if (JSON.stringify(bundlePaths) !== JSON.stringify(manifestFiles)) {
    throw new Error("bundle files do not match manifest files");
  }

  for (const file of bundle.files) {
    const content = Buffer.from(file.contentBase64, "base64");
    if (sha256Hex(content) !== file.sha256) {
      throw new Error(`bundle file digest mismatch: ${file.path}`);
    }
  }

  if (options.requireSignature && !bundle.signature) {
    throw new Error("bundle signature required");
  }

  if (bundle.signature) {
    verifyBundleSignature(bundle);
  }

  return bundle;
}

function normalizeFileList(files: readonly string[] | undefined): string[] {
  if (!files) {
    throw new Error("manifest files must be explicit");
  }

  const normalized = [...new Set(files.map(normalizeBundlePath))].sort();
  if (!normalized.includes("nipmod.json")) {
    throw new Error("manifest files must include nipmod.json");
  }

  return normalized;
}

function normalizeBundlePath(path: string): string {
  if (path.includes("\\") || path.startsWith("/") || path.startsWith("~")) {
    throw new Error(`unsafe bundle path: ${path}`);
  }

  const parts = path.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new Error(`unsafe bundle path: ${path}`);
  }

  return parts.join("/");
}

async function readBundleFile(projectDir: string, path: string): Promise<BundleFile> {
  const absolutePath = join(projectDir, path);
  const fileStat = await lstat(absolutePath);
  if (fileStat.isSymbolicLink()) {
    throw new Error(`bundle path is a symlink: ${path}`);
  }

  if (!fileStat.isFile()) {
    throw new Error(`bundle path is not a file: ${path}`);
  }

  const content = await readFile(absolutePath);
  return {
    path,
    mode: fileStat.mode & 0o111 ? "100755" : "100644",
    sha256: sha256Hex(content),
    contentBase64: content.toString("base64")
  };
}

function signBundle(bundle: NipmodBundle, privateKeyPem: string): NipmodBundle {
  return {
    ...bundle,
    signature: {
      keyId: bundle.manifest.publish.signingKey,
      algorithm: "Ed25519",
      signatureBase64: signBytes(privateKeyPem, signaturePayload(bundle)).toString("base64")
    }
  };
}

function verifyBundleSignature(bundle: NipmodBundle): void {
  if (!bundle.signature) {
    throw new Error("bundle signature required");
  }

  if (bundle.signature.keyId !== bundle.manifest.publish.signingKey) {
    throw new Error("bundle signature key does not match publisher");
  }

  const publicKeyPem = publicKeyPemFromDidKey(bundle.signature.keyId);
  const signature = Buffer.from(bundle.signature.signatureBase64, "base64");
  if (!verifyBytes(publicKeyPem, signaturePayload(bundle), signature)) {
    throw new Error("bundle signature verification failed");
  }
}

function signaturePayload(bundle: NipmodBundle): Buffer {
  return Buffer.from(
    `${BUNDLE_SIGNATURE_CONTEXT}\n${canonicalJson({
      files: bundle.files,
      formatVersion: bundle.formatVersion,
      manifest: bundle.manifest,
      manifestDigest: bundle.manifestDigest,
      mediaType: bundle.mediaType
    })}`,
    "utf8"
  );
}
