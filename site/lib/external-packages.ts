import { cleanPlainText, commandWarnings, installCommandRisk, type InstallCommandRisk } from "./package-command-safety";

export const EXTERNAL_PACKAGE_SOURCES = [
  "npm",
  "pypi",
  "github",
  "huggingface-model",
  "huggingface-dataset",
  "mcp"
] as const;

export type ExternalPackageSource = (typeof EXTERNAL_PACKAGE_SOURCES)[number];

export type ExternalPackageDecision = "recommended" | "usable_with_warning" | "avoid" | "unknown";
export type ExternalPackageRisk = "low" | "medium" | "high" | "unknown";
export type ExternalSourceStatus = "ok" | "empty" | "failed";
export type ExternalPackageSourceKind = "package-registry" | "source-repo" | "model-hub" | "tool-registry";

export interface ExternalPackageRecord {
  archive: {
    firstSeenReason: string;
    persistence: "ephemeral" | "static" | "database";
    status: "external_indexed" | "claimed" | "verified_nipmod";
  };
  description: string;
  displayName: string;
  formatVersion: 1;
  id: string;
  install: {
    command: string;
    commands?: string[];
    manager: string;
    notes: string[];
  };
  license: string | null;
  metrics: {
    dependents?: number | null;
    downloads?: number | null;
    likes?: number | null;
    stars?: number | null;
  };
  name: string;
  originalUrl: string;
  owner: string | null;
  registryUrl: string;
  repo: string | null;
  source: ExternalPackageSource;
  sourceKind: ExternalPackageSourceKind;
  trust: {
    checkedAt: string;
    decision: ExternalPackageDecision;
    risk: ExternalPackageRisk;
    score: number;
    signals: string[];
    warnings: string[];
  };
  type: "dev.nipmod.external-package.v1";
  updatedAt: string | null;
  version: string | null;
}

export interface ExternalSearchOptions {
  fetchImpl?: typeof fetch;
  limit?: number;
  sources?: ExternalPackageSource[];
  timeoutMs?: number;
}

export interface ExternalSourceReport {
  durationMs: number;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
    status: number;
  };
  recordCount: number;
  source: ExternalPackageSource;
  status: ExternalSourceStatus;
}

export interface ExternalSearchResult {
  generatedAt: string;
  partial: boolean;
  query: string;
  records: ExternalPackageRecord[];
  sourceReports: ExternalSourceReport[];
  sourceSummary: {
    empty: number;
    failed: number;
    ok: number;
    requested: number;
  };
  sources: ExternalPackageSource[];
  total: number;
  type: "dev.nipmod.external-search.v1";
}

export interface ExternalInstallPlan {
  generatedAt: string;
  package: Pick<
    ExternalPackageRecord,
    "archive" | "description" | "displayName" | "id" | "license" | "name" | "originalUrl" | "source" | "trust" | "version"
  >;
  plan: {
    commands: string[];
    requiresApprovalBeforeWrite: true;
    sourceOwnership: "external-owner-retained" | "nipmod-verified";
    steps: string[];
    writes: string[];
  };
  safety: {
    commandRisk: InstallCommandRisk;
    metadataIsInstruction: false;
    requiresApprovalBeforeWrite: true;
    warnings: string[];
  };
  type: "dev.nipmod.external-install-plan.v1";
}

type UnknownRecord = Record<string, unknown>;

const DEFAULT_TIMEOUT_MS = 6500;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const MAX_QUERY_LENGTH = 200;
const MAX_NAME_LENGTH = 220;
const MAX_SOURCE_RESPONSE_BYTES = 2_000_000;
const SOURCE_USER_AGENT = "nipmod-package-api/1.2.5 (+https://nipmod.com)";
const FETCH_CACHE_TTL_MS = 30_000;
const FETCH_CACHE_MAX_ITEMS = 500;
const EXTERNAL_PACKAGE_DECISIONS = ["recommended", "usable_with_warning", "avoid", "unknown"] as const;
const EXTERNAL_PACKAGE_RISKS = ["low", "medium", "high", "unknown"] as const;
const EXTERNAL_PACKAGE_SOURCE_KINDS = ["package-registry", "source-repo", "model-hub", "tool-registry"] as const;
const EXTERNAL_ARCHIVE_PERSISTENCE = ["ephemeral", "static", "database"] as const;
const EXTERNAL_ARCHIVE_STATUS = ["external_indexed", "claimed", "verified_nipmod"] as const;

const fetchCache = new Map<string, { expiresAt: number; value: UnknownRecord | UnknownRecord[] }>();

export async function searchExternalPackages(query: string, options: ExternalSearchOptions = {}): Promise<ExternalSearchResult> {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    throw new ExternalPackageError("query must not be empty", { code: "invalid_query", status: 400 });
  }

  const sources = normalizeSources(options.sources);
  const limit = normalizeLimit(options.limit);
  const fetchImpl = options.fetchImpl ?? fetch;
  const perSourceLimit = Math.max(2, Math.ceil(limit / Math.max(sources.length, 1)) + 2);

  const sourceResults = await Promise.all(
    sources.map((source) => searchSourceWithReport(source, normalized, perSourceLimit, fetchImpl, options.timeoutMs ?? DEFAULT_TIMEOUT_MS))
  );
  const sourceReports = sourceResults.map((result) => result.report);
  const failed = sourceReports.filter((report) => report.status === "failed").length;

  if (failed === sourceReports.length) {
    throw new ExternalPackageError("all external package sources failed", {
      code: "all_sources_failed",
      retryable: true,
      status: 502
    });
  }

  const records = sourceResults
    .flatMap((result) => result.records)
    .sort((left, right) => compareExternalRecords(left, right, normalized))
    .slice(0, limit);

  return {
    generatedAt: new Date().toISOString(),
    partial: failed > 0,
    query: normalized,
    records,
    sourceReports,
    sourceSummary: {
      empty: sourceReports.filter((report) => report.status === "empty").length,
      failed,
      ok: sourceReports.filter((report) => report.status === "ok").length,
      requested: sourceReports.length
    },
    sources,
    total: records.length,
    type: "dev.nipmod.external-search.v1"
  };
}

