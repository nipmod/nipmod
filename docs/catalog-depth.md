# Catalog Depth

nipmod launch depth is measured by verified packages, manifest type coverage and proof quality. Volume alone does not count.

## Launch Type Coverage

| Type | Package | Purpose |
| --- | --- | --- |
| `skill` | `gitlawb-repo-reader` | Read Gitlawb source with provenance context. |
| `mcp-server` | `readonly-registry-mcp-server` | Expose read only registry search and inspect tools through MCP. |
| `tool-bundle` | `gitlawb-review-tool-bundle` | Bundle Gitlawb repo review, diff summary and release review guidance. |
| `agent-profile` | `agent-runtime-compat-check` | Check whether an agent host is ready for safe package workflows. |
| `workflow-pack` | `external-review-packet` | Prepare an external reviewer handoff from proof and gate output. |
| `eval-pack` | `package-safety-eval-pack` | Evaluate scanners against unsafe package fixtures. |
| `policy-pack` | `launch-strict-policy-pack` | Apply launch strict install policy for verified agent packages. |
| `adapter` | `package-migration-planner` | Plan migration from Gitlawb, MCP or APM sources into nipmod packages. |

## Readiness Rule

Catalog depth is launch ready only when every supported manifest type has at least one verified package and every package has:

- `verified/100` trust
- signed bundle
- signed release event
- source tag provenance
- transparency proof
- witness statement
- permission manifest
- README
- smoke file
- no active quarantine

## Review Rule

External reviewers should treat type coverage, proof consistency and package smoke evidence as part of the review scope. A large catalog with weak proof is worse than a smaller catalog with complete proof.
