# nipmod

Gitlawb is decentralized GitHub for agents.
nipmod is decentralized npm for agents.

Public links:

- Website: https://nipmod.com
- X: https://x.com/Nipmod
- Gitlawb source: https://gitlawb.com/z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R/nipmod

## Founder-facing pitch

Gitlawb already gives agents decentralized source. nipmod adds the package layer agents need before they execute code from that source: signed bundles, digest-pinned installs, DID publisher identity, release evidence, transparency proof, witness evidence and advisory-aware audit.

The pitch is narrow: not a new Gitlawb authority, not a central upload gate. Gitlawb remains the source of repos and content. nipmod is the verification, discovery and lockfile layer that lets agents answer: who published this, what exact bytes am I installing, what source commit produced it, and is there current safety evidence against it?

nipmod is a decentralized capability dependency layer for agents. It packages, signs, verifies and installs agent capabilities such as skills, MCP servers, tool bundles and workflow packs by DID, digest and policy.

Current implementation status:

- Local TypeScript protocol core under `nipmod/`
- Deterministic `.nipmod` bundles
- Ed25519 `did:key` identities
- Signed bundle verification
- Install lockfiles pinned by external `sha256-...` integrity
- Public Gitlawb publish/install against `https://node.nipmod.com`
- `nipmod doctor` setup checks for Git, Gitlawb helper and node health
- Public installer at `https://nipmod.com/install.sh`
- Standalone CLI release artifact at `/releases/nipmod-0.1.33.tgz`
- Detached Ed25519 release signatures for CLI artifacts
- Signed public transparency log under `/transparency/*`
- Live independent witness at `https://nipmod-witness.fly.dev`
- Agent discovery manifest at `https://nipmod.com/.well-known/nipmod.json`
- Public security policy at `https://nipmod.com/security` and `https://nipmod.com/.well-known/security.txt`
- Public advisory feed at `https://nipmod.com/advisories.json`
- `nipmod audit` for installed package lockfiles
- `nipmod ci` for strict lockfile enforcement in automation
- `nipmod update` and `nipmod update --plan` for verified root package updates
- `nipmod sbom` for verified agent capability SBOM output from lockfiles
- `nipmod explain` for lockfile root and dependency path explanations
- `nipmod view`, `inspect`, `install --plan` and `add` for verified registry packages
- `nipmod policy init`, `policy check` and `policy explain` for local install policy decisions
- `nipmod mcp serve` with read-only agent tools for search, view, inspect, install plans, update plans, explain, SBOM, verify and audit plus a gated publish dry run
- Public MCP host setup guide at `https://nipmod.com/mcp` and `docs/mcp-hosts.md`
- Public compatibility receipts for MCP server JSON, APM package JSON and Git source provenance examples
- Verified registry build guard for the Vercel site
- Local Cloudflare setup page via `nipmod setup-cloudflare`
- Production runbook in `RUNBOOK.md`

## Current CLI flow

Standard install:

```bash
curl -fsSLO https://nipmod.com/install.sh && bash install.sh
```

Manual verification:

```bash
curl -fLO https://nipmod.com/install.sh
curl -fLO https://nipmod.com/install.sh.sha256
shasum -a 256 -c install.sh.sha256
bash install.sh
```

First package:

```bash
nipmod doctor --online
nipmod search gitlawb --online
nipmod inspect pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0 --online
nipmod install --plan pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0 --online
mkdir -p nipmod-demo
cd nipmod-demo
nipmod install gitlawb-repo-reader --online
nipmod install
nipmod update --plan --online
nipmod sbom --json
nipmod explain gitlawb-repo-reader --json
nipmod audit --online
nipmod ci --online
```

Author dry run:

```bash
nipmod init --name gitlawb-demo-package --dir gitlawb-demo-package
cd gitlawb-demo-package
nipmod manifest validate --dir . --json
nipmod publish . --dry-run --json
```

Advanced local policy flow:

```bash
nipmod install --plan pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0 --online
nipmod policy init
nipmod policy explain pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0 --online
nipmod policy check
nipmod package gitlawb://did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader --dir gitlawb-demo-package
```

Publish returns the canonical package id and digest. `add` verifies registry evidence, fetches the signed bundle and writes `nipmod.lock.json`. Low-level installs remain direct from Gitlawb and digest-strict:

Compatibility receipts are published at `https://nipmod.com/compatibility/receipts.json`. They bind external package formats to the exact verified nipmod package digest, Gitlawb source repo, source commit and source tag without claiming conversion if provenance was lost.

```bash
nipmod install pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0 \
  --integrity sha256-...
```

`git-remote-gitlawb` is discovered automatically from `PATH` or `NIPMOD_GITLAWB_HELPER`. Install does not need the helper.

## Operator flow

```bash
pnpm --dir nipmod test
pnpm --dir site test
pnpm --dir site registry:verified
pnpm --dir site build
pnpm --dir site security:secrets
node tools/supply-chain-check.mjs
```

See `RUNBOOK.md` for deploy, recovery, witness and token-handling procedures.
See `docs/mcp-hosts.md` for Codex, Claude Code and OpenCode MCP setup.
See `docs/quickstart.md`, `docs/publish.md`, `docs/packages.md`, `docs/trust-model.md` and `docs/cli-contract.md` for public launch onboarding.
See `docs/community.md` for package expectations, feedback links and founder outreach copy.
See `SECURITY.md` and `docs/independent-review.md` for disclosure scope and external review readiness.
See `docs/catalog-depth.md`, `docs/audit-readiness.md`, `docs/adoption-readiness.md` and `docs/external-evidence-ledger.md` for launch readiness evidence.
See `docs/adoption.md`, `docs/self-service-publishing.md` and `docs/multi-source-registry.md` for the remaining ecosystem scale paths.
See `docs/launch-demo.md` for the public demo script.
See `docs/ecosystem-packages.md` for the first party package catalog.
See `docs/public-launch-packet.md` for the public post, founder DM and review checklist.

Canonical public brand:

- Website: `https://nipmod.com`
- X: `https://x.com/Nipmod`
- Gitlawb source: `https://gitlawb.com/z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R/nipmod`
- DNS: Cloudflare
