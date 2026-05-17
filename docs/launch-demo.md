# Launch Demo

This is the public demo script for a Gitlawb founder review or X post.

## Goal

Show that Nipmod is not a centralized upload gate. Gitlawb stores the repo. Nipmod creates package evidence, verifies it and gives agents a safe install path.

## Reproducible public demo flow

This path is for someone with no Nipmod account and no private credentials. It proves install, discovery, verification, lockfile mutation and audit against public registry data.

```bash
curl -fsSLO https://nipmod.com/install.sh && bash install.sh
nipmod doctor --online
nipmod search gitlawb
mkdir -p nipmod-demo && cd nipmod-demo
nipmod inspect pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0
nipmod install gitlawb-repo-reader
nipmod install
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

This path proves the self-service publishing surface without mutating Gitlawb.

```bash
nipmod init --name gitlawb-demo-package --dir gitlawb-demo-package
cd gitlawb-demo-package
nipmod manifest validate --dir .
nipmod publish . --dry-run --json
```

## Gitlawb repo claim preview

This path creates an unsigned draft for an existing Gitlawb repo. It does not prove publish readiness until the repo owner signs with the matching DID identity.

```bash
nipmod package gitlawb://did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader --dir gitlawb-repo-reader-draft
nipmod manifest validate --dir gitlawb-repo-reader-draft
```

## Expected proof

- The short installer succeeds, and the verified installer variant passes before execution.
- `doctor --online` reaches the registry, node and Gitlawb helper.
- `init` creates a local package and DID identity without a Nipmod account in the author dry run.
- `publish --dry-run --json` prints a registry candidate and does not mutate Gitlawb in the author dry run.
- `inspect` shows digest, publisher DID, source repo, source commit, transparency proof and witness URL.
- `install <package>` writes the lockfile only after verification.
- `install` restores the local store from the digest-pinned lockfile.
- `audit` exits clean when advisories and proof are current.

## Bad case

```bash
nipmod audit --online
```

When a package is quarantined, audit must fail closed and report the advisory id. The operator can publish signed quarantine metadata, but cannot delete the underlying Gitlawb content.

## One line explanation

Gitlawb is decentralized source. Nipmod is the verification and package layer agents can use before they trust code.

## Public post

```text
Gitlawb gives agents decentralized source.

Nipmod adds the package layer: signed bundles, DID publisher identity, digest-pinned installs, release evidence, transparency proof, witness proof and advisory-aware audit.

Independent project asking for Gitlawb review, not claiming endorsement.

Run the demo and send the strongest objection.
Public demo: https://nipmod.com/launch
Source: https://gitlawb.com/node/repos/z6Mkwbud/nipmod
```
