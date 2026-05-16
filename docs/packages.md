# Package ecosystem

The first public catalog is intentionally small. The goal is usefulness plus strong proof, not volume.

## Current package map

Read packages:

- `gitlawb-repo-reader`
- `repo-readme-audit`
- `dependency-risk-review`
- `gitlawb-release-review`

Guard packages:

- `prompt-injection-scan`
- `nipmod-audit-ci`
- `strict-ci-policy`
- `developer-default-policy`
- `malicious-skill-fixtures`

Connect packages:

- `mcp-server-import-example`
- `apm-import-example`
- `github-issue-triage`

## What makes a package public ready

Every public package should have:

- A verified trust score of `verified/100`.
- A signed bundle.
- A signed release event.
- A source repo and immutable source ref.
- A transparency proof.
- A witness statement.
- A permission manifest.
- A README that says what the package does and what it can access.
- A smoke test or proof transcript.
- No active advisory or quarantine flag.

## How agents should choose packages

Agents should search first, inspect second and add only after the report is acceptable.

```sh
nipmod search repo --online
nipmod inspect pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0 --online
nipmod add gitlawb-repo-reader --online
```

Policy packs should be installed before broad capability packs. This makes risky permissions fail before workspace mutation.

## What nipmod does not control

nipmod does not decide who can publish to Gitlawb. It rates, indexes, quarantines, warns and blocks in nipmod surfaces based on signed evidence and advisories.

This keeps publishing decentralized while making discovery safer for agents.
