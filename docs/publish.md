# Publishing with Nipmod

Nipmod publishes agent packages through Gitlawb while keeping package truth outside registry control.

## Author flow

```sh
nipmod setup gitlawb
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

## Lifecycle writes

Package owners can publish signed lifecycle events without deleting Gitlawb content:

- `nipmod dist-tag add pkg:<publisher>/<name>@<version> latest`
- `nipmod dist-tag rm pkg:<publisher>/<name> next`
- `nipmod deprecate pkg:<publisher>/<name>@<version> "Use a newer release"`
- `nipmod yank pkg:<publisher>/<name>@<version> "Broken release"`

Use `--dry-run --json` to inspect the signed event before a remote write. Published events are appended under `lifecycle/events/` and referenced from `index.json`.

## Name limits

Gitlawb repo names currently allow lowercase letters, numbers, hyphens and underscores. A package can use a familiar package name while drafting, but the canonical slug that gets published must map to a Gitlawb repo name.

Use `nipmod package pr gitlawb://did:key:z6Mk.../repo --dir repo-pr` when turning an existing Gitlawb repo into a PR-ready package patch. The patch is local only. Publishing requires the matching repo owner DID identity. Use `nipmod claim verify gitlawb://did:key:z6Mk.../repo --json` after the claim proof is pushed, then `nipmod publish . --dry-run --json` inside a signed package workspace before any public write.

Public onboarding should use `package pr` only for repos the operator owns or maintains.

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
