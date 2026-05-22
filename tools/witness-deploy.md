# nipmod Witness Deploy

The witness is the independent external signer that upgrades registry packages from `signed/90` to `verified/100`.

Live witness:

- App: `nipmod-witness`
- URL: `https://nipmod-witness.fly.dev`
- Witness DID: `did:key:z6Mkv8WH5QeiZU1sJwGrCs8xe35AiH4gMfAy86zFMiEkewWJ`
- Log DID: `did:key:z6MkugeJcjgGhG1EpUMhhJ1Q5SoYn65T4cmiuBFE8E82TMyk`

## Fly deploy

This creates one always-on Fly machine and one small persistent volume.

```bash
fly apps create nipmod-witness --org personal
fly volumes create witness_data --app nipmod-witness --region fra --size 1
fly secrets set NIPMOD_WITNESS_BOOTSTRAP=1 --app nipmod-witness
fly secrets set NIPMOD_WITNESS_ALLOWED_LOG_IDS=did:key:z6MkugeJcjgGhG1EpUMhhJ1Q5SoYn65T4cmiuBFE8E82TMyk --app nipmod-witness
RUN_TOKEN=$(openssl rand -hex 32)
printf 'NIPMOD_WITNESS_RUN_TOKEN=%s\n' "$RUN_TOKEN" | fly secrets import --app nipmod-witness --stage
fly deploy --config tools/fly.witness.toml
```

After the first successful `/health`, remove bootstrap so a lost volume cannot silently re-anchor the witness:

```bash
fly secrets unset NIPMOD_WITNESS_BOOTSTRAP --app nipmod-witness
```

## Verify

```bash
curl -fsS https://nipmod-witness.fly.dev/health
curl -fsS https://nipmod-witness.fly.dev/witness-statements.json
curl -i -X POST https://nipmod-witness.fly.dev/run
curl -fsS -X POST -H "Authorization: Bearer $RUN_TOKEN" https://nipmod-witness.fly.dev/run
unset RUN_TOKEN
```

The health response must include the current registry root hash from `https://nipmod.com/transparency/checkpoint.json`.
Unauthenticated manual runs must return `401`. Authenticated forced runs must return `200`.

## Use as registry trust input

Pin both the log identity and witness identity. The registry must not trust arbitrary witness URLs.
Do not derive pins from the live endpoints during release. Use manually audited pins from `tools/verified-registry.env`.

For the current live pins:

```bash
set -a
. tools/verified-registry.env
set +a
node --experimental-strip-types tools/rebuild-verified-registry.ts
```

Expected package trust after a valid external witness:

```json
{
  "level": "verified",
  "score": 100,
  "transparencyLogVerified": true
}
```
