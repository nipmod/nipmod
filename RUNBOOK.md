# nipmod Runbook

## Fresh Clone

Requirements:

- Node.js 22+
- pnpm 10+
- git
- Vercel CLI login for site deploys
- Fly CLI login for node and witness deploys

Install and verify:

```bash
pnpm --dir nipmod install
pnpm --dir site install
node tools/verify-all.mjs
```

Expected registry state:

- `site/app/registry-data.json` has at least one package
- every published package has `trust.level: "verified"`
- every verified package has `sourceProvenanceVerified: true`
- `site/public/transparency/checkpoint.json` matches the pinned Fly witness

## Production Health

```bash
curl -fsS https://node.nipmod.com/health
curl -fsS https://nipmod-witness.fly.dev/health
curl -fsS https://nipmod.com/registry/packages.json
curl -fsS https://nipmod.com/.well-known/nipmod.json
curl -fsS https://nipmod.com/.well-known/security.txt
curl -fsS https://nipmod.com/security
curl -fsS https://nipmod.com/advisories.json
vercel inspect https://nipmod.com --timeout 120s
fly status --app nipmod-gitlawb-node-v2
fly status --app nipmod-witness
curl -i -X POST https://nipmod-witness.fly.dev/run
node tools/prod-synthetic-monitor.mjs
node tools/prod-load-smoke.mjs --profile launch
node tools/supply-chain-check.mjs
node tools/restore-drill.mjs
node tools/node-edge-resilience-smoke.mjs
node tools/verify-all.mjs --prod
nipmod search policy --registries https://nipmod.com/registry/packages.json,https://mirror.example/packages.json
```

The registry is public-ready only when:

- `node.nipmod.com` returns healthy
- `nipmod-witness.fly.dev/health` returns `ok: true`
- unauthenticated `POST /run` fails closed with `401`, `403` or `503`
- `registry/packages.json` reports `verified/100`
- `.well-known/nipmod.json` points to the current registry, node, witness, checkpoint, installer and release key
- `.well-known/security.txt` points to the public security policy and disclosure fallback
- `advisories.json` is valid JSON with `type: "dev.nipmod.advisories.v1"`
- `sourceCommit`, `sourceTag` and `sourceProvenanceVerified` are present
- Vercel deployment status is Ready and aliased to `nipmod.com`
- the advisory dry-run blocks a live verified package with `audit` exit `6` and `ci` exit `8` without changing the public advisory feed
- bounded load smoke passes for the homepage crawler, registry, trust page and node health

## Synthetic Monitoring

`node tools/prod-synthetic-monitor.mjs` is the alerting contract. It exits non-zero when any production surface is unsafe for public use and prints a `dev.nipmod.prod-synthetic-monitor.v1` JSON payload.

Checks covered:

- homepage and Trust page proof markers
- discovery manifest endpoint integrity
- deploy drift against local release, installer, advisory key, release key, log ID and witness DID pins
- live installer, release artifact and release signature bytes
- registry `verified/100` package state
- signed and unexpired advisory feed
- transparency checkpoint freshness and registry proof root
- witness health, freshness and root continuity
- unauthenticated witness `/run` rejection
- node `/health`
- unauthenticated `git-receive-pack` rejection for minimal and 1 MiB body probes

Run it every 60 seconds from the external monitor. Alert when `.ok` is false, when the command exits non-zero, or when no result arrives.

## Node Edge Resilience Smoke

`node tools/node-edge-resilience-smoke.mjs` is the bounded public Gitlawb edge smoke. It is intentionally small enough to run inside `verify-all --prod` without behaving like a load test.

It uses exactly 5 serial node requests with no retries:

- health before probes
- bounded repo catalog read capped at 256 KiB
- unauthenticated `git-receive-pack` rejection with a 4 byte body
- unauthenticated `git-receive-pack` rejection with a 1,048,576 byte body
- health after probes

Total receive-pack body budget is 1,048,580 bytes. The smoke fails on any 5xx response, oversized catalog response, missing `clone_url`, exposed unauthenticated receive-pack path or unhealthy node after probes.

This does not prove real per-IP rate limits, DID rate limits or aggressive crawler throttling. It does prove the public edge rejects unauthenticated write probes and stays healthy after bounded abuse probes.

## Production Load Smoke

`node tools/prod-load-smoke.mjs` is the bounded launch smoke for 100 early users. It is not a stress test and does not try to exhaust Gitlawb or Vercel.

It verifies:

- homepage crawler can discover the Trust page
- registry stays valid under the selected bounded request profile
- node health stays valid under the selected bounded request profile
- Trust page stays valid under half of the selected bounded request profile
- p95 latency remains under 2500ms for each checked surface

Default budget is 120 iterations with concurrency 12 and a 10 second request timeout. Launch budget is 360 iterations with concurrency 24 and a 10 second request timeout:

```bash
node tools/prod-load-smoke.mjs --profile launch
```

Run the launch profile before public posts and after deploys that touch registry, trust, security or node health.

