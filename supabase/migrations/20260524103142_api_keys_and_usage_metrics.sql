create table if not exists public.api_keys (
  id text primary key check (id ~ '^key_[a-f0-9]{16,32}$'),
  key_hash text not null unique check (key_hash ~ '^[a-f0-9]{64}$'),
  label text not null check (char_length(label) between 1 and 80),
  tier text not null check (tier in ('beta', 'builder', 'partner', 'admin')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  rate_limit_multiplier integer not null check (rate_limit_multiplier >= 1 and rate_limit_multiplier <= 50000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  check (expires_at is null or expires_at > created_at),
  check ((status = 'revoked') = (revoked_at is not null))
);

create index if not exists api_keys_status_tier_idx
  on public.api_keys (status, tier);

create index if not exists api_keys_expires_at_idx
  on public.api_keys (expires_at)
  where expires_at is not null;

alter table public.api_keys enable row level security;

revoke all on table public.api_keys from public, anon, authenticated;
grant select, insert, update, delete on table public.api_keys to service_role;

drop policy if exists api_keys_service_role_only on public.api_keys;
create policy api_keys_service_role_only
on public.api_keys
for all
to service_role
using (true)
with check (true);

alter table public.api_usage_events
  drop constraint if exists api_usage_events_access_tier_check;

alter table public.api_usage_events
  add constraint api_usage_events_access_tier_check
  check (access_tier in ('public', 'beta', 'builder', 'partner', 'admin'));

create or replace function public.read_api_usage_metrics(
  p_since timestamptz default now() - interval '24 hours',
  p_limit integer default 20
)
returns jsonb
language sql
stable
set search_path = public
as $$
with bounds as (
  select
    coalesce(p_since, now() - interval '24 hours') as since_at,
    least(100, greatest(1, coalesce(p_limit, 20))) as result_limit
),
events as (
  select api_usage_events.*
  from public.api_usage_events, bounds
  where api_usage_events.created_at >= bounds.since_at
),
totals as (
  select
    count(*)::integer as request_count,
    count(*) filter (where status >= 400)::integer as error_count,
    count(distinct api_key_id) filter (where api_key_id is not null)::integer as key_count,
    count(distinct client_hash)::integer as client_count,
    coalesce(round(avg(duration_ms))::integer, 0) as avg_duration_ms
  from events
),
route_rows as (
  select
    route,
    count(*)::integer as request_count,
    count(*) filter (where status >= 400)::integer as error_count,
    coalesce(round(avg(duration_ms))::integer, 0) as avg_duration_ms
  from events
  group by route
  order by request_count desc, route asc
  limit (select result_limit from bounds)
),
source_events as (
  select unnest(
    case
      when cardinality(sources) > 0 then sources
      when source is not null then array[source]
      else '{}'::text[]
    end
  ) as source
  from events
),
source_rows as (
  select
    source,
    count(*)::integer as request_count
  from source_events
  where source is not null and source <> ''
  group by source
  order by request_count desc, source asc
  limit (select result_limit from bounds)
),
package_rows as (
  select
    package_hash,
    count(*)::integer as request_count
  from events
  where package_hash is not null
  group by package_hash
  order by request_count desc, package_hash asc
  limit (select result_limit from bounds)
),
tier_rows as (
  select
    access_tier,
    count(*)::integer as request_count
  from events
  group by access_tier
  order by request_count desc, access_tier asc
),
error_rows as (
  select
    error_code,
    count(*)::integer as request_count
  from events
  where error_code is not null
  group by error_code
  order by request_count desc, error_code asc
  limit (select result_limit from bounds)
)
select jsonb_build_object(
  'type', 'dev.nipmod.api-usage-metrics.v1',
  'generatedAt', to_jsonb(now()),
  'since', to_jsonb((select since_at from bounds)),
  'privacy', 'aggregated metrics only; package values are hashes; raw keys, IPs, user agents, queries and package names are not returned',
  'totals', (
    select jsonb_build_object(
      'requestCount', request_count,
      'errorCount', error_count,
      'keyCount', key_count,
      'clientCount', client_count,
      'avgDurationMs', avg_duration_ms
    )
    from totals
  ),
  'routes', coalesce((
    select jsonb_agg(jsonb_build_object(
      'route', route,
      'requestCount', request_count,
      'errorCount', error_count,
      'avgDurationMs', avg_duration_ms
    ))
    from route_rows
  ), '[]'::jsonb),
  'sources', coalesce((
    select jsonb_agg(jsonb_build_object(
      'source', source,
      'requestCount', request_count
    ))
    from source_rows
  ), '[]'::jsonb),
  'packages', coalesce((
    select jsonb_agg(jsonb_build_object(
      'packageHash', package_hash,
      'requestCount', request_count
    ))
    from package_rows
  ), '[]'::jsonb),
  'accessTiers', coalesce((
    select jsonb_agg(jsonb_build_object(
      'tier', access_tier,
      'requestCount', request_count
    ))
    from tier_rows
  ), '[]'::jsonb),
  'errors', coalesce((
    select jsonb_agg(jsonb_build_object(
      'code', error_code,
      'requestCount', request_count
    ))
    from error_rows
  ), '[]'::jsonb)
);
$$;

revoke all on function public.read_api_usage_metrics(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.read_api_usage_metrics(timestamptz, integer) to service_role;
