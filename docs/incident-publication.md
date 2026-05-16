# Incident Publication

This is the operator path for a real package quarantine. It separates decentralized package storage from nipmod's rating layer: Gitlawb content is not deleted, but nipmod can publish signed advisory and registry quarantine metadata so agents stop installing the affected package.

## Inputs

- Reporter contact and timestamp.
- Package canonical id and version.
- Evidence URL or local evidence file.
- Impact summary.
- Proposed severity: `low`, `moderate`, `high` or `critical`.
- Operator decision: `active` or `withdrawn`.

## Decision Rules

- Use `critical` when a package can exfiltrate secrets, execute code, impersonate infrastructure, or mutate user projects without explicit policy approval.
- Use `high` when install or runtime behavior can materially harm a workspace but requires a narrower precondition.
- Use `moderate` or `low` for documentation, provenance or compatibility defects that should warn but not block installs.
- Only `high` and `critical` active quarantine metadata blocks install commands by default.
- Never edit package blobs on Gitlawb as part of incident response. Publish signed nipmod advisories and quarantine metadata instead.

## Dry Run

Before touching public advisory files, prove the intended package would be blocked:

```bash
node tools/advisory-drill.mjs \
  --registry https://nipmod.com/registry/packages.json \
  --target <package-name-or-canonical> \
  --quiet
```

Required result:

- `auditExitCode` is `6`.
- `ciExitCode` is `8`.
- `inspect` and `install --plan` exit `7` in the detailed JSON result.
- No public `site/public/advisories.json` file changes during the drill.

## Publish

1. Edit `site/public/advisories.json`.
2. Add or update one advisory with:
   - stable id `NIPMOD-YYYY-NNNN`
   - exact canonical package id
   - affected version list
   - severity
   - `status: "active"`
   - short title
3. Keep `generatedAt` in UTC and `expiresAt` no more than 30 days ahead.
4. Sign the feed:

```bash
node tools/sign-advisories.mjs
```

5. Add matching registry quarantine metadata for high or critical active incidents.
6. Run the full gate:

```bash
node tools/verify-all.mjs
```

7. Deploy the site:

```bash
pnpm --dir site exec vercel deploy --prod --yes
```

8. Run production verification:

```bash
node tools/verify-all.mjs --prod
```

## Public Update

Publish a short incident note with:

- advisory id
- package id and version
- severity
- install impact
- mitigation
- whether the package is blocked by search, inspect, install plan, add, audit and CI

Do not publish reporter private data, tokens, exploit payloads that enable abuse, or local secret paths.

## Withdraw

1. Change advisory `status` to `withdrawn`.
2. Remove active quarantine metadata or set `status: "withdrawn"`.
3. Re-sign advisories.
4. Run local and production verification.
5. Publish a withdrawal note with the same advisory id.
