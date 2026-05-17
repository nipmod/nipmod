# External Proof Tracks

nipmod can be technically launch ready before external proof is complete. These tracks separate what is already prepared from what only outside people can provide.

| Track | Current | Local work complete | External proof required |
| --- | ---: | --- | --- |
| Gitlawb review signal | 60% | Public source, launch demo, founder post, founder DM, clear non endorsement language. | Gitlawb founder or maintainer explicitly says nipmod fits Gitlawb or links to it. |
| External human audit | 90% | Review packet, reproducible gates, public proof loop, threat model, sign off template. | Independent reviewer signs the packet or publishes findings. |
| Real user adoption | 45% | First user loop, author dry run, repo claim preview, receipt template, redaction rules. | External users submit redacted install/audit/publish evidence. |
| Ecosystem depth | 85% | Verified first party packages cover every launch manifest type. | External package authors publish accepted packages. |

## Prepared asks

### Gitlawb review ask

```text
We built nipmod as a package layer for Gitlawb agents. It keeps Gitlawb as decentralized source and adds verification around install: signed bundles, DID publisher identity, digest-pinned lockfiles, release evidence, transparency proof, witness proof and advisory-aware audit.

Independent project asking for Gitlawb review, not claiming endorsement.

Could you review the trust model against Gitlawb's goals and tell us the strongest objection: should this stay an independent verification layer, become a Gitlawb maintained package path, or expose a smaller Gitlawb package primitive directly?
```

### External audit ask

```text
Please review nipmod as an install trust layer for agent packages on Gitlawb. Focus on signature, digest, transparency, witness, advisory, lockfile and installer bypasses. The review packet generator is `node tools/generate-review-packet.mjs`.
```

### First user ask

```text
Run the first user loop from `docs/adoption.md`, redact secrets and local private paths, then send the result with OS, Node, Git, nipmod version, package inspected, install result and audit result.
```

### External package author ask

```text
Run `nipmod init`, `nipmod manifest validate` and `nipmod publish --dry-run --json` for a package you would actually want an agent to install. Send the redacted registry candidate and any blocker.
```

## Claim rules

- It is correct to say: `nipmod is technically live and ready for external review`.
- It is correct to say: `nipmod is a decentralized package registry layer for Gitlawb agents`.
- Do not claim official Gitlawb status until Gitlawb says so.
- Do not say: `audited` until an independent reviewer signs or publishes a review.
- Do not say: `adopted` from page views, likes or private local tests.