export async function inspectExternalPackage(
  source: ExternalPackageSource,
  name: string,
  options: Omit<ExternalSearchOptions, "sources"> = {}
): Promise<ExternalPackageRecord> {
  const normalizedName = normalizeName(name);
  if (!normalizedName) {
    throw new ExternalPackageError("name must not be empty", { code: "invalid_name", status: 400 });
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let record: ExternalPackageRecord | null;
  try {
    record = await inspectSource(source, normalizedName, fetchImpl, timeoutMs);
  } catch (error) {
    if (error instanceof ExternalPackageError && error.status === 404) {
      throw new ExternalPackageError(`no external package found for ${source}:${normalizedName}`, {
        code: "package_not_found",
        retryable: false,
        source,
        status: 404
      });
    }
    throw error;
  }
  if (!record) {
    throw new ExternalPackageError(`no external package found for ${source}:${normalizedName}`, {
      code: "package_not_found",
      retryable: false,
      source,
      status: 404
    });
  }
  return record;
}

export function createExternalInstallPlan(record: ExternalPackageRecord): ExternalInstallPlan {
  const commands = boundedStrings(record.install.commands ?? [record.install.command], 6, 1000, "install.commands", 1);
  const warnings = [...record.trust.warnings, ...commandWarnings(commands)];
  return {
    generatedAt: new Date().toISOString(),
    package: {
      archive: record.archive,
      description: record.description,
      displayName: record.displayName,
      id: record.id,
      license: record.license,
      name: record.name,
      originalUrl: record.originalUrl,
      source: record.source,
      trust: record.trust,
      version: record.version
    },
    plan: {
      commands,
      requiresApprovalBeforeWrite: true,
      sourceOwnership: record.archive.status === "verified_nipmod" ? "nipmod-verified" : "external-owner-retained",
      steps: [
        "Review the original source and license.",
        "Review Nipmod trust signals and warnings.",
        "Ask the user before writing to the workspace.",
        "Run the install command only after approval.",
        "Save a receipt with the source, version and trust result."
      ],
      writes: []
    },
    safety: {
      commandRisk: installCommandRisk(commands),
      metadataIsInstruction: false,
      requiresApprovalBeforeWrite: true,
      warnings
    },
    type: "dev.nipmod.external-install-plan.v1"
  };
}

export function parseExternalSources(value: string | null): ExternalPackageSource[] {
  if (!value) {
    return [...EXTERNAL_PACKAGE_SOURCES];
  }
  const requested = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const allowed = new Set<string>(EXTERNAL_PACKAGE_SOURCES);
  const invalid = requested.filter((source) => !allowed.has(source));
  if (invalid.length > 0) {
    throw new ExternalPackageError(`invalid source: ${invalid.join(", ")}`, { code: "invalid_source", status: 400 });
  }
  const sources = requested.filter((source): source is ExternalPackageSource => allowed.has(source));
  return sources.length > 0 ? [...new Set(sources)] : [...EXTERNAL_PACKAGE_SOURCES];
}

export function readExternalPackageRecord(value: unknown): ExternalPackageRecord {
  const record = unwrapExternalPackageRecord(value);
  if (!isRecord(record)) {
    throw new ExternalPackageError("request body must include a record object", { code: "invalid_record", status: 400 });
  }

  const source = readEnum(record.source, EXTERNAL_PACKAGE_SOURCES, "source");
  const sourceKind = readEnum(record.sourceKind, EXTERNAL_PACKAGE_SOURCE_KINDS, "sourceKind");
  const archive = readArchive(record.archive);
  const trust = readTrust(record.trust);
  const install = readInstall(record.install);
  const name = requiredCleanString(record.name, "name", MAX_NAME_LENGTH);
  const id = requiredCleanString(record.id, "id", 320);
  const originalUrl = requiredHttpUrl(record.originalUrl, "originalUrl");
  const registryUrl = requiredHttpUrl(record.registryUrl, "registryUrl");
  const repo = nullableHttpUrl(record.repo, "repo");
  const displayName = requiredCleanString(record.displayName, "displayName", MAX_NAME_LENGTH);

  if (record.type !== "dev.nipmod.external-package.v1") {
    throw new ExternalPackageError("record must be a dev.nipmod.external-package.v1 object", { code: "invalid_record", status: 400 });
  }
  if (record.formatVersion !== 1) {
    throw new ExternalPackageError("record formatVersion must be 1", { code: "invalid_record", status: 400 });
  }
  if (!id.startsWith(`${source}:`)) {
    throw new ExternalPackageError("record id must be prefixed by its source", { code: "invalid_record", status: 400 });
  }

  return {
    archive,
    description: cleanPlainText(readOptionalString(record.description) ?? "", 1000),
    displayName,
    formatVersion: 1,
    id,
    install,
    license: nullableCleanString(record.license, "license", 120),
    metrics: readMetrics(record.metrics),
    name,
    originalUrl,
    owner: nullableCleanString(record.owner, "owner", MAX_NAME_LENGTH),
    registryUrl,
    repo,
    source,
    sourceKind,
    trust,
    type: "dev.nipmod.external-package.v1",
    updatedAt: nullableCleanString(record.updatedAt, "updatedAt", 80),
    version: nullableCleanString(record.version, "version", 120)
  };
}

export class ExternalPackageError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly source: ExternalPackageSource | null;
  readonly status: number;

  constructor(message: string, options: { code?: string; retryable?: boolean; source?: ExternalPackageSource | null; status?: number } = {}) {
    super(message);
    this.code = options.code ?? "external_package_error";
    this.retryable = options.retryable ?? false;
    this.source = options.source ?? null;
    this.status = options.status ?? 500;
  }
}

