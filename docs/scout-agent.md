# Nipmod Scout Agent

Scout Agent is the read mostly service that keeps Nipmod close to Gitlawb without taking control of anyone's repo.

It runs continuously, scans public Gitlawb repositories, checks the public claim index and exposes package-ready candidates, claim-safe package drafts and owner notification plans for humans and agents.

## Contract

The public Scout API never writes to Gitlawb.

It does:

- read public repo metadata from `https://node.nipmod.com/api/v1/repos`
- filter public DID owned repos
- ignore probe repos
- score package readiness
- mark candidates as claimed only when the claim index verifies
- prepare unsigned package drafts from public repo metadata
- expose package patch JSON that owners or agents can apply locally
- expose dry run owner notification plans for unclaimed unpublished drafts
- optionally deliver deduped Gitlawb issue notifications only through an authenticated operator run

It does not:

- create issues from public GET routes
- create pull requests
- publish packages
- claim ownership
- write package drafts back to Gitlawb
- use X, GitHub or email as ownership proof
- store secrets
- notify already claimed or already published packages
- notify when the claim index or registry snapshot is stale

## Public API

```text
GET https://nipmod.com/scout/health
GET https://nipmod.com/scout/last
GET https://nipmod.com/scout/candidates
GET https://nipmod.com/scout/drafts
GET https://nipmod.com/scout/draft?repo=gitlawb://did:key:.../repo
GET https://nipmod.com/scout/patch?repo=gitlawb://did:key:.../repo
GET https://nipmod.com/scout/notifications
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

`/notifications` returns the public dry run plan for owners who could be notified:

```json
{
  "type": "dev.nipmod.scout-owner-notifications.v1",
  "dryRun": true,
  "remoteWrites": false,
  "ready": true,
  "summary": {
    "eligible": 4,
    "planned": 4,
    "deduped": 0,
    "optedOut": 0,
    "rateLimited": 0
  },
  "notifications": [
    {
      "channel": "gitlawb-issue",
      "status": "planned",
      "package": "pkg:did:key:.../repo",
      "source": "gitlawb://did:key:.../repo"
    }
  ]
}
```

Delivery is a separate operator action:

```text
POST /notifications/run
Authorization: Bearer <run token>
```

Delivery still requires explicit remote write mode, a Scout signing identity, local dedupe state and a remote issue dedupe check. Without all of those, the delivery result is blocked and no Gitlawb write happens.

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

## Owner Notification Flow

1. Scout scans repos and builds drafts.
2. Scout blocks notification planning unless the claim index and registry snapshot are fresh.
3. Scout plans only `unclaimed-draft` candidates with an unclaimed package draft.
4. Scout dedupes by package id and rate limits by cycle and owner DID.
5. Public `/notifications` shows the plan with `remoteWrites: false`.
6. A configured operator may run `/notifications/run`.
7. The delivery path checks existing Gitlawb issues for the dedupe key before any write.
8. The issue body points owners to the generated draft and owner-only claim commands.

This makes Scout useful for ecosystem growth without pretending that Nipmod owns another repo.
