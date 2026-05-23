import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..", "..");
const migration = readFileSync(join(root, "supabase", "migrations", "20260522073000_package_intelligence_archive.sql"), "utf8");
const manualSql = readFileSync(join(root, "docs", "package-intelligence-schema.sql"), "utf8");
const usageMigration = readFileSync(join(root, "supabase", "migrations", "20260522151945_api_usage_events.sql"), "utf8");
const usageManualSql = readFileSync(join(root, "docs", "api-usage-schema.sql"), "utf8");
const rateLimitMigration = readFileSync(join(root, "supabase", "migrations", "20260523084500_api_rate_limit_buckets.sql"), "utf8");
const rateLimitManualSql = readFileSync(join(root, "docs", "api-rate-limit-schema.sql"), "utf8");

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

  test("keeps private API usage logging aligned with the migration", () => {
    expect(usageManualSql).toBe(usageMigration);
    expect(usageMigration).toContain("create table if not exists public.api_usage_events");
    expect(usageMigration).toContain("alter table public.api_usage_events enable row level security");
    expect(usageMigration).toContain("revoke all on table public.api_usage_events from public, anon, authenticated");
    expect(usageMigration).toContain("grant select, insert, delete on table public.api_usage_events to service_role");
    expect(usageMigration).not.toMatch(/raw_query|raw_package|raw_ip|user_agent|api_key\s/i);
  });

  test("keeps distributed API rate limits aligned with the migration", () => {
    expect(rateLimitManualSql).toBe(rateLimitMigration);
    expect(rateLimitMigration).toContain("create table if not exists public.api_rate_limit_buckets");
    expect(rateLimitMigration).toContain("create or replace function public.consume_api_rate_limit");
    expect(rateLimitMigration).toContain("alter table public.api_rate_limit_buckets enable row level security");
    expect(rateLimitMigration).toContain("revoke all on table public.api_rate_limit_buckets from public, anon, authenticated");
    expect(rateLimitMigration).toContain("grant execute on function public.consume_api_rate_limit(text, text, text, integer, integer) to service_role");
    expect(rateLimitMigration).not.toMatch(/raw_ip|user_agent|api_key\s/i);
    expect(rateLimitMigration).not.toContain("security definer");
  });
});
