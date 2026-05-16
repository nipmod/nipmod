# nipmod

Gitlawb is decentralized GitHub for agents.
nipmod is decentralized npm for agents.

Public links:

- Website: https://nipmod.com
- X: https://x.com/Nipmod
- Gitlawb source: https://gitlawb.com/z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R/nipmod

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
- Standalone CLI release artifact at `/releases/nipmod-0.1.21.tgz`
- Detached Ed25519 release signatures for CLI artifacts
- Signed public transparency log under `/transparency/*`
- Live independent witness at `https://nipmod-witness.fly.dev`
- Agent discovery manifest at `https://nipmod.com/.well-known/nipmod.json`
- Public advisory feed at `https://nipmod.com/advisories.json`
- `nipmod audit` for installed package lockfiles
- `nipmod ci` for strict lockfile enforcement in automation
- `nipmod inspect`, `install --plan` and `add` for verified registry packages
- `nipmod policy init`, `policy check` and `policy explain` for local install policy decisions
- `nipmod mcp serve` with read-only agent tools for search, inspect, install plans, verify and audit
- Public MCP host setup guide at `https://nipmod.com/mcp` and `docs/mcp-hosts.md`
- Public compatibility receipts for MCP server JSON, APM package JSON and Git source provenance examples
- Verified registry build guard for the Vercel site
- Local Cloudflare setup page via `nipmod setup-cloudflare`
- Production runbook in `RUNBOOK.md`

## Current CLI flow

```bash
curl -fLO https://nipmod.com/install.sh
printf '%s  install.sh\n' f0adffc43c905c0d44c804822cf1e1b26c41d2b27d08d36f58e857f7cc7a32d1 | shasum -a 256 -c -
bash install.sh
nipmod doctor
nipmod search skill --online
nipmod inspect pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0 --online
nipmod install --plan pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0 --online
nipmod add pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0 --online
nipmod policy init
nipmod policy explain pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0 --online
nipmod policy check
nipmod audit --online
nipmod ci --online
nipmod init --name gitlawb-repo-reader --dir gitlawb-repo-reader
nipmod manifest validate --dir gitlawb-repo-reader
nipmod publish gitlawb-repo-reader --dry-run
nipmod publish gitlawb-repo-reader
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
```

See `RUNBOOK.md` for deploy, recovery, witness and token-handling procedures.
See `docs/mcp-hosts.md` for Codex, Claude Code and OpenCode MCP setup.
See `docs/quickstart.md`, `docs/publish.md`, `docs/packages.md`, `docs/trust-model.md` and `docs/cli-contract.md` for public launch onboarding.

Canonical public brand:

- Website: `https://nipmod.com`
- X: `https://x.com/Nipmod`
- Gitlawb source: `https://gitlawb.com/z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R/nipmod`
- DNS: Cloudflare
