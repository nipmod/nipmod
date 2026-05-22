# Nipmod Review Packet

Nipmod is technically live and ready for an external review. It is not officially endorsed by Gitlawb and is not yet independently audited.

## Public targets

- Website: https://nipmod.com
- Source: https://gitlawb.com/node/repos/z6Mkwbud/nipmod
- Launch: https://nipmod.com/launch
- Security: https://nipmod.com/security
- Discovery: https://nipmod.com/.well-known/nipmod.json
- Registry: https://nipmod.com/registry/packages.json
- Proof transcript: https://nipmod.com/proof/transcript.json
- Evidence ledger: https://nipmod.com/review/evidence-ledger.json
- Evidence manifest: https://nipmod.com/review/evidence-manifest.json

## Review scope

- Source ref: main
- Commit policy: reviewer resolves the exact Gitlawb commit before signing external evidence.
- Evidence status: checklist and public proof links, not an external audit result.
- External receipt count: zero first user receipts, zero signed independent reviews.

## Required commands

```bash
node --experimental-strip-types tools/verify-all.ts --prod
node --experimental-strip-types tools/prod-load-smoke.ts --profile launch
node --experimental-strip-types tools/prod-synthetic-monitor.ts
node --experimental-strip-types tools/restore-drill.ts
node --experimental-strip-types tools/supply-chain-check.ts
pnpm --dir site test:e2e
node --experimental-strip-types tools/public-proof-loop.ts --registry https://nipmod.com/registry/packages.json
```

## Sign off

```text
Reviewer:
Organization:
Date:
Commit:
Scope:
Result:
Critical findings:
High findings:
Medium findings:
Residual risks:
Signature:
```
