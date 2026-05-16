# Ecosystem Packages

First party packages exist to prove real agent use cases before external publishers arrive.

| Package | Use | Command |
| --- | --- | --- |
| `gitlawb-repo-reader` | Read a public Gitlawb repo and return a provenance focused summary. | `nipmod add gitlawb-repo-reader --online` |
| `gitlawb-release-review` | Review immutable tags, signed release events and registry readiness. | `nipmod add gitlawb-release-review --online` |
| `dependency-risk-review` | Review dependency manifests, permissions and lockfiles before install. | `nipmod add dependency-risk-review --online` |
| `prompt-injection-scan` | Scan package text and prompts for instruction injection risk. | `nipmod add prompt-injection-scan --online` |
| `strict-ci-policy` | Run strict install policy gates for automated agent workspaces. | `nipmod add strict-ci-policy --online` |
| `mcp-server-import-example` | Map MCP server metadata into nipmod compatibility receipts. | `nipmod add mcp-server-import-example --online` |

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
