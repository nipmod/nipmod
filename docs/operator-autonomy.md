# Operator Autonomy Checklist

This file defines what the operator has to provide once so Nipmod can keep building and verifying the package intelligence layer without repeated manual handoffs.

Do not paste secrets into public chat, issues or committed files. Use Vercel environment variables, connector auth flows or a local ignored env file.

## Required for the durable archive

1. Supabase project URL
   - Vercel env: `NIPMOD_ARCHIVE_SUPABASE_URL`
   - Format: `https://<project-ref>.supabase.co`

2. Supabase publishable key
   - Vercel env: `NIPMOD_ARCHIVE_SUPABASE_PUBLISHABLE_KEY`
   - Database RLS also requires the server-only archive write token header before archive rows are readable or writable.

3. Archive write token
   - Vercel env: `NIPMOD_ARCHIVE_WRITE_TOKEN`
   - Generate locally with:

```bash
node --experimental-strip-types tools/package-intelligence-ops.ts generate-token
```

4. Database schema
   - Apply `supabase/migrations/20260522073000_package_intelligence_archive.sql` to the Supabase project.
   - If using the Supabase SQL editor, `docs/package-intelligence-schema.sql` contains the same SQL.
   - Register the same write token that is stored in Vercel:

```sql
select nipmod_private.set_archive_write_token('<NIPMOD_ARCHIVE_WRITE_TOKEN>', 'production');
```

   - Verify with:

```bash
node --experimental-strip-types tools/package-intelligence-ops.ts verify-secrets --env-file /tmp/nipmod-archive.env
```

## Required for distributed API rate limits

1. Supabase service role key
   - Vercel env: `NIPMOD_ARCHIVE_SUPABASE_SERVICE_ROLE_KEY`
   - Server-only. Never expose it to browser code or public logs.

2. Database schema
   - Apply `supabase/migrations/20260523084500_api_rate_limit_buckets.sql` to the Supabase project.
   - If using the Supabase SQL editor, `docs/api-rate-limit-schema.sql` contains the same SQL.
   - In Supabase Data API settings, expose the `consume_api_rate_limit` RPC function to the Data API for server-side service role calls. Some Supabase projects do not expose new functions automatically.

The rate-limit bucket stores hashed client identifiers only. If the RPC is missing or temporarily unavailable, the API falls back to the local in-process limiter and marks responses with `x-ratelimit-store: memory-fallback`.

Verify the RPC and the live API store with:

```bash
NIPMOD_CANARY_ENV_FILE=/tmp/nipmod-archive.env node --experimental-strip-types tools/rate-limit-canary.ts --require-configured --require-active
```

Without local secrets, the live production store can still be checked with:

```bash
pnpm rate-limit:canary -- --require-active
```

If the live check returns `fallbackReason: "distributed_rpc_http_404"`, Production has the Supabase env names but the RPC is not reachable through the Data API. Apply `supabase/migrations/20260523084500_api_rate_limit_buckets.sql`, then confirm `public.consume_api_rate_limit` is exposed to the Data API for service role calls before redeploying.

## Required for API keys and usage metrics

1. API key hash secret
   - Vercel env: `NIPMOD_API_KEY_HASH_SECRET`
   - Server-only. Use the same secret when deriving key hashes for storage.

2. Optional env bootstrap keys
   - Vercel env: `NIPMOD_API_KEY_HASHES`
   - Format: `label:tier:hash` or `label:tier:hash:multiplier`.
   - Supported tiers: `beta`, `partner`, `admin`. `builder` remains accepted as a legacy beta-tier alias.

3. Supabase key registry and metrics RPC
   - Apply `supabase/migrations/20260524103142_api_keys_and_usage_metrics.sql` to the Supabase project.
   - If using the Supabase SQL editor, use `docs/api-key-schema.sql` and `docs/api-usage-metrics-schema.sql` for the new key registry and metrics RPC.
   - In Supabase Data API settings, expose `api_keys` and `read_api_usage_metrics` for server-side service role calls only.

Raw API keys are never inserted. Store only `key_hash` values derived with `NIPMOD_API_KEY_HASH_SECRET`.

Free beta keys can be issued by the API once the registry table is live:

```bash
curl -s -X POST 'https://nipmod.com/api/keys/beta' \
  -H 'content-type: application/json' \
  -d '{"label":"self-serve-agent"}'
```

The response returns the raw key once. The server inserts only the keyed hash, key id, beta tier, non-private label, multiplier and expiry.

Create a key hash locally:

```bash
node --input-type=module -e "import { scryptSync } from 'node:crypto'; const [key, secret] = process.argv.slice(1); console.log(scryptSync(key, secret, 32).toString('hex'))" '<raw-api-key>' '<NIPMOD_API_KEY_HASH_SECRET>'
```

Insert a key manually only for operator-created partner, admin or recovery beta keys:

```sql
insert into public.api_keys (id, key_hash, label, tier, status, rate_limit_multiplier)
values ('key_<first_16_to_32_hash_chars>', '<64_hex_hash>', 'beta-caller', 'beta', 'active', 10);
```

Partner keys should use `tier = 'partner'`. Admin keys are for operational endpoints such as `GET /api/usage/stats`.

## Required for usage ingestion checks

Run the canary after Production env is available locally or through a temporary env file:

```bash
NIPMOD_CANARY_ENV_FILE=/tmp/nipmod-archive.env node --experimental-strip-types tools/api-usage-canary.ts --require-configured
```

The canary creates one public API request with a unique request id, then checks `api_usage_events` for that id through the service role key. It returns only route, status, count and timestamps; it does not print Supabase secrets or raw user query data.

## Local secret file template

Create this outside the repo or under a gitignored path:

```bash
node --experimental-strip-types tools/package-intelligence-ops.ts env-template > /tmp/nipmod-archive.env
```

Then fill in the values.

## Vercel activation

Check current Production env names:

```bash
node --experimental-strip-types tools/package-intelligence-ops.ts vercel-env-status
```

Apply required Production env vars:

```bash
node --experimental-strip-types tools/package-intelligence-ops.ts vercel-apply --env-file /tmp/nipmod-archive.env --replace
```

Deploy:

```bash
vercel --prod --yes
```

Verify live:

```bash
node --experimental-strip-types tools/package-intelligence-ops.ts live-smoke
node --experimental-strip-types tools/prod-synthetic-monitor.ts
node --experimental-strip-types tools/system-readiness-check.ts --live --parallel
```

## Optional access that improves coverage

| Access | Why it matters | Required now |
|---|---|---|
| GitHub token or app with repo/read security scopes | Higher rate limits, richer repo metadata, advisory enrichment | No |
| Hugging Face token | Higher limits and allowed gated metadata when a user has access | No |
| Cloudflare account | Edge rate limits, WAF rules, bot filters | No |
| OpenAI or Anthropic API key | Website chat and LLM assisted package search | No |
| External security vendor key | More vulnerability and supply chain signals | No |

## What still needs external proof

Even with every credential, these cannot be self-certified:

- official marketplace listings or partner acknowledgements
- private package access without user or owner authorization
- legal permission to mirror third party package contents at scale
- independent security audit results
- real external adoption

Nipmod can still be production strong without those claims. The correct public claim is that Nipmod provides one agent-readable package intelligence API over public package ecosystems, with durable memory for confirmed records and verification gates for Nipmod-native packages.
