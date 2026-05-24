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
