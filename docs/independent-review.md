# Independent Review Packet

nipmod must not claim third party audit status until an independent reviewer has signed this packet.

## Review Target

- Website: `https://nipmod.com`
- Source: `https://gitlawb.com/z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R/nipmod`
- Discovery: `https://nipmod.com/.well-known/nipmod.json`
- Security policy: `https://nipmod.com/security`
- Security metadata: `https://nipmod.com/.well-known/security.txt`

## Required Evidence

Attach or link:

- git commit under review
- `node tools/verify-all.mjs --prod` output
- `node tools/prod-load-smoke.mjs --profile launch` output
- `node tools/prod-synthetic-monitor.mjs` output
- `node tools/restore-drill.mjs` output
- `node tools/supply-chain-check.mjs` output
- browser test output for the public site
- known limitations and accepted risks

Generate the packet:

```bash
node tools/generate-review-packet.mjs /tmp/nipmod-review-packet.md
```

## Threat Model Focus

Reviewers should focus on:

- malicious package metadata as untrusted agent input
- digest, signature, transparency and witness bypasses
- advisory quarantine bypasses
- lockfile mutation safety
- installer and release artifact integrity
- public node unauthenticated write probes
- monitor and alert disclosure
- Gitlawb dependency and decentralized content limits

## Sign Off

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
