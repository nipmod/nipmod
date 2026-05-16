# Audit Readiness

nipmod is audit ready when an external reviewer can reproduce source, deployment, package, registry, witness and recovery claims without private context.

## Required Packet Contents

- commit under review
- production deployment URL
- Gitlawb source URL
- security policy and disclosure metadata
- trust model
- catalog depth matrix
- production gate output
- load smoke output
- synthetic monitor output
- restore drill output
- supply chain check output
- browser test output
- public proof loop transcript
- known limitations
- reviewer sign off fields

## Reviewer Commands

```bash
node tools/verify-all.mjs --prod
node tools/prod-load-smoke.mjs --profile launch
node tools/prod-synthetic-monitor.mjs
node tools/restore-drill.mjs
node tools/supply-chain-check.mjs
pnpm --dir site test:e2e
node tools/public-proof-loop.mjs --registry https://nipmod.com/registry/packages.json
```

## Requirement Mapping

| Requirement | Code path | Test or gate | Failure mode |
| --- | --- | --- | --- |
| Bundle signatures verify | `nipmod/src/bundle.ts` | `pnpm --dir nipmod test` | Install and inspect fail. |
| Registry proof verifies | `site/scripts/verify-registry-before-build.mjs` | `pnpm --dir site build` | Build fails before deploy. |
| Witness continuity holds | `tools/witness-worker.mjs` | `node tools/verify-all.mjs --prod` | Prod gate fails. |
| Advisories block installs | `nipmod/src/audit.ts` | `node tools/advisory-drill.mjs` | Audit and CI fail. |
| Restore path works | `tools/restore-drill.mjs` | `node tools/restore-drill.mjs` | Prod gate fails. |
| Unsafe manifest fields block | `nipmod/src/protocol.ts` | `node tools/public-proof-loop.mjs` | Public proof fails. |

## Status Language

Use `audit ready` only for reproducible packet readiness. Use `independently audited` only after a reviewer signs the packet.
