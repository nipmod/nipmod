create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create schema if not exists nipmod_private;

revoke all on schema nipmod_private from public;

create table if not exists nipmod_private.archive_write_tokens (
  token_sha256 text primary key,
  label text not null default 'production',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);

alter table nipmod_private.archive_write_tokens enable row level security;
revoke all on table nipmod_private.archive_write_tokens from public, anon, authenticated;

create or replace function nipmod_private.archive_token_sha256(raw_token text)
returns text
language sql
stable
set search_path = nipmod_private, extensions, pg_temp
as $$
  select encode(extensions.digest(raw_token, 'sha256'), 'hex')
$$;

revoke all on function nipmod_private.archive_token_sha256(text) from public, anon, authenticated;

create or replace function nipmod_private.set_archive_write_token(raw_token text, token_label text default 'production')
returns void
language plpgsql
security definer
set search_path = nipmod_private, extensions, pg_temp
as $$
begin
  if raw_token is null or length(raw_token) < 32 then
    raise exception 'archive write token must be at least 32 characters';
  end if;

  insert into nipmod_private.archive_write_tokens (token_sha256, label, active, rotated_at)
  values (nipmod_private.archive_token_sha256(raw_token), coalesce(nullif(token_label, ''), 'production'), true, now())
  on conflict (token_sha256) do update
    set active = true,
        label = excluded.label,
        rotated_at = now();
end;
$$;

revoke all on function nipmod_private.set_archive_write_token(text, text) from public, anon, authenticated;

create or replace function nipmod_private.archive_write_allowed()
returns boolean
language plpgsql
stable
security definer
set search_path = nipmod_private, extensions, pg_temp
as $$
declare
  request_headers jsonb;
  provided_token text;
begin
  begin
    request_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    return false;
  end;

  provided_token := request_headers ->> 'x-nipmod-archive-token';
  if provided_token is null or length(provided_token) < 32 then
    return false;
  end if;

  return exists (
    select 1
    from nipmod_private.archive_write_tokens
    where active = true
      and token_sha256 = nipmod_private.archive_token_sha256(provided_token)
  );
end;
$$;

revoke all on function nipmod_private.archive_write_allowed() from public;
grant usage on schema nipmod_private to anon, authenticated, service_role;
grant execute on function nipmod_private.archive_write_allowed() to anon, authenticated, service_role;

create table if not exists public.package_intelligence_records (
  id text primary key,
  stable_key text not null unique,
  source text not null,
  name text not null,
  display_name text not null,
  version text,
  status text not null check (
    status in (
      'external_indexed',
      'agent_confirmed',
      'claimed',
      'verified_nipmod',
      'quarantined',
      'yanked'
    )
  ),
  trust_score integer not null check (trust_score >= 0 and trust_score <= 100),
  original_url text not null,
  description text not null default '',
  record jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists package_intelligence_records_source_idx
  on public.package_intelligence_records (source);

create index if not exists package_intelligence_records_status_idx
  on public.package_intelligence_records (status);

create index if not exists package_intelligence_records_trust_score_idx
  on public.package_intelligence_records (trust_score desc);

create index if not exists package_intelligence_records_updated_at_idx
  on public.package_intelligence_records (updated_at desc);

create index if not exists package_intelligence_records_record_gin_idx
  on public.package_intelligence_records using gin (record);

create index if not exists package_intelligence_records_name_trgm_idx
  on public.package_intelligence_records using gin (name gin_trgm_ops);

create index if not exists package_intelligence_records_display_name_trgm_idx
  on public.package_intelligence_records using gin (display_name gin_trgm_ops);

create index if not exists package_intelligence_records_description_trgm_idx
  on public.package_intelligence_records using gin (description gin_trgm_ops);

alter table public.package_intelligence_records enable row level security;

revoke all on table public.package_intelligence_records from public, anon, authenticated;
grant select, insert, update on table public.package_intelligence_records to anon, authenticated;
grant select, insert, update, delete on table public.package_intelligence_records to service_role;

drop policy if exists package_intelligence_public_read on public.package_intelligence_records;
create policy package_intelligence_public_read
on public.package_intelligence_records
for select
to anon, authenticated
using (true);

drop policy if exists package_intelligence_authorized_insert on public.package_intelligence_records;
create policy package_intelligence_authorized_insert
on public.package_intelligence_records
for insert
to anon, authenticated
with check (nipmod_private.archive_write_allowed());

drop policy if exists package_intelligence_authorized_update on public.package_intelligence_records;
create policy package_intelligence_authorized_update
on public.package_intelligence_records
for update
to anon, authenticated
using (nipmod_private.archive_write_allowed())
with check (nipmod_private.archive_write_allowed());

create or replace function public.package_intelligence_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists package_intelligence_records_touch_updated_at on public.package_intelligence_records;

create trigger package_intelligence_records_touch_updated_at
before update on public.package_intelligence_records
for each row
execute function public.package_intelligence_touch_updated_at();
