# Ecosystem Packages

First party packages exist to prove real agent use cases before external publishers arrive.

| Package | Type | Use | Command |
| --- | --- | --- | --- |
| `gitlawb-repo-reader` | `skill` | Read a public Gitlawb repo and return a provenance focused summary. | `nipmod add gitlawb-repo-reader --online` |
| `gitlawb-release-review` | `skill` | Review immutable tags, signed release events and registry readiness. | `nipmod add gitlawb-release-review --online` |
| `repo-readme-audit` | `skill` | Audit repository README content for package clarity and untrusted instruction risk. | `nipmod add repo-readme-audit --online` |
| `dependency-risk-review` | `skill` | Review dependency manifests, permissions and lockfiles before install. | `nipmod add dependency-risk-review --online` |
| `prompt-injection-scan` | `skill` | Scan package text and prompts for instruction injection risk. | `nipmod add prompt-injection-scan --online` |
| `nipmod-audit-ci` | `skill` | Turn audit and policy output into CI decisions agents can explain and enforce. | `nipmod add nipmod-audit-ci --online` |
| `strict-ci-policy` | `skill` | Run strict install policy gates for automated agent workspaces. | `nipmod add strict-ci-policy --online` |
| `developer-default-policy` | `skill` | Apply a practical default policy for trying packages safely before production use. | `nipmod add developer-default-policy --online` |
| `github-issue-triage` | `skill` | Triage GitHub issues from untrusted issue text without package permissions. | `nipmod add github-issue-triage --online` |
| `malicious-skill-fixtures` | `skill` | Provide safe negative test fixtures for scanners and policy reviewers. | `nipmod add malicious-skill-fixtures --online` |
| `mcp-server-import-example` | `skill` | Map MCP server metadata into nipmod compatibility receipts. | `nipmod add mcp-server-import-example --online` |
| `apm-import-example` | `skill` | Map an APM package listing into nipmod trust metadata. | `nipmod add apm-import-example --online` |
| `gitlawb-diff-summarizer` | `skill` | Summarize Gitlawb repository diffs with provenance, risk and next action clarity. | `nipmod add gitlawb-diff-summarizer --online` |
| `release-notes-drafter` | `skill` | Draft release notes from verified package, Gitlawb tag and changelog evidence. | `nipmod add release-notes-drafter --online` |
| `security-advisory-triage` | `skill` | Triage package security reports into advisory, quarantine and user action decisions. | `nipmod add security-advisory-triage --online` |
| `agent-permission-review` | `skill` | Review agent package permissions for least privilege before install or publish. | `nipmod add agent-permission-review --online` |
| `mcp-tool-risk-review` | `skill` | Review MCP server tools and manifests before agents expose them to package workflows. | `nipmod add mcp-tool-risk-review --online` |
| `package-onboarding-checklist` | `skill` | Guide new package authors through a clean nipmod publish candidate. | `nipmod add package-onboarding-checklist --online` |
| `registry-mirror-compare` | `adapter` | Compare registry mirrors and fail closed on digest, root, witness or advisory drift. | `nipmod add registry-mirror-compare --online` |
| `package-evidence-brief` | `workflow-pack` | Turn package proof into a short human review brief. | `nipmod add package-evidence-brief --online` |
| `agent-runtime-compat-check` | `agent-profile` | Check whether an agent host is ready for install, audit and MCP flows. | `nipmod add agent-runtime-compat-check --online` |
| `external-review-packet` | `workflow-pack` | Prepare an external reviewer handoff from proof and gate output. | `nipmod add external-review-packet --online` |
| `first-user-onboarding` | `workflow-pack` | Guide a first user through install, inspect, add, audit and publish dry run. | `nipmod add first-user-onboarding --online` |
| `package-migration-planner` | `adapter` | Plan a Gitlawb, MCP or APM source migration into a package candidate. | `nipmod add package-migration-planner --online` |
| `readonly-registry-mcp-server` | `mcp-server` | Expose read only registry search and inspect tools through MCP. | `nipmod add readonly-registry-mcp-server --online` |
| `launch-strict-policy-pack` | `policy-pack` | Apply launch strict install policy for verified agent packages. | `nipmod add launch-strict-policy-pack --online` |
| `package-safety-eval-pack` | `eval-pack` | Evaluate scanners against unsafe agent package fixtures. | `nipmod add package-safety-eval-pack --online` |
| `gitlawb-review-tool-bundle` | `tool-bundle` | Bundle Gitlawb repo review, diff summary and release review guidance. | `nipmod add gitlawb-review-tool-bundle --online` |

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
