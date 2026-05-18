# Gitlawb Feedback

This document tracks protocol and node issues found while operating Nipmod on Gitlawb.

## Profile duplicate for mirrored repos

Status: reported upstream, still visible on the Gitlawb profile as of 2026-05-17.

Upstream issue:

```text
https://github.com/Gitlawb/node/issues/6
```

Public profile:

```text
https://gitlawb.com/z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R
```

The profile currently renders two repository cards for the same logical repository:

```text
z6Mkwbud / nipmod
z6Mkwbud / nipmod
```

Both cards link to the same public repo path:

```text
https://gitlawb.com/node/repos/z6Mkwbud/nipmod
```

The duplicate is caused by two records on `node.gitlawb.com` for the same normalized owner/repo:

```text
GET https://node.gitlawb.com/api/v1/repos?owner=z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R
```

One record is the canonical repo:

```json
{
  "id": "9d92186a-c233-4e64-ac82-3dadf1de1eb1",
  "name": "nipmod",
  "owner_did": "did:key:z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R",
  "description": "Verifiable package layer for agents on Gitlawb"
}
```

The other record is a peer mirror with short owner identity:

```json
{
  "id": "z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R/nipmod",
  "name": "nipmod",
  "owner_did": "z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R",
  "description": "mirrored from peer"
}
```

Read-only checks:

```sh
curl -fsSL 'https://node.gitlawb.com/api/v1/repos?owner=z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R'
curl -fsSL 'https://node.gitlawb.com/api/v1/repos/z6Mkwbud/nipmod'
curl -fsSL 'https://node.nipmod.com/api/v1/repos?owner=z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R'
```

Expected behavior:

- Profile and repo list surfaces should show one logical repo per normalized owner/repo.
- If both a canonical `did:key:` record and a short-owner mirror record exist, the canonical record should win.
- Mirror evidence can remain available through an explicit replicas or mirror view.

Observed behavior:

- `node.nipmod.com` has one canonical record.
- `node.gitlawb.com` has one canonical record and one short-owner mirror record.
- `gitlawb.com` profile renders both records as separate repos.
- The profile still shows `0 pushes` and `newcomer` even when commit activity is present and the canonical repo resolves to a pushed main branch.
- The direct repo page can show an older latest commit and README while its drift panel already sees the newer `node.gitlawb.com` commit hash.

Nipmod-side read-only checks:

```text
GITLAWB_NODE=https://node.nipmod.com git ls-remote gitlawb refs/heads/main
GITLAWB_NODE=https://node.gitlawb.com git ls-remote gitlawb refs/heads/main
```

`https://node.nipmod.com/api/v1/repos` currently returns one Nipmod repo record for the canonical owner DID. The duplicate is therefore not caused by an extra Nipmod repo on `node.nipmod.com`. Direct pushes to `node.gitlawb.com` update the canonical Gitlawb repo, but the public profile still renders the mirror row and reports stale trust counters.

Relevant Gitlawb source findings:

- `upsert_mirror_repo` inserts mirror records with `id = "{owner_short}/{name}"`, `owner_did = owner_short`, and `description = "mirrored from peer"`.
- `list_repos` returns every repo row and filters by either short owner or full owner without deduping normalized DID ownership.
- `gl repo` and the node router expose no public repo delete command or `DELETE /api/v1/repos/:owner/:repo`.
- `ReplicaUnregister` only removes entries from the replica table. It does not remove local mirror repo rows.

Operator-safe recommendation:

- Do not attempt client-side deletion from Nipmod.
- Add normalized owner/repo dedupe to list/profile surfaces, or migrate mirror rows when a canonical `did:key:` owner record exists.
- If an operator cleanup is needed, remove only the short-owner mirror row after backup and after verifying the canonical `did:key:` repo still resolves.

Launch impact:

- Code source remains correct because both cards resolve to the same public repo path.
- The profile count and duplicate card look unprofessional for founder review, so Nipmod public links should prefer the direct repo URL until Gitlawb dedupes this upstream.