export function externalPackageApiError(error: unknown, fallback: string): {
  code: string;
  error: string;
  retryable: boolean;
  source: ExternalPackageSource | null;
  status: number;
  type: "dev.nipmod.api-error.v1";
} {
  if (error instanceof ExternalPackageError) {
    return {
      code: error.code,
      error: error.message,
      retryable: error.retryable,
      source: error.source,
      status: error.status,
      type: "dev.nipmod.api-error.v1"
    };
  }
  return {
    code: "internal_error",
    error: error instanceof Error ? error.message : fallback,
    retryable: false,
    source: null,
    status: 500,
    type: "dev.nipmod.api-error.v1"
  };
}

async function searchSourceWithReport(
  source: ExternalPackageSource,
  query: string,
  limit: number,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<{ records: ExternalPackageRecord[]; report: ExternalSourceReport }> {
  const startedAt = Date.now();
  try {
    const records = await searchSource(source, query, limit, fetchImpl, timeoutMs);
    return {
      records,
      report: {
        durationMs: Date.now() - startedAt,
        recordCount: records.length,
        source,
        status: records.length > 0 ? "ok" : "empty"
      }
    };
  } catch (error) {
    const apiError = externalPackageApiError(error, "source search failed");
    return {
      records: [],
      report: {
        durationMs: Date.now() - startedAt,
        error: {
          code: apiError.code,
          message: apiError.error,
          retryable: apiError.retryable,
          status: apiError.status
        },
        recordCount: 0,
        source,
        status: "failed"
      }
    };
  }
}

async function searchSource(
  source: ExternalPackageSource,
  query: string,
  limit: number,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<ExternalPackageRecord[]> {
  switch (source) {
    case "npm":
      return searchNpm(query, limit, fetchImpl, timeoutMs);
    case "pypi":
      return searchPyPi(query, fetchImpl, timeoutMs);
    case "github":
      return searchGitHub(query, limit, fetchImpl, timeoutMs);
    case "huggingface-model":
      return searchHuggingFace("huggingface-model", query, limit, fetchImpl, timeoutMs);
    case "huggingface-dataset":
      return searchHuggingFace("huggingface-dataset", query, limit, fetchImpl, timeoutMs);
    case "mcp":
      return searchMcp(query, limit, fetchImpl, timeoutMs);
  }
}

async function inspectSource(
  source: ExternalPackageSource,
  name: string,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<ExternalPackageRecord | null> {
  switch (source) {
    case "npm":
      return inspectNpm(name, fetchImpl, timeoutMs);
    case "pypi":
      return inspectPyPi(name, fetchImpl, timeoutMs);
    case "github":
      return inspectGitHub(name, fetchImpl, timeoutMs);
    case "huggingface-model":
      return inspectHuggingFace("huggingface-model", name, fetchImpl, timeoutMs);
    case "huggingface-dataset":
      return inspectHuggingFace("huggingface-dataset", name, fetchImpl, timeoutMs);
    case "mcp":
      return inspectMcp(name, fetchImpl, timeoutMs);
  }
}

async function searchNpm(query: string, limit: number, fetchImpl: typeof fetch, timeoutMs: number): Promise<ExternalPackageRecord[]> {
  const payload = await fetchJson(
    `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=${limit}`,
    fetchImpl,
    timeoutMs,
    { source: "npm" }
  );
  const objects = isRecord(payload) && Array.isArray(payload.objects) ? payload.objects : [];
  return objects.map((item) => npmSearchRecord(item)).filter(isExternalPackageRecord);
}

async function inspectNpm(name: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<ExternalPackageRecord | null> {
  const payload = await fetchJson(`https://registry.npmjs.org/${encodeNpmName(name)}`, fetchImpl, timeoutMs, { source: "npm" });
  if (!isRecord(payload)) {
    return null;
  }
  const latest = readNestedString(payload, ["dist-tags", "latest"]);
  const versionData = latest && isRecord(payload.versions) ? readRecord(payload.versions[latest]) : null;
  const normalized = {
    downloads: null,
    package: {
      date: readString(payload.time),
      description: readString(versionData?.description) ?? readString(payload.description),
      keywords: [],
      license: readString(versionData?.license) ?? readString(payload.license),
      links: {
        bugs: readNestedString(versionData, ["bugs", "url"]),
        homepage: readString(versionData?.homepage),
        npm: `https://www.npmjs.com/package/${name}`,
        repository: normalizeRepositoryUrl(readNestedString(versionData, ["repository", "url"]) ?? readString(versionData?.repository))
      },
      name: readString(payload.name) ?? name,
      version: latest
    },
    score: { detail: { maintenance: 0.5, popularity: 0.5, quality: 0.5 } },
    updated: latest ? readNestedString(payload.time, [latest]) : readString(payload.modified)
  };
  return npmSearchRecord(normalized);
}

function npmSearchRecord(item: unknown): ExternalPackageRecord | null {
  if (!isRecord(item) || !isRecord(item.package)) {
    return null;
  }
  const pkg = item.package;
  const name = readString(pkg.name);
  if (!name) {
    return null;
  }
  const detail = isRecord(item.score) && isRecord(item.score.detail) ? item.score.detail : {};
  const popularity = readNumber(detail.popularity) ?? 0;
  const quality = readNumber(detail.quality) ?? 0;
  const maintenance = readNumber(detail.maintenance) ?? 0;
  const downloads = isRecord(item.downloads) ? (readNumber(item.downloads.monthly) ?? readNumber(item.downloads.weekly)) : null;
  const license = readString(pkg.license);
  const repo = normalizeRepositoryUrl(readNestedString(pkg, ["links", "repository"]));
  const warnings = readNumber(readRecord(item.flags)?.insecure) ? ["npm search marks this package as insecure."] : [];
  const score = clampScore(45 + popularity * 18 + quality * 18 + maintenance * 18 + (license ? 6 : 0) + (repo ? 6 : 0));

  return makeRecord({
    description: readString(pkg.description) ?? "",
    displayName: name,
    id: `npm:${name}`,
    install: {
      command: `npm install ${name}`,
      manager: "npm",
      notes: ["Install from the original npm registry. Nipmod does not claim ownership of this package."]
    },
    license,
    metrics: { dependents: readNumericString(item.dependents), downloads },
    name,
    originalUrl: readNestedString(pkg, ["links", "npm"]) ?? `https://www.npmjs.com/package/${name}`,
    owner: readNestedString(pkg, ["publisher", "username"]),
    registryUrl: `https://registry.npmjs.org/${encodeNpmName(name)}`,
    repo,
    source: "npm",
    sourceKind: "package-registry",
    signals: [
      "Resolved from npm registry search.",
      downloads ? `npm monthly downloads: ${downloads.toLocaleString("en-US")}` : "npm download data was not returned.",
      repo ? "Repository link is present." : "Repository link is missing."
    ],
    trustScore: score,
    updatedAt: readString(item.updated) ?? readString(pkg.date),
    version: readString(pkg.version),
    warnings
  });
}

async function searchPyPi(query: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<ExternalPackageRecord[]> {
  const names = [...new Set([query, query.replace(/\s+/g, "-"), query.replace(/\s+/g, "_")].map(normalizeName).filter(Boolean))];
  const settled = await Promise.allSettled(names.map((name) => inspectPyPi(name, fetchImpl, timeoutMs)));
  return settled.flatMap((result) => (result.status === "fulfilled" && result.value ? [result.value] : []));
}

async function inspectPyPi(name: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<ExternalPackageRecord | null> {
  const payload = await fetchJson(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`, fetchImpl, timeoutMs, { source: "pypi" });
  if (!isRecord(payload) || !isRecord(payload.info)) {
    return null;
  }
  const info = payload.info;
  const projectName = readString(info.name) ?? name;
  const vulnerabilities = Array.isArray(payload.vulnerabilities) ? payload.vulnerabilities : [];
  const projectUrls = readRecord(info.project_urls);
  const repo =
    normalizeRepositoryUrl(readString(projectUrls?.Source) ?? readString(projectUrls?.Homepage) ?? readString(info.home_page)) ?? null;
  const license = readString(info.license) || licenseFromClassifiers(info.classifiers);
  const warnings = vulnerabilities.length > 0 ? [`PyPI reports ${vulnerabilities.length} known vulnerabilities for the latest release.`] : [];
  const score = clampScore(58 + (license ? 10 : 0) + (repo ? 12 : 0) - vulnerabilities.length * 24);

  return makeRecord({
    description: readString(info.summary) ?? "",
    displayName: projectName,
    id: `pypi:${projectName}`,
    install: {
      command: `python -m pip install ${projectName}`,
      manager: "pip",
      notes: ["Install from the original PyPI project. Nipmod does not claim ownership of this package."]
    },
    license,
    metrics: {},
    name: projectName,
    originalUrl: readString(info.package_url) ?? `https://pypi.org/project/${projectName}/`,
    owner: readString(info.author) || readString(info.author_email),
    registryUrl: `https://pypi.org/pypi/${encodeURIComponent(projectName)}/json`,
    repo,
    source: "pypi",
    sourceKind: "package-registry",
    signals: [
      "Resolved from the PyPI JSON API.",
      vulnerabilities.length === 0 ? "PyPI returned no vulnerabilities for the latest release." : "PyPI returned vulnerability records.",
      repo ? "Project source/homepage link is present." : "Project source link is missing."
    ],
    trustScore: score,
    updatedAt: latestPyPiUploadTime(payload.releases),
    version: readString(info.version),
    warnings
  });
}

async function searchGitHub(query: string, limit: number, fetchImpl: typeof fetch, timeoutMs: number): Promise<ExternalPackageRecord[]> {
  const payload = await fetchJson(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(`${query} archived:false`)}&sort=stars&order=desc&per_page=${limit}`,
    fetchImpl,
    timeoutMs,
    { source: "github" }
  );
  const items = isRecord(payload) && Array.isArray(payload.items) ? payload.items : [];
  return items.map(gitHubRecord).filter(isExternalPackageRecord);
}

async function inspectGitHub(name: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<ExternalPackageRecord | null> {
  if (!name.includes("/")) {
    return null;
  }
  const payload = await fetchJson(`https://api.github.com/repos/${encodeURIComponentRepo(name)}`, fetchImpl, timeoutMs, { source: "github" });
  return gitHubRecord(payload);
}

function gitHubRecord(item: unknown): ExternalPackageRecord | null {
  if (!isRecord(item)) {
    return null;
  }
  const fullName = readString(item.full_name);
  if (!fullName) {
    return null;
  }
  const stars = readNumber(item.stargazers_count) ?? 0;
  const updatedAt = readString(item.pushed_at) ?? readString(item.updated_at);
  const license = readNestedString(item, ["license", "spdx_id"]);
  const owner = readNestedString(item, ["owner", "login"]);
  const score = clampScore(42 + Math.min(24, Math.log10(stars + 1) * 8) + (license ? 10 : 0) + (updatedAt ? recencyBonus(updatedAt) : 0));

  return makeRecord({
    description: readString(item.description) ?? "",
    displayName: fullName,
    id: `github:${fullName}`,
    install: {
      command: `git clone ${readString(item.clone_url) ?? `https://github.com/${fullName}.git`}`,
      manager: "git",
      notes: ["Clone from the original GitHub repository. Review project-specific install instructions before execution."]
    },
    license: license === "NOASSERTION" ? null : license,
    metrics: { stars },
    name: fullName,
    originalUrl: readString(item.html_url) ?? `https://github.com/${fullName}`,
    owner,
    registryUrl: readString(item.url) ?? `https://api.github.com/repos/${fullName}`,
    repo: readString(item.html_url) ?? `https://github.com/${fullName}`,
    source: "github",
    sourceKind: "source-repo",
    signals: [
      "Resolved from GitHub repository search.",
      `${stars.toLocaleString("en-US")} GitHub stars.`,
      license ? "License metadata is present." : "License metadata is missing."
    ],
    trustScore: score,
    updatedAt,
    version: null,
    warnings: license ? [] : ["No license metadata returned by GitHub."]
  });
}

async function searchHuggingFace(
  source: "huggingface-model" | "huggingface-dataset",
  query: string,
  limit: number,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<ExternalPackageRecord[]> {
  const endpoint = source === "huggingface-model" ? "models" : "datasets";
  const payload = await fetchJson(
    `https://huggingface.co/api/${endpoint}?search=${encodeURIComponent(query)}&limit=${limit}&sort=downloads&direction=-1`,
    fetchImpl,
    timeoutMs,
    { source }
  );
  const items = Array.isArray(payload) ? payload : [];
  return items.map((item) => huggingFaceRecord(source, item)).filter(isExternalPackageRecord);
}

async function inspectHuggingFace(
  source: "huggingface-model" | "huggingface-dataset",
  name: string,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<ExternalPackageRecord | null> {
  const endpoint = source === "huggingface-model" ? "models" : "datasets";
  const payload = await fetchJson(`https://huggingface.co/api/${endpoint}/${encodeURIComponentRepo(name)}`, fetchImpl, timeoutMs, { source });
  return huggingFaceRecord(source, payload);
}

function huggingFaceRecord(source: "huggingface-model" | "huggingface-dataset", item: unknown): ExternalPackageRecord | null {
  if (!isRecord(item)) {
    return null;
  }
  const id = readString(item.modelId) ?? readString(item.id);
  if (!id) {
    return null;
  }
  const tags = Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === "string") : [];
  const license = tags.find((tag) => tag.startsWith("license:"))?.replace(/^license:/, "") ?? null;
  const downloads = readNumber(item.downloads);
  const likes = readNumber(item.likes);
  const score = clampScore(46 + Math.min(22, Math.log10((downloads ?? 0) + 1) * 6) + Math.min(12, Math.log10((likes ?? 0) + 1) * 5) + (license ? 8 : 0));
  const kind = source === "huggingface-model" ? "model" : "dataset";

  return makeRecord({
    description: [readString(item.pipeline_tag), readString(item.library_name)].filter(Boolean).join(" / "),
    displayName: id,
    id: `${source}:${id}`,
    install: {
      command: `python -m pip install huggingface_hub`,
      commands: [
        "python -m pip install huggingface_hub",
        `python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='${id}', repo_type='${kind}')"`
      ],
      manager: "huggingface_hub",
      notes: [`Fetch the original Hugging Face ${kind}. Gated or private repos require the user's own Hugging Face access.`]
    },
    license,
    metrics: { downloads, likes },
    name: id,
    originalUrl: `https://huggingface.co/${source === "huggingface-dataset" ? "datasets/" : ""}${id}`,
    owner: id.includes("/") ? id.split("/")[0]! : null,
    registryUrl: `https://huggingface.co/api/${source === "huggingface-model" ? "models" : "datasets"}/${id}`,
    repo: `https://huggingface.co/${source === "huggingface-dataset" ? "datasets/" : ""}${id}`,
    source,
    sourceKind: "model-hub",
    signals: [
      `Resolved from Hugging Face ${kind} search.`,
      downloads ? `${downloads.toLocaleString("en-US")} downloads.` : "Download count was not returned.",
      license ? "License tag is present." : "License tag is missing."
    ],
    trustScore: score,
    updatedAt: readString(item.lastModified) ?? readString(item.createdAt),
    version: null,
    warnings: license ? [] : ["No license tag returned by Hugging Face."]
  });
}

async function searchMcp(query: string, limit: number, fetchImpl: typeof fetch, timeoutMs: number): Promise<ExternalPackageRecord[]> {
  const payload = await fetchJson("https://registry.modelcontextprotocol.io/v0.1/servers", fetchImpl, Math.min(timeoutMs, 3500), {
    source: "mcp"
  });
  const items = isRecord(payload) && Array.isArray(payload.servers) ? payload.servers : Array.isArray(payload) ? payload : [];
  const normalized = query.toLowerCase();
  return items
    .map(mcpRecord)
    .filter(isExternalPackageRecord)
    .filter((record) => [record.name, record.displayName, record.description].join(" ").toLowerCase().includes(normalized))
    .slice(0, limit);
}

async function inspectMcp(name: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<ExternalPackageRecord | null> {
  const payload = await fetchJson("https://registry.modelcontextprotocol.io/v0.1/servers", fetchImpl, Math.min(timeoutMs, 3500), {
    source: "mcp"
  });
  const items = isRecord(payload) && Array.isArray(payload.servers) ? payload.servers : Array.isArray(payload) ? payload : [];
  const normalized = name.toLowerCase();
  return items.map(mcpRecord).find((record) => record?.name.toLowerCase() === normalized || record?.id.toLowerCase() === `mcp:${normalized}`) ?? null;
}

function mcpRecord(item: unknown): ExternalPackageRecord | null {
  if (!isRecord(item)) {
    return null;
  }
  const name = readString(item.name) ?? readString(item.id);
  if (!name) {
    return null;
  }
  const repo = normalizeRepositoryUrl(readString(item.repository) ?? readNestedString(item, ["source", "url"]));
  const homepage = readString(item.homepage) ?? readString(item.url) ?? repo ?? "https://registry.modelcontextprotocol.io";

  return makeRecord({
    description: readString(item.description) ?? "",
    displayName: name,
    id: `mcp:${name}`,
    install: {
      command: `mcp install ${name}`,
      manager: "mcp",
      notes: ["MCP install commands differ by host. Use the server's original documentation before adding it to an agent runtime."]
    },
    license: readString(item.license),
    metrics: {},
    name,
    originalUrl: homepage,
    owner: readString(item.author) ?? null,
    registryUrl: "https://registry.modelcontextprotocol.io/v0.1/servers",
    repo,
    source: "mcp",
    sourceKind: "tool-registry",
    signals: ["Resolved from the MCP Registry.", repo ? "Source repository is present." : "Source repository was not returned."],
    trustScore: clampScore(52 + (repo ? 12 : 0) + (readString(item.license) ? 8 : 0)),
    updatedAt: readString(item.updatedAt) ?? readString(item.updated_at),
    version: readString(item.version),
    warnings: repo ? [] : ["No source repository returned by MCP Registry."]
  });
}

function makeRecord(input: {
  description: string;
  displayName: string;
  id: string;
  install: ExternalPackageRecord["install"];
  license: string | null;
  metrics: ExternalPackageRecord["metrics"];
  name: string;
  originalUrl: string;
  owner: string | null;
  registryUrl: string;
  repo: string | null;
  signals: string[];
  source: ExternalPackageSource;
  sourceKind: ExternalPackageRecord["sourceKind"];
  trustScore: number;
  updatedAt: string | null;
  version: string | null;
  warnings: string[];
}): ExternalPackageRecord {
  return {
    archive: {
      firstSeenReason: "Resolved by Nipmod external package index.",
      persistence: "ephemeral",
      status: "external_indexed"
    },
    description: input.description,
    displayName: input.displayName,
    formatVersion: 1,
    id: input.id,
    install: input.install,
    license: input.license,
    metrics: input.metrics,
    name: input.name,
    originalUrl: input.originalUrl,
    owner: input.owner,
    registryUrl: input.registryUrl,
    repo: input.repo,
    source: input.source,
    sourceKind: input.sourceKind,
    trust: {
      checkedAt: new Date().toISOString(),
      decision: decisionFromScore(input.trustScore, input.warnings),
      risk: riskFromScore(input.trustScore, input.warnings),
      score: input.trustScore,
      signals: input.signals,
      warnings: input.warnings
    },
    type: "dev.nipmod.external-package.v1",
    updatedAt: input.updatedAt,
    version: input.version
  };
}

async function fetchJson(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  options: { source?: ExternalPackageSource } = {}
): Promise<UnknownRecord | UnknownRecord[]> {
  const canCache = fetchImpl === fetch;
  const now = Date.now();
  if (canCache) {
    const cached = fetchCache.get(url);
    if (cached && cached.expiresAt > now) {
      return structuredClone(cached.value);
    }
    if (cached) {
      fetchCache.delete(url);
    }
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const value = await fetchJsonOnce(url, fetchImpl, timeoutMs, options.source);
      if (canCache) {
        rememberFetchCache(url, value);
      }
      return structuredClone(value);
    } catch (error) {
      lastError = error;
      if (!(error instanceof ExternalPackageError) || !error.retryable || attempt === 1) {
        throw error;
      }
      await wait(120);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new ExternalPackageError("source request failed", { source: options.source ?? null, status: 502 });
}

function rememberFetchCache(url: string, value: UnknownRecord | UnknownRecord[]): void {
  if (fetchCache.size >= FETCH_CACHE_MAX_ITEMS) {
    const oldest = fetchCache.keys().next().value as string | undefined;
    if (oldest) {
      fetchCache.delete(oldest);
    }
  }
  fetchCache.set(url, {
    expiresAt: Date.now() + FETCH_CACHE_TTL_MS,
    value: structuredClone(value)
  });
}

async function fetchJsonOnce(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  source: ExternalPackageSource | undefined
): Promise<UnknownRecord | UnknownRecord[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: sourceRequestHeaders(url),
      signal: controller.signal
    });
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      throw new ExternalPackageError(`source request failed with ${response.status}`, {
        code: response.status === 404 ? "source_not_found" : retryable ? "source_unavailable" : "source_rejected",
        retryable,
        source: source ?? null,
        status: response.status === 404 ? 404 : response.status === 429 ? 429 : 502
      });
    }
    const contentLength = response.headers.get("content-length");
    if (contentLength && Number.parseInt(contentLength, 10) > MAX_SOURCE_RESPONSE_BYTES) {
      throw new ExternalPackageError("source response is too large", {
        code: "source_response_too_large",
        retryable: true,
        source: source ?? null,
        status: 502
      });
    }
    const text = await response.text();
    if (text.length > MAX_SOURCE_RESPONSE_BYTES) {
      throw new ExternalPackageError("source response is too large", {
        code: "source_response_too_large",
        retryable: true,
        source: source ?? null,
        status: 502
      });
    }
    try {
      return JSON.parse(text) as UnknownRecord | UnknownRecord[];
    } catch {
      throw new ExternalPackageError("source returned invalid JSON", {
        code: "source_invalid_json",
        retryable: true,
        source: source ?? null,
        status: 502
      });
    }
  } catch (error) {
    if (error instanceof ExternalPackageError) {
      throw error;
    }
    if (isAbortError(error)) {
      throw new ExternalPackageError("source request timed out", {
        code: "source_timeout",
        retryable: true,
        source: source ?? null,
        status: 504
      });
    }
    throw new ExternalPackageError(error instanceof Error ? error.message : "source request failed", {
      code: "source_fetch_failed",
      retryable: true,
      source: source ?? null,
      status: 502
    });
  } finally {
    clearTimeout(timeout);
  }
}

function sourceRequestHeaders(url: string): HeadersInit {
  const headers: Record<string, string> = {
    accept: "application/json",
    "user-agent": SOURCE_USER_AGENT
  };
  const auth = sourceAuthHeader(url, process.env);
  if (auth) {
    headers.authorization = auth;
  }
  return headers;
}

function sourceAuthHeader(url: string, env: Record<string, string | undefined>): string | null {
  let hostname = "";
  try {
    hostname = new URL(url).hostname;
  } catch {
    return null;
  }
  if (hostname === "api.github.com" && env.NIPMOD_GITHUB_TOKEN) {
    return `Bearer ${env.NIPMOD_GITHUB_TOKEN}`;
  }
  if (hostname === "huggingface.co" && (env.NIPMOD_HUGGINGFACE_TOKEN || env.HF_TOKEN)) {
    return `Bearer ${env.NIPMOD_HUGGINGFACE_TOKEN ?? env.HF_TOKEN}`;
  }
  return null;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function compareExternalRecords(left: ExternalPackageRecord, right: ExternalPackageRecord, query: string): number {
  return (
    rankExternalRecord(right, query) - rankExternalRecord(left, query) ||
    (right.metrics.downloads ?? 0) - (left.metrics.downloads ?? 0) ||
    (right.metrics.stars ?? 0) - (left.metrics.stars ?? 0) ||
    left.displayName.localeCompare(right.displayName)
  );
}

function rankExternalRecord(record: ExternalPackageRecord, query: string): number {
  const normalizedQuery = query.toLowerCase();
  const name = record.name.toLowerCase();
  const displayName = record.displayName.toLowerCase();
  const description = record.description.toLowerCase();
  const exactMatch = name === normalizedQuery || displayName === normalizedQuery ? 18 : 0;
  const prefixMatch = name.startsWith(normalizedQuery) || displayName.startsWith(normalizedQuery) ? 10 : 0;
  const textMatch = `${name} ${displayName} ${description}`.includes(normalizedQuery) ? 6 : 0;
  const qualityPenalty = record.trust.decision === "avoid" || record.trust.risk === "high" ? 35 : record.trust.warnings.length * 4;
  const metricsBonus =
    Math.min(10, Math.log10((record.metrics.downloads ?? 0) + 1) * 2) +
    Math.min(8, Math.log10((record.metrics.stars ?? 0) + 1) * 2) +
    Math.min(4, Math.log10((record.metrics.likes ?? 0) + 1) * 1.5);
  return Math.round(record.trust.score + exactMatch + prefixMatch + textMatch + metricsBonus - qualityPenalty);
}

function normalizeSources(sources: ExternalPackageSource[] | undefined): ExternalPackageSource[] {
  if (!sources || sources.length === 0) {
    return [...EXTERNAL_PACKAGE_SOURCES];
  }
  const allowed = new Set<string>(EXTERNAL_PACKAGE_SOURCES);
  return [...new Set(sources.filter((source): source is ExternalPackageSource => allowed.has(source)))];
}

function normalizeLimit(limit: number | undefined): number {
  if (!limit) {
    return DEFAULT_LIMIT;
  }
  if (!Number.isInteger(limit)) {
    throw new ExternalPackageError("limit must be an integer", { code: "invalid_limit", status: 400 });
  }
  return Math.min(MAX_LIMIT, Math.max(1, limit));
}

function normalizeQuery(query: string): string {
  return cleanPlainText(query, MAX_QUERY_LENGTH);
}

function normalizeName(name: string): string {
  return cleanPlainText(name, MAX_NAME_LENGTH);
}

function unwrapExternalPackageRecord(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }
  return Object.prototype.hasOwnProperty.call(value, "record") ? value.record : value;
}

function readArchive(value: unknown): ExternalPackageRecord["archive"] {
  if (!isRecord(value)) {
    throw new ExternalPackageError("record.archive must be an object", { code: "invalid_record", status: 400 });
  }
  return {
    firstSeenReason: requiredCleanString(value.firstSeenReason, "archive.firstSeenReason", 240),
    persistence: readEnum(value.persistence, EXTERNAL_ARCHIVE_PERSISTENCE, "archive.persistence"),
    status: readEnum(value.status, EXTERNAL_ARCHIVE_STATUS, "archive.status")
  };
}

function readInstall(value: unknown): ExternalPackageRecord["install"] {
  if (!isRecord(value)) {
    throw new ExternalPackageError("record.install must be an object", { code: "invalid_record", status: 400 });
  }
  const command = requiredCleanString(value.command, "install.command", 1000);
  const commands = value.commands === undefined ? undefined : boundedStrings(value.commands, 6, 1000, "install.commands", 1);
  const notes = boundedStrings(value.notes, 10, 300, "install.notes", 1);
  const base = {
    command,
    manager: requiredCleanString(value.manager, "install.manager", 80),
    notes
  };
  return commands === undefined ? base : { ...base, commands };
}

function readTrust(value: unknown): ExternalPackageRecord["trust"] {
  if (!isRecord(value)) {
    throw new ExternalPackageError("record.trust must be an object", { code: "invalid_record", status: 400 });
  }
  return {
    checkedAt: requiredCleanString(value.checkedAt, "trust.checkedAt", 80),
    decision: readEnum(value.decision, EXTERNAL_PACKAGE_DECISIONS, "trust.decision"),
    risk: readEnum(value.risk, EXTERNAL_PACKAGE_RISKS, "trust.risk"),
    score: readBoundedInteger(value.score, "trust.score", 0, 100),
    signals: boundedStrings(value.signals, 16, 300, "trust.signals", 1),
    warnings: boundedStrings(value.warnings, 16, 300, "trust.warnings")
  };
}

function readMetrics(value: unknown): ExternalPackageRecord["metrics"] {
  if (!isRecord(value)) {
    return {};
  }
  return {
    dependents: nullableNonNegativeNumber(value.dependents, "metrics.dependents"),
    downloads: nullableNonNegativeNumber(value.downloads, "metrics.downloads"),
    likes: nullableNonNegativeNumber(value.likes, "metrics.likes"),
    stars: nullableNonNegativeNumber(value.stars, "metrics.stars")
  };
}

function readEnum<T extends readonly string[]>(value: unknown, allowed: T, label: string): T[number] {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as T[number];
  }
  throw new ExternalPackageError(`${label} is invalid`, { code: "invalid_record", status: 400 });
}

function requiredCleanString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new ExternalPackageError(`${label} must be a string`, { code: "invalid_record", status: 400 });
  }
  const cleaned = cleanPlainText(value, maxLength);
  if (!cleaned) {
    throw new ExternalPackageError(`${label} must not be empty`, { code: "invalid_record", status: 400 });
  }
  return cleaned;
}

function nullableCleanString(value: unknown, label: string, maxLength: number): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    throw new ExternalPackageError(`${label} must be a string or null`, { code: "invalid_record", status: 400 });
  }
  return cleanPlainText(value, maxLength) || null;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function boundedStrings(value: unknown, maxItems: number, maxLength: number, label: string, minItems = 0): string[] {
  if (!Array.isArray(value)) {
    throw new ExternalPackageError(`${label} must be an array`, { code: "invalid_record", status: 400 });
  }
  if (value.length < minItems) {
    throw new ExternalPackageError(`${label} has too few items`, { code: "invalid_record", status: 400 });
  }
  if (value.length > maxItems) {
    throw new ExternalPackageError(`${label} has too many items`, { code: "invalid_record", status: 400 });
  }
  return value.map((item, index) => requiredCleanString(item, `${label}.${index}`, maxLength));
}

