# nipmod quickstart

This is the public first run path. It is designed for a clean macOS or Linux workspace.

## Install

```sh
curl -fL https://nipmod.com/install.sh -o install.sh
curl -fL https://nipmod.com/install.sh.sha256 -o install.sh.sha256
shasum -a 256 -c install.sh.sha256
bash install.sh
```

Expected result:

- The checksum command prints `install.sh: OK`.
- `nipmod help` prints the command list and exit codes.

## Check the environment

```sh
nipmod doctor --online
```

Expected result:

- CLI is available.
- Public registry is reachable.
- Gitlawb helper is present or the output explains how to install it with a verified checksum.

## Find a package

```sh
nipmod search gitlawb --online
```

Expected result:

- Results include install ready commands.
- Quarantined packages are hidden by default.
- Trust is shown as a level and score.

## Inspect before install

```sh
nipmod inspect pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0 --online
```

Check these fields before mutation:

- Canonical package id.
- Publisher DID.
- Artifact digest.
- Source tag and release event.
- Transparency proof.
- Witness statement.
- Permissions.
- Advisory status.

## Add to a workspace

```sh
nipmod add gitlawb-repo-reader --online
```

Expected result:

- `nipmod.lock.json` is written or updated.
- The lockfile pins the artifact digest.
- A trust or advisory failure exits before lockfile mutation.

## Audit

```sh
nipmod audit --online
nipmod ci --online
```

Use `audit` for a report and `ci` for enforcement. `ci` is the command to run in automation.

## Publish dry run

From a package workspace:

```sh
nipmod init --name @you/example-agent --dir example-agent
cd example-agent
nipmod manifest validate --json
nipmod publish . --dry-run --json
```

Expected result:

- Manifest validates before packing.
- Dry run prints the package id, digest, Gitlawb helper status, target repo and release event preview.
- No public write occurs in dry run mode.

## Troubleshooting

If install fails, rerun the checksum step and do not pipe the installer into a shell.

If search or inspect fails with a network message, rerun with `--online`. nipmod does not silently use network access for commands that can run offline.

If inspect fails with a custom root message, use public roots or pass `--allow-custom-roots` only for a local test registry.

If add fails with a trust or advisory block, do not force install. Inspect the report, advisory id and permission reasons first.
