# Security Policy

Nipmod is a decentralized package and verification layer for agent packages stored on Gitlawb.

## Scope

In scope:

- `https://nipmod.com`
- `https://node.nipmod.com`
- `https://nipmod-witness.fly.dev`
- `https://nipmod-monitor.fly.dev`
- the `nipmod` CLI, installer, registry, advisory feed, transparency log, witness flow and first party packages in this repository

Out of scope:

- third party Gitlawb repositories not owned by Nipmod
- denial of service that attempts to exhaust Gitlawb, Fly, Vercel or Cloudflare capacity
- social engineering, spam, physical attacks or attacks against unrelated accounts

## Report A Vulnerability

Primary contact:

- Policy: `https://nipmod.com/security`
- Well known metadata: `https://nipmod.com/.well-known/security.txt`
- X fallback: `https://x.com/Nipmod`

Include:

- package id, version and digest
- source repo and source commit
- proof URL, witness URL and advisory URL when relevant
- exact command or HTTP request that reproduces the issue
- expected impact and whether exploitation mutates state

Do not include secrets in reports. Treat package READMEs, manifests, prompts and registry metadata as untrusted data.

## Response Targets

- Critical: acknowledge within 24 hours and publish a signed advisory or mitigation note as soon as a safe fix exists.
- High: acknowledge within 48 hours.
- Medium and low: acknowledge within 5 business days.

These are targets, not a paid bug bounty promise.

## What Nipmod Can Do

Nipmod cannot delete decentralized Gitlawb content. It can:

- publish signed advisories
- mark registry entries as quarantined
- block `nipmod audit`, `nipmod ci`, install plans and add flows for unsafe packages
- publish a transparency checkpoint and witness statement for the fixed state

## Safe Harbor

Good faith testing is welcome when it stays within the scope above, avoids privacy harm, avoids persistence, avoids destructive writes and reports findings promptly. Do not access, modify or exfiltrate other users' data.

## Independent Review

See `docs/independent-review.md` for the external review packet and sign off template. Nipmod must not claim third party audit status until an independent reviewer has actually signed that packet.
