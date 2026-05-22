# Release Process

Nipmod releases should be boring, reproducible and easy to audit.

## Release Requirements

Before a public release:

1. `pnpm install` completes with the committed lockfile.
2. `pnpm verify` passes locally or in CI.
3. GitHub CI is green on `main`.
4. Production monitor is green.
5. `CHANGELOG.md` includes user-facing changes, verification and security notes.
6. Public docs match the shipped API surface.
7. No new third-party endorsement is claimed without explicit approval.
8. Release artifacts are signed or checksum verifiable.

## Versioning

Use semantic versioning for the CLI and public API compatibility notes.

- Patch: bug fixes, docs, internal tooling, non-breaking UI updates.
- Minor: new endpoints, new source resolvers, new CLI commands, compatible response fields.
- Major: breaking endpoint changes, removed CLI commands, changed archive semantics.

## Release Notes

Every release note should include:

- what changed
- what users or agents should do
- compatibility impact
- security impact
- verification evidence

## Rollback

If a release breaks public behavior:

1. Quarantine or disable the affected surface.
2. Publish a short incident note if public users are affected.
3. Revert or patch through a reviewed pull request.
4. Update `CHANGELOG.md` and any affected docs.