## Alert Delivery

`node tools/prod-alert-runner.mjs` wraps the synthetic monitor and restore drill into the alert delivery contract. In normal mode it sends a critical `dev.nipmod.production-alert.v1` JSON payload only when a production check fails. In probe mode it sends an info alert even when production is healthy, which proves the primary and secondary operator paths are reachable.

Configure at least two destinations outside Vercel and Fly:

```bash
export NIPMOD_ALERT_PRIMARY_WEBHOOK_URL="https://..."
export NIPMOD_ALERT_SECONDARY_WEBHOOK_URL="https://..."
```

Delivery proof:

```bash
node tools/prod-alert-runner.mjs --probe
```

The command exits non-zero when a destination is missing or returns non-2xx. Its stdout redacts webhook URLs and reports destinations only as short SHA-256 ids. A public launch requires a successful `--probe` from the external runner plus a normal 60-second schedule outside the nipmod production stack.

Current deployable monitor target:

- Vercel cron config: `site/vercel.json`
- cron route: `https://nipmod.com/api/monitor`
- authenticated probe route: `https://nipmod.com/api/monitor?probe=1`
- external GitHub Actions runner: `.github/workflows/prod-monitor.yml`

Set `CRON_SECRET` in Vercel. Vercel sends it as `Authorization: Bearer <CRON_SECRET>` for cron invocations, and the route fails closed with `401` or `503` without it. The cron route sends only redacted destination ids and never returns webhook tokens. It checks homepage, Trust, discovery, registry, node and witness health.

The GitHub Actions workflow runs outside the Vercel/Fly runtime on a 15 minute schedule. It executes the full production alert runner plus the node edge resilience smoke. Add `NIPMOD_ALERT_*` repository secrets to make GitHub deliver alerts to external destinations when a production check fails.

Legacy Fly monitor config remains at `tools/fly.monitor.toml` for operators with an active Fly billing account. A large public launch should still use at least two external destinations outside Vercel and Fly plus separate primary and secondary alert tokens.

## Restore Drill

`node tools/restore-drill.mjs` is a non-destructive live restore proof. It does not mutate Fly volumes, Postgres, Gitlawb repositories or witness state.

It proves:

- discovery pins still point to the expected transparency log and witness DID
- discovery pins still point to the expected registry URL, node URL, node health URL, witness health URL and signed checkpoint URL
- the live registry snapshot has at least one recoverable verified package with source provenance, transparency evidence and the pinned witness DID in its package proof
- the checkpoint is signed by the pinned transparency log DID
- the witness health root and tree size match the signed checkpoint
- the public node is healthy
- the selected package bundle is streamed from the public node, stays under the drill size cap and its digest matches the registry
- `git ls-remote` proves the package source tag still resolves to the registry source commit

This does not replace a full Fly volume/Postgres restore drill. It is the safe recurring proof that the public restore criteria are still true between destructive/manual restore exercises.

## Fly Restore Drill

Full restore drills must use disposable targets. Never restore over `nipmod-gitlawb-node-v2`, `nipmod-gitlawb-db-v2` or `nipmod-witness`.

Current production storage:

- Gitlawb node volume: `vol_vz88k12k1ew5w5xv` on app `nipmod-gitlawb-node-v2`
- Witness volume: `vol_4911kywnxq580d5r` on app `nipmod-witness`
- Postgres app: `nipmod-gitlawb-db-v2`

Safe drill sequence:

1. Create fresh Fly volume snapshots for node and witness volumes.
2. Fork each volume into a disposable restore app or disposable volume.
3. Start a one-shot machine with the forked volume mounted read-only where possible.
4. Verify expected files exist:
   - node: `/data/repos`, `/data/keys/identity.pem`
   - witness: `/data/witness-worker-state.json`, `/data/witness-statements.json`, `/data/transparency-witness-identity.json`
5. For Postgres, enable Fly Postgres backups and restore into a new temporary cluster only.
6. Run restore checks against disposable endpoints or local dumps.
7. Destroy disposable restore apps, machines and volumes after recording results.

The Postgres backup feature requires accepting Tigris Terms of Service via Fly. This was approved and enabled for `nipmod-gitlawb-db-v2` on 2026-05-16. Future new Postgres clusters may require the same approval before backup enablement.

## Advisory Quarantine Dry-Run

Use this before public launch, after advisory key rotation, and after changing `audit` or `ci`.

```bash
node tools/advisory-drill.mjs --registry https://nipmod.com/registry/packages.json --target repo-readme-audit --quiet
```

Expected output:

```json
{"advisory":"NIPMOD-2026-9001","auditExitCode":6,"ciExitCode":8,"mode":"dry-run","target":"repo-readme-audit"}
```

The drill writes a temporary registry snapshot, a temporary signed advisory feed and a temporary lockfile under `/tmp`. It does not edit `site/public/advisories.json` or publish an advisory. It requires the local advisory signing key at `.nipmod/advisory-signing-private-key.pem`.

