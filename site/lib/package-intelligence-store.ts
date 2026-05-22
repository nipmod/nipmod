import { timingSafeEqual } from "node:crypto";
import type { PackageIntelligenceRecord } from "./package-intelligence";

type ArchiveEnv = Record<string, string | undefined>;

export interface ArchiveStoreStatus {
  configured: boolean;
  driver: "supabase-rest";
  keyMode: "publishable-token-rls" | "service-role" | "missing";
  missing: string[];
  type: "dev.nipmod.archive-store-status.v1";
}

export interface ArchiveSearchResult {
  configured: boolean;
  records: PackageIntelligenceRecord[];
  total: number;
  type: "dev.nipmod.package-intelligence-search.v1";
}

export interface ArchiveWriteResult {
  configured: boolean;
  record: PackageIntelligenceRecord;
  stored: boolean;
  type: "dev.nipmod.package-intelligence-write.v1";
}

const SUPABASE_URL_ENV = "NIPMOD_ARCHIVE_SUPABASE_URL";
const SUPABASE_SERVICE_ROLE_KEY_ENV = "NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY";
const SUPABASE_PUBLISHABLE_KEY_ENV = "NIPMOD_ARCHIVE_SUPABASE_PUBLISHABLE_KEY";
const WRITE_TOKEN_ENV = "NIPMOD_ARCHIVE_WRITE_TOKEN";

export function archiveStoreStatus(env: ArchiveEnv = process.env): ArchiveStoreStatus {
  const hasServiceRole = Boolean(env[SUPABASE_SERVICE_ROLE_KEY_ENV]);
  const hasPublishable = Boolean(env[SUPABASE_PUBLISHABLE_KEY_ENV]);
  const missing = [SUPABASE_URL_ENV, WRITE_TOKEN_ENV].filter((key) => !env[key]);
  if (!hasServiceRole && !hasPublishable) {
    missing.push(`${SUPABASE_SERVICE_ROLE_KEY_ENV} or ${SUPABASE_PUBLISHABLE_KEY_ENV}`);
  }
  return {
    configured: missing.length === 0,
    driver: "supabase-rest",
    keyMode: hasServiceRole ? "service-role" : hasPublishable ? "publishable-token-rls" : "missing",
    missing,
    type: "dev.nipmod.archive-store-status.v1"
  };
}

export function assertArchiveWriteAuthorized(request: Request, env: ArchiveEnv = process.env): void {
  const expected = env[WRITE_TOKEN_ENV];
  if (!expected) {
    throw new ArchiveStoreError("archive write token is not configured", 503);
  }

  const provided = request.headers.get("x-nipmod-archive-token") ?? bearerToken(request.headers.get("authorization"));
  if (!provided || !constantTimeEqual(provided, expected)) {
    throw new ArchiveStoreError("archive write token is required", 401);
  }
}

export async function searchPackageIntelligenceArchive(
  query: string,
  options: { env?: ArchiveEnv; fetchImpl?: typeof fetch; limit?: number } = {}
): Promise<ArchiveSearchResult> {
  const env = options.env ?? process.env;
  const status = archiveStoreStatus(env);
  if (!status.configured) {
    return {
      configured: false,
      records: [],
      total: 0,
      type: "dev.nipmod.package-intelligence-search.v1"
    };
  }

  const search = sanitizeArchiveSearchTerm(query);
  const limit = normalizeLimit(options.limit);
  const params = new URLSearchParams({
    limit: String(limit),
    order: "updated_at.desc",
    select: "record"
  });
  if (search) {
    params.set("or", `(name.ilike.*${search}*,display_name.ilike.*${search}*,description.ilike.*${search}*)`);
  }

  const requestOptions: SupabaseRequestOptions = { method: "GET" };
  if (options.fetchImpl) {
    requestOptions.fetchImpl = options.fetchImpl;
  }
  const rows = await supabaseJson<Array<{ record: PackageIntelligenceRecord }>>(
    env,
    `/rest/v1/package_intelligence_records?${params.toString()}`,
    requestOptions
  );
  const records = rows.map((row) => row.record).filter(isPackageIntelligenceRecord);

  return {
    configured: true,
    records,
    total: records.length,
    type: "dev.nipmod.package-intelligence-search.v1"
  };
}

