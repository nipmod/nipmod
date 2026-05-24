alter table public.api_usage_events
  add column if not exists trust_decision text check (
    trust_decision is null or trust_decision in ('recommended', 'usable_with_warning', 'avoid', 'unknown')
  ),
  add column if not exists trust_risk text check (
    trust_risk is null or trust_risk in ('low', 'medium', 'high', 'unknown')
  ),
  add column if not exists install_blocked boolean,
  add column if not exists archive_stored boolean;

create index if not exists api_usage_events_trust_decision_idx
  on public.api_usage_events (trust_decision)
  where trust_decision is not null;

create index if not exists api_usage_events_trust_risk_idx
  on public.api_usage_events (trust_risk)
  where trust_risk is not null;

create index if not exists api_usage_events_install_blocked_idx
  on public.api_usage_events (install_blocked)
  where install_blocked is not null;

create index if not exists api_usage_events_archive_stored_idx
  on public.api_usage_events (archive_stored)
  where archive_stored is not null;

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
),
decision_rows as (
  select
    trust_decision,
    count(*)::integer as request_count
  from events
  where trust_decision is not null
  group by trust_decision
  order by request_count desc, trust_decision asc
),
risk_rows as (
  select
    trust_risk,
    count(*)::integer as request_count
  from events
  where trust_risk is not null
  group by trust_risk
  order by request_count desc, trust_risk asc
),
install_plan_rows as (
  select
    count(*) filter (where install_blocked = true)::integer as blocked_count,
    count(*) filter (where install_blocked = false)::integer as allowed_count,
    count(*) filter (where install_blocked is not null)::integer as observed_count
  from events
),
archive_rows as (
  select
    count(*) filter (where archive_stored = true)::integer as stored_count,
    count(*) filter (where archive_stored = false)::integer as preview_count,
    count(*) filter (where archive_stored is not null)::integer as observed_count
  from events
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
  ), '[]'::jsonb),
  'trustDecisions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'decision', trust_decision,
      'requestCount', request_count
    ))
    from decision_rows
  ), '[]'::jsonb),
  'trustRisks', coalesce((
    select jsonb_agg(jsonb_build_object(
      'risk', trust_risk,
      'requestCount', request_count
    ))
    from risk_rows
  ), '[]'::jsonb),
  'installPlans', (
    select jsonb_build_object(
      'observedCount', observed_count,
      'blockedCount', blocked_count,
      'allowedCount', allowed_count
    )
    from install_plan_rows
  ),
  'archiveWrites', (
    select jsonb_build_object(
      'observedCount', observed_count,
      'storedCount', stored_count,
      'previewCount', preview_count
    )
    from archive_rows
  )
);
$$;

revoke all on function public.read_api_usage_metrics(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.read_api_usage_metrics(timestamptz, integer) to service_role;
