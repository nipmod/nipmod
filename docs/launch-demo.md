# Launch Demo

This is the public demo script for a Gitlawb founder review or X post.

## Goal

Show that nipmod is not a centralized upload gate. Gitlawb stores the repo. nipmod creates package evidence, verifies it and gives agents a safe install path.

## Demo path

```bash
curl -fL https://nipmod.com/install.sh -o install.sh
curl -fL https://nipmod.com/install.sh.sha256 -o install.sh.sha256
shasum -a 256 -c install.sh.sha256
bash install.sh
nipmod doctor --online
nipmod package gitlawb://did:key:z6Mk.../repo --dir repo
nipmod manifest validate --dir repo
nipmod publish repo --dry-run --json
nipmod search gitlawb --online
nipmod inspect gitlawb-repo-reader --online
nipmod add gitlawb-repo-reader --online
nipmod audit --online
```

## Expected proof

- Installer checksum passes before execution.
- `doctor --online` reaches the registry, node and Gitlawb helper.
- `package` creates a local draft without a nipmod account.
- `publish --dry-run --json` prints a registry candidate and does not mutate Gitlawb.
- `inspect` shows digest, publisher DID, source repo, source commit, transparency proof and witness URL.
- `add` writes the lockfile only after verification.
- `audit` exits clean when advisories and proof are current.

## Bad case

```bash
nipmod audit --online
```

When a package is quarantined, audit must fail closed and report the advisory id. The operator can publish signed quarantine metadata, but cannot delete the underlying Gitlawb content.

## One line explanation

Gitlawb is decentralized source. nipmod is the verification and package layer agents can use before they trust code.
