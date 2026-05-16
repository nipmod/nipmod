# Ecosystem Packages

First party packages exist to prove real agent use cases before external publishers arrive.

| Package | Use | Command |
| --- | --- | --- |
| `gitlawb-repo-reader` | Read a public Gitlawb repo and return a provenance focused summary. | `nipmod add gitlawb-repo-reader --online` |
| `gitlawb-release-review` | Review immutable tags, signed release events and registry readiness. | `nipmod add gitlawb-release-review --online` |
| `repo-readme-audit` | Audit repository README content for package clarity and untrusted instruction risk. | `nipmod add repo-readme-audit --online` |
| `dependency-risk-review` | Review dependency manifests, permissions and lockfiles before install. | `nipmod add dependency-risk-review --online` |
| `prompt-injection-scan` | Scan package text and prompts for instruction injection risk. | `nipmod add prompt-injection-scan --online` |
| `nipmod-audit-ci` | Turn audit and policy output into CI decisions agents can explain and enforce. | `nipmod add nipmod-audit-ci --online` |
| `strict-ci-policy` | Run strict install policy gates for automated agent workspaces. | `nipmod add strict-ci-policy --online` |
| `developer-default-policy` | Apply a practical default policy for trying packages safely before production use. | `nipmod add developer-default-policy --online` |
| `github-issue-triage` | Triage GitHub issues from untrusted issue text without package permissions. | `nipmod add github-issue-triage --online` |
| `malicious-skill-fixtures` | Provide safe negative-test fixtures for scanners and policy reviewers. | `nipmod add malicious-skill-fixtures --online` |
| `mcp-server-import-example` | Map MCP server metadata into nipmod compatibility receipts. | `nipmod add mcp-server-import-example --online` |
| `apm-import-example` | Map an APM package listing into nipmod trust metadata. | `nipmod add apm-import-example --online` |
| `gitlawb-diff-summarizer` | Summarize Gitlawb repository diffs with provenance, risk and next-action clarity. | `nipmod add gitlawb-diff-summarizer --online` |
| `release-notes-drafter` | Draft release notes from verified package, Gitlawb tag and changelog evidence. | `nipmod add release-notes-drafter --online` |
| `security-advisory-triage` | Triage package security reports into advisory, quarantine and user-action decisions. | `nipmod add security-advisory-triage --online` |
| `agent-permission-review` | Review agent package permissions for least privilege before install or publish. | `nipmod add agent-permission-review --online` |
| `mcp-tool-risk-review` | Review MCP server tools and manifests before agents expose them to package workflows. | `nipmod add mcp-tool-risk-review --online` |
| `package-onboarding-checklist` | Guide new package authors through a clean nipmod publish candidate. | `nipmod add package-onboarding-checklist --online` |

## Package quality bar

Every package must have:

- `nipmod.json`
- README
- permissions declared explicitly
- deterministic bundle digest
- source repo and source commit
- release event
- transparency proof
- witness evidence
- smoke notes or a reproducible example

Packages without this evidence can exist on Gitlawb, but nipmod should not rank them as verified.
