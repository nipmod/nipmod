# Registry API

Status: implemented static package documents, v1 sidecars in progress
Date: 2026-05-17

## Why this exists

Package registries often expose package documents that group all versions and dist tags for one package. Nipmod currently publishes a flat search index. That is enough for launch search, but not enough for package manager parity because `latest`, `beta`, version ranges, package pages, `outdated`, `update`, `view`, deprecation and dependency resolution need a package document contract.

## Package document

Each canonical Gitlawb package should resolve to a document:

```json
{
  "formatVersion": 1,
  "canonical": "pkg:did:key:z6Mk.../package",
  "name": "package",
  "distTags": {
    "latest": "1.2.0",
    "beta": "1.3.0"
  },
  "versions": {
    "1.2.0": {
      "digest": "sha256...",
      "dependencies": {
        "agent-logger": "^1.0.0"
      },
      "publisher": "did:key:z6Mk...",
      "type": "skill",
      "trust": {
        "level": "verified",
        "score": 100
      }
    }
  }
}
```

## Required endpoints

| Endpoint | Purpose |
| --- | --- |
| `/registry/packages.json` | Search index, optimized for discovery. |
| `/registry/packages/<encoded-canonical>.json` | Package document with versions and dist tags. |
| `/registry/packages/<encoded-canonical>/<version>.json` | Exact version metadata. |
| `/registry/packages/<encoded-canonical>/dependencies.json` | Direct dependency maps for the current `latest` dist tag. |
| `/registry/packages/<encoded-canonical>/provenance.json` | Source, artifact, release, transparency and witness proof for the current `latest` dist tag. |

`<encoded-canonical>` is base64url over the UTF-8 canonical package id. This keeps `pkg:did:key:.../name` usable in static file paths without decoded slashes breaking routing.

Agents can discover the templates from `https://nipmod.com/.well-known/nipmod.json` under `registry`.

## Dist tags

Dist tags are signed lifecycle events. `latest` can be derived only when no signed tag event exists. Published tag events must be verified before a resolver trusts them.

Lifecycle events use `dev.nipmod.lifecycle.v1` signed envelopes. Supported actions are `dist-tag.set`, `dist-tag.remove`, `deprecate` and `yank`. The registry materializes verified events into `distTags`, `deprecated` and `yanked` fields. Search hides yanked releases unless explicitly included; install, inspect, audit and CI fail closed on yanked releases.

## Decentralized differences

- Global names are not authoritative. Canonical identity is `pkg:<did>/<slug>`.
- Unscoped display names can be ambiguous. Resolvers must fail closed unless a canonical package id is provided.
- Public package removal should be a signed yank/deprecation event, not silent deletion.
- Search can show packages from multiple registries, but install must pin a signed registry root and trust roots.

## Next implementation steps

1. Add signed registry root metadata for package documents.
2. Teach resolver and inspect to consume package documents for registry driven graph install.
3. Add signed README extraction from bundles.
4. Add owner, maintainer-key and trusted-publishing lifecycle events.
