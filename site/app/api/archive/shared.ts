import {
  EXTERNAL_PACKAGE_SOURCES,
  ExternalPackageError,
  type ExternalPackageRecord,
  type ExternalPackageSource
} from "../../../lib/external-packages";

export function parseSource(value: string | null): ExternalPackageSource {
  if (typeof value === "string" && (EXTERNAL_PACKAGE_SOURCES as readonly string[]).includes(value)) {
    return value as ExternalPackageSource;
  }
  throw new ExternalPackageError("source must be one of npm, pypi, github, huggingface-model, huggingface-dataset or mcp", 400);
}

export function readExternalRecord(value: unknown): ExternalPackageRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = "record" in value ? (value as { record: unknown }).record : value;
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return null;
  }
  const candidate = record as Partial<ExternalPackageRecord>;
  if (candidate.type !== "dev.nipmod.external-package.v1" || typeof candidate.id !== "string") {
    return null;
  }
  return candidate as ExternalPackageRecord;
}

export function readLimit(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
