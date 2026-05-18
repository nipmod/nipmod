# Nipmod

Gitlawb gives agents decentralized source control.
Nipmod is the verifiable package layer for Gitlawb agent code.

Public links:

- Website: https://nipmod.com
- X: https://x.com/Nipmod
- Bankr token: https://bankr.bot/launches/0x5155Eaa3B5784B829DeAD78189Eb4Bf69359dbA3
- Gitlawb source: https://gitlawb.com/node/repos/z6Mkwbud/nipmod
- Agent discovery: https://nipmod.com/.well-known/nipmod.json
- Registry: https://nipmod.com/registry/packages.json
- Scout: https://nipmod.com/scout/candidates
- Scout drafts: https://nipmod.com/scout/drafts

## Founder-facing pitch

Gitlawb gives agents decentralized source. Nipmod adds the install layer agents need before they execute code from that source: signed bundles, digest-pinned installs, DID publisher identity, release evidence, transparency proof, witness evidence and advisory-aware audit.

Nipmod is not a Gitlawb authority and not a central upload gate. Gitlawb remains the source of repos and code. Nipmod verifies, indexes, locks and audits packages so agents can answer four questions before install:

- Who published this package?
- What exact bytes am I installing?
- Which Gitlawb source commit produced it?
- Is there current trust, witness and advisory evidence?

## What works now

- CLI release `1.2.0` with signed installer and signed tarball.
- Public verified registry sourced from Gitlawb.
- Install, add, update, audit, CI, SBOM and explain commands.
- Deterministic `.nipmod` bundles signed by Ed25519 `did:key` identities.
- Lockfiles pinned by `sha256` integrity.
- Gitlawb publish and install against `https://node.nipmod.com`.
- Package Claim for proving that a Gitlawb repo owner accepts a Nipmod package identity.
- Package PR generator for turning an existing Gitlawb repo into a local package patch without remote writes.
- Scout Agent that continuously scans public Gitlawb repos and exposes package-ready candidates plus claim-safe package drafts.
- Read-only MCP server for agents.
- Public transparency log, witness statements, advisory feed, security policy and review packet.

## Install

Requirements: Node.js 22 or newer, npm, Git, curl and tar. The CLI is not published to npm; install uses the signed release installer from `nipmod.com`.

Standard:

```bash
curl -fsSLO https://nipmod.com/install.sh && bash install.sh
```

Manual checksum verification:

```bash
curl -fLO https://nipmod.com/install.sh
curl -fLO https://nipmod.com/install.sh.sha256
shasum -a 256 -c install.sh.sha256
bash install.sh
```

## First package

```bash
nipmod doctor --online
nipmod search gitlawb --online
nipmod inspect pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0
nipmod install --plan pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0
mkdir -p nipmod-demo
cd nipmod-demo
nipmod install gitlawb-repo-reader
nipmod install
nipmod update --plan
nipmod sbom --json
nipmod explain gitlawb-repo-reader --json
nipmod audit --online
nipmod ci --online
```

## Publish dry run

```bash
nipmod init --name gitlawb-demo-package --dir gitlawb-demo-package
cd gitlawb-demo-package
nipmod manifest validate --dir . --json
nipmod publish . --dry-run --json
```

## Turn a Gitlawb repo into a package patch

```bash
curl -fsS "https://nipmod.com/scout/draft?repo=gitlawb://did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader"
nipmod package pr gitlawb://did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader --dir gitlawb-repo-reader-pr
nipmod claim gitlawb://did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader --dir . --identity .nipmod/identity.json
nipmod claim verify gitlawb://did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader --json
```

Scout drafts and `package pr` write local files only. The Gitlawb repo owner can review the patch, sign the claim with the matching DID identity and push it through Gitlawb.

## Agent surfaces

- Discovery manifest: `https://nipmod.com/.well-known/nipmod.json`
- Agent runbook: `https://nipmod.com/quickstart#agents`
- MCP docs: `https://nipmod.com/mcp`
- Package candidates: `https://nipmod.com/candidates`
- Scout API: `https://nipmod.com/scout/candidates`
- Scout drafts: `https://nipmod.com/scout/drafts`

## Operator flow

```bash
pnpm --dir nipmod test
pnpm --dir site test
pnpm --dir site registry:verified
pnpm --dir site build
pnpm --dir site security:secrets
node tools/supply-chain-check.mjs
```

## Docs

- Runbook: `RUNBOOK.md`
- Quickstart: `docs/quickstart.md`
- Publishing: `docs/publish.md`
- Package Claim: `docs/package-claim.md`
- Scout Agent: `docs/scout-agent.md`
- MCP hosts: `docs/mcp-hosts.md`
- Public launch packet: `docs/public-launch-packet.md`
- Security: `SECURITY.md`
