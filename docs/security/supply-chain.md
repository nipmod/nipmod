# Supply Chain Security

Nipmod is built for package intelligence, so the repository itself has to keep a strict supply chain standard.

## Repository Controls

- TypeScript source and tooling.
- GitHub CI for tests, typecheck, build, security checks and public readiness.
- Production monitor workflow.
- Dependabot for GitHub Actions and package dependencies.
- CodeQL scanning.
- OpenSSF Scorecard workflow.
- Secret and local state checks in `pnpm public:check`.
- Dependency audit in `pnpm security`.

## Product Controls

- External package metadata is untrusted input.
- Posted external records are re-inspected from the original source before archive prepare or confirm uses them.
- Client-supplied trust scores, decisions or factors cannot upgrade durable archive records.
- Agent-targeted instructions inside package metadata block confirmed archive persistence.
- Hosted API does not read or write caller workspaces.
- Install plans require approval before workspace writes.
- Local CLI verifies package metadata before controlled installs.
- Archive writes require server-side credentials and an authorized writer.

## Maintainer Rules

- Do not commit secrets, private keys, tokens, local identity files or service state.
- Do not add generated build output unless the file is part of a documented release surface.
- Do not add source resolver claims without tests and docs.
- Do not claim third-party audit status before a reviewer signs off.

## Incident Rule

If a supply chain issue affects users:

1. Disable or quarantine the affected surface.
2. Publish a mitigation note.
3. Rotate affected credentials.
4. Add a regression test or readiness check.
5. Document the incident in release notes.