export async function upsertPackageIntelligenceRecord(
  record: PackageIntelligenceRecord,
  options: { env?: ArchiveEnv; fetchImpl?: typeof fetch } = {}
): Promise<ArchiveWriteResult> {
  const env = options.env ?? process.env;
  const status = archiveStoreStatus(env);
  if (!status.configured) {
    return {
      configured: false,
      record,
      stored: false,
      type: "dev.nipmod.package-intelligence-write.v1"
    };
  }

  const requestOptions: SupabaseRequestOptions = {
    body: JSON.stringify([toSupabaseRow(record)]),
    headers: {
      Prefer: "resolution=merge-duplicates"
    },
    method: "POST"
  };
  if (options.fetchImpl) {
    requestOptions.fetchImpl = options.fetchImpl;
  }
  await supabaseJson(env, "/rest/v1/package_intelligence_records?on_conflict=id", requestOptions);

  return {
    configured: true,
    record,
    stored: true,
    type: "dev.nipmod.package-intelligence-write.v1"
  };
}

export class ArchiveStoreError extends Error {
  constructor(
    message: string,
    readonly status = 500
  ) {
    super(message);
  }
}

function toSupabaseRow(record: PackageIntelligenceRecord): Record<string, unknown> {
  return {
    description: record.sourceRecord.description,
    display_name: record.sourceRecord.displayName,
    id: record.id,
    name: record.name,
    original_url: record.sourceSnapshot.originalUrl,
    record,
    source: record.source,
    stable_key: record.stableKey,
    status: record.archive.status,
    trust_score: record.trust.score,
    updated_at: record.archive.updatedAt,
    version: record.version
  };
}

interface SupabaseRequestOptions {
  body?: string;
  fetchImpl?: typeof fetch;
  headers?: Record<string, string>;
  method: "GET" | "POST";
}

async function supabaseJson<T>(
  env: ArchiveEnv,
  path: string,
  options: SupabaseRequestOptions
): Promise<T> {
  const baseUrl = env[SUPABASE_URL_ENV];
  const serviceRoleKey = env[SUPABASE_SERVICE_ROLE_KEY_ENV];
  const publishableKey = env[SUPABASE_PUBLISHABLE_KEY_ENV];
  const writeToken = env[WRITE_TOKEN_ENV];
  const key = serviceRoleKey ?? publishableKey;
  if (!baseUrl || !key) {
    throw new ArchiveStoreError("archive store is not configured", 503);
  }

  const requestInit: RequestInit = {
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(options.method === "POST" && publishableKey && writeToken ? { "x-nipmod-archive-token": writeToken } : {}),
      ...options.headers
    },
    method: options.method
  };
  if (options.body !== undefined) {
    requestInit.body = options.body;
  }

  const response = await (options.fetchImpl ?? fetch)(`${baseUrl.replace(/\/$/, "")}${path}`, requestInit);
  if (!response.ok) {
    throw new ArchiveStoreError(`archive store request failed with ${response.status}`, response.status);
  }
  if (response.status === 204) {
    return null as T;
  }
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (null as T);
}

function bearerToken(value: string | null): string | null {
  if (!value?.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  return value.slice(7).trim();
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeLimit(limit: number | undefined): number {
  if (!limit || !Number.isInteger(limit)) {
    return 20;
  }
  return Math.min(100, Math.max(1, limit));
}

function sanitizeArchiveSearchTerm(value: string): string {
  return value
    .replace(/[^\p{L}\p{N}@._/\-\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function isPackageIntelligenceRecord(value: unknown): value is PackageIntelligenceRecord {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as { type?: unknown }).type === "dev.nipmod.package-intelligence-record.v1"
  );
}
