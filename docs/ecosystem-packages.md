# Ecosystem Packages

First party packages exist to prove real agent use cases before external publishers arrive.

| Package | Type | Use | Command |
| --- | --- | --- | --- |
| `gitlawb-repo-reader` | `skill` | Read a public Gitlawb repo and return a provenance focused summary. | `nipmod install gitlawb-repo-reader` |
| `gitlawb-release-review` | `skill` | Review immutable tags, signed release events and registry readiness. | `nipmod install gitlawb-release-review` |
| `repo-readme-audit` | `skill` | Audit repository README content for package clarity and untrusted instruction risk. | `nipmod install repo-readme-audit` |
| `dependency-risk-review` | `skill` | Review dependency manifests, permissions and lockfiles before install. | `nipmod install dependency-risk-review` |
| `prompt-injection-scan` | `skill` | Scan package text and prompts for instruction injection risk. | `nipmod install prompt-injection-scan` |
| `nipmod-audit-ci` | `skill` | Turn audit and policy output into CI decisions agents can explain and enforce. | `nipmod install nipmod-audit-ci` |
| `strict-ci-policy` | `skill` | Run strict install policy gates for automated agent workspaces. | `nipmod install strict-ci-policy` |
| `developer-default-policy` | `skill` | Apply a practical default policy for trying packages safely before production use. | `nipmod install developer-default-policy` |
| `github-issue-triage` | `skill` | Triage GitHub issues from untrusted issue text without package permissions. | `nipmod install github-issue-triage` |
| `malicious-skill-fixtures` | `skill` | Provide safe negative test fixtures for scanners and policy reviewers. | `nipmod install malicious-skill-fixtures` |
| `mcp-server-import-example` | `skill` | Map MCP server metadata into Nipmod compatibility receipts. | `nipmod install mcp-server-import-example` |
| `apm-import-example` | `skill` | Map an APM package listing into Nipmod trust metadata. | `nipmod install apm-import-example` |
| `gitlawb-diff-summarizer` | `skill` | Summarize Gitlawb repository diffs with provenance, risk and next action clarity. | `nipmod install gitlawb-diff-summarizer` |
| `release-notes-drafter` | `skill` | Draft release notes from verified package, Gitlawb tag and changelog evidence. | `nipmod install release-notes-drafter` |
| `security-advisory-triage` | `skill` | Triage package security reports into advisory, quarantine and user action decisions. | `nipmod install security-advisory-triage` |
| `agent-permission-review` | `skill` | Review agent package permissions for least privilege before install or publish. | `nipmod install agent-permission-review` |
| `mcp-tool-risk-review` | `skill` | Review MCP server tools and manifests before agents expose them to package workflows. | `nipmod install mcp-tool-risk-review` |
| `package-onboarding-checklist` | `skill` | Guide new package authors through a clean Nipmod publish candidate. | `nipmod install package-onboarding-checklist` |
| `registry-mirror-compare` | `adapter` | Compare registry mirrors and fail closed on digest, root, witness or advisory drift. | `nipmod install registry-mirror-compare` |
| `package-evidence-brief` | `workflow-pack` | Turn package proof into a short human review brief. | `nipmod install package-evidence-brief` |
| `agent-runtime-compat-check` | `agent-profile` | Check whether an agent host is ready for install, audit and MCP flows. | `nipmod install agent-runtime-compat-check` |
| `external-review-packet` | `workflow-pack` | Prepare an external reviewer handoff from proof and gate output. | `nipmod install external-review-packet` |
| `first-user-onboarding` | `workflow-pack` | Guide a first user through setup, inspect, package install, audit and publish dry run. | `nipmod install first-user-onboarding` |
| `package-migration-planner` | `adapter` | Plan a Gitlawb, MCP or APM source migration into a package candidate. | `nipmod install package-migration-planner` |
| `readonly-registry-mcp-server` | `mcp-server` | Expose read only registry search and inspect tools through MCP. | `nipmod install readonly-registry-mcp-server` |
| `launch-strict-policy-pack` | `policy-pack` | Apply launch strict install policy for verified agent packages. | `nipmod install launch-strict-policy-pack` |
| `package-safety-eval-pack` | `eval-pack` | Evaluate scanners against unsafe agent package fixtures. | `nipmod install package-safety-eval-pack` |
| `gitlawb-review-tool-bundle` | `tool-bundle` | Bundle Gitlawb repo review, diff summary and release review guidance. | `nipmod install gitlawb-review-tool-bundle` |

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

Packages without this evidence can exist on Gitlawb, but Nipmod should not rank them as verified.
