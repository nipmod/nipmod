# Nipmod Package Claim

Package Claim is the growth and ownership flow that turns public Gitlawb repos into installable Nipmod packages without asking owners to create a Nipmod account.

## Product Promise

Gitlawb is the source layer for agent-built code. Nipmod is the package layer on top.

Package Claim makes that concrete:

```text
Gitlawb repo -> Scout draft -> owner claim -> package doctor -> verified package
```

The hard boundary is simple: published is not claimed. A registry package can be installable, but the `/candidates`
surface only marks it `claimed` after a Gitlawb-pushed `.nipmod/package-claim.json` verifies against the repo owner DID.

## Core Concepts

### Package Candidate

A Package Candidate is a public Gitlawb repo that Nipmod can describe as a possible agent package before the owner has claimed it.

Candidates are not official packages. The UI must clearly label them as unclaimed until a Gitlawb owner proof exists.

### Package Draft

A Package Draft is the concrete package proposal Scout can generate from a candidate without writing to Gitlawb.

It contains:

- `nipmod.json`
- `README.nipmod.md`
- claim command
- claim verify command
- exact local commit and push commands

Drafts are useful because a repo owner or agent can inspect real files instead of interpreting generic advice. They are still unclaimed until the owner DID signs `.nipmod/package-claim.json`.

### Readiness Score

Readiness is a deterministic score from 0 to 100. It answers one question:

```text
How close is this repo to becoming installable by agents?
```

Signals:

- Public Gitlawb repo exists.
- Repo has a useful description.
- Repo has README or agent-facing docs.
- Repo has agent/package signals in name, description or docs.
- Repo already has `nipmod.json`.
- Manifest has explicit permissions.
- Repo has install or usage examples.
- Repo has license metadata.

### Package Claim

Package Claim verifies that the repo owner DID controls the package claim.

The owner proves control by signing a Nipmod claim with the same DID that owns the Gitlawb repo. The proof can then be committed and pushed through Gitlawb.

No Nipmod account is required.

### Claim Proof Index

Nipmod builds a public claim index from Gitlawb repos:

```bash
nipmod claim index --node https://node.nipmod.com --out claim-index.json
```

Each repo is checked for:

```text
.nipmod/package-claim.json
```

The proof is accepted only when:

- The proof schema is valid.
- The Ed25519 signature verifies.
- `signature.keyId` equals `ownerDid`.
- `ownerDid` equals the Gitlawb repo owner DID.
- `repoName`, `repo` and `package` match the exact repo being checked.

Machines can verify one repo directly:

```bash
nipmod claim verify gitlawb://did:key:.../repo --json
```

Exit code `0` means verified. Exit code `7` means missing, invalid or mismatched proof.

### Verified Package

A candidate becomes a verified package only after:

- Owner DID matches the Gitlawb repo owner.
- Claim proof is valid.
- `nipmod.json` validates.
- Package can be packed.
- Release artifact is signed.
- Registry candidate passes trust and policy checks.

## User Flow

### 1. Scanner Finds Repos

Nipmod Scout Agent continuously reads public Gitlawb repos from configured nodes and publishes a read only candidate index.

```text
https://nipmod.com/scout/candidates
https://nipmod.com/scout/drafts
https://nipmod.com/scout/draft?repo=gitlawb://did:key:.../repo
```

Output:

```text
package candidates: 24
ready 5
almost 11
needs-work 8
```

The Scout service runs 24/7. It never creates issues, pull requests, claims or packages on behalf of another owner.

Scout also exposes a dry run owner notification plan:

```text
https://nipmod.com/scout/notifications
```

That plan is public, read only and marked `remoteWrites: false`. It lists only unclaimed unpublished drafts after the claim index and registry have both refreshed.

### 2. Candidate Page Exists

Every candidate gets a page:

```text
Unclaimed package candidate
Readiness: 82%
Missing: nipmod.json, permissions, examples
```

CTA:

```bash
nipmod claim gitlawb://did:key:.../repo
```

### 3. Owner Runs Doctor

```bash
nipmod package doctor gitlawb://did:key:.../repo
```

Doctor prints:

- Readiness score.
- Missing files.
- Suggested package type.
- Exact commands.
- Whether it is safe to claim.

### 4. Owner Claims

```bash
nipmod claim gitlawb://did:key:.../repo --dir . --identity .nipmod/identity.json
```

Claim writes:

```text
.nipmod/package-claim.json
```

The file contains a canonical signed proof:

