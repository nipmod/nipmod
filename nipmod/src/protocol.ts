import { isIP } from "node:net";
import * as z from "zod";

const DidKeySchema = z.string().regex(/^did:key:z[A-Za-z0-9]+$/, "expected did:key");
const PackageIdSchema = z
  .string()
  .regex(/^pkg:did:key:z[A-Za-z0-9]+\/[a-z0-9][a-z0-9._-]*$/, "expected pkg:did:key package id");
const SemverSchema = z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, "expected semver");
const SemverTagSchema = z.string().regex(/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, "expected immutable vX.Y.Z tag");
const PackageNameSchema = z
  .string()
  .regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/, "expected npm-style package name");
const SafeTextSchema = z
  .string()
  .min(1)
  .max(1024)
  .superRefine((value, ctx) => {
    if (unsafeTextIssue(value)) {
      ctx.addIssue({
        code: "custom",
        message: "unsafe instruction-like metadata text is not allowed"
      });
    }
  });
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/, "expected sha256 hex digest");
const GitCommitSchema = z.string().regex(/^[a-f0-9]{40}$/, "expected git commit hash");
const GitlawbRepoSchema = z
  .string()
  .regex(/^gitlawb:\/\/did:key:z[A-Za-z0-9]+\/[a-z0-9][a-z0-9_-]*$/, "expected gitlawb repo");
const ReleaseEventSignatureSchema = z.strictObject({
  keyId: DidKeySchema,
  algorithm: z.literal("Ed25519"),
  signatureBase64: z.string().min(1)
});
const ReleaseEventSourceSchema = z.strictObject({
  type: z.literal("gitlawb"),
  repo: GitlawbRepoSchema,
  commit: GitCommitSchema.optional(),
  tag: SemverTagSchema
});

export type PermissionScopeKind = "env" | "filesystem" | "mcpTools" | "network" | "secrets";
export type PermissionScopeIssueCode =
  | "control"
  | "empty"
  | "env-format"
  | "env-secret-like"
  | "filesystem-format"
  | "filesystem-wildcard"
  | "filesystem-write"
  | "mcp-format"
  | "mcp-wildcard"
  | "network-format"
  | "network-wildcard"
  | "secrets-not-supported";

export interface PermissionScopeIssue {
  code: PermissionScopeIssueCode;
  message: string;
}

export const PermissionSchema = z.strictObject({
  filesystem: z.array(permissionScopeSchema("filesystem")),
  network: z.array(permissionScopeSchema("network")),
  mcpTools: z.array(permissionScopeSchema("mcpTools")),
  env: z.array(permissionScopeSchema("env")),
  secrets: z.array(permissionScopeSchema("secrets")),
  exec: z.strictObject({
    allowed: z.literal(false)
  }),
  postinstall: z.strictObject({
    allowed: z.literal(false)
  })
});

export const ManifestSchema = z
  .strictObject({
    formatVersion: z.literal(1),
    name: PackageNameSchema,
    canonical: PackageIdSchema,
    version: SemverSchema,
    type: z.enum([
      "skill",
      "mcp-server",
      "tool-bundle",
      "agent-profile",
      "workflow-pack",
      "eval-pack",
      "policy-pack",
      "adapter"
    ]),
    description: SafeTextSchema.optional(),
    license: SafeTextSchema.optional(),
    exports: z.record(z.string(), z.record(z.string(), z.string())),
    files: z.array(z.string().min(1)).min(1).optional(),
    permissions: PermissionSchema,
    publish: z.strictObject({
      signingKey: DidKeySchema,
      provenance: SafeTextSchema
    })
  })
  .superRefine((manifest, ctx) => {
    const canonical = splitCanonicalPackage(manifest.canonical);
    const files = manifest.files ? new Set(manifest.files.map(normalizeManifestPath)) : null;
    if (canonical.owner !== manifest.publish.signingKey) {
      ctx.addIssue({
        code: "custom",
        path: ["publish", "signingKey"],
        message: "signingKey must match canonical package owner"
      });
    }

    if (canonical.slug !== manifest.name.split("/").at(-1)) {
      ctx.addIssue({
        code: "custom",
        path: ["canonical"],
        message: "canonical package slug must match package name"
      });
    }

    for (const [exportName, exportTargets] of Object.entries(manifest.exports)) {
      for (const [kind, target] of Object.entries(exportTargets)) {
        validateExportTarget(target, files, ["exports", exportName, kind], ctx);
      }
    }
  });

export type Manifest = z.infer<typeof ManifestSchema>;

export function permissionScopeIssue(kind: PermissionScopeKind, value: string): PermissionScopeIssue | null {
  if (value.length === 0) {
    return { code: "empty", message: `${kind} permission scope must not be empty` };
  }
  if (/[\u0000-\u001F\u007F]/.test(value) || value.includes("```") || value.includes("<system>")) {
    return { code: "control", message: `${kind} permission scope contains unsafe characters` };
  }

  switch (kind) {
    case "filesystem":
      return filesystemPermissionIssue(value);
    case "network":
      return networkPermissionIssue(value);
    case "mcpTools":
      return mcpToolPermissionIssue(value);
    case "env":
      return envPermissionIssue(value);
    case "secrets":
      return { code: "secrets-not-supported", message: "secrets permissions are not supported in manifest v1" };
  }
}

