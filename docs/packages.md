# Package ecosystem

Status: historical first-party launch catalog.

This document describes the original first-party proof catalog. It is not the current public archive state. The public API now resolves live external sources first, and durable archive records are stored only after explicit confirmation.

## Launch Catalog Matrix

| Package | Type | Permission profile | Primary use |
| --- | --- | --- | --- |
| `gitlawb-repo-reader` | `skill` | no permissions | Read a public Gitlawb repo with provenance context. |
| `gitlawb-release-review` | `skill` | no permissions | Review immutable tags, release events and registry readiness. |
| `repo-readme-audit` | `skill` | no permissions | Audit README clarity and untrusted instruction risk. |
| `dependency-risk-review` | `skill` | no permissions | Review dependency manifests and lockfiles before install. |
| `prompt-injection-scan` | `skill` | no permissions | Scan package text for prompt injection risk. |
| `nipmod-audit-ci` | `skill` | no permissions | Convert audit and policy output into CI decisions. |
| `strict-ci-policy` | `skill` | no permissions | Explain strict production policy for agent workspaces. |
| `developer-default-policy` | `skill` | no permissions | Apply safe developer defaults for package trials. |
| `malicious-skill-fixtures` | `skill` | no permissions | Provide safe negative fixtures for scanners. |
| `mcp-server-import-example` | `skill` | no permissions | Map MCP server metadata into compatibility receipts. |
| `apm-import-example` | `skill` | no permissions | Map an APM listing into Nipmod trust metadata. |
| `github-issue-triage` | `skill` | no permissions | Triage issue text as untrusted input. |
| `gitlawb-diff-summarizer` | `skill` | no permissions | Summarize Gitlawb diffs with risk context. |
| `release-notes-drafter` | `skill` | no permissions | Draft release notes from verified source evidence. |
| `security-advisory-triage` | `skill` | no permissions | Triage reports into advisory and quarantine decisions. |
| `agent-permission-review` | `skill` | no permissions | Review package permissions before install or publish. |
| `mcp-tool-risk-review` | `skill` | no permissions | Review MCP tool manifests before package workflows. |
| `package-onboarding-checklist` | `skill` | no permissions | Guide authors through a clean package candidate. |
| `registry-mirror-compare` | `adapter` | no permissions | Compare registry mirrors and fail closed on drift. |
| `package-evidence-brief` | `workflow-pack` | no permissions | Turn package proof into a human review brief. |
| `agent-runtime-compat-check` | `agent-profile` | no permissions | Check host readiness for install, audit and MCP use. |
| `external-review-packet` | `workflow-pack` | no permissions | Prepare an external reviewer handoff. |
| `first-user-onboarding` | `workflow-pack` | no permissions | Guide a first user through install and audit. |
| `package-migration-planner` | `adapter` | no permissions | Plan migration from Gitlawb, MCP or APM sources. |
| `readonly-registry-mcp-server` | `mcp-server` | no permissions | Expose read only registry search and inspect tools. |
| `launch-strict-policy-pack` | `policy-pack` | no permissions | Apply launch strict install policy. |
| `package-safety-eval-pack` | `eval-pack` | no permissions | Evaluate scanners against unsafe package fixtures. |
| `gitlawb-review-tool-bundle` | `tool-bundle` | no permissions | Bundle Gitlawb repo, diff and release review guidance. |

## What Makes A Package Public Ready

Every public package should have:

- a verified trust score of `verified/100`
- a signed bundle
- a signed release event
- a source repo and immutable source ref
- a transparency proof
- a witness statement
- a permission manifest
- a README that says what the package does and what it can access
- a smoke test or proof transcript
- no active advisory or quarantine flag

## How Agents Should Choose Packages

Agents should search first, inspect second and install only after the report is acceptable.

```sh
nipmod search repo
nipmod inspect pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0
mkdir -p nipmod-demo
cd nipmod-demo
nipmod install gitlawb-repo-reader
nipmod install
```

Policy packs should be installed before broad capability packs. This makes risky permissions fail before workspace mutation.

## How Ranking Works

Search ranks by trust first, then exact package name, name prefix, agent native package type, quiet permissions, compatibility receipts and recency. Active high and critical quarantines are hidden unless explicitly requested.

The ranking is advice, not authority. Agents should still run `nipmod inspect` before install.

## What Nipmod Does Not Control

Nipmod does not decide who can publish to Gitlawb. It rates, indexes, quarantines, warns and blocks in Nipmod surfaces based on signed evidence and advisories.

This keeps publishing decentralized while making discovery safer for agents.
