create table if not exists public.api_rate_limit_buckets (
  bucket_key text primary key,
  policy text not null,
  client_hash text not null,
  count integer not null check (count >= 0),
  limit_count integer not null check (limit_count > 0),
  window_ms integer not null check (window_ms >= 1000),
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists api_rate_limit_buckets_reset_at_idx
  on public.api_rate_limit_buckets (reset_at);

create index if not exists api_rate_limit_buckets_policy_idx
  on public.api_rate_limit_buckets (policy);

alter table public.api_rate_limit_buckets enable row level security;

revoke all on table public.api_rate_limit_buckets from public, anon, authenticated;
grant select, insert, update, delete on table public.api_rate_limit_buckets to service_role;

drop policy if exists api_rate_limit_buckets_service_role_only on public.api_rate_limit_buckets;
create policy api_rate_limit_buckets_service_role_only
on public.api_rate_limit_buckets
for all
to service_role
using (true)
with check (true);

create or replace function public.consume_api_rate_limit(
  p_bucket_key text,
  p_policy text,
  p_client_hash text,
  p_limit_count integer,
  p_window_ms integer
)
returns table (
  allowed boolean,
  count integer,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_reset_at timestamptz := v_now + greatest(p_window_ms, 1000) * interval '1 millisecond';
  v_count integer;
begin
  if p_bucket_key is null or length(p_bucket_key) < 16 or length(p_bucket_key) > 128 then
    raise exception 'invalid rate limit bucket key';
  end if;

  if p_policy is null or length(p_policy) < 1 or length(p_policy) > 80 then
    raise exception 'invalid rate limit policy';
  end if;

  if p_client_hash is null or length(p_client_hash) < 16 or length(p_client_hash) > 128 then
    raise exception 'invalid rate limit client hash';
  end if;

  if p_limit_count is null or p_limit_count < 1 or p_limit_count > 50000 then
    raise exception 'invalid rate limit count';
  end if;

  if p_window_ms is null or p_window_ms < 1000 or p_window_ms > 86400000 then
    raise exception 'invalid rate limit window';
  end if;

  insert into public.api_rate_limit_buckets (
    bucket_key,
    policy,
    client_hash,
    count,
    limit_count,
    window_ms,
    reset_at,
    updated_at
  )
  values (
    p_bucket_key,
    p_policy,
    p_client_hash,
    1,
    p_limit_count,
    p_window_ms,
    v_reset_at,
    v_now
  )
  on conflict (bucket_key) do update
  set
    policy = excluded.policy,
    client_hash = excluded.client_hash,
    count = case
      when public.api_rate_limit_buckets.reset_at <= v_now then 1
      else public.api_rate_limit_buckets.count + 1
    end,
    limit_count = excluded.limit_count,
    window_ms = excluded.window_ms,
    reset_at = case
      when public.api_rate_limit_buckets.reset_at <= v_now then v_reset_at
      else public.api_rate_limit_buckets.reset_at
    end,
    updated_at = v_now
  returning public.api_rate_limit_buckets.count, public.api_rate_limit_buckets.reset_at
  into v_count, v_reset_at;

  return query
  select
    v_count <= p_limit_count as allowed,
    v_count as count,
    greatest(0, p_limit_count - v_count) as remaining,
    v_reset_at as reset_at;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, text, integer, integer) to service_role;
