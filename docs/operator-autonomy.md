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
