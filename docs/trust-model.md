# Trust model

Nipmod treats Gitlawb as decentralized transport and storage. Package truth comes from signed evidence.

## Roles

Publisher:

- Owns the DID signing key.
- Publishes source and bundles through Gitlawb.
- Signs the package bundle and release event.

Registry:

- Indexes packages.
- Scores trust evidence.
- Shows advisories and quarantine state.
- Does not own package publishing rights.

Transparency log:

- Commits release evidence into an append only tree.
- Publishes a signed checkpoint.

Witness:

- Co signs observed checkpoints.
- Makes silent log rewrites detectable.

CLI:

- Verifies digests, signatures, proofs, witness statements, permissions and advisories before install surfaces are green.

## Green verdict requirements

A package can be `verified/100` only when these facts pass:

- Canonical package id.
- Publisher DID.
- Artifact digest.
- Signed bundle.
- Signed release event.
- Permission manifest.
- Immutable source ref.
- Transparency proof.
- Witness proof.
- Advisory status.

## Failure behavior

Search hides quarantined packages by default.

Inspect fails closed when verified registry evidence contradicts proof.

Install commands and install plans exit before lockfile mutation when trust, policy or advisory checks fail.

CI exits nonzero when a lockfile can no longer be verified.

## Decentralization boundary

Nipmod should not need privileged access to Gitlawb publishing. Anyone can publish to the underlying transport if Gitlawb allows it. Nipmod can refuse to recommend, install or mark a package green.

That is the same boundary as a market data layer: it can rate and warn, but it does not become the exchange.

## Gitlawb boundary

Gitlawb stores repos, refs and blobs. Nipmod does not treat a moving Gitlawb ref as enough trust by itself. Install trust comes from the package digest, bundle signature, signed release event, transparency inclusion, witness statement and advisory state.

Publish uses `git-remote-gitlawb` and a package slug that Gitlawb can store as a repo name. Run `nipmod setup gitlawb` to install the helper from a checksum verified Gitlawb release with `https://node.nipmod.com` as the default node. Dotted or scoped names can be used for local drafts only when their canonical slug resolves to a Gitlawb compatible repo name.
