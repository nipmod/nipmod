import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..", "..");
const migration = readFileSync(join(root, "supabase", "migrations", "20260522073000_package_intelligence_archive.sql"), "utf8");
const manualSql = readFileSync(join(root, "docs", "package-intelligence-schema.sql"), "utf8");
const usageMigration = readFileSync(join(root, "supabase", "migrations", "20260522151945_api_usage_events.sql"), "utf8");
const usageDecisionMetricsMigration = readFileSync(
  join(root, "supabase", "migrations", "20260524124159_api_usage_decision_metrics.sql"),
  "utf8"
);
const usageTrafficOriginMigration = readFileSync(join(root, "supabase", "migrations", "20260524161426_usage_traffic_origin.sql"), "utf8");
const usageManualSql = readFileSync(join(root, "docs", "api-usage-schema.sql"), "utf8");
const rateLimitMigration = readFileSync(join(root, "supabase", "migrations", "20260523084500_api_rate_limit_buckets.sql"), "utf8");
const rateLimitManualSql = readFileSync(join(root, "docs", "api-rate-limit-schema.sql"), "utf8");
const apiKeyManualSql = readFileSync(join(root, "docs", "api-key-schema.sql"), "utf8");
const apiKeyPausedMigration = readFileSync(join(root, "supabase", "migrations", "20260526180332_api_key_paused_status.sql"), "utf8");

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
    expect(usageManualSql).toContain("create table if not exists public.api_usage_events");
    expect(usageManualSql).toContain("access_tier text not null check (access_tier in ('public', 'beta', 'builder', 'partner', 'admin'))");
    expect(usageManualSql).toContain("trust_decision text");
    expect(usageManualSql).toContain("install_blocked boolean");
    expect(usageManualSql).toContain("traffic_origin text");
    expect(usageDecisionMetricsMigration).toContain("add column if not exists trust_decision");
    expect(usageDecisionMetricsMigration).toContain("create or replace function public.read_api_usage_metrics");
    expect(usageTrafficOriginMigration).toContain("add column if not exists traffic_origin");
    expect(usageTrafficOriginMigration).toContain("'trafficOrigins'");
    expect(usageTrafficOriginMigration).toContain("'trafficSummary'");
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

  test("keeps API key status schema aligned with admin key management", () => {
    expect(apiKeyManualSql).toContain("status in ('active', 'paused', 'revoked')");
    expect(apiKeyManualSql).toContain("api_keys_revoked_at_status_check");
    expect(apiKeyPausedMigration).toContain("status in ('active', 'paused', 'revoked')");
    expect(apiKeyPausedMigration).toContain("drop constraint if exists api_keys_check");
    expect(apiKeyPausedMigration).not.toMatch(/raw_key|api_key\s/i);
  });
});
