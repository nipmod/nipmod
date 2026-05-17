# nipmod quickstart

This is the public first run path. It is designed for a clean macOS or Linux workspace.

## Install

```sh
curl -fsSLO https://nipmod.com/install.sh && bash install.sh
```

Manual verification:

```sh
curl -fLO https://nipmod.com/install.sh
curl -fLO https://nipmod.com/install.sh.sha256
shasum -a 256 -c install.sh.sha256
bash install.sh
```

Expected result:

- The installer finishes and prints the next `nipmod` command.
- `nipmod help` prints the command list and exit codes.

## Check the environment

```sh
nipmod doctor --online
```

Expected result:

- CLI is available.
- Public registry is reachable.
- Missing publish setup is shown as a warning, not an install blocker.

## Find a package

```sh
nipmod search gitlawb
```

Expected result:

- Results include install ready commands.
- Quarantined packages are hidden by default.
- Trust is shown as a level and score.

## Inspect before install

```sh
nipmod inspect pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0
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

## Install into a workspace

Create a demo workspace first. The first lockfile mutation should not happen in an unrelated repo.

```sh
mkdir -p nipmod-demo
cd nipmod-demo
nipmod install gitlawb-repo-reader
```

Expected result:

- `nipmod.lock.json` is written or updated inside `nipmod-demo`.
- The lockfile pins the artifact digest.
- A trust or advisory failure exits before lockfile mutation.

## Restore from the lockfile

```sh
nipmod install
nipmod update --plan
```

Expected result:

- `.nipmod/store` is restored from the lockfile.
- Existing verified store entries are reused.
- `--offline` refuses remote fetches and only uses local store or file URLs.
- `update --plan` shows whether verified root packages are current or can update before mutation.

## Update packages

```sh
nipmod update
```

Expected result:

- Root package updates are fetched from the verified registry.
- Every updated bundle is checked before the lockfile changes.
- Stale package versions are pruned when no root dependency can reach them.

## Explain and audit

```sh
nipmod sbom --json
nipmod explain gitlawb-repo-reader --json
```

Expected result:

- The SBOM lists installed package records from the lockfile.
- Local store bundles are verified before manifest details are included.
- Permission counts and dependency edges are visible for agents and reviewers.
- Explain shows whether the package is root, transitive or orphaned.

```sh
nipmod audit --online
nipmod ci --online
```

Use `sbom` for inventory, `explain` for lockfile reasons, `audit` for a report and `ci` for enforcement. `ci` is the command to run in automation.

## Publish dry run

From a package workspace:

```sh
nipmod init --name @you/example-agent --dir example-agent
cd example-agent
nipmod manifest validate --dir . --json
nipmod publish . --dry-run --json
```

Expected result:

- Manifest validates before packing.
- Dry run prints the package id, digest, Gitlawb helper status, target repo and release event preview.
- No public write occurs in dry run mode.

## Troubleshooting

If install fails, rerun the checksum step and do not pipe the installer into a shell.

Registry commands use the public registry by default. `nipmod install` may fetch digest-pinned remote bundles when the local store is missing or corrupt; pass `--offline` to force local store and file URL use only.

If inspect fails with a custom root message, use public roots or pass `--allow-custom-roots` only for a local test registry.

If install fails with a trust or advisory block, do not force it. Inspect the report, advisory id and permission reasons first.
