alter table public.api_keys
  drop constraint if exists api_keys_status_check;

alter table public.api_keys
  add constraint api_keys_status_check
  check (status in ('active', 'paused', 'revoked'));

alter table public.api_keys
  drop constraint if exists api_keys_check;

alter table public.api_keys
  drop constraint if exists api_keys_revoked_at_status_check;

alter table public.api_keys
  add constraint api_keys_revoked_at_status_check
  check ((status = 'revoked') = (revoked_at is not null));
