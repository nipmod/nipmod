import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..", "..");
const migration = readFileSync(join(root, "supabase", "migrations", "20260522073000_package_intelligence_archive.sql"), "utf8");
const manualSql = readFileSync(join(root, "docs", "package-intelligence-schema.sql"), "utf8");

describe("package intelligence Supabase schema", () => {
  test("keeps the manual SQL copy aligned with the migration", () => {
    expect(manualSql).toBe(migration);
    expect(manualSql).not.toContain("\\ir");
  });

  test("uses private token hashes and RLS for archive writes", () => {
    expect(migration).toContain("create schema if not exists nipmod_private");
    expect(migration).toContain("archive_write_tokens");
    expect(migration).toContain("archive_token_sha256");
    expect(migration).toContain("alter table public.package_intelligence_records enable row level security");
    expect(migration).toContain("package_intelligence_public_read");
    expect(migration).toContain("package_intelligence_authorized_insert");
    expect(migration).toContain("package_intelligence_authorized_update");
    expect(migration).toContain("nipmod_private.archive_write_allowed()");
    expect(migration).not.toMatch(/service[-_ ]role key/i);
  });
});
