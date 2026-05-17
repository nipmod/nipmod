# Public Launch Packet

This is the public material to send to Gitlawb founders, agent builders or reviewers. It should be honest: nipmod is technically live, but external adoption and independent review are still earned in public.

## Founder pitch

Gitlawb already gives agents decentralized source. nipmod adds the package layer agents need before they execute code from that source: signed bundles, digest-pinned installs, DID publisher identity, release evidence, transparency proof, witness evidence and advisory-aware audit.

nipmod does not decide who can publish to Gitlawb and does not delete Gitlawb content. It verifies packages over Gitlawb content so agents can search, inspect, add, lock and audit before trusting code.

## Public demo

```bash
curl -fsSLO https://nipmod.com/install.sh && bash install.sh
nipmod doctor --online
nipmod search gitlawb --online
mkdir -p nipmod-demo && cd nipmod-demo
nipmod inspect pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0 --online
nipmod add gitlawb-repo-reader --online
nipmod install
nipmod outdated --online
nipmod audit --online
```

## Verified installer variant

Use this installer step when the reviewer wants to verify the script checksum before execution.

```bash
curl -fLO https://nipmod.com/install.sh
curl -fLO https://nipmod.com/install.sh.sha256
shasum -a 256 -c install.sh.sha256
bash install.sh
```

## Author dry run

```bash
nipmod init --name gitlawb-demo-package --dir gitlawb-demo-package
cd gitlawb-demo-package
nipmod manifest validate --dir .
nipmod publish . --dry-run --json
```

## Gitlawb repo claim preview

This path creates a package draft for an existing Gitlawb repo without claiming ownership. Publishing the draft requires the matching owner DID identity.

```bash
nipmod package gitlawb://did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader --dir gitlawb-repo-reader-draft
nipmod manifest validate --dir gitlawb-repo-reader-draft
```

## Public post

```text
Gitlawb gives agents decentralized source.

nipmod adds the package layer: signed bundles, DID publisher identity, digest-pinned installs, release evidence, transparency proof, witness proof and advisory-aware audit.

Public demo: https://nipmod.com/launch
Source: https://gitlawb.com/z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R/nipmod
```

## Founder DM

```text
We built nipmod as a package layer for Gitlawb agents. It keeps Gitlawb as decentralized source and adds verification around install: signed bundles, DID publisher identity, digest-pinned lockfiles, release evidence, transparency proof, witness proof and advisory-aware audit.

Could you review the trust model against Gitlawb's goals and tell us the strongest objection: should this stay an independent package-verification layer, become a Gitlawb-native package path, or expose a smaller Gitlawb package primitive directly?
```

## Review links

- Website: https://nipmod.com
- Launch path: https://nipmod.com/launch
- Source: https://gitlawb.com/z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R/nipmod
- Registry: https://nipmod.com/registry/packages.json
- Transparency checkpoint: https://nipmod.com/transparency/checkpoint.json
- Security policy: https://nipmod.com/security
- Review packet source: docs/independent-review.md
- Review packet generator: `node tools/generate-review-packet.mjs review-packet.md --evidence-dir <dir>`
- Catalog depth: docs/catalog-depth.md
- Adoption readiness: docs/adoption-readiness.md
- External evidence ledger: docs/external-evidence-ledger.md

## What not to claim

- Do not claim Gitlawb endorsement before Gitlawb says so.
- Do not claim mature ecosystem adoption before external users and publishers exist.
- Do not claim nipmod controls decentralized publishing. It only verifies, ranks, locks and audits packages.
