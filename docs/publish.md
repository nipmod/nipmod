# Publishing with nipmod

nipmod publishes agent packages through Gitlawb while keeping package truth outside registry control.

## Author flow

```sh
nipmod init --name @you/example-agent --dir example-agent
cd example-agent
nipmod manifest validate
nipmod pack . --out dist --json
nipmod publish . --dry-run --json
nipmod publish .
```

## What dry run checks

- Manifest schema.
- Package id and publisher DID.
- Signing identity.
- Bundle digest.
- Gitlawb helper availability.
- Target repo name.
- Version availability.
- Release event preview.

## What publish writes

- A signed `.nipmod` bundle.
- A signed release event.
- Source and release refs on Gitlawb.

The public registry indexes this data. It does not own the package and cannot grant itself publish rights.

## Manifest rules

Required fields:

- `formatVersion`
- `name`
- `canonical`
- `version`
- `type`
- `description`
- `exports`
- `files`
- `permissions`
- `publish.signingKey`

Rejected v1 permission patterns:

- Postinstall scripts.
- Arbitrary exec.
- Secret like environment variables.
- Secret permission scopes.
- Filesystem write scopes.
- Network wildcards.
- Mutable source refs for release provenance.
- Prompt injection metadata.

## Release discipline

Use immutable tags for source provenance. Do not publish from a moving branch ref.

Keep `.nipmod/identity.json` private. The generated `.gitignore` excludes it by default.

Run `nipmod publish . --dry-run --json` in CI before a public release.
