import {
  EXTERNAL_PACKAGE_SOURCES,
  ExternalPackageError,
  readExternalPackageRecord,
  type ExternalPackageRecord,
  type ExternalPackageSource
} from "../../../lib/external-packages";

export function parseSource(value: string | null): ExternalPackageSource {
  if (typeof value === "string" && (EXTERNAL_PACKAGE_SOURCES as readonly string[]).includes(value)) {
    return value as ExternalPackageSource;
  }
  throw new ExternalPackageError("source must be one of npm, pypi, github, huggingface-model, huggingface-dataset or mcp", {
    code: "invalid_source",
    status: 400
  });
}

export function readExternalRecord(value: unknown): ExternalPackageRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const hasRecord = Object.prototype.hasOwnProperty.call(value, "record");
  const record = hasRecord ? (value as { record: unknown }).record : value;
  if (!hasRecord && (!record || typeof record !== "object" || Array.isArray(record))) {
    return null;
  }
  if (!hasRecord && (record as Partial<ExternalPackageRecord>).type !== "dev.nipmod.external-package.v1") {
    return null;
  }
  return readExternalPackageRecord(record);
}

export function readLimit(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || String(parsed) !== value.trim() || parsed < 1 || parsed > 100) {
    throw new ExternalPackageError("limit must be an integer from 1 to 100", { code: "invalid_limit", status: 400 });
  }
  return parsed;
}
