# npm parity master plan

Status: accepted implementation plan
Date: 2026-05-17

## Goal

nipmod should become the Gitlawb native package manager for agents: npm level ergonomics, Gitlawb as canonical decentralized source, agent safe trust checks by default.

The target is not a literal npm clone. npm parity means users and agents get the same product primitives people expect from npm, but with DID identity, signed Gitlawb artifacts, permission manifests, transparency proofs, witness evidence and policy gated activation.

## Non negotiable boundary

Gitlawb owns source, refs and package artifacts. nipmod can index, resolve, verify, cache, rank, warn, quarantine and activate packages. It must not become a central publishing authority that can delete or grant Gitlawb publishing rights.

## Parity matrix

| Layer | npm primitive | nipmod equivalent | Status |
| --- | --- | --- | --- |
| Package manifest | `package.json` | `nipmod.json` with package type, exports, permissions, dependencies and agent host metadata | in progress |
| Version specifiers | exact, caret, tilde, tags | exact, caret, tilde, wildcard, dist tags | started |
| Dependency graph | dependencies, dev, peer, optional | agent dependencies, dev dependencies, peer agent dependencies, optional capabilities | in progress |
| Lockfile | `package-lock.json` | `nipmod.lock.json` with verified package records and dependency graph snapshots | in progress |
| Local store | `node_modules` plus cache | `.nipmod/store/sha256/<digest>` plus host activation adapters | started |
| Install | `npm install` | `nipmod add`, graph install and lockfile restore with `nipmod install` | in progress |
| Clean CI | `npm ci` | `nipmod ci` with trust, advisory and policy gates | partial |
| Search | `npm search`, website search | trust ranked package search across signed registries | partial |
| View | `npm view`, npm package pages | exact package metadata CLI/API and `/packages/[name]` pages | started |
| Publish | `npm publish` | signed bundle and release event published through Gitlawb | partial |
| Outdated | `npm outdated` | lockfile versus registry report with current, wanted, latest and policy-safe status | done |
| Update | `npm update` | verified root dependency update plans, signed bundle fetch and stale lockfile prune | done |
| Pack | `npm pack` | signed `.nipmod` bundle | done |
| Dist tags | `npm dist-tag` | signed lifecycle event mapping tags to versions | missing |
| Version bump | `npm version` | signed version update and immutable Gitlawb release tag | missing |
| Deprecation | `npm deprecate` | signed deprecation advisory/lifecycle event, hidden in install plans | missing |
| Removal | `npm unpublish` | no destructive delete; signed yank/deprecate/quarantine events only | missing |
| Ownership | npm owner/collaborator | DID owner, maintainer keys, org DIDs, key rotation and recovery | missing |
| Orgs and teams | npm org/team/access | Gitlawb DID org/team proof with package policy | missing |
| Auth tokens | npm tokens/OIDC | no long lived registry tokens for public packages; trusted Gitlawb publishing receipts | missing |
| Audit | npm audit | signed advisories, quarantine, transparency and witness checks | partial |
| Provenance | npm provenance | Gitlawb source tag, release event, transparency inclusion and witness proof | partial |
| SBOM | `npm sbom` | agent capability SBOM with manifests, exports, permissions and dependency graph | done |
| Runtime | `npm exec`, scripts | explicit host adapters only; no arbitrary postinstall or default exec | missing |
| Workspaces | npm workspaces | multi package agent workspace and monorepo publishing | missing |

## P0 implementation order

1. Manifest and resolver foundation
   - Accept agent dependency maps in `nipmod.json`.
   - Support semver ranges and dist tags.
   - Fail closed on ambiguous unscoped package names.

2. Lockfile v2
   - Add root importer metadata.
   - Store direct dependency intent separately from resolved package records.
   - Record snapshots: package key, dependency edges, integrity, resolved URL, source tag, trust root and store path.
   - Keep v1 lockfiles readable.

3. Content addressed install store
   - Persist verified bundle bytes under `.nipmod/store/sha256/<digest>/bundle.nipmod`.
   - Add host activation directories later instead of executing install scripts.

4. Graph install
   - Resolve direct and transitive dependencies before mutation.
   - Verify trust, advisory and policy for every node.
   - Write lockfile only after the full graph is ready.

5. Package product surface
   - Add `/packages` browse and `/packages/[name]`.
   - Show Readme, Install, Versions, Dependencies, Provenance, Trust, Advisories and Agent Use.
   - Keep Evidence pages as proof drill down, not the main package page.

## P1 implementation order

1. Lifecycle events
   - `nipmod version`
   - `nipmod dist-tag`
   - `nipmod deprecate`
   - signed deprecation and yank events instead of destructive unpublish

2. Package operations
   - `nipmod outdated`
   - `nipmod uninstall`
   - `nipmod explain`
   - `nipmod ls`

3. Registry API
   - package metadata endpoint
   - version endpoint
   - dist tag endpoint
   - readme endpoint
   - dependencies endpoint
   - provenance endpoint

4. Maintainer model
   - maintainer DID list
   - key rotation
   - org DID proof
   - multi signature package ownership

## P2 implementation order

1. Host activation
   - Codex skill adapter
   - Claude/MCP adapter
   - generic MCP server adapter
   - workflow pack runner metadata
   - policy pack activation

2. Ecosystem scale
   - package claim status
   - author dashboards
   - import from MCP/APM/Gitlawb repos
   - compatibility receipts per format
   - public reviewer receipts

3. Enterprise surfaces
   - private mirror support without central nipmod secrets
   - org policy packs
   - signed allowlists
   - offline registry snapshots

## Anti goals

- No arbitrary postinstall scripts.
- No default package exec.
- No hidden registry write authority.
- No destructive unpublish model for public packages.
- No package install without digest, signature and policy proof.

## Current first slice

The first slice establishes manifest dependency fields, a semver/dist tag resolver, an npm style package document builder, a content addressed local bundle store, package browse/detail pages and basic `ls`/`uninstall` package operations.

The second slice adds additive Registry dependency metadata, v1 readable / v2 written lockfiles, root dependency intent, package snapshots, direct dependency edges and an atomic graph install primitive for pre verified bundles. This is the base for registry driven transitive install, `outdated`, `update`, `explain`, `sbom` and signed lifecycle events.

The third slice adds `nipmod sbom` for verified agent capability inventories from lockfiles and local store bundles. It gives agents one JSON surface for package identity, manifest exports, permission counts and dependency edges without fetching network data.

The fourth slice adds `nipmod explain` for lockfile root intent, dependent records and dependency paths. It gives agents the missing npm style answer to why a package is installed without network access or package execution.

The fifth slice adds `nipmod update` and MCP `nipmod.update_plan` for verified root package updates. Plans are read only, execution reuses the signed graph install path and stale package records are pruned only when they are unreachable from all root dependencies.
