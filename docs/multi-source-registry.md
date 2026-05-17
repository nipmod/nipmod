# Multi Source Registry

nipmod defaults to `https://nipmod.com/registry/packages.json`, but search can already read multiple registry indexes.

```bash
nipmod search policy --registries https://nipmod.com/registry/packages.json,https://mirror.example/packages.json
```

or:

```bash
export NIPMOD_REGISTRY_URLS="https://nipmod.com/registry/packages.json,https://mirror.example/packages.json"
nipmod search policy --online
```

## Safety Rules

- Registry URLs must use `https`, local `file:` or loopback `http`.
- Duplicate `canonical@version` records are allowed only when their digest is identical.
- Conflicting digests fail closed.
- Quarantined high and critical packages stay hidden unless explicitly requested.
- Install and audit still verify package trust evidence before workspace mutation.

## Current Limit

Search is multi source. Install still operates against one selected registry URL because trust roots, transparency pins and advisory roots must stay explicit. Multi source install should only ship after each source can publish signed registry root metadata.
