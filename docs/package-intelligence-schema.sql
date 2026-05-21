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

alter table public.package_intelligence_records enable row level security;

revoke all on table public.package_intelligence_records from anon;
revoke all on table public.package_intelligence_records from authenticated;

create or replace function public.package_intelligence_touch_updated_at()
returns trigger
language plpgsql
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