For the real publication workflow, use `docs/incident-publication.md`. Public incident response must publish signed advisory data and quarantine metadata; it must not delete or mutate package content stored on Gitlawb.

## MCP Server

`nipmod mcp serve` starts the newline-delimited stdio MCP server. It must not print anything to stdout except JSON-RPC messages.

Default tools are read-only and non-destructive:

- `nipmod.search`
- `nipmod.inspect`
- `nipmod.install_plan`
- `nipmod.publish_plan`
- `nipmod.verify`
- `nipmod.audit`

The server does not expose mutating `init`, `add`, `install`, `pack`, `publish`, `policy init` or `setup-cloudflare`. `nipmod.publish_plan` is dry run only and returns planned Gitlawb writes as data. Package registry fields, manifests, READMEs and advisory text are returned as data, not as instructions. Custom transparency or advisory trust roots require explicit `allowCustomRoots: true`.

Public host setup docs live at `https://nipmod.com/mcp` and `docs/mcp-hosts.md`.

Smoke test:

```bash
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"smoke","version":"1.0.0"}}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n' | pnpm --dir nipmod exec tsx src/cli.ts mcp serve
```

## Registry Release

1. Publish or republish package content to Gitlawb.
2. Ensure the package version tag exists:

```bash
git ls-remote https://node.nipmod.com/<owner>/<repo>.git
```

3. Rebuild verified registry:

```bash
pnpm --dir site registry:verified
```

4. Build locally:

```bash
pnpm --dir site build
```

5. Deploy:

```bash
cd site
vercel deploy --prod --yes
```

Vercel must print `registry verified for build` before `next build`.

## CLI Release

1. Keep `nipmod/package.json` on an immutable public version. The release builder refuses `0.0.0` and refuses to overwrite an existing release artifact.
2. Keep the release signing private key local at `.nipmod/release-signing-private-key.pem` with mode `600`.
3. Build the signed release:

```bash
node tools/build-nipmod-release.mjs
```

4. Verify the local installer path:

```bash
TMP_DIR="$(mktemp -d)"
NIPMOD_PACKAGE_URL="file://$PWD/site/public/releases/nipmod-0.1.6.tgz" \
NIPMOD_CHECKSUM_URL="file://$PWD/site/public/releases/nipmod-0.1.6.tgz.sha256" \
NIPMOD_SIGNATURE_URL="file://$PWD/site/public/releases/nipmod-0.1.6.tgz.sig" \
NIPMOD_HOME="$TMP_DIR/home" \
NIPMOD_BIN_DIR="$TMP_DIR/bin" \
NIPMOD_SKIP_GITLAWB=1 \
bash site/public/install.sh
rm -rf "$TMP_DIR"
```

The installer must verify checksum, detached Ed25519 signature and package metadata before `npm install --ignore-scripts`.
The post-install check must run `nipmod doctor --offline --json`; only the optional `gitlawb-helper` failure is non-blocking.

## Witness Recovery

The witness is append-only. A missing state file must not silently re-anchor.

Current public pins live in `tools/verified-registry.env`.

If the witness volume is lost:

1. Stop deployment and do not run `/run` blindly.
2. Restore `/data/identity.json` and `/data/witness-state.json` from backup.
3. If restore is impossible, rotate the witness DID deliberately:
   - deploy a new witness identity
   - update `tools/verified-registry.env`
   - rebuild and redeploy the registry
   - document the rotation in `progress.md`

Never derive trusted pins from mutable live endpoints.

Manual witness runs are protected by `NIPMOD_WITNESS_RUN_TOKEN`. Keep it as a Fly secret, never in repo files. If a forced run is needed, rotate a temporary token, deploy it, call `/run` with `Authorization: Bearer <token>`, then rotate again.

If the token is missing, `/run` must fail closed with `503`.

## Node Recovery

Current node:

- Fly app: `nipmod-gitlawb-node-v2`
- Hostname: `node.nipmod.com`
- Region: `fra`

If the node is replaced:

1. Deploy a new node and attach Postgres.
2. Restore or republish package repos.
3. Set Cloudflare DNS-only records for `node.nipmod.com`.
4. Issue Fly certificate.
5. Verify `/health`, `/api/v1/repos`, package blobs and `git ls-remote`.
6. Run `node tools/restore-drill.mjs`.
7. Run `pnpm --dir site registry:verified`.
8. Deploy site only after source provenance and witness checks pass.

## Secret Handling

Local deploy credentials and private signing keys must never be committed or uploaded.

Rules:

- keep `.env*`, `.nipmod/*identity*.json`, `.gitlawb-bin/` and key files ignored
- keep local secret files at mode `600`
- never commit `.nipmod/release-signing-private-key.pem`
- run `pnpm --dir site security:secrets` before shipping
- rotate Cloudflare/Fly tokens from the provider dashboards if they were exposed outside this machine
- rotate transparency log and witness identities if their private keys were shared with any untrusted environment

The current workspace can operate with local credentials, but production trust should assume dashboard tokens and signing keys are sensitive root material.
