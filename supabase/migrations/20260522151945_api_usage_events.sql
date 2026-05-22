create table if not exists public.api_usage_events (
  id uuid primary key default gen_random_uuid(),
  route text not null,
  method text not null check (method in ('GET', 'POST', 'OPTIONS')),
  status integer not null check (status >= 100 and status <= 599),
  request_id text not null,
  access_tier text not null check (access_tier in ('public', 'builder', 'partner', 'admin')),
  api_key_id text,
  client_hash text not null,
  query_hash text,
  package_hash text,
  source text,
  sources text[] not null default '{}',
  result_count integer check (result_count is null or result_count >= 0),
  error_code text,
  duration_ms integer not null check (duration_ms >= 0),
  created_at timestamptz not null default now()
);

create index if not exists api_usage_events_created_at_idx
  on public.api_usage_events (created_at desc);

create index if not exists api_usage_events_route_status_idx
  on public.api_usage_events (route, status);

create index if not exists api_usage_events_access_tier_idx
  on public.api_usage_events (access_tier);

create index if not exists api_usage_events_api_key_id_idx
  on public.api_usage_events (api_key_id)
  where api_key_id is not null;

create index if not exists api_usage_events_source_idx
  on public.api_usage_events (source)
  where source is not null;

create index if not exists api_usage_events_error_code_idx
  on public.api_usage_events (error_code)
  where error_code is not null;

alter table public.api_usage_events enable row level security;

revoke all on table public.api_usage_events from public, anon, authenticated;
grant select, insert, delete on table public.api_usage_events to service_role;

drop policy if exists api_usage_events_service_role_only on public.api_usage_events;
create policy api_usage_events_service_role_only
on public.api_usage_events
for all
to service_role
using (true)
with check (true);