function permissionScopeSchema(kind: PermissionScopeKind): z.ZodType<string> {
  return z.string().superRefine((value, ctx) => {
    const issue = permissionScopeIssue(kind, value);
    if (issue) {
      ctx.addIssue({
        code: "custom",
        message: issue.message
      });
    }
  });
}

function filesystemPermissionIssue(value: string): PermissionScopeIssue | null {
  if (value.includes("*")) {
    return { code: "filesystem-wildcard", message: "filesystem permission wildcards are not allowed" };
  }
  if (/^(?:write|readwrite):/.test(value)) {
    return { code: "filesystem-write", message: "filesystem write permissions are not allowed" };
  }
  const prefix = "read:${project}/";
  if (!value.startsWith(prefix)) {
    return { code: "filesystem-format", message: "filesystem permissions must use read:${project}/relative/path" };
  }

  const relativePath = value.slice(prefix.length);
  if (
    !relativePath ||
    relativePath.includes("\\") ||
    relativePath.startsWith("/") ||
    relativePath.startsWith("~") ||
    relativePath.includes("${home}") ||
    relativePath.includes("${env}") ||
    relativePath.split("/").some((part) => part === "" || part === "." || part === "..") ||
    !/^[A-Za-z0-9._/-]+$/.test(relativePath)
  ) {
    return { code: "filesystem-format", message: "filesystem permissions must use safe relative project paths" };
  }

  return null;
}

function networkPermissionIssue(value: string): PermissionScopeIssue | null {
  if (value.includes("*")) {
    return { code: "network-wildcard", message: "network permission wildcards are not allowed" };
  }
  if (/\s/.test(value) || value !== value.toLowerCase()) {
    return { code: "network-format", message: "network permissions must use lowercase DNS hosts" };
  }

  if (value.startsWith("https://")) {
    return httpsNetworkPermissionIssue(value);
  }

  const [host, port] = splitHostPort(value);
  if (!isSafeDnsHost(host) || !isSafePort(port)) {
    return { code: "network-format", message: "network permissions must use exact DNS hosts" };
  }
  return null;
}

function httpsNetworkPermissionIssue(value: string): PermissionScopeIssue | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { code: "network-format", message: "network permissions must use valid https origins" };
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !isSafeDnsHost(url.hostname) ||
    !isSafePort(url.port || null)
  ) {
    return { code: "network-format", message: "network permissions must use exact https origins" };
  }
  return null;
}

function mcpToolPermissionIssue(value: string): PermissionScopeIssue | null {
  if (value.includes("*")) {
    return { code: "mcp-wildcard", message: "mcpTools permission wildcards are not allowed" };
  }
  if (!/^[a-z0-9][a-z0-9_-]*(?:\.[a-z0-9][a-z0-9_-]*)+$/.test(value)) {
    return { code: "mcp-format", message: "mcpTools permissions must use server.tool names" };
  }
  return null;
}

function envPermissionIssue(value: string): PermissionScopeIssue | null {
  if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(value)) {
    return { code: "env-format", message: "env permissions must use public env var names" };
  }
  if (isSecretLikeEnvName(value)) {
    return { code: "env-secret-like", message: "env permissions must not request secret-like variables" };
  }
  return null;
}

function isSecretLikeEnvName(value: string): boolean {
  return (
    value.startsWith("AWS_") ||
    value.startsWith("GITHUB_") ||
    value.startsWith("OPENAI_") ||
    value.startsWith("NPM_") ||
    value === "SUPABASE_SERVICE_ROLE_KEY" ||
    value.endsWith("_TOKEN") ||
    value.endsWith("_SECRET") ||
    value.endsWith("_PASSWORD") ||
    value.endsWith("_PRIVATE_KEY") ||
    value.endsWith("_API_KEY")
  );
}

function unsafeTextIssue(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    /[\u0000-\u001F\u007F]/.test(value) ||
    value.includes("```") ||
    normalized.includes("<system") ||
    normalized.includes("</system") ||
    normalized.includes("ignore previous instructions") ||
    normalized.includes("disregard previous instructions")
  );
}

function splitHostPort(value: string): [host: string, port: string | null] {
  const lastColon = value.lastIndexOf(":");
  if (lastColon === -1) {
    return [value, null];
  }
  return [value.slice(0, lastColon), value.slice(lastColon + 1)];
}

function isSafeDnsHost(value: string): boolean {
  if (isIP(value) !== 0 || value.length > 253 || value.endsWith(".") || value.includes("..")) {
    return false;
  }
  const labels = value.split(".");
  if (labels.length < 2) {
    return false;
  }
  return labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
}

