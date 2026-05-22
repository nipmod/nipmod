# Public Launch Packet

This is the public material to send to Gitlawb founders, agent builders or reviewers. It should be honest: Nipmod is technically live, but external adoption and independent review are still earned in public.

## Founder pitch

Gitlawb already gives agents decentralized source. Nipmod adds the package layer agents need before they execute code from that source: signed bundles, digest-pinned installs, DID publisher identity, release evidence, transparency proof, witness evidence and advisory-aware audit.

Nipmod does not decide who can publish to Gitlawb and does not delete Gitlawb content. It verifies packages over Gitlawb content so agents can search, inspect, install, lock and audit before trusting code.

## Public demo

```bash
curl https://nipmod.com/i|bash
nipmod doctor --online
nipmod search gitlawb
mkdir -p nipmod-demo && cd nipmod-demo
nipmod inspect pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0
nipmod install gitlawb-repo-reader
nipmod install
nipmod outdated
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

## Gitlawb repo package patch preview

This path creates a PR-ready local package patch for an existing Gitlawb repo without remote writes. Publishing the package still requires the matching owner DID identity.

```bash
nipmod package pr gitlawb://did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader --dir gitlawb-repo-reader-pr
nipmod claim verify gitlawb://did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader --json
```

## Public post

```text
Gitlawb gives agents decentralized source.

Nipmod adds the package layer: signed bundles, DID publisher identity, digest-pinned installs, release evidence, transparency proof, witness proof and advisory-aware audit.

Independent project asking for Gitlawb review, not claiming endorsement.

Run the demo and send the strongest objection.
Public demo: https://nipmod.com/launch
Source: https://gitlawb.com/node/repos/z6Mkwbud/nipmod
```

## Founder DM

```text
We built Nipmod as a package layer for Gitlawb agents. It keeps Gitlawb as decentralized source and adds verification around install: signed bundles, DID publisher identity, digest-pinned lockfiles, release evidence, transparency proof, witness proof and advisory-aware audit.

Independent project asking for Gitlawb review, not claiming endorsement.

Could you review the trust model against Gitlawb's goals and tell us the strongest objection: should this stay an independent package-verification layer, become a Gitlawb maintained package path, or expose a smaller Gitlawb package primitive directly?
```

## Review links

- Website: https://nipmod.com
- Telegram: https://t.me/nipmod
- Launch path: https://nipmod.com/launch
- Source: https://gitlawb.com/node/repos/z6Mkwbud/nipmod
- Registry: https://nipmod.com/registry/packages.json
- Transparency checkpoint: https://nipmod.com/transparency/checkpoint.json
- Security policy: https://nipmod.com/security
- Review packet: https://nipmod.com/review/packet.json
- Review packet markdown: https://nipmod.com/review/packet.md
- Evidence manifest: https://nipmod.com/review/evidence-manifest.json
- Evidence ledger: https://nipmod.com/review/evidence-ledger.json
- Review packet source: docs/independent-review.md
- Review packet generator: `node --experimental-strip-types tools/generate-review-packet.ts review-packet.md --evidence-dir <dir>`
- Catalog depth: docs/catalog-depth.md
- Adoption readiness: docs/adoption-readiness.md
- External proof tracks: docs/external-proof-tracks.md
- External evidence ledger: docs/external-evidence-ledger.md

## External proof tracks

| Track | State | What is ready | What still needs outside proof |
| --- | --- | --- | --- |
| Gitlawb review signal | Prepared, 0 maintainer responses | Founder post, DM, public source and demo. | Gitlawb founder or maintainer response. |
| External human audit | Prepared, 0 signed reviews | Review packet, gates, proof loop and sign off template. | Independent reviewer signature or published findings. |
| Real user adoption | Waiting, 0 receipts | First user loop, author dry run, repo package patch preview and receipt template. | External redacted user receipts. |
| Ecosystem depth | First party ready, 0 external packages | Verified first party packages cover every launch manifest type. | External packages accepted into the registry. |

## What not to claim

- Do not claim Gitlawb endorsement before Gitlawb says so.
- Do not claim mature ecosystem adoption before external users and publishers exist.
- Do not claim Nipmod controls decentralized publishing. It only verifies, ranks, locks and audits packages.
