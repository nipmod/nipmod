# Registry API

Status: proposed P0 contract
Date: 2026-05-17

## Why this exists

npm has package documents, often called packuments, that group all versions and dist tags for one package. nipmod currently publishes a flat search index. That is enough for launch search, but not enough for npm parity because `latest`, `beta`, version ranges, package pages, `outdated`, `update`, `view`, deprecation and dependency resolution need a package document contract.

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
| `/registry/packages/<encoded-canonical>/readme` | README from the signed bundle. |
| `/registry/packages/<encoded-canonical>/dependencies` | Direct dependency maps and resolved graph preview. |
| `/registry/packages/<encoded-canonical>/provenance` | Source, release event, transparency and witness proof. |

## Dist tags

Dist tags are signed lifecycle events. `latest` can be derived only when no signed tag event exists. Published tag events must be verified before a resolver trusts them.

## Decentralized differences from npm

- Global names are not authoritative. Canonical identity is `pkg:<did>/<slug>`.
- Unscoped display names can be ambiguous. Resolvers must fail closed unless a canonical package id is provided.
- Public package removal should be a signed yank/deprecation event, not silent deletion.
- Search can show packages from multiple registries, but install must pin a signed registry root and trust roots.

## Next implementation steps

1. Generate public package documents from the verified flat registry.
2. Add signed registry root metadata for package documents.
3. Teach resolver and inspect to consume package documents for registry driven graph install.
4. Add lifecycle schemas for dist tag, deprecation, yank, owner and trusted publishing events.