```json
{
  "type": "dev.nipmod.package-claim.v1",
  "repo": "gitlawb://did:key:.../repo",
  "package": "pkg:did:key:.../repo",
  "ownerDid": "did:key:...",
  "createdAt": "2026-05-17T00:00:00.000Z",
  "signature": {
    "algorithm": "Ed25519",
    "keyId": "did:key:...",
    "signatureBase64": "..."
  }
}
```

### 5. Assisted Package PR

When the repo is missing packaging files, Nipmod can create a package-ready patch without opening a remote issue or PR:

```bash
nipmod package pr gitlawb://did:key:.../repo --dir repo-package-pr
```

`package pr` writes a local PR-ready folder:

- `nipmod.json`
- `README.nipmod.md`
- optional `.nipmod/package-claim.json` when the matching owner identity is supplied

It also prints the exact Gitlawb-safe commands:

```bash
git add nipmod.json README.nipmod.md .nipmod/package-claim.json
git commit -m "feat: add nipmod package manifest"
GITLAWB_NODE=https://node.nipmod.com git push
```

Remote writes stay operator controlled. Scout can deliver a Gitlawb issue notification only when the operator provides authorization, explicit write mode and a Scout signing identity. The delivery path dedupes locally and checks existing Gitlawb issues before writing.

Later, a Gitlawb PR assistant can use the same local patch to open:

- `nipmod.json`
- package README companion file
- install command
- Package Claim badge
- permission summary

## Owner Notification Delivery

The notification feature is designed to help repo owners discover a ready package draft without stealing the repo or claiming endorsement.

Eligibility:

- candidate status is `unclaimed-draft`
- claim status is `unclaimed`
- package is not already in the registry
- matching draft exists
- claim index is fresh
- registry snapshot is fresh

Safety gates:

- public endpoints are dry run only
- no notification for published packages
- no notification for claimed packages
- no X, GitHub or email ownership inference
- opt-out list support
- per-cycle and per-owner rate limits
- local dedupe ledger
- remote Gitlawb issue dedupe by marker

Operator run:

```bash
curl -X POST https://nipmod.com/scout/notifications/run \
  -H "Authorization: Bearer $NIPMOD_SCOUT_RUN_TOKEN"
```

Production should keep `NIPMOD_SCOUT_NOTIFY_REMOTE_WRITES` off until the operator identity and opt-out policy are reviewed.

## CLI Surface

```bash
nipmod package scan --node https://node.nipmod.com
nipmod package doctor gitlawb://did:key:.../repo
nipmod package pr gitlawb://did:key:.../repo --dir repo-package-pr
nipmod claim gitlawb://did:key:.../repo --dir . --identity .nipmod/identity.json
nipmod claim verify gitlawb://did:key:.../repo --json
nipmod claim index --node https://node.nipmod.com --out claim-index.json --json
```

JSON mode is required for agents:

```bash
nipmod package doctor gitlawb://did:key:.../repo --json
nipmod claim gitlawb://did:key:.../repo --json
nipmod claim verify gitlawb://did:key:.../repo --json
nipmod claim index --json
```

## Website Surface

Routes:

- `/packages` keeps verified packages first.
- `/candidates` lists unclaimed Gitlawb package candidates.
- `/candidates/[owner]/[repo]` explains readiness and claim steps.

Page copy:

```text
Your Gitlawb repo is almost an agent package.
Claim it with Gitlawb ownership proof.
```

## Safety Rules

- Never label unclaimed repos as verified packages.
- Never open mass issues or PRs automatically.
- Never open remote issues or PRs from `package pr`; it is a local patch generator only.
- Never claim ownership through X, GitHub or email.
- Never accept a claim proof unless `signature.keyId` matches the Gitlawb repo owner DID.
- Never accept a claim proof unless it matches the exact repo and package id being checked.
- Never publish without a signed artifact and manifest validation.
- Outreach must be opt-in or targeted, not spam.

## Growth Loop

1. Scanner discovers a repo.
2. Candidate page creates a useful public artifact.
3. Owner sees readiness and missing steps.
4. Owner claims without creating a Nipmod account.
5. Package becomes installable.
6. Package page and badge bring other agents back to Nipmod.

The loop turns Gitlawb itself into the distribution channel.

## What Needs User Credentials

No credentials are needed for local doctor, candidate scoring, candidate pages or claim proof generation.

Credentials are needed only for:

- Writing to a real Gitlawb repo.
- Opening Gitlawb issues or PRs.
- Running a production scanner job against private or rate-limited nodes.