function isSafePort(value: string | null): boolean {
  if (!value) {
    return true;
  }
  if (!/^\d{1,5}$/.test(value)) {
    return false;
  }
  const port = Number(value);
  return port >= 1 && port <= 65535;
}

export const ReleaseEventSchema = z
  .strictObject({
    type: z.literal("dev.nipmod.release.v1"),
    formatVersion: z.literal(1),
    package: PackageIdSchema,
	    version: SemverSchema,
	    publisher: DidKeySchema,
	    source: ReleaseEventSourceSchema,
	    artifact: z.strictObject({
	      mediaType: z.string().min(1),
	      path: z.string().min(1).optional(),
      manifestDigest: Sha256Schema.optional(),
      sha256: Sha256Schema.optional(),
      cid: z.string().min(1).optional()
    })
  })
  .superRefine((event, ctx) => {
    const canonical = splitCanonicalPackage(event.package);
	    if (canonical.owner !== event.publisher) {
	      ctx.addIssue({
	        code: "custom",
        path: ["publisher"],
	        message: "publisher must match package owner"
	      });
	    }

	    const source = splitGitlawbRepo(event.source.repo);
	    if (source.owner !== event.publisher) {
	      ctx.addIssue({
	        code: "custom",
	        path: ["source", "repo"],
	        message: "source repo owner must match publisher"
	      });
	    }

	    if (source.repo !== canonical.slug) {
	      ctx.addIssue({
	        code: "custom",
	        path: ["source", "repo"],
	        message: "source repo must match canonical package slug"
	      });
	    }

    if (!event.artifact.sha256 && !event.artifact.cid) {
      ctx.addIssue({
        code: "custom",
        path: ["artifact"],
        message: "artifact requires sha256 or cid"
      });
    }
  });

export type ReleaseEvent = z.infer<typeof ReleaseEventSchema>;
export type ReleaseEventSignature = z.infer<typeof ReleaseEventSignatureSchema>;
export interface SignedReleaseEvent {
  payload: ReleaseEvent;
  signature: ReleaseEventSignature;
}

const SignedReleaseEventEnvelopeSchema = z.strictObject({
  payload: z.unknown(),
  signature: ReleaseEventSignatureSchema
});

export function validateManifest(value: unknown): Manifest {
  return parseOrThrow(ManifestSchema, value, "manifest");
}

export function validateReleaseEvent(value: unknown): ReleaseEvent {
  return parseOrThrow(ReleaseEventSchema, value, "release event");
}

export function validateSignedReleaseEvent(value: unknown): SignedReleaseEvent {
  const envelope = parseOrThrow(SignedReleaseEventEnvelopeSchema, value, "signed release event");
  const payload = validateReleaseEvent(envelope.payload);
  if (envelope.signature.keyId !== payload.publisher) {
    throw new Error("signed release event invalid: signature key must match publisher");
  }

  return {
    payload,
    signature: envelope.signature
  };
}

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (result.success) {
    return result.data;
  }

  const details = result.error.issues.map(formatIssue).join("; ");
  throw new Error(`${label} invalid: ${details}`);
}

function formatIssue(issue: z.core.$ZodIssue): string {
  const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
  return `${path}${issue.message}`;
}

function splitCanonicalPackage(canonical: string): { owner: string; slug: string } {
  const withoutScheme = canonical.slice("pkg:".length);
  const separator = withoutScheme.lastIndexOf("/");

  return {
    owner: withoutScheme.slice(0, separator),
    slug: withoutScheme.slice(separator + 1)
  };
}

function splitGitlawbRepo(repo: string): { owner: string; repo: string } {
  const withoutScheme = repo.slice("gitlawb://".length);
  const separator = withoutScheme.lastIndexOf("/");

  return {
    owner: withoutScheme.slice(0, separator),
    repo: withoutScheme.slice(separator + 1)
  };
}

function validateExportTarget(
  target: string,
  files: ReadonlySet<string> | null,
  path: (string | number)[],
  ctx: z.core.$RefinementCtx<unknown>
): void {
  if (!target.startsWith("./")) {
    ctx.addIssue({
      code: "custom",
      path,
      message: "exports must use ./ package-relative paths"
    });
    return;
  }

  try {
    const normalized = normalizeManifestPath(target.slice(2));
    if (files && !files.has(normalized)) {
      ctx.addIssue({
        code: "custom",
        path,
        message: "exports target must be listed in files"
      });
    }
  } catch (error) {
    ctx.addIssue({
      code: "custom",
      path,
      message: error instanceof Error ? error.message : "unsafe exports target"
    });
  }
}

function normalizeManifestPath(path: string): string {
  if (path.includes("\\") || path.startsWith("/") || path.startsWith("~")) {
    throw new Error(`unsafe exports target: ${path}`);
  }

  const parts = path.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new Error(`unsafe exports target: ${path}`);
  }

  return parts.join("/");
}
