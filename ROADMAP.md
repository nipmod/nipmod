# Roadmap

Nipmod is focused on one product:

> The package layer for AI agents.

Agents use Nipmod to search packages, inspect trust, and get safe install plans before touching a workspace.

## Now

- Hosted public API for search, inspect and install plans.
- Source resolvers for npm, PyPI, GitHub, Hugging Face and MCP.
- Trust factors that separate source evidence, metadata quality, usage signals, security confidence and install risk.
- Hosted API boundary that never reads or writes caller workspaces.
- Durable package intelligence archive for confirmed useful records.
- OpenAPI, hosted read-only MCP, local MCP and CLI support surfaces.
- CI, CodeQL, dependency review, production monitor and launch verification gates.

## Next

- Better source-depth fixtures for every resolver.
- More explicit lifecycle output around `ephemeral`, `indexed`, `confirmed_use`, `verified`, `quarantined` and `blocked`.
- Stronger policy rules for risky lifecycle scripts, weak provenance, unsafe model files and package metadata prompt injection.
- Clearer docs and examples for agent hosts using the public API.
- Archive confirmation quality controls, abuse controls, quotas and audit receipts.
- TypeScript and Python SDKs after the API contract is stable.

## Later

- Owner claim flow for external package records.
- Private source connectors only after the public beta is stable.
- Higher-limit API keys after free usage proves demand and operational cost.
- Policy packs, allowlists and audit export for teams.

## Rules

- Nipmod does not replace package registries.
- Search score is not install permission.
- Popularity cannot create `verified`.
- External package owners keep ownership.
- Hosted API calls never execute install commands.
- Free public beta stays rate limited.
- No public claim ships without tests, docs and production checks.
