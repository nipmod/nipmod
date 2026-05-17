# Nipmod Review Packet

Nipmod is technically live and ready for external review. It is not officially endorsed by Gitlawb and is not yet independently audited.

## Public targets

- Website: https://nipmod.com
- Source: https://gitlawb.com/z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R/nipmod
- Launch: https://nipmod.com/launch
- Security: https://nipmod.com/security
- Discovery: https://nipmod.com/.well-known/nipmod.json
- Registry: https://nipmod.com/registry/packages.json
- Proof transcript: https://nipmod.com/proof/transcript.json
- Evidence ledger: https://nipmod.com/review/evidence-ledger.json
- Evidence manifest: https://nipmod.com/review/evidence-manifest.json

## Required commands

```bash
node tools/verify-all.mjs --prod
node tools/prod-load-smoke.mjs --profile launch
node tools/prod-synthetic-monitor.mjs
node tools/restore-drill.mjs
node tools/supply-chain-check.mjs
pnpm --dir site test:e2e
node tools/public-proof-loop.mjs --registry https://nipmod.com/registry/packages.json
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
