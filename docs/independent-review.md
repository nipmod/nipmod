# Independent Review Packet

Nipmod must not claim third-party audit status until an independent reviewer has actually completed and signed a review.

This packet defines what an external reviewer should inspect for the public CLI, public integration material and hosted API boundary.

## Scope

- Public CLI source in `cli/`.
- MCP and Codex integration material in `plugins/`, `examples/` and `docs/integrations/`.
- Public API contract examples.
- Public security model and disclosure process.
- Hosted API boundary statements that say hosted calls are read-only with respect to caller workspaces.

## Required Review Checks

- Hosted API examples do not imply local execution, package installation, cloning or file writes.
- CLI commands that can touch local workspaces are separated from hosted read-only decisions.
- Package metadata, README text, model cards and MCP descriptions are treated as untrusted input.
- Install plans include an explicit approval boundary before dependency writes.
- Security reporting paths are clear and do not ask reporters to disclose secrets publicly.
- Public documentation does not claim affiliation with third-party ecosystems without written proof.
- Public documentation does not claim an external audit until this packet is signed.

## Reviewer Sign Off

Reviewer:

Organization:

Date:

Commit or release reviewed:

Findings summary:

Residual risk:

Signed statement:

```text
I reviewed the scope above and confirm whether Nipmod's public safety boundary,
CLI behavior and hosted read-only claims are accurately represented for the
reviewed commit or release.
```