function requiredHttpUrl(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new ExternalPackageError(`${label} must be a URL`, { code: "invalid_record", status: 400 });
  }
  const cleaned = cleanPlainText(value, 1000);
  if (!isHttpUrl(cleaned)) {
    throw new ExternalPackageError(`${label} must be an http or https URL`, { code: "invalid_record", status: 400 });
  }
  return cleaned;
}

function nullableHttpUrl(value: unknown, label: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return requiredHttpUrl(value, label);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

function readBoundedInteger(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new ExternalPackageError(`${label} must be an integer from ${min} to ${max}`, { code: "invalid_record", status: 400 });
  }
  return value;
}

function nullableNonNegativeNumber(value: unknown, label: string): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ExternalPackageError(`${label} must be a non-negative number or null`, { code: "invalid_record", status: 400 });
  }
  return value;
}

function decisionFromScore(score: number, warnings: string[]): ExternalPackageDecision {
  if (warnings.some((warning) => /vulnerab|insecure/i.test(warning))) {
    return "avoid";
  }
  if (score >= 75) return "recommended";
  if (score >= 50) return "usable_with_warning";
  return "unknown";
}

function riskFromScore(score: number, warnings: string[]): ExternalPackageRisk {
  if (warnings.some((warning) => /vulnerab|insecure/i.test(warning))) {
    return "high";
  }
  if (score >= 75) return "low";
  if (score >= 50) return "medium";
  return "unknown";
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function recencyBonus(value: string): number {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    return 0;
  }
  const days = (Date.now() - time) / 86_400_000;
  if (days < 90) return 14;
  if (days < 365) return 10;
  if (days < 730) return 6;
  return 0;
}

