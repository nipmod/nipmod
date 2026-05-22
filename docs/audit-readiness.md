# Audit Readiness

Nipmod is audit ready when an external reviewer can reproduce source, deployment, package, registry, witness and recovery claims without private context.

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
node --experimental-strip-types tools/verify-all.ts --prod
node --experimental-strip-types tools/prod-load-smoke.ts --profile launch
node --experimental-strip-types tools/prod-synthetic-monitor.ts
node --experimental-strip-types tools/restore-drill.ts
node --experimental-strip-types tools/supply-chain-check.ts
pnpm --dir site test:e2e
node --experimental-strip-types tools/public-proof-loop.ts --registry https://nipmod.com/registry/packages.json
```

## Requirement Mapping

| Requirement | Code path | Test or gate | Failure mode |
| --- | --- | --- | --- |
| Bundle signatures verify | `nipmod/src/bundle.ts` | `pnpm --dir nipmod test` | Install and inspect fail. |
| Registry proof verifies | `site/scripts/verify-registry-before-build.ts` | `pnpm --dir site build` | Build fails before deploy. |
| Witness continuity holds | `tools/witness-worker.ts` | `node --experimental-strip-types tools/verify-all.ts --prod` | Prod gate fails. |
| Advisories block installs | `nipmod/src/audit.ts` | `node --experimental-strip-types tools/advisory-drill.ts` | Audit and CI fail. |
| Restore path works | `tools/restore-drill.ts` | `node --experimental-strip-types tools/restore-drill.ts` | Prod gate fails. |
| Unsafe manifest fields block | `nipmod/src/protocol.ts` | `node --experimental-strip-types tools/public-proof-loop.ts` | Public proof fails. |

## Status Language

Use `audit ready` only for reproducible packet readiness. Use `independently audited` only after a reviewer signs the packet.
