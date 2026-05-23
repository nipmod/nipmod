import {
  EXTERNAL_PACKAGE_SOURCES,
  ExternalPackageError,
  inspectExternalPackage,
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

export async function inspectExternalRecordFromRequest(value: unknown): Promise<ExternalPackageRecord> {
  const suppliedRecord = readExternalRecord(value);
  const suppliedSource = readString(value, "source");
  const suppliedName = readString(value, "name");

  if (suppliedRecord && suppliedSource && suppliedSource !== suppliedRecord.source) {
    throw new ExternalPackageError("record source does not match request source", { code: "invalid_record", status: 400 });
  }
  if (suppliedRecord && suppliedName && normalizeComparableName(suppliedName) !== normalizeComparableName(suppliedRecord.name)) {
    throw new ExternalPackageError("record name does not match request name", { code: "invalid_record", status: 400 });
  }

  const source = suppliedRecord?.source ?? parseSource(suppliedSource);
  const name = suppliedRecord?.name ?? suppliedName ?? "";
  const inspected = await inspectExternalPackage(source, name);

  if (suppliedRecord) {
    if (inspected.source !== suppliedRecord.source || normalizeComparableName(inspected.name) !== normalizeComparableName(suppliedRecord.name)) {
      throw new ExternalPackageError("source inspection returned a different package than the submitted record", {
        code: "source_record_mismatch",
        status: 409
      });
    }
    if (suppliedRecord.version && inspected.version && suppliedRecord.version !== inspected.version) {
      throw new ExternalPackageError("submitted record version is stale; refresh from the source before archive confirmation", {
        code: "stale_record",
        status: 409
      });
    }
  }

  return inspected;
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

function readString(value: unknown, key: string): string | null {
  return value && typeof value === "object" && !Array.isArray(value) && typeof (value as Record<string, unknown>)[key] === "string"
    ? ((value as Record<string, string>)[key] ?? null)
    : null;
}

function normalizeComparableName(value: string): string {
  return value.trim().toLowerCase();
}