function licenseFromClassifiers(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const licenseClassifier = value.find((item): item is string => typeof item === "string" && item.startsWith("License ::"));
  return licenseClassifier?.split("::").at(-1)?.trim() ?? null;
}

function latestPyPiUploadTime(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }
  const uploads = Object.values(value)
    .flatMap((release) => (Array.isArray(release) ? release : []))
    .map((file) => (isRecord(file) ? readString(file.upload_time_iso_8601) : null))
    .filter((item): item is string => Boolean(item))
    .sort((left, right) => right.localeCompare(left));
  return uploads[0] ?? null;
}

function normalizeRepositoryUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return value.replace(/^git\+/, "").replace(/\.git$/, "");
}

function encodeNpmName(name: string): string {
  return name.startsWith("@") ? name.split("/").map(encodeURIComponent).join("/") : encodeURIComponent(name);
}

function encodeURIComponentRepo(name: string): string {
  return name.split("/").map(encodeURIComponent).join("/");
}

function readRecord(value: unknown): UnknownRecord | null {
  return isRecord(value) ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readNumericString(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function readNestedString(value: unknown, path: string[]): string | null {
  let current = value;
  for (const key of path) {
    if (!isRecord(current)) {
      return null;
    }
    current = current[key];
  }
  return readString(current);
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isExternalPackageRecord(value: ExternalPackageRecord | null): value is ExternalPackageRecord {
  return value !== null;
}
