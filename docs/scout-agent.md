# Nipmod Scout Agent

Scout Agent is the read only service that keeps Nipmod close to Gitlawb without taking control of anyone's repo.

It runs continuously, scans public Gitlawb repositories, checks the public claim index and exposes package-ready candidates and claim-safe package drafts for humans and agents.

## Contract

Scout Agent never writes to Gitlawb.

It does:

- read public repo metadata from `https://node.nipmod.com/api/v1/repos`
- filter public DID owned repos
- ignore probe repos
- score package readiness
- mark candidates as claimed only when the claim index verifies
- prepare unsigned package drafts from public repo metadata
- expose package patch JSON that owners or agents can apply locally

It does not:

- create issues
- create pull requests
- publish packages
- claim ownership
- write package drafts back to Gitlawb
- use X, GitHub or email as ownership proof
- store secrets

## Public API

```text
GET https://nipmod.com/scout/health
GET https://nipmod.com/scout/last
GET https://nipmod.com/scout/candidates
GET https://nipmod.com/scout/drafts
GET https://nipmod.com/scout/draft?repo=gitlawb://did:key:.../repo
GET https://nipmod.com/scout/patch?repo=gitlawb://did:key:.../repo
```

`/candidates` returns the current machine-readable list:

```json
{
  "type": "dev.nipmod.scout-candidates.v1",
  "formatVersion": 1,
  "ok": true,
  "candidates": []
}
```

`/drafts` returns all current package drafts Scout can prepare without remote writes:

```json
{
  "type": "dev.nipmod.scout-drafts.v1",
  "formatVersion": 1,
  "ok": true,
  "summary": {
    "drafts": 12,
    "unclaimedDrafts": 9
  },
  "drafts": []
}
```

`/draft?repo=...` returns one claim-safe package draft:

```json
{
  "type": "dev.nipmod.package-draft.v1",
  "remoteWrites": false,
  "claim": {
    "required": true,
    "command": "nipmod claim gitlawb://did:key:.../repo --dir . --identity .nipmod/identity.json",
    "verifyCommand": "nipmod claim verify gitlawb://did:key:.../repo --json"
  },
  "files": [
    { "path": "nipmod.json", "content": "..." },
    { "path": "README.nipmod.md", "content": "..." }
  ]
}
```

`/patch` returns files and next commands only:

```json
{
  "type": "dev.nipmod.package-patch.v1",
  "remoteWrites": false,
  "files": [
    { "path": "nipmod.json", "content": "..." },
    { "path": "README.nipmod.md", "content": "..." }
  ],
  "nextCommands": [
    "git add nipmod.json README.nipmod.md",
    "git commit -m \"feat: add nipmod package manifest\"",
    "GITLAWB_NODE=https://node.nipmod.com git push"
  ]
}
```

## Production Runtime

The public Scout API is served under `https://nipmod.com/scout`.

The same contract can also run as a dedicated always-on Fly service from:

```text
tools/fly.scout.toml
tools/Dockerfile.scout
```

That dedicated runtime uses `auto_stop_machines = "off"` and `min_machines_running = 1`.

## Agent Flow

1. Fetch `https://nipmod.com/.well-known/nipmod.json`.
2. Read `manifest.scout.candidates`.
3. Pick a candidate.
4. Fetch `manifest.scout.draft?repo=<gitlawb source>` for the full claim-safe draft.
5. From the repo checkout, run the first returned command: `nipmod package pr <repo> --dir . --identity .nipmod/identity.json --json`.
6. Commit the returned files plus `.nipmod/package-claim.json`.
7. Push with `GITLAWB_NODE=https://node.nipmod.com`.
8. Run the returned `claim.verifyCommand`.

Only the Gitlawb repo owner can make a candidate claimed.
